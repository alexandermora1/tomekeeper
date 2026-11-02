using System.Net;
using System.Net.Http.Json;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Progress;

namespace Tomekeeper.Api.Tests;

/// <summary>The year at a glance: pages and books against the goal, months, and the books being read.</summary>
public sealed class ChronicleTests(PostgresFixture database) : IAsyncLifetime
{
    private TomekeeperApiFactory _api = null!;
    private HttpClient _client = null!;
    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.UtcNow);
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        _api = new TomekeeperApiFactory(database.ConnectionString);
        _client = await NewReader();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _api.DisposeAsync();
    }

    private async Task<HttpClient> NewReader()
    {
        var client = _api.CreateBrowserClient();
        var email = $"reader-{Guid.NewGuid():N}@example.no";
        (await client.PostAsJsonAsync("/api/account/register", new { displayName = "Alex", email, password = "lantern harbour winter quill" }, Cancel))
            .EnsureSuccessStatusCode();
        return client;
    }

    private async Task<Guid> ReadPages(HttpClient client, string title, params int[] pages)
    {
        var key = $"OL{Random.Shared.NextInt64(1_000_000_000, 9_999_999_999)}W";
        _api.OpenLibrary.Works.Add(FakeOpenLibrary.Work(key, title, ["Ingrid Berg"], 1999, 300, null));
        var book = await (await client.PostAsync($"/api/books/open-library/{key}", null, Cancel)).Content.ReadFromJsonAsync<BookResponse>(Cancel);
        (await client.PutAsJsonAsync($"/api/shelves/{book!.Id}", new { shelf = "wantToRead" }, Cancel)).EnsureSuccessStatusCode();
        foreach (var page in pages)
        {
            (await client.PostAsJsonAsync($"/api/shelves/{book.Id}/progress", new { page, readOn = Today.ToString("yyyy-MM-dd") }, Cancel))
                .EnsureSuccessStatusCode();
        }
        return book.Id;
    }

    private Task<ChronicleResponse?> Chronicle(int year, HttpClient? client = null) =>
        (client ?? _client).GetFromJsonAsync<ChronicleResponse>($"/api/chronicle/{year}", Cancel);

    [Fact]
    public async Task The_year_counts_pages_books_and_months_against_the_goal()
    {
        (await _client.PutAsJsonAsync($"/api/goals/{Today.Year}", new { kind = "both", pages = 5000, books = 12 }, Cancel)).EnsureSuccessStatusCode();
        await ReadPages(_client, "Read to the End", 100, 300);
        var reading = await ReadPages(_client, "Still Reading", 40);

        var chronicle = await Chronicle(Today.Year);

        Assert.Equal((5000, 12), (chronicle!.Goal!.Pages, chronicle.Goal.Books));
        Assert.Equal(340, chronicle.PagesRead);
        Assert.Equal(1, chronicle.BooksFinished);
        Assert.Equal(12, chronicle.PagesByMonth.Count);
        Assert.Equal(340, chronicle.PagesByMonth[Today.Month - 1]);
        var now = Assert.Single(chronicle.ReadingNow);
        Assert.Equal((reading, 40), (now.Book.Id, now.Page));
    }

    [Fact]
    public async Task Another_year_and_another_reader_start_from_nothing()
    {
        await ReadPages(_client, "Only Mine", 50);
        using var other = await NewReader();

        var lastYear = await Chronicle(Today.Year - 1);
        var theirs = await Chronicle(Today.Year, other);

        Assert.Equal((0, 0, (object?)null), (lastYear!.PagesRead, lastYear.BooksFinished, (object?)lastYear.Goal));
        Assert.Equal(0, theirs!.PagesRead);
        Assert.Empty(theirs.ReadingNow);
    }

    [Fact]
    public async Task Years_far_away_are_not_found()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/chronicle/{Today.Year + 2}", Cancel)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/chronicle/1800", Cancel)).StatusCode);
    }

    [Fact]
    public async Task The_chronicle_is_for_signed_in_readers()
    {
        using var visitor = _api.CreateBrowserClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync($"/api/chronicle/{Today.Year}", Cancel)).StatusCode);
    }
}
