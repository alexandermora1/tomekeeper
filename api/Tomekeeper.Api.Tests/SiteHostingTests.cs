using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Security;

namespace Tomekeeper.Api.Tests;

/// <summary>Running as on Azure: the front-end served by the API, behind a proxy, with Azure email and kept keys.</summary>
public sealed class SiteHostingTests(PostgresFixture database) : IAsyncLifetime
{
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;
    private readonly DirectoryInfo _webRoot = Directory.CreateTempSubdirectory("tomekeeper-web-");

    public ValueTask InitializeAsync()
    {
        // A small stand-in for web/dist.
        File.WriteAllText(Path.Combine(_webRoot.FullName, "index.html"), "<!doctype html><title>Tomekeeper</title><div id=\"root\"></div>");
        Directory.CreateDirectory(Path.Combine(_webRoot.FullName, "assets"));
        File.WriteAllText(Path.Combine(_webRoot.FullName, "assets", "index-Bx7k2.js"), "console.log('hello');");
        return ValueTask.CompletedTask;
    }

    public ValueTask DisposeAsync()
    {
        _webRoot.Delete(recursive: true);
        return ValueTask.CompletedTask;
    }

    private TomekeeperApiFactory Api(Dictionary<string, string>? settings = null, string environment = "Development")
    {
        var all = new Dictionary<string, string> { ["webroot"] = _webRoot.FullName };
        foreach (var (key, value) in settings ?? []) all[key] = value;
        return new TomekeeperApiFactory(database.ConnectionString, environment, settings: all);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/library")]
    [InlineData("/readers/ingrid")]
    public async Task Pages_of_the_front_end_get_index_html(string path)
    {
        await using var api = Api();
        using var client = api.CreateClient();

        var response = await client.GetAsync(path, Cancel);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("<div id=\"root\">", await response.Content.ReadAsStringAsync(Cancel));
        Assert.Equal("no-cache", response.Headers.CacheControl?.ToString());
        Assert.Equal(SecurityHeaders.PageContentSecurityPolicy, response.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
    }

    [Fact]
    public async Task Built_files_are_kept_by_browsers_for_a_year()
    {
        await using var api = Api();
        using var client = api.CreateClient();

        var response = await client.GetAsync("/assets/index-Bx7k2.js", Cancel);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("public, max-age=31536000, immutable", response.Headers.NonValidated["Cache-Control"].ToString());
    }

    [Fact]
    public async Task Unknown_api_addresses_are_still_a_plain_404()
    {
        await using var api = Api();
        using var client = api.CreateClient();

        var response = await client.GetAsync("/api/no-such-thing", Cancel);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(SecurityHeaders.ApiContentSecurityPolicy, response.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/health/live", Cancel)).StatusCode);
    }

    [Theory]
    [InlineData(true, "https")]
    [InlineData(false, "http")]
    public async Task Behind_the_proxy_google_sends_readers_back_over_https(bool behindProxy, string scheme)
    {
        await using var api = Api(new() { [SiteHosting.BehindProxyKey] = behindProxy.ToString() });
        using var client = api.CreateBrowserClient(followRedirects: false);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/account/google/start");
        request.Headers.Add("X-Forwarded-Proto", "https");
        request.Headers.Add("X-Forwarded-For", "203.0.113.7");

        var start = await client.SendAsync(request, Cancel);

        var redirect = QueryHelpers.ParseQuery(start.Headers.Location!.Query)["redirect_uri"].ToString();
        Assert.StartsWith($"{scheme}://", redirect);
    }

    [Fact]
    public async Task Outside_development_emails_go_through_azure_when_it_is_set_up()
    {
        await using var api = Api(new()
        {
            ["Email:AzureConnectionString"] = "endpoint=https://tomekeeper-test.europe.communication.azure.com/;accesskey=" + Convert.ToBase64String(new byte[32]),
            ["Email:Sender"] = "DoNotReply@example.azurecomm.net",
        }, environment: "Production");

        // The tests put their own fake last; the app's choice is the one before it.
        var senders = api.Services.GetServices<IAccountEmailSender>().ToList();

        Assert.IsType<AzureEmailSender>(senders[0]);
    }

    [Fact]
    public async Task Without_azure_email_nothing_is_sent_outside_development()
    {
        await using var api = Api(environment: "Production");

        Assert.IsType<NotConfiguredEmailSender>(api.Services.GetServices<IAccountEmailSender>().First());
    }

    [Fact]
    public async Task Sign_in_keys_are_kept_in_the_folder_set_for_them()
    {
        var keys = Directory.CreateTempSubdirectory("tomekeeper-keys-");
        try
        {
            await using var api = Api(new() { ["DataProtection:KeysPath"] = keys.FullName });
            using var client = api.CreateBrowserClient();

            (await client.PostAsJsonAsync("/api/account/register",
                new { displayName = "Kari", email = $"reader-{Guid.NewGuid():N}@example.no", password = "lantern harbour winter quill" }, Cancel))
                .EnsureSuccessStatusCode();

            Assert.NotEmpty(keys.GetFiles("key-*.xml"));
        }
        finally
        {
            keys.Delete(recursive: true);
        }
    }
}
