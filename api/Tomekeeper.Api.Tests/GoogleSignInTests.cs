using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using Tomekeeper.Api.Accounts;

namespace Tomekeeper.Api.Tests;

/// <summary>
/// Sign in with Google, from the button to the signed-in reader. The test plays the browser and Google:
/// it follows each redirect by hand, and Google's servers are <see cref="FakeGoogle"/>.
/// </summary>
public sealed class GoogleSignInTests(PostgresFixture database) : IAsyncLifetime
{
    private const string Password = "lantern harbour winter quill";

    private TomekeeperApiFactory _api = null!;
    private HttpClient _browser = null!;
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync()
    {
        _api = new TomekeeperApiFactory(database.ConnectionString);
        _browser = _api.CreateBrowserClient(followRedirects: false);
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _browser.Dispose();
        await _api.DisposeAsync();
    }

    private static GoogleUser NewGoogleUser(string? name = "Ingrid Berg", bool verified = true) =>
        new($"google-{Guid.NewGuid():N}", $"reader-{Guid.NewGuid():N}@gmail.example", verified, name);

    /// <summary>
    /// Press the button, "sign in at Google", come back. Returns where the API sends the browser in the end.
    /// </summary>
    private async Task<string> SignInWithGoogle(GoogleUser user, string returnUrl = "/", HttpClient? browser = null)
    {
        browser ??= _browser;
        _api.Google.NextUser = user;

        var start = await browser.GetAsync($"/api/account/google/start?returnUrl={Uri.EscapeDataString(returnUrl)}", Cancel);
        Assert.Equal(HttpStatusCode.Redirect, start.StatusCode);
        var atGoogle = start.Headers.Location!;
        Assert.Equal("accounts.google.com", atGoogle.Host);

        // Google sends the reader back with a code and the state it was given.
        var state = QueryHelpers.ParseQuery(atGoogle.Query)["state"].ToString();
        var callback = await browser.GetAsync($"{GoogleSignIn.CallbackPath}?code=fake-code&state={Uri.EscapeDataString(state)}", Cancel);
        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);

        var done = await browser.GetAsync(callback.Headers.Location!, Cancel);
        Assert.Equal(HttpStatusCode.Redirect, done.StatusCode);
        return done.Headers.Location!.OriginalString;
    }

    private async Task<MeResponse?> Me(HttpClient? browser = null)
    {
        var response = await (browser ?? _browser).GetAsync("/api/account/me", Cancel);
        return response.IsSuccessStatusCode ? await response.Content.ReadFromJsonAsync<MeResponse>(Cancel) : null;
    }

    private async Task<string> RegisterWithPassword(string email, bool confirm)
    {
        using var other = _api.CreateBrowserClient();
        var response = await other.PostAsJsonAsync("/api/account/register", new { displayName = "Alex", email, password = Password }, Cancel);
        response.EnsureSuccessStatusCode();
        var me = await response.Content.ReadFromJsonAsync<MeResponse>(Cancel);
        if (confirm)
        {
            await using var scope = _api.Services.CreateAsyncScope();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var user = (await users.FindByIdAsync(me!.Id.ToString()))!;
            await users.ConfirmEmailAsync(user, await users.GenerateEmailConfirmationTokenAsync(user));
        }
        return me!.Id.ToString();
    }

    [Fact]
    public async Task The_front_end_can_ask_whether_google_is_set_up()
    {
        var options = await _browser.GetFromJsonAsync<SignInOptionsResponse>("/api/account/sign-in-options", Cancel);
        Assert.True(options!.Google);

        await using var withoutGoogle = new TomekeeperApiFactory(database.ConnectionString, withGoogle: false);
        using var client = withoutGoogle.CreateBrowserClient(followRedirects: false);
        Assert.False((await client.GetFromJsonAsync<SignInOptionsResponse>("/api/account/sign-in-options", Cancel))!.Google);

        var start = await client.GetAsync("/api/account/google/start", Cancel);
        Assert.Equal("/sign-in?google=unavailable", start.Headers.Location!.OriginalString);
    }

    [Fact]
    public async Task The_button_asks_google_only_for_name_and_email()
    {
        var start = await _browser.GetAsync("/api/account/google/start", Cancel);

        var query = QueryHelpers.ParseQuery(start.Headers.Location!.Query);
        Assert.Equal(["openid", "profile", "email"], query["scope"].ToString().Split(' '));
        Assert.Equal("test-client-id", query["client_id"]);
        Assert.EndsWith(GoogleSignIn.CallbackPath, query["redirect_uri"].ToString());
    }

    [Fact]
    public async Task A_new_google_reader_gets_an_account_and_is_signed_in()
    {
        var google = NewGoogleUser();

        var landing = await SignInWithGoogle(google, returnUrl: "/library");

        Assert.Equal("/library", landing);
        var me = await Me();
        Assert.Equal(google.Email, me!.Email);
        Assert.Equal("Ingrid Berg", me.DisplayName);
        Assert.True(me.EmailConfirmed);
        Assert.Null(me.Portrait);
    }

    [Fact]
    public async Task Signing_in_with_google_again_finds_the_same_account()
    {
        var google = NewGoogleUser();
        await SignInWithGoogle(google);
        var first = await Me();

        using var anotherBrowser = _api.CreateBrowserClient(followRedirects: false);
        await SignInWithGoogle(google, browser: anotherBrowser);

        Assert.Equal(first!.Id, (await Me(anotherBrowser))!.Id);
    }

    [Fact]
    public async Task Google_is_linked_to_an_account_with_the_same_confirmed_email()
    {
        var google = NewGoogleUser();
        var id = await RegisterWithPassword(google.Email!, confirm: true);

        await SignInWithGoogle(google);

        Assert.Equal(id, (await Me())!.Id.ToString());
    }

    [Fact]
    public async Task Google_is_not_linked_to_an_account_whose_email_was_never_confirmed()
    {
        var google = NewGoogleUser();
        await RegisterWithPassword(google.Email!, confirm: false);

        var landing = await SignInWithGoogle(google);

        Assert.Equal("/sign-in?google=unconfirmed", landing);
        Assert.Null(await Me());
    }

    [Fact]
    public async Task A_google_account_without_a_verified_email_is_refused()
    {
        var landing = await SignInWithGoogle(NewGoogleUser(verified: false));

        Assert.Equal("/sign-in?google=email", landing);
        Assert.Null(await Me());
    }

    [Fact]
    public async Task Cancelling_at_google_goes_back_to_the_sign_in_page()
    {
        var start = await _browser.GetAsync("/api/account/google/start", Cancel);
        var state = QueryHelpers.ParseQuery(start.Headers.Location!.Query)["state"].ToString();

        var callback = await _browser.GetAsync($"{GoogleSignIn.CallbackPath}?error=access_denied&state={Uri.EscapeDataString(state)}", Cancel);

        Assert.Equal("/sign-in?google=cancelled", callback.Headers.Location!.OriginalString);
    }

    [Fact]
    public async Task An_answer_from_google_that_this_browser_did_not_ask_for_is_refused()
    {
        var start = await _browser.GetAsync("/api/account/google/start", Cancel);
        var state = QueryHelpers.ParseQuery(start.Headers.Location!.Query)["state"].ToString();

        // Another browser, without the cookie from the start: for example a link an attacker sent.
        using var victim = _api.CreateBrowserClient(followRedirects: false);
        var callback = await victim.GetAsync($"{GoogleSignIn.CallbackPath}?code=attackers-code&state={Uri.EscapeDataString(state)}", Cancel);

        Assert.Equal("/sign-in?google=failed", callback.Headers.Location!.OriginalString);
        Assert.Null(await Me(victim));
    }

    [Theory]
    [InlineData("https://evil.example/")]
    [InlineData("//evil.example/")]
    [InlineData("/\\evil.example/")]
    [InlineData("library")]
    public async Task Only_paths_on_this_site_are_followed_afterwards(string returnUrl)
    {
        Assert.Equal("/", await SignInWithGoogle(NewGoogleUser(), returnUrl));
    }

    [Fact]
    public async Task Names_come_from_google_or_from_the_email()
    {
        var longName = new string('x', 60);
        await SignInWithGoogle(NewGoogleUser(name: longName));
        Assert.Equal(new string('x', User.DisplayNameMaxLength), (await Me())!.DisplayName);

        using var second = _api.CreateBrowserClient(followRedirects: false);
        var nameless = NewGoogleUser(name: null);
        await SignInWithGoogle(nameless, browser: second);
        Assert.Equal(nameless.Email!.Split('@')[0], (await Me(second))!.DisplayName);
    }

    [Fact]
    public async Task A_google_reader_deletes_their_account_with_their_email_address_alone()
    {
        var google = NewGoogleUser();
        await SignInWithGoogle(google);
        Assert.False((await Me())!.HasPassword);

        var response = await _browser.PostAsJsonAsync("/api/account/delete", new { email = google.Email }, Cancel);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(await Me());

        // Signing in with Google again makes a new, empty account.
        using var again = _api.CreateBrowserClient(followRedirects: false);
        await SignInWithGoogle(google, browser: again);
        Assert.Null((await Me(again))!.Portrait);
    }

    [Fact]
    public async Task A_google_reader_has_no_password_until_they_choose_one()
    {
        var google = NewGoogleUser();
        await SignInWithGoogle(google);

        using var other = _api.CreateBrowserClient();
        var signIn = await other.PostAsJsonAsync("/api/account/sign-in", new { email = google.Email, password = Password, rememberMe = false }, Cancel);

        Assert.Equal(HttpStatusCode.Unauthorized, signIn.StatusCode);
    }
}
