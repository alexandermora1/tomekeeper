using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Passwords;
using Tomekeeper.Api.Security;

namespace Tomekeeper.Api.Tests;

/// <summary>
/// Starts the real API in memory, pointed at a test database. Emails are kept in <see cref="Emails"/>
/// instead of being sent, the breach check uses <see cref="Breaches"/> instead of the outside service,
/// and Google sign-in talks to <see cref="Google"/> instead of Google.
/// </summary>
public sealed class TomekeeperApiFactory(string connectionString, string environment = "Development", bool withGoogle = true)
    : WebApplicationFactory<Program>
{
    public const string PublicUrl = "http://tomekeeper.test";

    public FakeEmailSender Emails { get; } = new();

    public FakeBreachCheck Breaches { get; } = new();

    public FakeGoogle Google { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        builder.UseSetting("ConnectionStrings:Tomekeeper", connectionString);
        builder.UseSetting("App:PublicUrl", PublicUrl);
        if (withGoogle)
        {
            builder.UseSetting(GoogleSignIn.ClientIdKey, "test-client-id");
            builder.UseSetting(GoogleSignIn.ClientSecretKey, "test-client-secret");
        }
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IAccountEmailSender>(Emails);
            services.AddSingleton<IBreachedPasswordCheck>(Breaches);
            // Calls that would go to Google's servers (code for token, then who the reader is) go to the fake.
            services.Configure<GoogleOptions>(GoogleDefaults.AuthenticationScheme, options => options.BackchannelHttpHandler = Google);
        });
    }

    /// <summary>
    /// A client that keeps cookies, like a browser, and sends the header our front-end sends.
    /// With followRedirects: false it stops at each redirect, so a test can play Google's part.
    /// </summary>
    public HttpClient CreateBrowserClient(bool followRedirects = true)
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true, AllowAutoRedirect = followRedirects });
        client.DefaultRequestHeaders.Add(RequestHeaderGuard.HeaderName, "1");
        return client;
    }
}

public sealed partial class FakeEmailSender : IAccountEmailSender
{
    private readonly ConcurrentQueue<AccountEmail> _sent = new();

    public IReadOnlyList<AccountEmail> Sent => _sent.ToList();

    public Task SendAsync(AccountEmail email, CancellationToken cancellationToken)
    {
        _sent.Enqueue(email);
        return Task.CompletedTask;
    }

    /// <summary>The link in the latest email to an address.</summary>
    public Uri LatestLinkTo(string address)
    {
        var email = _sent.LastOrDefault(e => e.To == address)
            ?? throw new InvalidOperationException($"No email was sent to {address}.");
        return new Uri(LinkPattern().Match(email.Body).Value);
    }

    [GeneratedRegex(@"https?://\S+")]
    private static partial Regex LinkPattern();
}

public sealed class FakeBreachCheck : IBreachedPasswordCheck
{
    public HashSet<string> Breached { get; } = [];

    public Task<BreachResult> CheckAsync(string password, CancellationToken cancellationToken) =>
        Task.FromResult(Breached.Contains(password) ? BreachResult.Breached : BreachResult.NotFound);
}

/// <summary>
/// Plays Google's servers: trades any code for a token, then answers "who is this?" with <see cref="NextUser"/>.
/// </summary>
public sealed class FakeGoogle : HttpMessageHandler
{
    /// <summary>The Google account the next sign-in comes back as.</summary>
    public GoogleUser NextUser { get; set; } = new("google-id-1", "reader@gmail.example", true, "Ingrid Berg");

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var url = request.RequestUri!.GetLeftPart(UriPartial.Path);
        if (url == GoogleDefaults.TokenEndpoint)
        {
            return Json(new Dictionary<string, object> { ["access_token"] = "fake-access-token", ["token_type"] = "Bearer", ["expires_in"] = 3600 });
        }
        if (url == GoogleDefaults.UserInformationEndpoint)
        {
            var user = new Dictionary<string, object?> { ["sub"] = NextUser.Id, ["email_verified"] = NextUser.EmailVerified };
            if (NextUser.Email is not null) user["email"] = NextUser.Email;
            if (NextUser.Name is not null) user["name"] = NextUser.Name;
            return Json(user);
        }
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
    }

    private static Task<HttpResponseMessage> Json(object body) =>
        Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(body) });
}

/// <param name="Id">Google's id for the account ("sub"), which never changes.</param>
public sealed record GoogleUser(string Id, string? Email, bool EmailVerified, string? Name);
