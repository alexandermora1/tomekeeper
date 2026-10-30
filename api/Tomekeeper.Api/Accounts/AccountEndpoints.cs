using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;

namespace Tomekeeper.Api.Accounts;

public sealed record RegisterRequest(string? DisplayName, string? Email, string? Password);
public sealed record SignInRequest(string? Email, string? Password, bool RememberMe);
public sealed record ConfirmEmailRequest(Guid UserId, string? Code);
public sealed record ForgotPasswordRequest(string? Email);
public sealed record ResetPasswordRequest(string? Email, string? Code, string? Password);

public sealed record MeResponse(Guid Id, string DisplayName, string Email, bool EmailConfirmed)
{
    public static MeResponse From(User user) => new(user.Id, user.DisplayName, user.Email ?? "", user.EmailConfirmed);
}

/// <summary>
/// Accounts with email and password. Signing in sets an HttpOnly cookie; the front-end never sees a token.
/// All routes are under /api/account.
/// </summary>
public static class AccountEndpoints
{
    public const string WrongCredentialsMessage = "That email and password don't match an account.";
    public const string LockedOutMessage = "Too many attempts. Wait 15 minutes, or reset your password.";
    public const string BadConfirmationMessage = "This confirmation link doesn't work any more. Sign in and ask for a new one.";
    public const string BadResetMessage = "This reset link doesn't work any more. Ask for a new one.";

    public static RouteGroupBuilder MapAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var account = app.MapGroup("/api/account").WithTags("Account");

        account.MapPost("/register", Register);
        account.MapPost("/sign-in", SignIn);
        account.MapPost("/sign-out", SignOut);
        account.MapGet("/me", Me).RequireAuthorization();
        account.MapPost("/confirm-email", ConfirmEmail);
        account.MapPost("/resend-confirmation", ResendConfirmation).RequireAuthorization();
        account.MapPost("/forgot-password", ForgotPassword);
        account.MapPost("/reset-password", ResetPassword);

        return account;
    }

    /// <summary>Creates the account, signs the reader in and sends a confirmation email.</summary>
    private static async Task<Results<Created<MeResponse>, ValidationProblem>> Register(
        RegisterRequest request,
        UserManager<User> users,
        SignInManager<User> signIn,
        IAccountEmailSender email,
        AccountLinks links,
        CancellationToken cancellationToken)
    {
        var displayName = request.DisplayName?.Trim() ?? "";
        var address = request.Email?.Trim() ?? "";
        var password = request.Password ?? "";
        var errors = new FieldErrors();

        if (displayName.Length == 0) errors.Add("displayName", "Enter the name to show on your profile.");
        else if (displayName.Length > User.DisplayNameMaxLength) errors.Add("displayName", $"Keep the name to {User.DisplayNameMaxLength} characters or fewer.");

        if (address.Length == 0) errors.Add("email", "Enter your email address.");
        else if (!FieldErrors.LooksLikeEmail(address)) errors.Add("email", FieldErrors.InvalidEmailMessage);
        else if (await users.FindByEmailAsync(address) is not null) errors.Add("email", FieldErrors.DuplicateEmailMessage);

        var user = new User
        {
            Id = Guid.CreateVersion7(),
            UserName = address,
            Email = address,
            DisplayName = displayName,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        // Check the password with every validator now, so the reader sees all problems at once.
        if (password.Length == 0) errors.Add("password", "Choose a password.");
        else
        {
            foreach (var validator in users.PasswordValidators)
            {
                var result = await validator.ValidateAsync(users, user, password);
                if (!result.Succeeded) errors.AddIdentityErrors(result.Errors, password);
            }
        }

        if (errors.Any) return errors.ToProblem();

        // The password is already checked, so hash it directly instead of validating it twice
        // (the breach check is a call to an outside service).
        user.PasswordHash = users.PasswordHasher.HashPassword(user, password);
        var created = await users.CreateAsync(user);
        if (!created.Succeeded) return errors.AddIdentityErrors(created.Errors, password).ToProblem();

        await SendConfirmationAsync(user, users, email, links, cancellationToken);
        await signIn.SignInAsync(user, isPersistent: false);
        return TypedResults.Created("/api/account/me", MeResponse.From(user));
    }

    private static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> SignIn(
        SignInRequest request,
        UserManager<User> users,
        SignInManager<User> signIn)
    {
        var address = request.Email?.Trim() ?? "";
        var password = request.Password ?? "";
        var errors = new FieldErrors();
        if (address.Length == 0) errors.Add("email", "Enter your email address.");
        if (password.Length == 0) errors.Add("password", "Enter your password.");
        if (errors.Any) return errors.ToProblem();

        // The same answer whether the email is unknown or the password is wrong, so nobody can find out who has an account.
        var user = await users.FindByEmailAsync(address);
        if (user is null) return Unauthorized(WrongCredentialsMessage);

        var result = await signIn.PasswordSignInAsync(user, password, request.RememberMe, lockoutOnFailure: true);
        if (result.Succeeded) return TypedResults.NoContent();
        return Unauthorized(result.IsLockedOut ? LockedOutMessage : WrongCredentialsMessage);
    }

    private static async Task<NoContent> SignOut(SignInManager<User> signIn)
    {
        await signIn.SignOutAsync();
        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<MeResponse>, UnauthorizedHttpResult>> Me(ClaimsPrincipal principal, UserManager<User> users)
    {
        var user = await users.GetUserAsync(principal);
        return user is null ? TypedResults.Unauthorized() : TypedResults.Ok(MeResponse.From(user));
    }

    private static async Task<Results<NoContent, ProblemHttpResult>> ConfirmEmail(ConfirmEmailRequest request, UserManager<User> users)
    {
        var user = await users.FindByIdAsync(request.UserId.ToString());
        var token = AccountLinks.Decode(request.Code);
        if (user is null || token is null) return BadRequest(BadConfirmationMessage);
        if (user.EmailConfirmed) return TypedResults.NoContent();

        var result = await users.ConfirmEmailAsync(user, token);
        return result.Succeeded ? TypedResults.NoContent() : BadRequest(BadConfirmationMessage);
    }

    private static async Task<Results<NoContent, UnauthorizedHttpResult>> ResendConfirmation(
        ClaimsPrincipal principal,
        UserManager<User> users,
        IAccountEmailSender email,
        AccountLinks links,
        CancellationToken cancellationToken)
    {
        var user = await users.GetUserAsync(principal);
        if (user is null) return TypedResults.Unauthorized();
        if (!user.EmailConfirmed) await SendConfirmationAsync(user, users, email, links, cancellationToken);
        return TypedResults.NoContent();
    }

    /// <summary>Always answers 204, whether or not the email has an account.</summary>
    private static async Task<Results<NoContent, ValidationProblem>> ForgotPassword(
        ForgotPasswordRequest request,
        UserManager<User> users,
        IAccountEmailSender email,
        AccountLinks links,
        CancellationToken cancellationToken)
    {
        var address = request.Email?.Trim() ?? "";
        if (address.Length == 0) return new FieldErrors().Add("email", "Enter your email address.").ToProblem();

        var user = await users.FindByEmailAsync(address);
        if (user is not null)
        {
            var token = await users.GeneratePasswordResetTokenAsync(user);
            await email.SendAsync(AccountEmails.PasswordReset(user, links.PasswordReset(user.Email!, token)), cancellationToken);
        }
        return TypedResults.NoContent();
    }

    private static async Task<Results<NoContent, ValidationProblem, ProblemHttpResult>> ResetPassword(
        ResetPasswordRequest request,
        UserManager<User> users)
    {
        var password = request.Password ?? "";
        if (password.Length == 0) return new FieldErrors().Add("password", "Choose a password.").ToProblem();

        var user = string.IsNullOrWhiteSpace(request.Email) ? null : await users.FindByEmailAsync(request.Email.Trim());
        var token = AccountLinks.Decode(request.Code);
        if (user is null || token is null) return BadRequest(BadResetMessage);

        var result = await users.ResetPasswordAsync(user, token, password);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(e => e.Code == nameof(IdentityErrorDescriber.InvalidToken))) return BadRequest(BadResetMessage);
            return new FieldErrors().AddIdentityErrors(result.Errors, password).ToProblem();
        }

        // The reset link came by email, so the address is proven. Earlier failed attempts no longer count.
        if (!user.EmailConfirmed)
        {
            user.EmailConfirmed = true;
            await users.UpdateAsync(user);
        }
        await users.SetLockoutEndDateAsync(user, null);
        await users.ResetAccessFailedCountAsync(user);
        return TypedResults.NoContent();
    }

    private static async Task SendConfirmationAsync(
        User user, UserManager<User> users, IAccountEmailSender email, AccountLinks links, CancellationToken cancellationToken)
    {
        var token = await users.GenerateEmailConfirmationTokenAsync(user);
        await email.SendAsync(AccountEmails.Confirmation(user, links.Confirmation(user.Id, token)), cancellationToken);
    }

    private static ProblemHttpResult Unauthorized(string detail) =>
        TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Not signed in", detail: detail);

    private static ProblemHttpResult BadRequest(string detail) =>
        TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "That didn't work", detail: detail);
}
