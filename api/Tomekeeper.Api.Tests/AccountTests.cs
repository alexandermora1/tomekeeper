using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Security;

namespace Tomekeeper.Api.Tests;

public sealed class AccountTests(PostgresFixture database) : IAsyncLifetime
{
    private const string GoodPassword = "lantern harbour winter quill";

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

    /// <summary>A fresh address per test, so tests sharing the database never collide.</summary>
    private static string NewEmail() => $"reader-{Guid.NewGuid():N}@example.no";

    private Task<HttpResponseMessage> Register(string? displayName, string? email, string? password) =>
        _client.PostAsJsonAsync("/api/account/register", new { displayName, email, password }, Cancel);

    private Task<HttpResponseMessage> SignIn(string email, string password, bool rememberMe = false) =>
        _client.PostAsJsonAsync("/api/account/sign-in", new { email, password, rememberMe }, Cancel);

    private async Task<Dictionary<string, string[]>> FieldErrors(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        return problem.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    private async Task<string> Detail(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>(Cancel)).GetProperty("detail").GetString()!;

    // Signing up

    [Fact]
    public async Task Signing_up_creates_the_account_signs_in_and_sends_a_confirmation_email()
    {
        var email = NewEmail();

        var response = await Register("Alex", email, GoodPassword);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<MeResponse>(Cancel);
        Assert.Equal("Alex", created!.DisplayName);
        Assert.False(created.EmailConfirmed);

        var me = await _client.GetFromJsonAsync<MeResponse>("/api/account/me", Cancel);
        Assert.Equal(email, me!.Email);

        var link = _api.Emails.LatestLinkTo(email);
        Assert.StartsWith($"{TomekeeperApiFactory.PublicUrl}/confirm-email?", link.ToString());
    }

    [Fact]
    public async Task Signing_up_reports_every_missing_field_at_once()
    {
        var errors = await FieldErrors(await Register("", "", ""));

        Assert.Equal(["Enter the name to show on your profile."], errors["displayName"]);
        Assert.Equal(["Enter your email address."], errors["email"]);
        Assert.Equal(["Choose a password."], errors["password"]);
    }

    [Fact]
    public async Task A_short_password_says_how_long_it_is()
    {
        var errors = await FieldErrors(await Register("Alex", NewEmail(), "bookworm1"));

        Assert.Equal(["Make the password at least 15 characters. It has 9."], errors["password"]);
    }

    [Theory]
    [InlineData("passwordpassword")]
    [InlineData("1qaz2wsx3edc4rfv")]
    [InlineData("sunshine12345678")]
    public async Task An_easy_password_is_refused(string password)
    {
        var errors = await FieldErrors(await Register("Alex", NewEmail(), password));

        Assert.Equal(["That password is too easy to guess. Try a few unrelated words."], errors["password"]);
    }

    [Fact]
    public async Task A_password_with_the_readers_name_is_refused()
    {
        var errors = await FieldErrors(await Register("Ingrid Berg", NewEmail(), "ingrid reads every night"));

        Assert.Equal(["Don't use your name or email address in the password."], errors["password"]);
    }

    [Fact]
    public async Task A_breached_password_is_refused()
    {
        _api.Breaches.Breached.Add("correct horse battery staple");

        var errors = await FieldErrors(await Register("Alex", NewEmail(), "correct horse battery staple"));

        Assert.Equal(["That password has appeared in a data breach, so attackers will try it. Choose another."], errors["password"]);
    }

    [Fact]
    public async Task An_email_can_only_have_one_account()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);

        var errors = await FieldErrors(await Register("Someone else", email.ToUpperInvariant(), GoodPassword + " again"));

        Assert.Equal([Accounts.FieldErrors.DuplicateEmailMessage], errors["email"]);
    }

    [Fact]
    public async Task A_malformed_email_is_refused()
    {
        var errors = await FieldErrors(await Register("Alex", "alex@", GoodPassword));

        Assert.Equal([Accounts.FieldErrors.InvalidEmailMessage], errors["email"]);
    }

    // Confirming the email

    [Fact]
    public async Task The_link_in_the_email_confirms_the_address()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);
        var query = QueryHelpers.ParseQuery(_api.Emails.LatestLinkTo(email).Query);

        var response = await _client.PostAsJsonAsync("/api/account/confirm-email",
            new { userId = query["userId"].ToString(), code = query["code"].ToString() }, Cancel);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var me = await _client.GetFromJsonAsync<MeResponse>("/api/account/me", Cancel);
        Assert.True(me!.EmailConfirmed);
    }

    [Fact]
    public async Task A_broken_confirmation_code_is_refused()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);
        var query = QueryHelpers.ParseQuery(_api.Emails.LatestLinkTo(email).Query);

        var response = await _client.PostAsJsonAsync("/api/account/confirm-email",
            new { userId = query["userId"].ToString(), code = "not-the-code" }, Cancel);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(AccountEndpoints.BadConfirmationMessage, await Detail(response));
    }

    [Fact]
    public async Task A_signed_in_reader_can_ask_for_a_new_confirmation_email()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);

        var response = await _client.PostAsync("/api/account/resend-confirmation", null, Cancel);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(2, _api.Emails.Sent.Count(e => e.To == email));
    }

    // Signing in and out

    [Fact]
    public async Task Signing_out_and_in_again()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);

        Assert.Equal(HttpStatusCode.NoContent, (await _client.PostAsync("/api/account/sign-out", null, Cancel)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/account/me", Cancel)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await SignIn(email, GoodPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync("/api/account/me", Cancel)).StatusCode);
    }

    [Fact]
    public async Task The_sign_in_cookie_is_http_only_and_same_site()
    {
        var response = await Register("Alex", NewEmail(), GoodPassword);

        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("tomekeeper.auth=", StringComparison.Ordinal));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", cookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A_wrong_password_and_an_unknown_email_get_the_same_answer()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);
        await _client.PostAsync("/api/account/sign-out", null, Cancel);

        var wrongPassword = await SignIn(email, "not the right password at all");
        var unknownEmail = await SignIn(NewEmail(), GoodPassword);

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        Assert.Equal(AccountEndpoints.WrongCredentialsMessage, await Detail(wrongPassword));
        Assert.Equal(AccountEndpoints.WrongCredentialsMessage, await Detail(unknownEmail));
    }

    [Fact]
    public async Task Five_wrong_passwords_lock_the_account()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);
        await _client.PostAsync("/api/account/sign-out", null, Cancel);

        for (var i = 0; i < 5; i++) await SignIn(email, $"wrong password number {i}");
        var response = await SignIn(email, GoodPassword);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(AccountEndpoints.LockedOutMessage, await Detail(response));
    }

    [Fact]
    public async Task Me_needs_a_signed_in_reader()
    {
        var response = await _client.GetAsync("/api/account/me", Cancel);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // Forgotten passwords

    [Fact]
    public async Task A_reader_can_reset_a_forgotten_password()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);
        await _client.PostAsync("/api/account/sign-out", null, Cancel);

        var asked = await _client.PostAsJsonAsync("/api/account/forgot-password", new { email }, Cancel);
        Assert.Equal(HttpStatusCode.NoContent, asked.StatusCode);
        var link = _api.Emails.LatestLinkTo(email);
        Assert.StartsWith($"{TomekeeperApiFactory.PublicUrl}/reset-password?", link.ToString());
        var query = QueryHelpers.ParseQuery(link.Query);

        const string newPassword = "pigeon cathedral marmalade";
        var reset = await _client.PostAsJsonAsync("/api/account/reset-password",
            new { email = query["email"].ToString(), code = query["code"].ToString(), password = newPassword }, Cancel);

        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await SignIn(email, GoodPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await SignIn(email, newPassword)).StatusCode);
        var me = await _client.GetFromJsonAsync<MeResponse>("/api/account/me", Cancel);
        Assert.True(me!.EmailConfirmed);
    }

    [Fact]
    public async Task Asking_for_a_reset_does_not_reveal_whether_an_account_exists()
    {
        var email = NewEmail();

        var response = await _client.PostAsJsonAsync("/api/account/forgot-password", new { email }, Cancel);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.DoesNotContain(_api.Emails.Sent, e => e.To == email);
    }

    [Fact]
    public async Task The_new_password_must_follow_the_rules()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);
        await _client.PostAsJsonAsync("/api/account/forgot-password", new { email }, Cancel);
        var query = QueryHelpers.ParseQuery(_api.Emails.LatestLinkTo(email).Query);

        var reset = await _client.PostAsJsonAsync("/api/account/reset-password",
            new { email, code = query["code"].ToString(), password = "short" }, Cancel);

        Assert.Equal(["Make the password at least 15 characters. It has 5."], (await FieldErrors(reset))["password"]);
    }

    [Fact]
    public async Task A_broken_reset_code_is_refused()
    {
        var email = NewEmail();
        await Register("Alex", email, GoodPassword);

        var reset = await _client.PostAsJsonAsync("/api/account/reset-password",
            new { email, code = "bm90LWEtcmVhbC10b2tlbg", password = "pigeon cathedral marmalade" }, Cancel);

        Assert.Equal(HttpStatusCode.BadRequest, reset.StatusCode);
        Assert.Equal(AccountEndpoints.BadResetMessage, await Detail(reset));
    }

    // Cross-site request forgery

    [Fact]
    public async Task Requests_that_change_something_need_our_header()
    {
        using var plain = _api.CreateClient();

        var response = await plain.PostAsJsonAsync("/api/account/sign-in", new { email = NewEmail(), password = GoodPassword }, Cancel);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains(RequestHeaderGuard.HeaderName, await Detail(response));
    }
}
