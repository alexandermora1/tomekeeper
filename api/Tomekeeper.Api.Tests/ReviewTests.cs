using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Game;
using Tomekeeper.Api.Profiles;
using Tomekeeper.Api.Reviews;
using Tomekeeper.Api.Shelves;

namespace Tomekeeper.Api.Tests;

/// <summary>Reviews: writing one, who sees it, the profile, removing the book, and The Chronicler.</summary>
public sealed class ReviewTests(PostgresFixture database) : IAsyncLifetime
{
    private TomekeeperApiFactory _api = null!;
    private readonly List<HttpClient> _clients = [];
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

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
        return (client, (await client.GetFromJsonAsync<ProfileSettingsResponse>("/api/profile", Cancel))!.Handle);
    }

    /// <summary>A book only this test knows, in the shared catalogue.</summary>
    private async Task<Guid> CatalogueBook(HttpClient client, string title = "The Winter Road")
    {
        var key = $"OL{Random.Shared.NextInt64(1_000_000_000, 9_999_999_999)}W";
        _api.OpenLibrary.Works.Add(FakeOpenLibrary.Work(key, title, ["Ingrid Berg"], 1999, 320, null));
        var response = await client.PostAsync($"/api/books/open-library/{key}", null, Cancel);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<BookResponse>(Cancel))!.Id;
    }

    private static async Task Shelve(HttpClient client, Guid bookId, string shelf = "finished") =>
        (await client.PutAsJsonAsync($"/api/shelves/{bookId}", new { shelf, readOn = DateTime.UtcNow.ToString("yyyy-MM-dd") }, Cancel)).EnsureSuccessStatusCode();

    private static Task<HttpResponseMessage> Write(HttpClient client, Guid bookId, int? rating, string? text) =>
        client.PutAsJsonAsync($"/api/books/{bookId}/review", new { rating, text }, Cancel);

    private static async Task<ReviewResponse> WriteOk(HttpClient client, Guid bookId, int rating, string? text = null)
    {
        var response = await Write(client, bookId, rating, text);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ReviewResponse>(Cancel))!;
    }

    private static async Task<BookReviewsResponse> Reviews(HttpClient client, Guid bookId) =>
        (await client.GetFromJsonAsync<BookReviewsResponse>($"/api/books/{bookId}/reviews", Cancel))!;

    private static Task Share(HttpClient client, string reviews) =>
        client.PutAsJsonAsync("/api/profile/visibility", new { reviews }, Cancel);

    private static async Task Befriend(HttpClient one, HttpClient two, string oneHandle, string twoHandle)
    {
        (await one.PostAsync($"/api/fellowship/{twoHandle}/ask", null, Cancel)).EnsureSuccessStatusCode();
        (await two.PostAsync($"/api/fellowship/{oneHandle}/accept", null, Cancel)).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task A_reader_reviews_a_book_on_their_shelves_and_can_change_it()
    {
        var (ingrid, handle) = await NewReader("Ingrid");
        var book = await CatalogueBook(ingrid);
        await Shelve(ingrid, book);

        var written = await WriteOk(ingrid, book, 4, "  Cold and slow,\r\nin the best way.  ");

        Assert.Equal((handle, "you", 4, "Cold and slow,\nin the best way.", (DateTimeOffset?)null),
            (written.Reader.Handle, written.Reader.Relation, written.Rating, written.Text, written.EditedAt));
        Assert.Equivalent(written, (await Reviews(ingrid, book)).Mine);
        Assert.True((await ingrid.GetFromJsonAsync<ShelfEntryResponse>($"/api/shelves/{book}", Cancel))!.Reviewed);

        var changed = await WriteOk(ingrid, book, 5);
        Assert.Equal((5, (string?)null, written.WrittenAt), (changed.Rating, changed.Text, changed.WrittenAt));
        Assert.NotNull(changed.EditedAt);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    [InlineData(null)]
    public async Task A_review_needs_1_to_5_stars(int? rating)
    {
        var (ingrid, _) = await NewReader("Ingrid");
        var book = await CatalogueBook(ingrid);
        await Shelve(ingrid, book);

        var response = await Write(ingrid, book, rating, "Fine.");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal(ReviewEndpoints.RatingMessage, problem.GetProperty("errors").GetProperty("rating")[0].GetString());
    }

    [Fact]
    public async Task Long_reviews_and_books_off_the_shelves_are_refused()
    {
        var (ingrid, _) = await NewReader("Ingrid");
        var book = await CatalogueBook(ingrid);

        var unshelved = await Write(ingrid, book, 3, null);
        Assert.Equal(HttpStatusCode.Conflict, unshelved.StatusCode);
        Assert.Equal(ReviewEndpoints.NotShelvedMessage, (await unshelved.Content.ReadFromJsonAsync<JsonElement>(Cancel)).GetProperty("detail").GetString());

        await Shelve(ingrid, book);
        var tooLong = await Write(ingrid, book, 3, new string('a', Review.MaxTextLength + 1));
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Write(ingrid, Guid.NewGuid(), 3, null)).StatusCode);
    }

    [Fact]
    public async Task Others_see_a_review_as_the_reviewer_shares_it()
    {
        var (ingrid, ingridHandle) = await NewReader("Ingrid");
        var (tormod, tormodHandle) = await NewReader("Tormod");
        var (kari, _) = await NewReader("Kari");
        var book = await CatalogueBook(ingrid);
        await Shelve(ingrid, book);
        await WriteOk(ingrid, book, 2, "Not for me.");

        // Friends only, to begin with.
        Assert.Empty((await Reviews(tormod, book)).Others);
        await Befriend(ingrid, tormod, ingridHandle, tormodHandle);
        var seen = Assert.Single((await Reviews(tormod, book)).Others);
        Assert.Equal((ingridHandle, "friend", 2, "Not for me."), (seen.Reader.Handle, seen.Reader.Relation, seen.Rating, seen.Text));
        Assert.Null((await Reviews(tormod, book)).Mine);
        Assert.Empty((await Reviews(kari, book)).Others);

        await Share(ingrid, "everyone");
        Assert.Equal("none", Assert.Single((await Reviews(kari, book)).Others).Reader.Relation);

        await Share(ingrid, "onlyYou");
        Assert.Empty((await Reviews(tormod, book)).Others);
        Assert.NotNull((await Reviews(ingrid, book)).Mine);
    }

    [Fact]
    public async Task The_profile_shows_the_latest_reviews_to_those_who_may_see_them()
    {
        var (ingrid, ingridHandle) = await NewReader("Ingrid");
        var (kari, _) = await NewReader("Kari");
        var first = await CatalogueBook(ingrid, "The First");
        var second = await CatalogueBook(ingrid, "The Second");
        await Shelve(ingrid, first);
        await Shelve(ingrid, second);
        await WriteOk(ingrid, first, 3, "Good.");
        await WriteOk(ingrid, second, 5);

        var own = await ingrid.GetFromJsonAsync<ReaderProfileResponse>($"/api/readers/{ingridHandle}", Cancel);
        Assert.Equal(["The Second", "The First"], own!.Reviews!.Select(r => r.Title));
        Assert.Equal((second, 5), (own.Reviews![0].BookId, own.Reviews[0].Rating));
        var stranger = await kari.GetFromJsonAsync<ReaderProfileResponse>($"/api/readers/{ingridHandle}", Cancel);
        Assert.Null(stranger!.Reviews);
        Assert.True(stranger.SomethingHidden);
    }

    [Fact]
    public async Task Taking_the_book_off_the_shelves_deletes_the_review()
    {
        var (ingrid, _) = await NewReader("Ingrid");
        var book = await CatalogueBook(ingrid);
        await Shelve(ingrid, book);
        await WriteOk(ingrid, book, 4);

        (await ingrid.DeleteAsync($"/api/shelves/{book}", Cancel)).EnsureSuccessStatusCode();

        Assert.Null((await Reviews(ingrid, book)).Mine);
    }

    [Fact]
    public async Task A_review_can_be_deleted()
    {
        var (ingrid, _) = await NewReader("Ingrid");
        var book = await CatalogueBook(ingrid);
        await Shelve(ingrid, book);
        await WriteOk(ingrid, book, 4);

        Assert.Equal(HttpStatusCode.NoContent, (await ingrid.DeleteAsync($"/api/books/{book}/review", Cancel)).StatusCode);

        Assert.Null((await Reviews(ingrid, book)).Mine);
        Assert.False((await ingrid.GetFromJsonAsync<ShelfEntryResponse>($"/api/shelves/{book}", Cancel))!.Reviewed);
    }

    [Fact]
    public async Task Five_reviews_with_words_complete_The_Chronicler()
    {
        var (ingrid, _) = await NewReader("Ingrid");
        var year = DateTime.UtcNow.Year;
        for (var i = 1; i <= 5; i++)
        {
            var book = await CatalogueBook(ingrid, $"Book {i}");
            await Shelve(ingrid, book);
            await WriteOk(ingrid, book, 4, i == 5 ? null : "Worth it.");
        }

        var quests = (await ingrid.GetFromJsonAsync<QuestsResponse>($"/api/quests/{year}", Cancel))!;
        var quill = quests.Quests.Single(q => q.Id == "quill");
        Assert.Equal(("active", 80), (quill.State, quill.Percent));

        var sixth = await CatalogueBook(ingrid, "Book 6");
        await Shelve(ingrid, sixth);
        await WriteOk(ingrid, sixth, 3, "Slow start.");
        quests = (await ingrid.GetFromJsonAsync<QuestsResponse>($"/api/quests/{year}", Cancel))!;
        quill = quests.Quests.Single(q => q.Id == "quill");
        Assert.Equal("done", quill.State);
        Assert.EndsWith("with a review of Book 6.", quill.Progress);
        Assert.Equal(year, quests.Gear.Single(g => g.Item == "quill").EarnedIn);
    }

    [Fact]
    public async Task A_book_added_by_hand_has_no_reviews_for_others()
    {
        var (ingrid, _) = await NewReader("Ingrid");
        var (tormod, _) = await NewReader("Tormod");
        var added = await ingrid.PostAsJsonAsync("/api/books", new { title = "Family Recipes", authors = Array.Empty<string>(), shelf = "finished" }, Cancel);
        var book = (await added.Content.ReadFromJsonAsync<ShelfEntryResponse>(Cancel))!.Book.Id;
        await WriteOk(ingrid, book, 5, "Grandmother's best.");

        Assert.Equal(HttpStatusCode.NotFound, (await tormod.GetAsync($"/api/books/{book}/reviews", Cancel)).StatusCode);
    }
}
