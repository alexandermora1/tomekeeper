using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Passwords;
using Tomekeeper.Api.Security;

namespace Tomekeeper.Api.Tests;

/// <summary>
/// Starts the real API in memory, pointed at a test database. Emails are kept in <see cref="Emails"/>
/// instead of being sent, the breach check uses <see cref="Breaches"/> instead of the outside service,
/// and Google sign-in talks to <see cref="Google"/> instead of Google.
/// </summary>
public sealed class TomekeeperApiFactory(
    string connectionString,
    string environment = "Development",
    bool withGoogle = true,
    IReadOnlyDictionary<string, string>? settings = null)
    : WebApplicationFactory<Program>
{
    public const string PublicUrl = "http://tomekeeper.test";

    public FakeEmailSender Emails { get; } = new();

    public FakeBreachCheck Breaches { get; } = new();

    public FakeGoogle Google { get; } = new();

    public FakeOpenLibrary OpenLibrary { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        builder.UseSetting("ConnectionStrings:Tomekeeper", connectionString);
        builder.UseSetting("App:PublicUrl", PublicUrl);
        foreach (var (key, value) in settings ?? new Dictionary<string, string>())
        {
            builder.UseSetting(key, value);
        }
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
            // Searches go to the fake Open Library. The throttle in front of it stays, as in the real API.
            services.AddHttpClient<OpenLibraryClient>().ConfigurePrimaryHttpMessageHandler(() => OpenLibrary);
            services.AddHttpClient<OpenLibraryCoverClient>().ConfigurePrimaryHttpMessageHandler(() => OpenLibrary);
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

/// <summary>
/// Plays Open Library's search API: answers search.json from <see cref="Works"/>, the way the real one shapes its
/// answer, and records each request. Set <see cref="Down"/> to act as if Open Library is unavailable.
/// </summary>
public sealed class FakeOpenLibrary : HttpMessageHandler
{
    public List<Dictionary<string, object?>> Works { get; } =
    [
        Work("OL27448W", "The Lord of the Rings", ["J.R.R. Tolkien"], 1954, 1193, 9255566),
        Work("OL893415W", "Dune", ["Frank Herbert"], 1965, 604, 11481354),
        Work("OL5735363W", "The Name of the Wind", ["Patrick Rothfuss"], 2007, 662, null),
    ];

    public ConcurrentQueue<HttpRequestMessage> Requests { get; } = new();

    public bool Down { get; set; }

    /// <summary>Cover ids the fake has a picture for. Every picture is the same few bytes.</summary>
    public HashSet<int> Covers { get; } = [9255566, 11481354];

    public static readonly byte[] CoverBytes = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 0xFF, 0xD9];

    public static Dictionary<string, object?> Work(string key, string title, string[] authors, int? year, int? pages, int? cover) => new()
    {
        ["key"] = $"/works/{key}",
        ["title"] = title,
        ["author_name"] = authors,
        ["first_publish_year"] = year,
        ["number_of_pages_median"] = pages,
        ["cover_i"] = cover,
        ["edition_count"] = 12,
    };

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Enqueue(request);
        if (Down) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var cover = Regex.Match(request.RequestUri!.AbsolutePath, @"^/b/id/(\d+)-[SML]\.jpg$");
        if (cover.Success)
        {
            if (!Covers.Contains(int.Parse(cover.Groups[1].Value))) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
            var content = new ByteArrayContent(CoverBytes);
            content.Headers.ContentType = new("image/jpeg");
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = content });
        }
        if (request.RequestUri!.AbsolutePath != "/search.json") return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));

        var q = QueryHelpers.ParseQuery(request.RequestUri.Query)["q"].ToString();
        var keyMatch = Regex.Match(q, "^key:\"(/works/OL\\d+W)\"$");
        var docs = Works.Where(w => keyMatch.Success
            ? (string)w["key"]! == keyMatch.Groups[1].Value
            : ((string)w["title"]!).Contains(q, StringComparison.OrdinalIgnoreCase)
              || ((string[])w["author_name"]!).Any(a => a.Contains(q, StringComparison.OrdinalIgnoreCase))).ToList();

        // The real API sends both spellings of the total.
        var body = new Dictionary<string, object> { ["numFound"] = docs.Count, ["num_found"] = docs.Count, ["start"] = 0, ["docs"] = docs };
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(body) });
    }
}
