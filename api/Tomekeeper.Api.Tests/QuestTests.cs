using System.Net;
using System.Net.Http.Json;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Game;
using Tomekeeper.Api.Shelves;

namespace Tomekeeper.Api.Tests;

/// <summary>The six quests of the year, and the gear they earn.</summary>
public sealed class QuestTests(PostgresFixture database) : IAsyncLifetime
{
    private TomekeeperApiFactory _api = null!;
    private HttpClient _client = null!;
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        _api = new TomekeeperApiFactory(database.ConnectionString);
        _client = _api.CreateBrowserClient();
        var email = $"reader-{Guid.NewGuid():N}@example.no";
        (await _client.PostAsJsonAsync("/api/account/register", new { displayName = "Alex", email, password = "lantern harbour winter quill" }, Cancel))
            .EnsureSuccessStatusCode();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _api.DisposeAsync();
    }

    /// <summary>A book of its own on Reading now, with pages logged up to <paramref name="reach"/>.</summary>
    private async Task<Guid> Read(int pages, int reach, int? year = 1999, string[]? subjects = null, string title = "A Book")
    {
        var key = $"OL{Random.Shared.NextInt64(1_000_000_000, 9_999_999_999)}W";
        _api.OpenLibrary.Works.Add(FakeOpenLibrary.Work(key, title, ["Ingrid Berg"], year, pages, null, subjects));
        var book = await (await _client.PostAsync($"/api/books/open-library/{key}", null, Cancel)).Content.ReadFromJsonAsync<BookResponse>(Cancel);
        (await _client.PutAsJsonAsync($"/api/shelves/{book!.Id}", new { shelf = "reading" }, Cancel)).EnsureSuccessStatusCode();
        (await _client.PostAsJsonAsync($"/api/shelves/{book.Id}/progress", new { page = reach, readOn = Today.ToString("yyyy-MM-dd") }, Cancel))
            .EnsureSuccessStatusCode();
        return book.Id;
    }

    private async Task<QuestsResponse> Quests() =>
        (await _client.GetFromJsonAsync<QuestsResponse>($"/api/quests/{Today.Year}", Cancel))!;

    private static QuestResponse Quest(QuestsResponse quests, string id) => quests.Quests.Single(q => q.Id == id);

    [Fact]
    public async Task A_new_reader_has_six_quests_and_no_gear()
    {
        var quests = await Quests();

        Assert.Equal(["binder", "scholar", "road", "decades", "quill", "nights"], quests.Quests.Select(q => q.Id));
        Assert.All(quests.Quests, q => Assert.NotEqual("done", q.State));
        Assert.Equal("soon", Quest(quests, "quill").State);
        Assert.Equal(Today.Month == 12 ? "active" : "soon", Quest(quests, "nights").State);
        Assert.Equal(["spectacles", "cloak", "gloves", "satchel", "lantern", "quill"], quests.Gear.Select(g => g.Item));
        Assert.All(quests.Gear, g => Assert.Null(g.EarnedIn));
    }

    [Fact]
    public async Task Ten_finished_books_earn_the_bookbinders_gloves()
    {
        for (var i = 1; i <= 10; i++) await Read(100, 100, title: $"Book {i:00}");

        var quests = await Quests();

        Assert.Equal(("done", 100), (Quest(quests, "binder").State, Quest(quests, "binder").Percent));
        Assert.EndsWith("with Book 10.", Quest(quests, "binder").Progress);
        Assert.Equal(Today.Year, quests.Gear.Single(g => g.Item == "gloves").EarnedIn);
    }

    [Fact]
    public async Task The_long_road_follows_a_long_book_and_is_done_when_it_is_finished()
    {
        var bookId = await Read(1200, 600, title: "Memories of Ice");

        var underway = Quest(await Quests(), "road");
        Assert.Equal(("active", 50, "Memories of Ice, page 600 of 1,200."), (underway.State, underway.Percent, underway.Progress));

        (await _client.PostAsJsonAsync($"/api/shelves/{bookId}/progress/finish", new { readOn = Today.ToString("yyyy-MM-dd") }, Cancel))
            .EnsureSuccessStatusCode();
        var quests = await Quests();
        Assert.Equal("done", Quest(quests, "road").State);
        Assert.NotNull(quests.Gear.Single(g => g.Item == "satchel").EarnedIn);
    }

    [Fact]
    public async Task Five_decades_need_books_from_five_decades()
    {
        foreach (var year in new[] { 1954, 1965, 1965, 1999 }) await Read(100, 100, year);
        Assert.Equal("3 of 5: the 1950s, 1960s and 1990s.", Quest(await Quests(), "decades").Progress);

        await Read(100, 100, 2007);
        await Read(100, 100, 2021);

        Assert.Equal("done", Quest(await Quests(), "decades").State);
    }

    [Fact]
    public async Task The_scholar_counts_nonfiction_by_the_books_subjects_or_the_readers_say()
    {
        await Read(1500, 1200, subjects: ["History", "Rome"]);
        var novel = await Read(1500, 900, subjects: ["Fiction", "Fantasy fiction"]);
        Assert.Equal("1,200 of 2,000 pages.", Quest(await Quests(), "scholar").Progress);

        var say = await _client.PutAsJsonAsync($"/api/shelves/{novel}/kind", new { fiction = false }, Cancel);
        Assert.False((await say.Content.ReadFromJsonAsync<ShelfEntryResponse>(Cancel))!.Fiction);

        var quests = await Quests();
        Assert.Equal("done", Quest(quests, "scholar").State);
        Assert.NotNull(quests.Gear.Single(g => g.Item == "spectacles").EarnedIn);
    }

    [Fact]
    public async Task Gear_is_kept_for_good_even_when_the_progress_is_taken_back()
    {
        var bookId = await Read(1100, 1100);
        Assert.Equal("done", Quest(await Quests(), "road").State);

        (await _client.DeleteAsync($"/api/shelves/{bookId}/progress/latest", Cancel)).EnsureSuccessStatusCode();

        var quests = await Quests();
        Assert.NotEqual("done", Quest(quests, "road").State);
        Assert.NotNull(quests.Gear.Single(g => g.Item == "satchel").EarnedIn);
    }

    [Theory]
    [InlineData(new[] { "Fiction", "Fantasy" }, true)]
    [InlineData(new[] { "Science fiction" }, true)]
    [InlineData(new[] { "History", "Nonfiction" }, false)]
    [InlineData(new[] { "Biography", "Non-fiction" }, false)]
    [InlineData(new string[0], null)]
    public void Subjects_tell_fiction_from_nonfiction(string[] subjects, bool? fiction)
    {
        Assert.Equal(fiction, OpenLibraryClient.FictionFrom(subjects));
    }

    [Fact]
    public async Task Quests_are_for_signed_in_readers()
    {
        using var visitor = _api.CreateBrowserClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync($"/api/quests/{Today.Year}", Cancel)).StatusCode);
    }
}
