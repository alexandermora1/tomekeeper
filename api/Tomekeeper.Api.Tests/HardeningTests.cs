using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Security;

namespace Tomekeeper.Api.Tests;

/// <summary>Rate limits, security headers and deleting an account.</summary>
public sealed class HardeningTests(PostgresFixture database) : IAsyncLifetime
{
    private const string Password = "lantern harbour winter quill";

    private TomekeeperApiFactory _api = null!;
    private HttpClient _client = null!;
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync()
    {
        _api = new TomekeeperApiFactory(database.ConnectionString);
        _client = _api.CreateBrowserClient();
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _api.DisposeAsync();
    }

    private static string NewEmail() => $"reader-{Guid.NewGuid():N}@example.no";

    private async Task<string> SignUp(HttpClient client)
    {
        var email = NewEmail();
        var response = await client.PostAsJsonAsync("/api/account/register", new { displayName = "Alex", email, password = Password }, Cancel);
        response.EnsureSuccessStatusCode();
        return email;
    }

    private static async Task<JsonElement> Problem(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);

    // Rate limits

    [Fact]
    public async Task Too_many_sign_in_attempts_from_one_address_are_refused_for_a_while()
    {
        await using var api = new TomekeeperApiFactory(database.ConnectionString,
            settings: new Dictionary<string, string> { ["RateLimits:AccountRequestsPerMinute"] = "3" });
        using var client = api.CreateBrowserClient();

        for (var i = 0; i < 3; i++)
        {
            var allowed = await client.PostAsJsonAsync("/api/account/sign-in", new { email = NewEmail(), password = Password }, Cancel);
            Assert.Equal(HttpStatusCode.Unauthorized, allowed.StatusCode);
        }
        var refused = await client.PostAsJsonAsync("/api/account/sign-in", new { email = NewEmail(), password = Password }, Cancel);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.True(refused.Headers.RetryAfter?.Delta > TimeSpan.Zero);
        Assert.Equal(RateLimits.TooManyMessage, (await Problem(refused)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Asking_for_emails_has_its_own_stricter_limit()
    {
        await using var api = new TomekeeperApiFactory(database.ConnectionString,
            settings: new Dictionary<string, string> { ["RateLimits:EmailRequestsPer15Minutes"] = "2" });
        using var client = api.CreateBrowserClient();

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 3; i++)
        {
            statuses.Add((await client.PostAsJsonAsync("/api/account/forgot-password", new { email = NewEmail() }, Cancel)).StatusCode);
        }

        Assert.Equal([HttpStatusCode.NoContent, HttpStatusCode.NoContent, HttpStatusCode.TooManyRequests], statuses);
    }

    [Fact]
    public async Task At_most_three_reset_emails_go_to_one_address_an_hour()
    {
        var email = await SignUp(_client);

        for (var i = 0; i < 5; i++)
        {
            // Asked from "different places": the limit per address holds however the requests arrive.
            var response = await _client.PostAsJsonAsync("/api/account/forgot-password", new { email = email.ToUpperInvariant() }, Cancel);
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        Assert.Equal(3, _api.Emails.Sent.Count(e => e.To == email && e.Subject.Contains("Reset")));
    }

    // Security headers

    [Theory]
    [InlineData("/api/health/live")]
    [InlineData("/api/account/me")]
    [InlineData("/api/no-such-thing")]
    public async Task Every_api_answer_carries_the_security_headers(string path)
    {
        var response = await _client.GetAsync(path, Cancel);

        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal(SecurityHeaders.ApiContentSecurityPolicy, response.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.True(response.Headers.CacheControl?.NoStore);
    }

    // Deleting an account

    private Task<HttpResponseMessage> Delete(string? email, string? password, HttpClient? client = null) =>
        (client ?? _client).PostAsJsonAsync("/api/account/delete", new { email, password }, Cancel);

    [Fact]
    public async Task Deleting_the_account_removes_it_and_everything_in_it()
    {
        var email = await SignUp(_client);
        var me = await _client.GetFromJsonAsync<MeResponse>("/api/account/me", Cancel);
        await _client.PutAsJsonAsync($"/api/goals/{DateTimeOffset.UtcNow.Year}", new { kind = "pages", pages = 1500 }, Cancel);

        var response = await Delete(email.ToUpperInvariant(), Password);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/account/me", Cancel)).StatusCode);
        await using (var scope = _api.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>();
            Assert.False(db.Users.Any(u => u.Id == me!.Id));
            Assert.False(db.Goals.Any(g => g.UserId == me!.Id));
        }
        Assert.Contains(_api.Emails.Sent, e => e.To == email && e.Subject == "Your Tomekeeper account is deleted");

        // The address is free again.
        using var again = _api.CreateBrowserClient();
        var signUpAgain = await again.PostAsJsonAsync("/api/account/register", new { displayName = "Alex", email, password = Password }, Cancel);
        Assert.Equal(HttpStatusCode.Created, signUpAgain.StatusCode);
    }

    [Fact]
    public async Task Deleting_needs_the_email_address_and_the_password()
    {
        await SignUp(_client);

        var missing = await Problem(await Delete("", ""));
        Assert.Equal("Type your email address to confirm.", missing.GetProperty("errors").GetProperty("email")[0].GetString());
        Assert.Equal("Enter your password.", missing.GetProperty("errors").GetProperty("password")[0].GetString());

        var wrongEmail = await Problem(await Delete("someone.else@example.no", Password));
        Assert.Equal("That isn't the email address of this account.", wrongEmail.GetProperty("errors").GetProperty("email")[0].GetString());

        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/account/me", Cancel)).StatusCode);
    }

    [Fact]
    public async Task A_wrong_password_does_not_delete_and_counts_towards_the_lockout()
    {
        var email = await SignUp(_client);

        var wrong = await Problem(await Delete(email, "not the right password at all"));
        Assert.Equal("That password isn't right.", wrong.GetProperty("errors").GetProperty("password")[0].GetString());

        await using var scope = _api.Services.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<User>>();
        var user = await users.FindByEmailAsync(email);
        Assert.NotNull(user);
        Assert.Equal(1, await users.GetAccessFailedCountAsync(user));
    }

    [Fact]
    public async Task Deleting_needs_a_signed_in_reader()
    {
        using var visitor = _api.CreateBrowserClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Delete("someone@example.no", Password, visitor)).StatusCode);
    }

    [Fact]
    public async Task Me_says_whether_the_reader_has_a_password()
    {
        await SignUp(_client);
        Assert.True((await _client.GetFromJsonAsync<MeResponse>("/api/account/me", Cancel))!.HasPassword);
    }
}
