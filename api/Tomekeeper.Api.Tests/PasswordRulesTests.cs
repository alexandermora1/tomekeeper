using System.Net;
using Microsoft.Extensions.Logging.Abstractions;
using Tomekeeper.Api.Passwords;

namespace Tomekeeper.Api.Tests;

public sealed class PasswordRulesTests
{
    [Theory]
    [InlineData("lantern harbour winter quill")]
    [InlineData("Kettles sing at 4am in Bergen")]
    [InlineData("my-cat-prefers-erikson")]
    public void Accepts_long_unusual_passwords(string password) =>
        Assert.Null(PasswordRules.Check(password, "reader@example.no", "Alex"));

    [Fact]
    public void Wants_at_least_15_characters() =>
        Assert.Equal(PasswordProblem.TooShort, PasswordRules.Check("fourteen chars", null, null));

    [Fact]
    public void Allows_long_passwords_up_to_256_characters()
    {
        var words = string.Join(" ", Enumerable.Range(1, 80).Select(i => $"folio{i}"));
        Assert.Null(PasswordRules.Check(words[..256], null, null));
        Assert.Equal(PasswordProblem.TooLong, PasswordRules.Check(words[..257], null, null));
    }

    [Theory]
    [InlineData("passwordpassword")]          // repeated
    [InlineData("abcabcabcabcabcabc")]        // repeated
    [InlineData("aaaaaaaaaaaaaaaa")]          // one character
    [InlineData("1qaz2wsx3edc4rfv")]          // keyboard columns
    [InlineData("qwertyuiop12345")]           // keyboard row and digits
    [InlineData("123456789987654321")]        // counting up and down
    [InlineData("zxcvbnm123456789")]          // keyboard row and digits
    [InlineData("sunshine12345678")]          // common word plus digits
    [InlineData("!!dragon2024!!!!")]          // common word with digits and symbols around it
    [InlineData("mailcreated5240")]           // on the common password list
    [InlineData("I love Tomekeeper!")]        // the site's own name
    public void Refuses_passwords_that_are_easy_to_guess(string password) =>
        Assert.Equal(PasswordProblem.TooEasyToGuess, PasswordRules.Check(password, null, null));

    [Theory]
    [InlineData("alexander.mora@example.no", "Alex", "mora reads late into the night")]
    [InlineData("reader@example.no", "Ingrid Berg", "ingrid likes long books a lot")]
    [InlineData("reader@example.no", "Ingrid Berg", "my reader password is long")]
    public void Refuses_passwords_with_the_readers_name_or_email(string email, string displayName, string password) =>
        Assert.Equal(PasswordProblem.ContainsPersonalInfo, PasswordRules.Check(password, email, displayName));

    [Fact]
    public void Short_name_parts_do_not_count_as_personal_info() =>
        Assert.Null(PasswordRules.Check("bo has a tiny library of maps", "bo@example.no", "Bo"));

    [Fact]
    public void The_common_password_list_is_loaded() =>
        Assert.True(CommonPasswords.Count > 40_000);
}

public sealed class PwnedPasswordsClientTests
{
    // SHA-1 of "password" is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8.
    private const string Prefix = "5BAA6";
    private const string Suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

    [Fact]
    public void Finds_the_suffix_with_a_count() =>
        Assert.True(PwnedPasswordsClient.ContainsSuffix($"0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n{Suffix}:52256179\r\n", Suffix));

    [Fact]
    public void Ignores_padding_lines_with_a_count_of_zero() =>
        Assert.False(PwnedPasswordsClient.ContainsSuffix($"{Suffix}:0\r\n", Suffix));

    [Fact]
    public async Task Sends_only_the_first_five_characters_of_the_hash_and_asks_for_padding()
    {
        var handler = new RecordingHandler($"{Suffix}:3\r\n");
        var client = new PwnedPasswordsClient(new HttpClient(handler) { BaseAddress = new Uri("https://example.test/") }, NullLogger<PwnedPasswordsClient>.Instance);

        var result = await client.CheckAsync("password", TestContext.Current.CancellationToken);

        Assert.Equal(BreachResult.Breached, result);
        Assert.Equal($"/range/{Prefix}", handler.Request!.RequestUri!.AbsolutePath);
        Assert.Equal("true", Assert.Single(handler.Request.Headers.GetValues("Add-Padding")));
    }

    [Fact]
    public async Task Says_unknown_when_the_service_cannot_be_reached()
    {
        var handler = new RecordingHandler("", HttpStatusCode.ServiceUnavailable);
        var client = new PwnedPasswordsClient(new HttpClient(handler) { BaseAddress = new Uri("https://example.test/") }, NullLogger<PwnedPasswordsClient>.Instance);

        Assert.Equal(BreachResult.Unknown, await client.CheckAsync("lantern harbour winter quill", TestContext.Current.CancellationToken));
    }

    private sealed class RecordingHandler(string body, HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Request = request;
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body) });
        }
    }
}
