using System.Net;
using System.Net.Http.Json;

namespace Tomekeeper.Api.Tests;

/// <summary>Cover images from (a fake) Open Library, through Tomekeeper's own API.</summary>
public sealed class CoverTests(PostgresFixture database) : IAsyncLifetime
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

    [Fact]
    public async Task A_cover_comes_from_open_library_once_and_may_be_kept_by_the_browser()
    {
        var first = await _client.GetAsync("/api/covers/11481354?size=l", Cancel);
        var second = await _client.GetAsync("/api/covers/11481354?size=l", Cancel);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal("image/jpeg", first.Content.Headers.ContentType?.MediaType);
        Assert.Equal(FakeOpenLibrary.CoverBytes, await first.Content.ReadAsByteArrayAsync(Cancel));
        Assert.Equal("private, max-age=31536000, immutable", first.Headers.NonValidated["Cache-Control"].ToString());
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var request = Assert.Single(_api.OpenLibrary.Requests);
        Assert.Equal("/b/id/11481354-L.jpg", request.RequestUri!.AbsolutePath);
        Assert.Equal("?default=false", request.RequestUri.Query);
    }

    [Fact]
    public async Task The_medium_size_is_the_default()
    {
        (await _client.GetAsync("/api/covers/9255566", Cancel)).EnsureSuccessStatusCode();
        Assert.EndsWith("-M.jpg", Assert.Single(_api.OpenLibrary.Requests).RequestUri!.AbsolutePath);
    }

    [Fact]
    public async Task A_missing_cover_gives_404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/covers/12345", Cancel)).StatusCode);
    }

    [Theory]
    [InlineData("/api/covers/9255566?size=xl")]
    [InlineData("/api/covers/0")]
    [InlineData("/api/covers/-4")]
    public async Task Only_cover_ids_and_the_three_sizes_are_accepted(string path)
    {
        var response = await _client.GetAsync(path, Cancel);
        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.NotFound, response.StatusCode.ToString());
        Assert.Empty(_api.OpenLibrary.Requests);
    }

    [Fact]
    public async Task When_open_library_is_down_the_answer_is_503()
    {
        _api.OpenLibrary.Down = true;
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await _client.GetAsync("/api/covers/9255566", Cancel)).StatusCode);
    }

    [Fact]
    public async Task Covers_are_for_signed_in_readers()
    {
        using var visitor = _api.CreateBrowserClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/covers/9255566", Cancel)).StatusCode);
        Assert.Empty(_api.OpenLibrary.Requests);
    }
}
