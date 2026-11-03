using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Fellowship;
using Tomekeeper.Api.Moderation;
using Tomekeeper.Api.Profiles;
using Tomekeeper.Api.Reviews;

namespace Tomekeeper.Api.Tests;

/// <summary>Blocking (hidden both ways) and reports (stored, and emailed to the moderator).</summary>
public sealed class BlockAndReportTests(PostgresFixture database) : IAsyncLifetime
{
    private const string Moderator = "moderator@tomekeeper.test";
    private TomekeeperApiFactory _api = null!;
    private readonly List<HttpClient> _clients = [];
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;
    private readonly string _tag = new(Guid.NewGuid().ToString("N")[..8].Select(c => (char)('a' + Convert.ToInt32(c.ToString(), 16))).ToArray());

    public ValueTask InitializeAsync()
    {
        _api = new TomekeeperApiFactory(database.ConnectionString, settings: new Dictionary<string, string> { ["App:ModeratorEmail"] = Moderator });
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var client in _clients) client.Dispose();
        await _api.DisposeAsync();
    }

    private sealed record Reader(HttpClient Client, string Handle, Guid Id, string Name);

    private async Task<Reader> NewReader(string name)
    {
        var client = _api.CreateBrowserClient();
        _clients.Add(client);
        var email = $"reader-{Guid.NewGuid():N}@example.no";
        (await client.PostAsJsonAsync("/api/account/register", new { displayName = $"{name} {_tag}", email, password = "lantern harbour winter quill" }, Cancel))
            .EnsureSuccessStatusCode();
        var me = await client.GetFromJsonAsync<MeResponse>("/api/account/me", Cancel);
        var handle = (await client.GetFromJsonAsync<ProfileSettingsResponse>("/api/profile", Cancel))!.Handle;
        return new Reader(client, handle, me!.Id, $"{name} {_tag}");
    }

    private static async Task<string> Act(Reader from, string action, Reader to)
    {
        var response = action switch
        {
            "block" => await from.Client.PostAsync($"/api/fellowship/{to.Handle}/block", null, Cancel),
            "unblock" => await from.Client.DeleteAsync($"/api/fellowship/{to.Handle}/block", Cancel),
            _ => await from.Client.PostAsync($"/api/fellowship/{to.Handle}/{action}", null, Cancel),
        };
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<RelationResponse>(Cancel))!.Relation;
    }

    private static async Task Befriend(Reader one, Reader two)
    {
        await Act(one, "ask", two);
        await Act(two, "accept", one);
    }

    private static Task<HttpResponseMessage> Profile(Reader viewer, Reader owner) => viewer.Client.GetAsync($"/api/readers/{owner.Handle}", Cancel);

    private static async Task<FellowshipResponse> Fellowship(Reader reader) =>
        (await reader.Client.GetFromJsonAsync<FellowshipResponse>("/api/fellowship", Cancel))!;

    private async Task<Guid> ReviewedBook(Reader reader, string words = "Cold and slow.")
    {
        var key = $"OL{Random.Shared.NextInt64(1_000_000_000, 9_999_999_999)}W";
        _api.OpenLibrary.Works.Add(FakeOpenLibrary.Work(key, "The Winter Road", ["Ingrid Berg"], 1999, 320, null));
        var book = (await (await reader.Client.PostAsync($"/api/books/open-library/{key}", null, Cancel)).Content.ReadFromJsonAsync<BookResponse>(Cancel))!.Id;
        await Shelve(reader, book);
        (await reader.Client.PutAsJsonAsync($"/api/books/{book}/review", new { rating = 2, text = words }, Cancel)).EnsureSuccessStatusCode();
        (await reader.Client.PutAsJsonAsync("/api/profile/visibility", new { reviews = "everyone", friends = "everyone" }, Cancel)).EnsureSuccessStatusCode();
        return book;
    }

    private static async Task Shelve(Reader reader, Guid book) =>
        (await reader.Client.PutAsJsonAsync($"/api/shelves/{book}", new { shelf = "finished", readOn = DateTime.UtcNow.ToString("yyyy-MM-dd") }, Cancel))
            .EnsureSuccessStatusCode();

    private static Task<HttpResponseMessage> SendReport(Reader from, string handle, Guid? bookId, string? reason, string? details = null) =>
        from.Client.PostAsJsonAsync("/api/reports", new { handle, bookId, reason, details }, Cancel);

    [Fact]
    public async Task Blocking_ends_a_friendship_and_hides_the_two_from_each_other()
    {
        var ingrid = await NewReader("Ingrid");
        var tormod = await NewReader("Tormod");
        await Befriend(ingrid, tormod);

        Assert.Equal("blocked", await Act(ingrid, "block", tormod));

        Assert.Empty((await Fellowship(ingrid)).Friends);
        Assert.Empty((await Fellowship(tormod)).Friends);
        Assert.Equal(HttpStatusCode.NotFound, (await Profile(tormod, ingrid)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Profile(ingrid, tormod)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await tormod.Client.PostAsync($"/api/fellowship/{ingrid.Handle}/ask", null, Cancel)).StatusCode);
        var found = await tormod.Client.GetFromJsonAsync<ReaderSearchResponse>($"/api/readers?q={_tag}", Cancel);
        Assert.DoesNotContain(found!.Readers, r => r.Handle == ingrid.Handle);
        var blocked = Assert.Single((await Fellowship(ingrid)).Blocked);
        Assert.Equal((tormod.Handle, "blocked"), (blocked.Handle, blocked.Relation));
        Assert.Empty((await Fellowship(tormod)).Blocked);
    }

    [Fact]
    public async Task Blocked_readers_reviews_and_friendships_are_hidden_both_ways()
    {
        var ingrid = await NewReader("Ingrid");
        var tormod = await NewReader("Tormod");
        var kari = await NewReader("Kari");
        var book = await ReviewedBook(tormod);
        await ReviewedBook(ingrid);
        await Shelve(ingrid, book);
        (await ingrid.Client.PutAsJsonAsync($"/api/books/{book}/review", new { rating = 5 }, Cancel)).EnsureSuccessStatusCode();
        await Befriend(kari, ingrid);
        await Befriend(kari, tormod);
        (await kari.Client.PutAsJsonAsync("/api/profile/visibility", new { friends = "everyone" }, Cancel)).EnsureSuccessStatusCode();

        await Act(tormod, "block", ingrid);

        var ingridSees = await ingrid.Client.GetFromJsonAsync<BookReviewsResponse>($"/api/books/{book}/reviews", Cancel);
        Assert.Empty(ingridSees!.Others);
        var tormodSees = await tormod.Client.GetFromJsonAsync<BookReviewsResponse>($"/api/books/{book}/reviews", Cancel);
        Assert.Empty(tormodSees!.Others);
        Assert.Equal(2, (await kari.Client.GetFromJsonAsync<BookReviewsResponse>($"/api/books/{book}/reviews", Cancel))!.Others.Count);
        var karisFriends = (await ingrid.Client.GetFromJsonAsync<ReaderProfileResponse>($"/api/readers/{kari.Handle}", Cancel))!.Fellowship!;
        Assert.Equal([ingrid.Handle], karisFriends.Select(f => f.Handle));
    }

    [Fact]
    public async Task Unblocking_lets_the_two_see_each_other_again_but_not_as_friends()
    {
        var ingrid = await NewReader("Ingrid");
        var tormod = await NewReader("Tormod");
        await Befriend(ingrid, tormod);
        await Act(ingrid, "block", tormod);

        // Only the reader who blocked can undo it.
        Assert.Equal("none", await Act(tormod, "unblock", ingrid));
        Assert.Equal(HttpStatusCode.NotFound, (await Profile(tormod, ingrid)).StatusCode);

        Assert.Equal("none", await Act(ingrid, "unblock", tormod));
        var seen = await (await Profile(tormod, ingrid)).Content.ReadFromJsonAsync<ReaderProfileResponse>(Cancel);
        Assert.Equal(("stranger", "none"), (seen!.ViewedAs, seen.Relation));
        Assert.Empty((await Fellowship(ingrid)).Blocked);
    }

    [Fact]
    public async Task Readers_cant_block_themselves()
    {
        var ingrid = await NewReader("Ingrid");

        Assert.Equal(HttpStatusCode.BadRequest, (await ingrid.Client.PostAsync($"/api/fellowship/{ingrid.Handle}/block", null, Cancel)).StatusCode);
    }

    [Fact]
    public async Task A_reported_review_is_stored_as_it_was_and_emailed_to_the_moderator()
    {
        var ingrid = await NewReader("Ingrid");
        var tormod = await NewReader("Tormod");
        var book = await ReviewedBook(tormod, "Buy cheap watches at example.com!");

        var response = await SendReport(ingrid, tormod.Handle, book, "spam", "Not about the book at all.");
        response.EnsureSuccessStatusCode();
        var id = (await response.Content.ReadFromJsonAsync<ReportResponse>(Cancel))!.Id;
        (await tormod.Client.PutAsJsonAsync($"/api/books/{book}/review", new { rating = 2, text = "Changed." }, Cancel)).EnsureSuccessStatusCode();

        await using (var scope = _api.Services.CreateAsyncScope())
        {
            var report = await scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>().Reports.FindAsync([id], Cancel);
            Assert.Equal((ingrid.Id, tormod.Id, (Guid?)book, ReportReason.Spam), (report!.ReporterId, report.ReportedId, report.BookId, report.Reason));
            Assert.Equal("Review of The Winter Road, 2 of 5 stars:\nBuy cheap watches at example.com!", report.Snapshot);
        }
        var email = Assert.Single(_api.Emails.Sent, e => e.To == Moderator && e.Body.Contains(id.ToString()));
        Assert.Equal($"Tomekeeper report: spam or advertising, about a review by {tormod.Name}", email.Subject);
        Assert.Contains($"{TomekeeperApiFactory.PublicUrl}/readers/{tormod.Handle}", email.Body);
        Assert.Contains($"{TomekeeperApiFactory.PublicUrl}/books/{book}", email.Body);
        Assert.Contains("From the reporter: Not about the book at all.", email.Body);
        Assert.Contains("Buy cheap watches at example.com!", email.Body);

        // The same report again the same day is the same report, with no second email.
        var again = await SendReport(ingrid, tormod.Handle, book, "spam");
        Assert.Equal(id, (await again.Content.ReadFromJsonAsync<ReportResponse>(Cancel))!.Id);
        Assert.Single(_api.Emails.Sent, e => e.To == Moderator && e.Body.Contains(id.ToString()));
    }

    [Fact]
    public async Task A_reader_can_be_reported_after_being_blocked()
    {
        var ingrid = await NewReader("Ingrid");
        var tormod = await NewReader("Tormod");
        await Act(ingrid, "block", tormod);

        var response = await SendReport(ingrid, tormod.Handle, null, "harassment");

        response.EnsureSuccessStatusCode();
        var email = Assert.Single(_api.Emails.Sent, e => e.To == Moderator && e.Subject.Contains(tormod.Name));
        Assert.Contains($"Name: {tormod.Name}", email.Body);
        Assert.Contains("Reason: Harassment or bullying", email.Body);
    }

    [Fact]
    public async Task Reports_need_a_reason_and_words_for_something_else()
    {
        var ingrid = await NewReader("Ingrid");
        var tormod = await NewReader("Tormod");

        async Task<string?> Error(string? reason, string? details, string field)
        {
            var response = await SendReport(ingrid, tormod.Handle, null, reason, details);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            return (await response.Content.ReadFromJsonAsync<JsonElement>(Cancel)).GetProperty("errors").GetProperty(field)[0].GetString();
        }

        Assert.Equal(ReportEndpoints.ReasonMessage, await Error(null, null, "reason"));
        Assert.Equal(ReportEndpoints.ReasonMessage, await Error("rude", null, "reason"));
        Assert.Equal(ReportEndpoints.DetailsNeededMessage, await Error("other", "  ", "details"));
        Assert.StartsWith("Keep it to 1,000 characters", await Error("spam", new string('a', 1001), "details"));
        Assert.Equal(HttpStatusCode.BadRequest, (await SendReport(ingrid, ingrid.Handle, null, "spam")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SendReport(ingrid, "nobody-at-all", null, "spam")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SendReport(ingrid, tormod.Handle, Guid.NewGuid(), "spam")).StatusCode);
    }

    [Fact]
    public async Task A_reader_can_send_at_most_20_reports_a_day()
    {
        var ingrid = await NewReader("Ingrid");
        var tormod = await NewReader("Tormod");
        var kari = await NewReader("Kari");
        await using (var scope = _api.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>();
            for (var i = 0; i < ReportEndpoints.MaxPerDay; i++)
            {
                db.Reports.Add(new Report
                {
                    Id = Guid.CreateVersion7(), ReporterId = ingrid.Id, ReportedId = tormod.Id, BookId = Guid.NewGuid(),
                    Reason = ReportReason.Spam, Snapshot = "-", CreatedAt = DateTimeOffset.UtcNow,
                });
            }
            await db.SaveChangesAsync(Cancel);
        }

        var response = await SendReport(ingrid, kari.Handle, null, "spam");

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
    }

    [Fact]
    public async Task Without_a_moderator_address_reports_are_still_stored()
    {
        await using var api = new TomekeeperApiFactory(database.ConnectionString, settings: new Dictionary<string, string> { ["App:ModeratorEmail"] = "" });
        using var one = api.CreateBrowserClient();
        using var two = api.CreateBrowserClient();
        foreach (var client in new[] { one, two })
        {
            (await client.PostAsJsonAsync("/api/account/register", new { displayName = "Kari", email = $"reader-{Guid.NewGuid():N}@example.no", password = "lantern harbour winter quill" }, Cancel))
                .EnsureSuccessStatusCode();
        }
        var handle = (await two.GetFromJsonAsync<ProfileSettingsResponse>("/api/profile", Cancel))!.Handle;

        var response = await one.PostAsJsonAsync("/api/reports", new { handle, reason = "offensive" }, Cancel);

        response.EnsureSuccessStatusCode();
        Assert.DoesNotContain(api.Emails.Sent, e => e.Subject.StartsWith("Tomekeeper report"));
    }
}
