using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Progress;

namespace Tomekeeper.Api.Tests;

/// <summary>Logging progress: pages or percentages, finishing, reading again and taking an entry back.</summary>
public sealed class ProgressTests(PostgresFixture database) : IAsyncLifetime
{
    private TomekeeperApiFactory _api = null!;
    private HttpClient _client = null!;
    private static readonly string Today = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");
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

    /// <summary>A book of its own for each test, on the Want to read shelf.</summary>
    private async Task<Guid> ShelvedBook(int? pages = 320)
    {
        var key = $"OL{Random.Shared.NextInt64(1_000_000_000, 9_999_999_999)}W";
        _api.OpenLibrary.Works.Add(FakeOpenLibrary.Work(key, "A Book to Read", ["Ingrid Berg"], 1999, pages, null));
        var book = await (await _client.PostAsync($"/api/books/open-library/{key}", null, Cancel)).Content.ReadFromJsonAsync<BookResponse>(Cancel);
        (await _client.PutAsJsonAsync($"/api/shelves/{book!.Id}", new { shelf = "wantToRead" }, Cancel)).EnsureSuccessStatusCode();
        return book.Id;
    }

    private Task<HttpResponseMessage> Log(Guid bookId, object body, HttpClient? client = null) =>
        (client ?? _client).PostAsJsonAsync($"/api/shelves/{bookId}/progress", body, Cancel);

    private async Task<ProgressResponse> LogOk(Guid bookId, int page)
    {
        var response = await Log(bookId, new { page, readOn = Today });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ProgressResponse>(Cancel))!;
    }

    private static async Task<string?> ErrorFor(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        return problem.GetProperty("errors").GetProperty(field)[0].GetString();
    }

    [Fact]
    public async Task Logging_a_page_starts_a_reading_and_puts_the_book_on_reading_now()
    {
        var bookId = await ShelvedBook();
        Assert.Null((await _client.GetFromJsonAsync<ProgressResponse>($"/api/shelves/{bookId}/progress", Cancel))!.Reading);

        var progress = await LogOk(bookId, 40);

        Assert.Equal("reading", progress.Entry.Shelf);
        Assert.Equal(40, progress.Entry.Page);
        Assert.Equal(40, progress.Entry.PagesRead);
        Assert.Equal(DateOnly.Parse(Today), progress.Reading!.StartedOn);
        Assert.Null(progress.Reading.FinishedOn);
        var entry = Assert.Single(progress.Entries);
        Assert.Equal((40, 40, false), (entry.Page, entry.Pages, entry.Finished));
    }

    [Fact]
    public async Task Each_entry_counts_the_pages_since_the_one_before()
    {
        var bookId = await ShelvedBook();
        await LogOk(bookId, 40);

        var progress = await LogOk(bookId, 100);

        Assert.Equal([60, 40], progress.Entries.Select(e => e.Pages));
        Assert.Equal(100, progress.Entry.PagesRead);
    }

    [Fact]
    public async Task A_percentage_becomes_a_page_with_the_page_count()
    {
        var bookId = await ShelvedBook(pages: 320);

        var response = await Log(bookId, new { percent = 50, readOn = Today });

        Assert.Equal(160, (await response.Content.ReadFromJsonAsync<ProgressResponse>(Cancel))!.Entry.Page);
    }

    [Fact]
    public async Task A_percentage_needs_a_page_count()
    {
        var bookId = await ShelvedBook(pages: null);
        Assert.Equal(ProgressEndpoints.PercentNeedsPagesMessage, await ErrorFor(await Log(bookId, new { percent = 10, readOn = Today }), "percent"));
    }

    [Fact]
    public async Task The_page_must_be_further_on_and_within_the_book()
    {
        var bookId = await ShelvedBook(pages: 320);
        await LogOk(bookId, 100);

        Assert.StartsWith("You're already on page 100.", await ErrorFor(await Log(bookId, new { page = 90, readOn = Today }), "page"));
        Assert.StartsWith("This book has 320 pages.", await ErrorFor(await Log(bookId, new { page = 400, readOn = Today }), "page"));
        Assert.Equal("Enter the page you've reached.", await ErrorFor(await Log(bookId, new { readOn = Today }), "page"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("2020-01-01")]
    [InlineData("02.11.2026")]
    public async Task The_date_must_be_today_where_the_reader_is(string? readOn)
    {
        var bookId = await ShelvedBook();
        Assert.Equal(ReadingDays.Message, await ErrorFor(await Log(bookId, new { page = 10, readOn }), "readOn"));
    }

    [Fact]
    public async Task Reaching_the_last_page_finishes_the_book()
    {
        var bookId = await ShelvedBook(pages: 320);
        await LogOk(bookId, 300);

        var progress = await LogOk(bookId, 320);

        Assert.Equal("finished", progress.Entry.Shelf);
        Assert.Null(progress.Entry.Page);
        Assert.Equal(DateOnly.Parse(Today), progress.Reading!.FinishedOn);
        Assert.True(progress.Entries[0].Finished);
    }

    [Fact]
    public async Task Finishing_counts_the_rest_of_the_pages()
    {
        var bookId = await ShelvedBook(pages: 320);
        await LogOk(bookId, 200);

        var response = await _client.PostAsJsonAsync($"/api/shelves/{bookId}/progress/finish", new { readOn = Today }, Cancel);

        var progress = (await response.Content.ReadFromJsonAsync<ProgressResponse>(Cancel))!;
        Assert.Equal((320, 120, true), (progress.Entries[0].Page, progress.Entries[0].Pages, progress.Entries[0].Finished));
        Assert.Equal(320, progress.Entry.PagesRead);
        Assert.Equal("finished", progress.Entry.Shelf);
        var again = await _client.PostAsJsonAsync($"/api/shelves/{bookId}/progress/finish", new { readOn = Today }, Cancel);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
    }

    [Fact]
    public async Task Moving_a_book_in_progress_to_finished_finishes_it()
    {
        var bookId = await ShelvedBook(pages: 320);
        await LogOk(bookId, 20);

        (await _client.PutAsJsonAsync($"/api/shelves/{bookId}", new { shelf = "finished", readOn = Today }, Cancel)).EnsureSuccessStatusCode();

        var progress = await _client.GetFromJsonAsync<ProgressResponse>($"/api/shelves/{bookId}/progress", Cancel);
        Assert.Equal(320, progress!.Entry.PagesRead);
        Assert.NotNull(progress.Reading!.FinishedOn);
    }

    [Fact]
    public async Task Undo_takes_back_the_latest_entry()
    {
        var bookId = await ShelvedBook(pages: 320);
        await LogOk(bookId, 100);
        await LogOk(bookId, 320);

        var undone = await (await _client.DeleteAsync($"/api/shelves/{bookId}/progress/latest", Cancel)).Content.ReadFromJsonAsync<ProgressResponse>(Cancel);

        Assert.Equal("reading", undone!.Entry.Shelf);
        Assert.Equal(100, undone.Entry.Page);
        Assert.Null(undone.Reading!.FinishedOn);
        var none = await (await _client.DeleteAsync($"/api/shelves/{bookId}/progress/latest", Cancel)).Content.ReadFromJsonAsync<ProgressResponse>(Cancel);
        Assert.Null(none!.Reading);
        Assert.Equal(0, none.Entry.PagesRead);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.DeleteAsync($"/api/shelves/{bookId}/progress/latest", Cancel)).StatusCode);
    }

    [Fact]
    public async Task Reading_a_finished_book_again_starts_a_new_reading()
    {
        var bookId = await ShelvedBook(pages: 320);
        await LogOk(bookId, 320);

        var progress = await LogOk(bookId, 50);

        Assert.Equal("reading", progress.Entry.Shelf);
        Assert.Single(progress.Entries);
        Assert.NotNull(Assert.Single(progress.EarlierReadings).FinishedOn);
        Assert.Equal(370, progress.Entry.PagesRead);
    }

    [Fact]
    public async Task Taking_the_book_off_the_shelves_deletes_its_progress()
    {
        var bookId = await ShelvedBook();
        await LogOk(bookId, 50);

        (await _client.DeleteAsync($"/api/shelves/{bookId}", Cancel)).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync($"/api/shelves/{bookId}", new { shelf = "reading" }, Cancel)).EnsureSuccessStatusCode();

        var progress = await _client.GetFromJsonAsync<ProgressResponse>($"/api/shelves/{bookId}/progress", Cancel);
        Assert.Null(progress!.Reading);
        Assert.Equal(0, progress.Entry.PagesRead);
    }

    [Fact]
    public async Task Progress_is_only_for_books_on_the_readers_own_shelves()
    {
        var bookId = await ShelvedBook();
        using var other = await NewReader();
        Assert.Equal(HttpStatusCode.NotFound, (await Log(bookId, new { page = 10, readOn = Today }, other)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/shelves/{bookId}/progress", Cancel)).StatusCode);
    }
}
