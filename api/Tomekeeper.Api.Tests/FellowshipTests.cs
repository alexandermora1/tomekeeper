using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Tomekeeper.Api.Fellowship;
using Tomekeeper.Api.Profiles;

namespace Tomekeeper.Api.Tests;

/// <summary>Finding readers, asking them to be friends, answering, and what friends see of each other.</summary>
public sealed class FellowshipTests(PostgresFixture database) : IAsyncLifetime
{
    private TomekeeperApiFactory _api = null!;
    private readonly List<HttpClient> _clients = [];
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    /// <summary>Letters only, so each test's readers can be found by name without meeting other tests' readers.</summary>
    private readonly string _tag = new(Guid.NewGuid().ToString("N")[..8].Select(c => (char)('a' + Convert.ToInt32(c.ToString(), 16))).ToArray());

    public ValueTask InitializeAsync()
    {
        _api = new TomekeeperApiFactory(database.ConnectionString);
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var client in _clients) client.Dispose();
        await _api.DisposeAsync();
    }

    private async Task<(HttpClient Client, string Handle)> NewReader(string name)
    {
        var client = _api.CreateBrowserClient();
        _clients.Add(client);
        var email = $"reader-{Guid.NewGuid():N}@example.no";
        (await client.PostAsJsonAsync("/api/account/register", new { displayName = name, email, password = "lantern harbour winter quill" }, Cancel))
            .EnsureSuccessStatusCode();
        var settings = await client.GetFromJsonAsync<ProfileSettingsResponse>("/api/profile", Cancel);
        return (client, settings!.Handle);
    }

    private static async Task<string> Act(HttpClient client, string action, string handle)
    {
        var response = action == "leave"
            ? await client.DeleteAsync($"/api/fellowship/{handle}", Cancel)
            : await client.PostAsync($"/api/fellowship/{handle}/{action}", null, Cancel);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<RelationResponse>(Cancel))!.Relation;
    }

    private static async Task<FellowshipResponse> Fellowship(HttpClient client) =>
        (await client.GetFromJsonAsync<FellowshipResponse>("/api/fellowship", Cancel))!;

    private static async Task<ReaderProfileResponse> Profile(HttpClient client, string handle) =>
        (await client.GetFromJsonAsync<ReaderProfileResponse>($"/api/readers/{handle}", Cancel))!;

    private static async Task<IReadOnlyList<ReaderCard>> Search(HttpClient client, string q) =>
        (await client.GetFromJsonAsync<ReaderSearchResponse>($"/api/readers?q={Uri.EscapeDataString(q)}", Cancel))!.Readers;

    [Fact]
    public async Task Readers_are_found_by_part_of_their_name_or_address_but_not_yourself()
    {
        var (me, _) = await NewReader($"Ingrid {_tag}");
        var (_, aseHandle) = await NewReader($"Åse {_tag}");
        await NewReader($"Tormod {_tag}");

        var all = await Search(me, _tag.ToUpperInvariant());
        Assert.Equal([$"Tormod {_tag}", $"Åse {_tag}"], all.Select(r => r.DisplayName).Order(StringComparer.Ordinal));
        Assert.All(all, r => Assert.Equal("none", r.Relation));

        // "ase" is in Åse's address, in plain letters.
        var plain = await Search(me, $"ase-{_tag}");
        Assert.Equal(aseHandle, Assert.Single(plain).Handle);
        // A % is a letter like any other, not "anything".
        Assert.Empty(await Search(me, "%%"));
    }

    [Fact]
    public async Task A_search_needs_two_letters()
    {
        var (me, _) = await NewReader("Ingrid");

        var response = await me.GetAsync("/api/readers?q=a", Cancel);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal(FellowshipEndpoints.QueryMessage, problem.GetProperty("errors").GetProperty("q")[0].GetString());
    }

    [Fact]
    public async Task Asking_and_accepting_makes_two_readers_friends()
    {
        var (ingrid, ingridHandle) = await NewReader("Ingrid");
        var (tormod, tormodHandle) = await NewReader("Tormod");

        Assert.Equal("asked", await Act(ingrid, "ask", tormodHandle));
        Assert.Equal("asked", await Act(ingrid, "ask", tormodHandle));
        Assert.Equal(tormodHandle, Assert.Single((await Fellowship(ingrid)).YouAsked).Handle);
        var asking = Assert.Single((await Fellowship(tormod)).AskingYou);
        Assert.Equal((ingridHandle, "asksYou"), (asking.Handle, asking.Relation));
        Assert.Equal("asksYou", (await Profile(tormod, ingridHandle)).Relation);

        Assert.Equal("friend", await Act(tormod, "accept", ingridHandle));

        var theirs = await Fellowship(tormod);
        Assert.Empty(theirs.AskingYou);
        Assert.Equal(ingridHandle, Assert.Single(theirs.Friends).Handle);
        var mine = await Fellowship(ingrid);
        Assert.Empty(mine.YouAsked);
        var friend = Assert.Single(mine.Friends);
        Assert.Equal((tormodHandle, "friend"), (friend.Handle, friend.Relation));
        Assert.NotNull(friend.Since);
    }

    [Fact]
    public async Task Friends_see_what_is_shared_with_friends()
    {
        var (ingrid, ingridHandle) = await NewReader("Ingrid");
        var (tormod, tormodHandle) = await NewReader("Tormod");
        var (_, aseHandle) = await NewReader("Åse");
        await Act(ingrid, "ask", tormodHandle);
        await Act(ingrid, "ask", aseHandle);

        var before = await Profile(tormod, ingridHandle);
        Assert.Equal(("stranger", "asksYou"), (before.ViewedAs, before.Relation));
        Assert.Null(before.Year);
        Assert.Null(before.Fellowship);

        await Act(tormod, "accept", ingridHandle);
        var after = await Profile(tormod, ingridHandle);
        Assert.Equal(("friend", "friend"), (after.ViewedAs, after.Relation));
        Assert.NotNull(after.Year);
        Assert.NotNull(after.ReadingNow);
        Assert.False(after.SomethingHidden);
        var you = Assert.Single(after.Fellowship!);
        Assert.Equal((tormodHandle, "you"), (you.Handle, you.Relation));
        Assert.Null(after.Visibility);
    }

    [Fact]
    public async Task A_part_kept_for_the_owner_stays_hidden_from_friends()
    {
        var (ingrid, ingridHandle) = await NewReader("Ingrid");
        var (tormod, tormodHandle) = await NewReader("Tormod");
        await Act(ingrid, "ask", tormodHandle);
        await Act(tormod, "accept", ingridHandle);
        (await ingrid.PutAsJsonAsync("/api/profile/visibility", new { friends = "onlyYou" }, Cancel)).EnsureSuccessStatusCode();

        var seen = await Profile(tormod, ingridHandle);

        Assert.Null(seen.Fellowship);
        Assert.True(seen.SomethingHidden);
        Assert.NotNull((await Profile(ingrid, ingridHandle)).Fellowship);
    }

    [Fact]
    public async Task Asking_someone_who_asked_you_makes_you_friends_at_once()
    {
        var (ingrid, ingridHandle) = await NewReader("Ingrid");
        var (tormod, tormodHandle) = await NewReader("Tormod");
        await Act(ingrid, "ask", tormodHandle);

        Assert.Equal("friend", await Act(tormod, "ask", ingridHandle));

        Assert.Single((await Fellowship(ingrid)).Friends);
        Assert.Empty((await Fellowship(ingrid)).YouAsked);
    }

    [Fact]
    public async Task Ignoring_hides_the_request_without_telling_the_asker()
    {
        var (ingrid, ingridHandle) = await NewReader("Ingrid");
        var (tormod, tormodHandle) = await NewReader("Tormod");
        await Act(ingrid, "ask", tormodHandle);

        Assert.Equal("none", await Act(tormod, "ignore", ingridHandle));

        Assert.Empty((await Fellowship(tormod)).AskingYou);
        Assert.Equal("none", (await Profile(tormod, ingridHandle)).Relation);
        Assert.Equal("asked", (await Profile(ingrid, tormodHandle)).Relation);
        Assert.Single((await Fellowship(ingrid)).YouAsked);
        // Asking again changes nothing; the ignoring reader can still change their mind.
        Assert.Equal("asked", await Act(ingrid, "ask", tormodHandle));
        Assert.Equal("friend", await Act(tormod, "ask", ingridHandle));
    }

    [Fact]
    public async Task A_request_can_be_withdrawn_and_a_friendship_ended_from_either_side()
    {
        var (ingrid, ingridHandle) = await NewReader("Ingrid");
        var (tormod, tormodHandle) = await NewReader("Tormod");
        await Act(ingrid, "ask", tormodHandle);

        Assert.Equal("none", await Act(ingrid, "leave", tormodHandle));
        Assert.Empty((await Fellowship(tormod)).AskingYou);

        await Act(ingrid, "ask", tormodHandle);
        await Act(tormod, "accept", ingridHandle);
        Assert.Equal("none", await Act(tormod, "leave", ingridHandle));
        Assert.Empty((await Fellowship(ingrid)).Friends);
        Assert.Empty((await Fellowship(tormod)).Friends);
        Assert.Equal("stranger", (await Profile(tormod, ingridHandle)).ViewedAs);
    }

    [Fact]
    public async Task Requests_that_cant_be_answered_are_refused()
    {
        var (ingrid, ingridHandle) = await NewReader("Ingrid");
        var (_, tormodHandle) = await NewReader("Tormod");

        Assert.Equal(HttpStatusCode.BadRequest, (await ingrid.PostAsync($"/api/fellowship/{ingridHandle}/ask", null, Cancel)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ingrid.PostAsync("/api/fellowship/nobody-at-all/ask", null, Cancel)).StatusCode);
        var accept = await ingrid.PostAsync($"/api/fellowship/{tormodHandle}/accept", null, Cancel);
        Assert.Equal(HttpStatusCode.NotFound, accept.StatusCode);
        var problem = await accept.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal("Tormod hasn't asked you to be friends, or has withdrawn the request.", problem.GetProperty("detail").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await ingrid.PostAsync($"/api/fellowship/{tormodHandle}/ignore", null, Cancel)).StatusCode);
    }

    [Fact]
    public async Task Fellowship_needs_a_signed_in_reader()
    {
        using var anonymous = _api.CreateBrowserClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/fellowship", Cancel)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/readers?q=ingrid", Cancel)).StatusCode);
    }
}
