using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Shelves;

namespace Tomekeeper.Api.Tests;

/// <summary>Books Open Library doesn't have, added by hand. They belong to the reader who added them.</summary>
public sealed class HandBookTests(PostgresFixture database) : IAsyncLifetime
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

    private Task<HttpResponseMessage> Add(object book, HttpClient? client = null) =>
        (client ?? _client).PostAsJsonAsync("/api/books", book, Cancel);

    private async Task<ShelfEntryResponse> AddOk(string title = "Grandmother's Recipes")
    {
        var response = await Add(new { title, authors = new[] { "Ingrid Berg", " " }, firstPublishedYear = 1971, pageCount = 88, shelf = "reading" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ShelfEntryResponse>(Cancel))!;
    }

    [Fact]
    public async Task A_book_added_by_hand_goes_on_the_chosen_shelf()
    {
        var entry = await AddOk();

        Assert.Equal("reading", entry.Shelf);
        Assert.Null(entry.Book.OpenLibraryKey);
        Assert.Equal(["Ingrid Berg"], entry.Book.Authors);
        Assert.Equal(88, entry.Book.PageCount);
        Assert.Equivalent(entry, Assert.Single((await _client.GetFromJsonAsync<ShelvesResponse>("/api/shelves", Cancel))!.Books));
        Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync($"/api/books/{entry.Book.Id}", Cancel)).StatusCode);
    }

    [Fact]
    public async Task Nobody_else_can_see_or_shelve_it()
    {
        var entry = await AddOk();
        using var other = (await NewReader()).Client;

        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/books/{entry.Book.Id}", Cancel)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync($"/api/shelves/{entry.Book.Id}", new { shelf = "reading" }, Cancel)).StatusCode);
    }

    [Fact]
    public async Task Every_problem_is_reported_by_field()
    {
        var response = await Add(new { title = " ", firstPublishedYear = 9999, pageCount = 0, shelf = "somewhere" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>(Cancel)).GetProperty("errors");
        Assert.Equal("Enter the title.", errors.GetProperty("title")[0].GetString());
        Assert.StartsWith("Enter a year from 1 to", errors.GetProperty("firstPublishedYear")[0].GetString());
        Assert.Equal(ShelfEndpoints.PageCountMessage, errors.GetProperty("pageCount")[0].GetString());
        Assert.Equal(ShelfEndpoints.ChooseShelfMessage, errors.GetProperty("shelf")[0].GetString());
    }

    [Fact]
    public async Task Removing_it_from_the_shelves_deletes_it()
    {
        var entry = await AddOk();

        (await _client.DeleteAsync($"/api/shelves/{entry.Book.Id}", Cancel)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/books/{entry.Book.Id}", Cancel)).StatusCode);
    }

    [Fact]
    public async Task Deleting_the_account_deletes_the_books_added_by_hand()
    {
        var entry = await AddOk();

        (await _client.PostAsJsonAsync("/api/account/delete", new { email = _email, password = Password }, Cancel)).EnsureSuccessStatusCode();

        await using var scope = _api.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>();
        Assert.False(await db.Books.AnyAsync(b => b.Id == entry.Book.Id, Cancel));
    }

    [Fact]
    public async Task Adding_by_hand_is_for_signed_in_readers()
    {
        using var visitor = _api.CreateBrowserClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Add(new { title = "X", shelf = "reading" }, visitor)).StatusCode);
    }
}
