using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace Tomekeeper.Api.Books;

public sealed class OpenLibraryOptions
{
    public const string Section = "OpenLibrary";

    public string BaseUrl { get; set; } = "https://openlibrary.org/";

    /// <summary>
    /// Open Library asks apps to say who they are and how to reach them, and gives identified apps a higher limit.
    /// Set your email here (or with dotnet user-secrets) to add it to the User-Agent header.
    /// </summary>
    public string? ContactEmail { get; set; }
}

/// <summary>A work as Open Library's search returns it.</summary>
public sealed record OpenLibraryWork(
    string Key,
    string Title,
    string? Subtitle,
    IReadOnlyList<string> Authors,
    int? FirstPublishedYear,
    int? PageCount,
    int? CoverId,
    int? EditionCount);

public sealed record OpenLibrarySearch(int Total, IReadOnlyList<OpenLibraryWork> Works);

/// <summary>Open Library couldn't be reached, or answered with an error.</summary>
public sealed class OpenLibraryUnavailableException(string message, Exception? inner = null) : Exception(message, inner);

/// <summary>
/// Talks to Open Library's search API (https://openlibrary.org/dev/docs/api/search). Following Open Library's
/// rules for apps: it says who it is in the User-Agent, stays under 3 requests a second, and keeps answers
/// for a while instead of asking again.
/// </summary>
public sealed class OpenLibraryClient(HttpClient http, IMemoryCache cache, ILogger<OpenLibraryClient> logger)
{
    /// <summary>Only the fields Tomekeeper uses, which keeps Open Library's work and the answer small.</summary>
    private const string Fields = "key,title,subtitle,author_name,first_publish_year,number_of_pages_median,cover_i,edition_count";

    private static readonly TimeSpan SearchCacheTime = TimeSpan.FromMinutes(10);

    public async Task<OpenLibrarySearch> SearchAsync(string query, int limit, CancellationToken cancellationToken)
    {
        var normalized = string.Join(' ', query.Split(' ', StringSplitOptions.RemoveEmptyEntries)).ToLowerInvariant();
        var cacheKey = $"openlibrary:search:{limit}:{normalized}";
        if (cache.TryGetValue(cacheKey, out OpenLibrarySearch? cached) && cached is not null) return cached;

        var result = await GetSearchAsync($"search.json?q={Uri.EscapeDataString(normalized)}&fields={Fields}&limit={limit}", cancellationToken);
        cache.Set(cacheKey, result, SearchCacheTime);
        return result;
    }

    /// <summary>One work by its key, such as "OL27448W", or null if Open Library doesn't know it.</summary>
    public async Task<OpenLibraryWork?> GetWorkAsync(string key, CancellationToken cancellationToken)
    {
        var query = Uri.EscapeDataString($"key:\"/works/{key}\"");
        var result = await GetSearchAsync($"search.json?q={query}&fields={Fields}&limit=1", cancellationToken);
        return result.Works.FirstOrDefault(w => w.Key == key);
    }

    private async Task<OpenLibrarySearch> GetSearchAsync(string pathAndQuery, CancellationToken cancellationToken)
    {
        SearchResponse? response;
        try
        {
            using var answer = await http.GetAsync(pathAndQuery, cancellationToken);
            if (!answer.IsSuccessStatusCode)
            {
                throw new OpenLibraryUnavailableException($"Open Library answered {(int)answer.StatusCode}.");
            }
            response = await answer.Content.ReadFromJsonAsync<SearchResponse>(cancellationToken);
        }
        catch (Exception ex) when (ex is HttpRequestException or JsonException
                                       || (ex is TaskCanceledException && !cancellationToken.IsCancellationRequested))
        {
            logger.LogWarning(ex, "Open Library could not be reached.");
            throw new OpenLibraryUnavailableException("Open Library could not be reached.", ex);
        }

        var works = (response?.Docs ?? [])
            .Where(d => d.Key is not null && d.Title is not null)
            .Select(d => new OpenLibraryWork(
                Key: d.Key!.Replace("/works/", "", StringComparison.Ordinal),
                Title: d.Title!.Trim(),
                Subtitle: string.IsNullOrWhiteSpace(d.Subtitle) ? null : d.Subtitle.Trim(),
                Authors: d.AuthorName ?? [],
                FirstPublishedYear: d.FirstPublishYear,
                PageCount: d.NumberOfPagesMedian is > 0 ? d.NumberOfPagesMedian : null,
                CoverId: d.CoverI is > 0 ? d.CoverI : null,
                EditionCount: d.EditionCount))
            .ToList();
        return new OpenLibrarySearch(response?.NumFound ?? response?.NumFoundSnake ?? works.Count, works);
    }

    private sealed record SearchResponse(
        [property: JsonPropertyName("numFound")] int? NumFound,
        [property: JsonPropertyName("num_found")] int? NumFoundSnake,
        [property: JsonPropertyName("docs")] List<SearchDoc>? Docs);

    private sealed record SearchDoc(
        [property: JsonPropertyName("key")] string? Key,
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("subtitle")] string? Subtitle,
        [property: JsonPropertyName("author_name")] List<string>? AuthorName,
        [property: JsonPropertyName("first_publish_year")] int? FirstPublishYear,
        [property: JsonPropertyName("number_of_pages_median")] int? NumberOfPagesMedian,
        [property: JsonPropertyName("cover_i")] int? CoverI,
        [property: JsonPropertyName("edition_count")] int? EditionCount);
}

/// <summary>Keeps all calls to Open Library from this server under 3 a second, waiting briefly when needed.</summary>
public sealed class OpenLibraryThrottle(OpenLibraryRateLimiter limiter) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var lease = await limiter.Limiter.AcquireAsync(1, cancellationToken);
        if (!lease.IsAcquired) return new HttpResponseMessage(HttpStatusCode.TooManyRequests) { RequestMessage = request };
        return await base.SendAsync(request, cancellationToken);
    }
}

/// <summary>The one limiter all calls share. A singleton, because the HTTP client's handlers are created afresh now and then.</summary>
public sealed class OpenLibraryRateLimiter : IDisposable
{
    public TokenBucketRateLimiter Limiter { get; } = new(new TokenBucketRateLimiterOptions
    {
        TokenLimit = 3,
        TokensPerPeriod = 3,
        ReplenishmentPeriod = TimeSpan.FromSeconds(1),
        QueueLimit = 30,
        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
    });

    public void Dispose() => Limiter.Dispose();
}
