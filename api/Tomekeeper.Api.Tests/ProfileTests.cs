using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Tomekeeper.Api.Profiles;

namespace Tomekeeper.Api.Tests;

/// <summary>Profiles: the reader's address and text, who can see what, and how others see it.</summary>
public sealed class ProfileTests(PostgresFixture database) : IAsyncLifetime
{
    private TomekeeperApiFactory _api = null!;
    private HttpClient _client = null!;
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        _api = new TomekeeperApiFactory(database.ConnectionString);
        _client = await NewReader("Åse Ødegård");
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _api.DisposeAsync();
    }

    private async Task<HttpClient> NewReader(string name)
    {
        var client = _api.CreateBrowserClient();
        var email = $"reader-{Guid.NewGuid():N}@example.no";
        (await client.PostAsJsonAsync("/api/account/register", new { displayName = name, email, password = "lantern harbour winter quill" }, Cancel))
            .EnsureSuccessStatusCode();
        return client;
    }

    private async Task<ProfileSettingsResponse> Settings(HttpClient? client = null) =>
        (await (client ?? _client).GetFromJsonAsync<ProfileSettingsResponse>("/api/profile", Cancel))!;

    private async Task<string> UniqueHandle(HttpClient client)
    {
        var handle = $"r-{Guid.NewGuid():N}"[..20];
        (await client.PutAsJsonAsync("/api/profile", new { handle, bio = "Mostly fantasy." }, Cancel)).EnsureSuccessStatusCode();
        return handle;
    }

    [Fact]
    public async Task A_reader_gets_an_address_made_from_their_name_and_private_settings()
    {
        var settings = await Settings();

        Assert.StartsWith("ase-odegard", settings.Handle);
        Assert.Equal(new VisibilitySettings("friends", "friends", "friends", "friends"), settings.Visibility);
        Assert.Equal(settings.Handle, (await Settings()).Handle);
    }

    [Theory]
    [InlineData("al")]
    [InlineData("-alex")]
    [InlineData("alex the reader")]
    [InlineData("settings")]
    public async Task Addresses_follow_the_rules(string handle)
    {
        var response = await _client.PutAsJsonAsync("/api/profile", new { handle, bio = (string?)null }, Cancel);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal(ProfileEndpoints.HandleMessage, problem.GetProperty("errors").GetProperty("handle")[0].GetString());
    }

    [Fact]
    public async Task Two_readers_cannot_share_an_address()
    {
        var handle = await UniqueHandle(_client);
        using var other = await NewReader("Kari");

        var response = await other.PutAsJsonAsync("/api/profile", new { handle = handle.ToUpperInvariant() }, Cancel);

        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal(ProfileEndpoints.HandleTakenMessage, problem.GetProperty("errors").GetProperty("handle")[0].GetString());
    }

    [Fact]
    public async Task Others_see_only_the_name_and_text_until_the_reader_shares_more()
    {
        var handle = await UniqueHandle(_client);
        using var other = await NewReader("Kari");

        var seen = await other.GetFromJsonAsync<ReaderProfileResponse>($"/api/readers/{handle}", Cancel);

        Assert.Equal(("Åse Ødegård", "Mostly fantasy.", "stranger", false), (seen!.DisplayName, seen.Bio, seen.ViewedAs, seen.IsOwner));
        Assert.Null(seen.Year);
        Assert.Null(seen.ReadingNow);
        Assert.Null(seen.Visibility);
        Assert.True(seen.SomethingHidden);

        (await _client.PutAsJsonAsync("/api/profile/visibility", new { progress = "everyone", reading = "everyone", friends = "everyone", reviews = "everyone" }, Cancel)).EnsureSuccessStatusCode();
        var shared = await other.GetFromJsonAsync<ReaderProfileResponse>($"/api/readers/{handle}", Cancel);

        Assert.NotNull(shared!.Year);
        Assert.NotNull(shared.Volumes);
        Assert.Empty(shared.ReadingNow!);
        Assert.Empty(shared.Fellowship!);
        Assert.Empty(shared.Reviews!);
        Assert.Equal("none", shared.Relation);
        Assert.False(shared.SomethingHidden);
    }

    [Fact]
    public async Task The_owner_sees_everything_and_can_preview_what_others_see()
    {
        var handle = await UniqueHandle(_client);

        var own = await _client.GetFromJsonAsync<ReaderProfileResponse>($"/api/readers/{handle}", Cancel);
        var asStranger = await _client.GetFromJsonAsync<ReaderProfileResponse>($"/api/readers/{handle}?as=stranger", Cancel);

        Assert.Equal(("you", true), (own!.ViewedAs, own.IsOwner));
        Assert.NotNull(own.Year);
        Assert.NotNull(own.Visibility);
        Assert.Equal("stranger", asStranger!.ViewedAs);
        Assert.Null(asStranger.Year);
    }

    [Fact]
    public async Task Only_you_hides_a_part_from_everyone_else()
    {
        (await _client.PutAsJsonAsync("/api/profile/visibility", new { reading = "onlyYou" }, Cancel)).EnsureSuccessStatusCode();
        var response = await _client.PutAsJsonAsync("/api/profile/visibility", new { progress = "the world" }, Cancel);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(new VisibilitySettings("friends", "onlyYou", "friends", "friends"), (await Settings()).Visibility);
    }

    [Fact]
    public async Task An_unknown_address_gives_404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/readers/no-such-reader-here", Cancel)).StatusCode);
    }

    [Theory]
    [InlineData("Alex", "alex")]
    [InlineData("Ingrid  Berg!", "ingrid-berg")]
    [InlineData("Ø", "reader")]
    [InlineData("李", "reader")]
    public void Names_become_addresses(string name, string handle)
    {
        Assert.Equal(handle, Handles.Slug(name));
    }
}
