using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Data;

namespace Tomekeeper.Api.Tests;

/// <summary>Finding books on (a fake) Open Library and keeping them in the catalogue.</summary>
public sealed class BookTests(PostgresFixture database) : IAsyncLifetime
{
    private TomekeeperApiFactory _api = null!;
    private HttpClient _client = null!;
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

    /// <summary>A work only this test uses, so tests sharing the database don't see each other's books.</summary>
    private string AddUniqueWork(string title, int? pages = 300)
    {
        var key = $"OL{Random.Shared.NextInt64(1_000_000_000, 9_999_999_999)}W";
        _api.OpenLibrary.Works.Add(FakeOpenLibrary.Work(key, title, ["Ingrid Berg"], 1999, pages, null));
        return key;
    }

    private Task<BookSearchResponse?> Search(string q) =>
        _client.GetFromJsonAsync<BookSearchResponse>($"/api/books/search?q={Uri.EscapeDataString(q)}", Cancel);

    [Fact]
    public async Task Searching_returns_what_open_library_found()
    {
        var found = await Search("dune");

        var dune = Assert.Single(found!.Results);
        Assert.Equal(1, found.Total);
        Assert.Equal("OL893415W", dune.OpenLibraryKey);
        Assert.Equal("Dune", dune.Title);
        Assert.Equal(["Frank Herbert"], dune.Authors);
        Assert.Equal(1965, dune.FirstPublishedYear);
        Assert.Equal(604, dune.PageCount);
        Assert.Equal(11481354, dune.CoverId);
    }

    [Fact]
    public async Task The_search_asks_open_library_politely()
    {
        await Search("tolkien");

        var request = Assert.Single(_api.OpenLibrary.Requests);
        var query = request.RequestUri!.Query;
        Assert.Contains("q=tolkien", query);
        Assert.Contains("fields=key%2Ctitle", query.Replace(",", "%2C"));
        Assert.Contains("limit=20", query);
        Assert.StartsWith("Tomekeeper/", request.Headers.UserAgent.ToString());
    }

    [Fact]
    public async Task The_same_search_again_is_answered_from_memory()
    {
        await Search("Dune");
        await Search("  dune ");

        Assert.Single(_api.OpenLibrary.Requests);
    }

    [Theory]
    [InlineData("")]
    [InlineData("a")]
    public async Task A_search_needs_at_least_two_characters(string q)
    {
        var response = await _client.GetAsync($"/api/books/search?q={q}", Cancel);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal("Type a title, an author or an ISBN.", problem.GetProperty("errors").GetProperty("q")[0].GetString());
    }

    [Fact]
    public async Task When_open_library_is_down_the_reader_is_told()
    {
        _api.OpenLibrary.Down = true;

        var response = await _client.GetAsync("/api/books/search?q=dune", Cancel);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal(BookEndpoints.OpenLibraryDownMessage, problem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Adding_a_book_saves_it_in_the_catalogue_once()
    {
        var key = AddUniqueWork("A Book Only This Test Knows", pages: 412);

        var first = await _client.PostAsync($"/api/books/open-library/{key}", null, Cancel);
        var second = await _client.PostAsync($"/api/books/open-library/{key}", null, Cancel);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var book = await first.Content.ReadFromJsonAsync<BookResponse>(Cancel);
        // Records with a list inside compare the lists by reference, so compare them field by field.
        Assert.Equivalent(book, await second.Content.ReadFromJsonAsync<BookResponse>(Cancel));
        Assert.Equal("A Book Only This Test Knows", book!.Title);
        Assert.Equal(412, book.PageCount);
        Assert.Equivalent(book, await _client.GetFromJsonAsync<BookResponse>($"/api/books/{book.Id}", Cancel));

        await using var scope = _api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>();
        Assert.Equal(1, db.Books.Count(b => b.OpenLibraryKey == key));
    }

    [Fact]
    public async Task Search_results_say_which_books_are_already_in_the_catalogue()
    {
        var key = AddUniqueWork("Catalogued Already");
        var added = await (await _client.PostAsync($"/api/books/open-library/{key}", null, Cancel)).Content.ReadFromJsonAsync<BookResponse>(Cancel);
        AddUniqueWork("Catalogued Not Yet");

        var found = await Search("catalogued");

        Assert.Equal(added!.Id, found!.Results.Single(r => r.Title == "Catalogued Already").BookId);
        Assert.Null(found.Results.Single(r => r.Title == "Catalogued Not Yet").BookId);
    }

    [Fact]
    public async Task Adding_a_book_open_library_does_not_have_gives_404()
    {
        var response = await _client.PostAsync("/api/books/open-library/OL1W", null, Cancel);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal(BookEndpoints.NotOnOpenLibraryMessage, problem.GetProperty("detail").GetString());
    }

    [Theory]
    [InlineData("OL123M")]
    [InlineData("27448")]
    [InlineData("OL27448W%20OR%20x")]
    public async Task Only_open_library_work_ids_are_accepted(string key)
    {
        var response = await _client.PostAsync($"/api/books/open-library/{key}", null, Cancel);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(_api.OpenLibrary.Requests);
    }

    [Fact]
    public async Task Books_are_for_signed_in_readers()
    {
        using var visitor = _api.CreateBrowserClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/books/search?q=dune", Cancel)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.PostAsync("/api/books/open-library/OL893415W", null, Cancel)).StatusCode);
        Assert.Empty(_api.OpenLibrary.Requests);
    }

    [Fact]
    public async Task An_unknown_book_id_gives_404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/books/{Guid.NewGuid()}", Cancel)).StatusCode);
    }
}
