using System.Collections.Concurrent;
using System.Text.RegularExpressions;
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
/// instead of being sent, and the breach check uses <see cref="Breaches"/> instead of the outside service.
/// </summary>
public sealed class TomekeeperApiFactory(string connectionString, string environment = "Development")
    : WebApplicationFactory<Program>
{
    public const string PublicUrl = "http://tomekeeper.test";

    public FakeEmailSender Emails { get; } = new();

    public FakeBreachCheck Breaches { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        builder.UseSetting("ConnectionStrings:Tomekeeper", connectionString);
        builder.UseSetting("App:PublicUrl", PublicUrl);
        builder.ConfigureTestServices(services =>
        {
            services.AddSingleton<IAccountEmailSender>(Emails);
            services.AddSingleton<IBreachedPasswordCheck>(Breaches);
        });
    }

    /// <summary>A client that keeps cookies, like a browser, and sends the header our front-end sends.</summary>
    public HttpClient CreateBrowserClient()
    {
        var client = CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = true });
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
