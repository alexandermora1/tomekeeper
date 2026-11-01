using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Shelves;

namespace Tomekeeper.Api.Tests;

/// <summary>Putting books on shelves, moving them and taking them off.</summary>
public sealed class ShelfTests(PostgresFixture database) : IAsyncLifetime
{
    private const string Password = "lantern harbour winter quill";
    private TomekeeperApiFactory _api = null!;
    private HttpClient _client = null!;
    private string _email = "";
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        _api = new TomekeeperApiFactory(database.ConnectionString);
        (_client, _email) = await NewReader();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _api.DisposeAsync();
    }

    private async Task<(HttpClient Client, string Email)> NewReader()
    {
        var client = _api.CreateBrowserClient();
        var email = $"reader-{Guid.NewGuid():N}@example.no";
        (await client.PostAsJsonAsync("/api/account/register", new { displayName = "Alex", email, password = Password }, Cancel))
            .EnsureSuccessStatusCode();
        return (client, email);
    }

    /// <summary>Puts a book only this test knows in the catalogue, the way the Library page does.</summary>
    private async Task<BookResponse> CatalogueBook(string title)
    {
        var key = $"OL{Random.Shared.NextInt64(1_000_000_000, 9_999_999_999)}W";
        _api.OpenLibrary.Works.Add(FakeOpenLibrary.Work(key, title, ["Ingrid Berg"], 1999, 320, null));
        var response = await _client.PostAsync($"/api/books/open-library/{key}", null, Cancel);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<BookResponse>(Cancel))!;
    }

    private Task<HttpResponseMessage> Put(Guid bookId, string? shelf, HttpClient? client = null) =>
        (client ?? _client).PutAsJsonAsync($"/api/shelves/{bookId}", new { shelf }, Cancel);

    private async Task<ShelfEntryResponse> PutOk(Guid bookId, string shelf)
    {
        var response = await Put(bookId, shelf);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ShelfEntryResponse>(Cancel))!;
    }

    private async Task<IReadOnlyList<ShelfEntryResponse>> Shelves(HttpClient? client = null) =>
        (await (client ?? _client).GetFromJsonAsync<ShelvesResponse>("/api/shelves", Cancel))!.Books;

    [Fact]
    public async Task A_new_reader_has_empty_shelves()
    {
        Assert.Empty(await Shelves());
    }

    [Fact]
    public async Task A_book_put_on_a_shelf_is_listed_with_its_details()
    {
        var book = await CatalogueBook("The Shelved Book");

        var entry = await PutOk(book.Id, "wantToRead");

        Assert.Equal("wantToRead", entry.Shelf);
        Assert.Equivalent(book, entry.Book);
        var listed = Assert.Single(await Shelves());
        Assert.Equivalent(entry, listed);
        Assert.Equal("The Shelved Book", listed.Book.Title);
        Assert.Equal(320, listed.Book.PageCount);
    }

    [Theory]
    [InlineData("reading")]
    [InlineData("wantToRead")]
    [InlineData("finished")]
    [InlineData("setAside")]
    public async Task There_are_four_shelves(string shelf)
    {
        var book = await CatalogueBook($"A Book For {shelf}");
        Assert.Equal(shelf, (await PutOk(book.Id, shelf)).Shelf);
    }

    [Fact]
    public async Task Moving_a_book_keeps_it_on_one_shelf()
    {
        var book = await CatalogueBook("The Moving Book");
        var first = await PutOk(book.Id, "reading");

        var moved = await PutOk(book.Id, "finished");

        Assert.Equal("finished", moved.Shelf);
        Assert.True(moved.ShelvedAt > first.ShelvedAt);
        Assert.Equal("finished", Assert.Single(await Shelves()).Shelf);
    }

    [Fact]
    public async Task Putting_a_book_on_the_shelf_it_is_on_changes_nothing()
    {
        var book = await CatalogueBook("The Patient Book");
        var first = await PutOk(book.Id, "reading");

        var again = await PutOk(book.Id, "reading");

        Assert.Equal(first.ShelvedAt, again.ShelvedAt);
    }

    [Fact]
    public async Task The_latest_shelved_book_comes_first()
    {
        var older = await CatalogueBook("The Older Book");
        var newer = await CatalogueBook("The Newer Book");
        await PutOk(older.Id, "wantToRead");
        await PutOk(newer.Id, "wantToRead");
        Assert.Equal(["The Newer Book", "The Older Book"], (await Shelves()).Select(e => e.Book.Title));

        // Moving a book counts as shelving it again.
        await PutOk(older.Id, "reading");

        Assert.Equal(["The Older Book", "The Newer Book"], (await Shelves()).Select(e => e.Book.Title));
    }

    [Fact]
    public async Task A_book_taken_off_the_shelves_stays_in_the_catalogue()
    {
        var book = await CatalogueBook("The Removed Book");
        await PutOk(book.Id, "setAside");

        var first = await _client.DeleteAsync($"/api/shelves/{book.Id}", Cancel);
        var again = await _client.DeleteAsync($"/api/shelves/{book.Id}", Cancel);

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.Empty(await Shelves());
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync($"/api/books/{book.Id}", Cancel)).StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Reading")]
    [InlineData("read")]
    [InlineData("2")]
    public async Task The_shelf_must_be_one_of_the_four(string? shelf)
    {
        var book = await CatalogueBook("The Unsure Book");

        var response = await Put(book.Id, shelf);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal(ShelfEndpoints.ChooseShelfMessage, problem.GetProperty("errors").GetProperty("shelf")[0].GetString());
        Assert.Empty(await Shelves());
    }

    [Fact]
    public async Task Only_books_in_the_catalogue_can_be_shelved()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await Put(Guid.NewGuid(), "reading")).StatusCode);
    }

    [Fact]
    public async Task Shelves_are_each_readers_own()
    {
        var book = await CatalogueBook("The Shared Book");
        await PutOk(book.Id, "reading");
        using var other = (await NewReader()).Client;

        Assert.Empty(await Shelves(other));
        (await Put(book.Id, "finished", other)).EnsureSuccessStatusCode();
        (await other.DeleteAsync($"/api/shelves/{book.Id}", Cancel)).EnsureSuccessStatusCode();

        Assert.Equal("reading", Assert.Single(await Shelves()).Shelf);
    }

    [Fact]
    public async Task Search_results_show_the_readers_own_shelf()
    {
        var mine = await CatalogueBook("Shelfsearch Mine");
        var theirs = await CatalogueBook("Shelfsearch Theirs");
        await PutOk(mine.Id, "finished");
        using var other = (await NewReader()).Client;
        (await Put(theirs.Id, "reading", other)).EnsureSuccessStatusCode();

        var found = await _client.GetFromJsonAsync<BookSearchResponse>("/api/books/search?q=shelfsearch", Cancel);

        Assert.Equal("finished", found!.Results.Single(r => r.Title == "Shelfsearch Mine").Shelf);
        var notMine = found.Results.Single(r => r.Title == "Shelfsearch Theirs");
        Assert.Equal(theirs.Id, notMine.BookId);
        Assert.Null(notMine.Shelf);
    }

    [Fact]
    public async Task Shelves_are_for_signed_in_readers()
    {
        using var visitor = _api.CreateBrowserClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/shelves", Cancel)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Put(Guid.NewGuid(), "reading", visitor)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.DeleteAsync($"/api/shelves/{Guid.NewGuid()}", Cancel)).StatusCode);
    }

    [Fact]
    public async Task Deleting_the_account_empties_the_shelves_but_keeps_the_books()
    {
        var book = await CatalogueBook("The Book That Stays");
        await PutOk(book.Id, "reading");

        (await _client.PostAsJsonAsync("/api/account/delete", new { email = _email, password = Password }, Cancel)).EnsureSuccessStatusCode();

        await using var scope = _api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>();
        Assert.False(await db.ShelfEntries.AnyAsync(e => e.BookId == book.Id, Cancel));
        Assert.True(await db.Books.AnyAsync(b => b.Id == book.Id, Cancel));
    }

    [Fact]
    public async Task Full_shelves_take_no_more_books()
    {
        var book = await CatalogueBook("One Book Too Many");
        await FillShelves();

        var response = await Put(book.Id, "wantToRead");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal(ShelfEndpoints.FullMessage, problem.GetProperty("detail").GetString());
    }

    /// <summary>Puts as many books as Tomekeeper keeps on this reader's shelves, straight in the database.</summary>
    private async Task FillShelves()
    {
        await using var scope = _api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>();
        var userId = (await db.Users.SingleAsync(u => u.Email == _email, Cancel)).Id;
        var batch = Guid.NewGuid().ToString("N");
        await db.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO books (id, title, authors, added_at, updated_at)
            SELECT gen_random_uuid(), {batch} || ' ' || n, ARRAY[]::text[], now(), now() FROM generate_series(1, {ShelfEntry.MaxPerReader}) AS n
            """,
            Cancel);
        await db.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO shelf_entries (user_id, book_id, shelf, added_at, shelved_at)
            SELECT {userId}, id, 'Finished', now(), now() FROM books WHERE title LIKE {batch + " %"}
            """,
            Cancel);
    }
}
