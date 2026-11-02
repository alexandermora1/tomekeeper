using System.Net;
using System.Net.Http.Json;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Game;

namespace Tomekeeper.Api.Tests;

/// <summary>Levels and titles, and the XP the API counts from a reader's progress.</summary>
public sealed class CharacterTests(PostgresFixture database) : IAsyncLifetime
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

    [Theory]
    [InlineData(0, 1)]
    [InlineData(549, 1)]
    [InlineData(550, 2)]
    [InlineData(2500, 5)]
    [InlineData(12080, 14)]
    [InlineData(12250, 15)]
    [InlineData(19000, 20)]
    public void Levels_grow_a_little_slower_each_time(int xp, int level)
    {
        Assert.Equal(level, Levels.LevelFor(xp));
    }

    [Theory]
    [InlineData(1, "Novice")]
    [InlineData(4, "Novice")]
    [InlineData(5, "Reader")]
    [InlineData(14, "Wayfarer")]
    [InlineData(15, "Scholar")]
    [InlineData(20, "Sage")]
    [InlineData(57, "Sage")]
    public void Each_level_has_a_title(int level, string title)
    {
        Assert.Equal(title, Levels.TitleFor(level));
    }

    [Fact]
    public async Task Xp_is_a_point_a_page_and_a_quarter_of_the_book_for_finishing_it()
    {
        var key = $"OL{Random.Shared.NextInt64(1_000_000_000, 9_999_999_999)}W";
        _api.OpenLibrary.Works.Add(FakeOpenLibrary.Work(key, "A Book of 400 Pages", ["Ingrid Berg"], 1999, 400, null));
        var book = await (await _client.PostAsync($"/api/books/open-library/{key}", null, Cancel)).Content.ReadFromJsonAsync<BookResponse>(Cancel);
        (await _client.PutAsJsonAsync($"/api/shelves/{book!.Id}", new { shelf = "reading" }, Cancel)).EnsureSuccessStatusCode();
        foreach (var page in new[] { 250, 400 })
        {
            (await _client.PostAsJsonAsync($"/api/shelves/{book.Id}/progress", new { page, readOn = Today.ToString("yyyy-MM-dd") }, Cancel))
                .EnsureSuccessStatusCode();
        }

        var character = await _client.GetFromJsonAsync<CharacterResponse>($"/api/character/{Today.Year}", Cancel);

        Assert.Equal((400, 100, 500), (character!.PagesXp, character.FinishXp, character.Xp));
        Assert.Equal((1, "Novice", 0, 550), (character.Level, character.Title, character.LevelStartsAt, character.NextLevelAt));
        Assert.Equal(5, character.Titles.Count);
        var lastYear = await _client.GetFromJsonAsync<CharacterResponse>($"/api/character/{Today.Year - 1}", Cancel);
        Assert.Equal(0, lastYear!.Xp);
    }

    [Fact]
    public async Task The_character_is_for_signed_in_readers()
    {
        using var visitor = _api.CreateBrowserClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync($"/api/character/{Today.Year}", Cancel)).StatusCode);
    }
}
