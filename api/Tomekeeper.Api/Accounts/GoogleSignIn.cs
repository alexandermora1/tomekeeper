using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Identity;

namespace Tomekeeper.Api.Accounts;

public sealed record SignInOptionsResponse(bool Google);

/// <summary>
/// "Sign in with Google", the server-side way: the button is a plain link to /api/account/google/start, the
/// reader signs in on Google's own page, and Google sends them back to /api/account/google/callback. No Google
/// script runs on Tomekeeper's pages, and the browser never sees a Google token.
///
/// It is only switched on when Authentication:Google:ClientId and ClientSecret are set (locally with
/// `dotnet user-secrets`, see the README). Without them the button doesn't show.
/// </summary>
public static class GoogleSignIn
{
    public const string ClientIdKey = "Authentication:Google:ClientId";
    public const string ClientSecretKey = "Authentication:Google:ClientSecret";
    public const string CallbackPath = "/api/account/google/callback";
    private const string EmailVerifiedClaim = "email_verified";

    /// <summary>Why a Google sign-in didn't work, sent to the sign-in page as ?google=…, which explains it.</summary>
    public static class Problem
    {
        public const string Cancelled = "cancelled";
        public const string Failed = "failed";
        public const string NoVerifiedEmail = "email";
        public const string UnconfirmedAccount = "unconfirmed";
        public const string LockedOut = "locked";
        public const string Unavailable = "unavailable";
    }

    public static bool IsConfigured(IConfiguration configuration) =>
        !string.IsNullOrWhiteSpace(configuration[ClientIdKey]) && !string.IsNullOrWhiteSpace(configuration[ClientSecretKey]);

    public static AuthenticationBuilder AddGoogleSignIn(this AuthenticationBuilder authentication, IConfiguration configuration, IHostEnvironment environment)
    {
        if (!IsConfigured(configuration)) return authentication;

        return authentication.AddGoogle(options =>
        {
            options.ClientId = configuration[ClientIdKey]!;
            options.ClientSecret = configuration[ClientSecretKey]!;
            options.CallbackPath = CallbackPath;
            // Google's answer goes into Identity's short-lived "external" cookie until /google/done has read it.
            options.SignInScheme = IdentityConstants.ExternalScheme;
            // The scopes are openid, profile and email: name and address, nothing else. The photo isn't used.
            options.ClaimActions.MapJsonKey(EmailVerifiedClaim, EmailVerifiedClaim);

            // The cookie that ties Google's answer to this browser. Google sends the reader back with a normal
            // link (GET), so SameSite=Lax is enough. Locally the site runs on plain http.
            options.CorrelationCookie.SameSite = SameSiteMode.Lax;
            options.CorrelationCookie.SecurePolicy =
                environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;

            options.Events.OnAccessDenied = context =>
            {
                context.Response.Redirect(SignInPage(Problem.Cancelled));
                context.HandleResponse();
                return Task.CompletedTask;
            };
            options.Events.OnRemoteFailure = context =>
            {
                context.Response.Redirect(SignInPage(Problem.Failed));
                context.HandleResponse();
                return Task.CompletedTask;
            };
        });
    }

    public static void MapGoogleSignIn(this RouteGroupBuilder account)
    {
        account.MapGet("/sign-in-options", async (IAuthenticationSchemeProvider schemes) =>
            TypedResults.Ok(new SignInOptionsResponse(Google: await IsAvailable(schemes))));
        account.MapGet("/google/start", Start);
        account.MapGet("/google/done", Done);
    }

    private static async Task<bool> IsAvailable(IAuthenticationSchemeProvider schemes) =>
        await schemes.GetSchemeAsync(GoogleDefaults.AuthenticationScheme) is not null;

    /// <summary>Sends the reader to Google's sign-in page.</summary>
    private static async Task<IResult> Start(string? returnUrl, SignInManager<User> signIn, IAuthenticationSchemeProvider schemes)
    {
        if (!await IsAvailable(schemes)) return Results.Redirect(SignInPage(Problem.Unavailable));

        var done = $"/api/account/google/done?returnUrl={Uri.EscapeDataString(LocalPath(returnUrl))}";
        var properties = signIn.ConfigureExternalAuthenticationProperties(GoogleDefaults.AuthenticationScheme, done);
        return Results.Challenge(properties, [GoogleDefaults.AuthenticationScheme]);
    }

    /// <summary>
    /// Google has said who the reader is. Sign in the account linked to that Google account; or link Google to
    /// the account with the same confirmed email; or create a new account. Then go back to the front-end.
    /// </summary>
    private static async Task<IResult> Done(
        string? returnUrl,
        HttpContext http,
        SignInManager<User> signIn,
        UserManager<User> users,
        TimeProvider time)
    {
        var info = await signIn.GetExternalLoginInfoAsync();
        if (info is null) return Results.Redirect(SignInPage(Problem.Failed));

        // A reader who has used Google here before.
        var result = await signIn.ExternalLoginSignInAsync(info.LoginProvider, info.ProviderKey, isPersistent: true, bypassTwoFactor: true);
        if (result.Succeeded) return Results.Redirect(LocalPath(returnUrl));
        if (result.IsLockedOut) return await Refuse(http, Problem.LockedOut);

        var email = info.Principal.FindFirstValue(ClaimTypes.Email)?.Trim();
        var emailVerified = string.Equals(info.Principal.FindFirstValue(EmailVerifiedClaim), "true", StringComparison.OrdinalIgnoreCase);
        if (string.IsNullOrEmpty(email) || !emailVerified) return await Refuse(http, Problem.NoVerifiedEmail);

        var user = await users.FindByEmailAsync(email);
        if (user is not null)
        {
            // Someone could sign up with another person's address and a password, then wait for the real owner
            // to arrive with Google. So Google is only linked to accounts whose address has been confirmed.
            if (!user.EmailConfirmed) return await Refuse(http, Problem.UnconfirmedAccount);
            if (await users.IsLockedOutAsync(user)) return await Refuse(http, Problem.LockedOut);
        }
        else
        {
            user = new User
            {
                Id = Guid.CreateVersion7(),
                UserName = email,
                Email = email,
                // Google has checked the address.
                EmailConfirmed = true,
                DisplayName = DisplayNameFrom(info.Principal, email),
                CreatedAt = time.GetUtcNow(),
            };
            // No password: this reader signs in with Google. "Forgot your password?" can add one later.
            if (!(await users.CreateAsync(user)).Succeeded) return await Refuse(http, Problem.Failed);
        }

        if (!(await users.AddLoginAsync(user, info)).Succeeded) return await Refuse(http, Problem.Failed);

        await signIn.SignInAsync(user, isPersistent: true, info.LoginProvider);
        await http.SignOutAsync(IdentityConstants.ExternalScheme);
        return Results.Redirect(LocalPath(returnUrl));
    }

    private static async Task<IResult> Refuse(HttpContext http, string problem)
    {
        await http.SignOutAsync(IdentityConstants.ExternalScheme);
        return Results.Redirect(SignInPage(problem));
    }

    private static string SignInPage(string problem) => $"/sign-in?google={problem}";

    /// <summary>The name from Google, or the first part of the email address, cut to the length the site allows.</summary>
    internal static string DisplayNameFrom(ClaimsPrincipal principal, string email)
    {
        var name = principal.FindFirstValue(ClaimTypes.Name)?.Trim();
        if (string.IsNullOrEmpty(name)) name = email.Split('@')[0];
        return name.Length <= User.DisplayNameMaxLength ? name : name[..User.DisplayNameMaxLength].TrimEnd();
    }

    /// <summary>Only paths on this site, such as "/" or "/library", so the link can't send readers elsewhere.</summary>
    internal static string LocalPath(string? returnUrl) =>
        returnUrl is { Length: > 0 }
        && returnUrl[0] == '/'
        && (returnUrl.Length == 1 || (returnUrl[1] != '/' && returnUrl[1] != '\\'))
        && !returnUrl.Any(char.IsControl)
            ? returnUrl
            : "/";
}
