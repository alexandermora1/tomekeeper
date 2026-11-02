using System.Net;
using System.Net.Http.Json;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Game;

namespace Tomekeeper.Api.Tests;

/// <summary>Attributes, which grow for as long as the reader reads, and the year's volume.</summary>
public sealed class LegacyTests(PostgresFixture database) : IAsyncLifetime
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

    private async Task Read(string author, int pages, int reach, string[] subjects)
    {
        var key = $"OL{Random.Shared.NextInt64(1_000_000_000, 9_999_999_999)}W";
        _api.OpenLibrary.Works.Add(FakeOpenLibrary.Work(key, $"A Book by {author}", [author], 1999, pages, null, subjects));
        var book = await (await _client.PostAsync($"/api/books/open-library/{key}", null, Cancel)).Content.ReadFromJsonAsync<BookResponse>(Cancel);
        (await _client.PutAsJsonAsync($"/api/shelves/{book!.Id}", new { shelf = "reading" }, Cancel)).EnsureSuccessStatusCode();
        (await _client.PostAsJsonAsync($"/api/shelves/{book.Id}/progress", new { page = reach, readOn = Today.ToString("yyyy-MM-dd") }, Cancel))
            .EnsureSuccessStatusCode();
    }

    private async Task<LegacyResponse> Legacy() => (await _client.GetFromJsonAsync<LegacyResponse>("/api/legacy", Cancel))!;

    [Fact]
    public async Task Attributes_count_the_pages_of_each_kind_a_point_per_500()
    {
        await Read("Ingrid Berg", 900, 700, ["Fantasy fiction"]);   // long, fiction, new author
        await Read("Ingrid Berg", 300, 300, ["History"]);           // nonfiction, same author: not new
        await Read("Kari Lund", 200, 150, ["Biography"]);           // nonfiction, new author

        var attributes = (await Legacy()).Attributes.ToDictionary(a => a.Name);

        Assert.Equal((700, 1, 300), (attributes["Endurance"].Pages, attributes["Endurance"].Value, attributes["Endurance"].ToNext));
        Assert.Equal(450, attributes["Wisdom"].Pages);
        Assert.Equal(700, attributes["Imagination"].Pages);
        Assert.Equal((850, 1), (attributes["Wanderlust"].Pages, attributes["Wanderlust"].Value));
        Assert.Equal("Pages by authors new to you", attributes["Wanderlust"].From);
    }

    [Fact]
    public async Task The_year_going_on_is_a_volume_with_its_pages_books_level_and_quests()
    {
        await Read("Ingrid Berg", 400, 400, ["Fiction"]);

        var volume = Assert.Single((await Legacy()).Volumes);

        Assert.Equal((Today.Year, 400, 1, 1, 0), (volume.Year, volume.Pages, volume.Books, volume.Level, volume.Quests));
    }

    [Fact]
    public async Task A_new_reader_has_no_points_and_one_empty_volume()
    {
        var legacy = await Legacy();

        Assert.All(legacy.Attributes, a => Assert.Equal((0, 500), (a.Value, a.ToNext)));
        Assert.Equal((Today.Year, 0), (Assert.Single(legacy.Volumes).Year, legacy.Volumes[0].Pages));
    }

    [Fact]
    public async Task The_legacy_is_for_signed_in_readers()
    {
        using var visitor = _api.CreateBrowserClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/legacy", Cancel)).StatusCode);
    }
}
