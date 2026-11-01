using System.Net;
using Microsoft.Extensions.Caching.Memory;

namespace Tomekeeper.Api.Books;

/// <summary>
/// Gets cover images from Open Library's cover store (covers.openlibrary.org). Covers fetched by their id
/// have no rate limit there, so this client has no throttle, unlike the search.
/// </summary>
public sealed class OpenLibraryCoverClient(HttpClient http)
{
    /// <summary>Covers are small (a large one is about 100 KB). Anything bigger than this is refused.</summary>
    public const int MaxBytes = 2_000_000;

    /// <summary>The JPEG for a cover, or null when Open Library has no such cover.</summary>
    /// <param name="size">'S', 'M' or 'L'.</param>
    /// <exception cref="OpenLibraryUnavailableException">Open Library didn't answer, or sent something else than an image.</exception>
    public async Task<byte[]?> GetAsync(int coverId, char size, CancellationToken cancellationToken)
    {
        try
        {
            // default=false: answer 404 for a missing cover, instead of a blank image.
            using var response = await http.GetAsync($"b/id/{coverId}-{size}.jpg?default=false", HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (response.StatusCode == HttpStatusCode.NotFound) return null;
            if (!response.IsSuccessStatusCode
                || response.Content.Headers.ContentType?.MediaType != "image/jpeg"
                || response.Content.Headers.ContentLength > MaxBytes)
            {
                throw new OpenLibraryUnavailableException($"The cover store answered {(int)response.StatusCode} with {response.Content.Headers.ContentType}.");
            }
            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            return bytes.Length <= MaxBytes ? bytes : throw new OpenLibraryUnavailableException("The cover was too big.");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            throw new OpenLibraryUnavailableException("The cover store could not be reached.", ex);
        }
    }
}

/// <summary>
/// Covers kept in memory, so each one is fetched from Open Library once instead of for every reader.
/// The cache has a size limit in bytes; the covers used least recently go first when it is full.
/// </summary>
public sealed class CoverCache : IDisposable
{
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 64_000_000 });

    /// <summary>A cover from the cache, or from Open Library (then kept). Null when there is no such cover.</summary>
    public async Task<byte[]?> GetAsync(int coverId, char size, OpenLibraryCoverClient openLibrary, CancellationToken cancellationToken)
    {
        var key = $"{coverId}-{size}";
        if (_cache.TryGetValue(key, out byte[]? cached)) return cached!.Length == 0 ? null : cached;

        var bytes = await openLibrary.GetAsync(coverId, size, cancellationToken);
        // A missing cover is kept too, as an empty array, but only for an hour: one may be uploaded later.
        _cache.Set(key, bytes ?? [], new MemoryCacheEntryOptions
        {
            Size = Math.Max(bytes?.Length ?? 0, 1),
            SlidingExpiration = bytes is null ? null : TimeSpan.FromDays(7),
            AbsoluteExpirationRelativeToNow = bytes is null ? TimeSpan.FromHours(1) : null,
        });
        return bytes;
    }

    public void Dispose() => _cache.Dispose();
}

/// <summary>Cover images through Tomekeeper's own API, under /api/covers, so readers' browsers never contact Open Library.</summary>
public static class CoverEndpoints
{
    public static RouteGroupBuilder MapCoverEndpoints(this IEndpointRouteBuilder app)
    {
        var covers = app.MapGroup("/api/covers").WithTags("Covers").RequireAuthorization();
        covers.MapGet("/{coverId:int:min(1)}", GetCover);
        return covers;
    }

    /// <param name="size">"s" (about 40 pixels wide), "m" (about 180) or "l" (about 500). "m" if left out.</param>
    private static async Task<IResult> GetCover(
        int coverId, string? size, HttpContext http, CoverCache cache, OpenLibraryCoverClient openLibrary, CancellationToken cancellationToken)
    {
        char? letter = (size ?? "m") switch { "s" => 'S', "m" => 'M', "l" => 'L', _ => null };
        if (letter is null) return TypedResults.BadRequest();

        byte[]? bytes;
        try
        {
            bytes = await cache.GetAsync(coverId, letter.Value, openLibrary, cancellationToken);
        }
        catch (OpenLibraryUnavailableException)
        {
            return TypedResults.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }
        if (bytes is null) return TypedResults.NotFound();

        // A cover id always shows the same picture, so the browser may keep it for a year.
        http.Response.Headers.CacheControl = "private, max-age=31536000, immutable";
        return TypedResults.File(bytes, "image/jpeg");
    }
}
