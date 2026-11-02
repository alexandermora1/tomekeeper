using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;

namespace Tomekeeper.Api.Game;

/// <param name="Pages">All pages of this kind the reader has logged, in every year.</param>
/// <param name="Value">One point per 500 pages.</param>
/// <param name="ToNext">Pages until the next point.</param>
public sealed record AttributeResponse(string Name, string From, int Pages, int Value, int ToNext);

/// <param name="Year">The year of the volume. The year going on is a volume too, still being written.</param>
/// <param name="Quests">Quests done that year, of six.</param>
public sealed record VolumeResponse(int Year, int Pages, int Books, int Level, int Quests);

public sealed record LegacyResponse(IReadOnlyList<AttributeResponse> Attributes, IReadOnlyList<VolumeResponse> Volumes);

/// <summary>
/// What a reader keeps from year to year: attributes, which grow for as long as they read, and volumes, one for
/// each year with its pages, books, level and quests. GET /api/legacy.
/// </summary>
public static class Legacy
{
    public const int PagesPerPoint = 500;

    /// <summary>Books longer than this count for Endurance.</summary>
    public const int LongBook = 600;

    public static RouteHandlerBuilder MapLegacyEndpoints(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/legacy", GetLegacy).WithTags("Game").RequireAuthorization();

    private static async Task<Ok<LegacyResponse>> GetLegacy(
        ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var userId = principal.GetUserId();
        var now = time.GetUtcNow();
        return TypedResults.Ok(new LegacyResponse(
            await AttributesAsync(db, userId, cancellationToken),
            await VolumesAsync(db, userId, now, cancellationToken)));
    }

    public static async Task<IReadOnlyList<AttributeResponse>> AttributesAsync(
        TomekeeperDbContext db, Guid userId, CancellationToken cancellationToken)
    {
        // Pages per book, and when the reader first logged it, for every book with progress.
        var read = await db.ProgressEntries.AsNoTracking()
            .Where(p => p.UserId == userId)
            .GroupBy(p => p.BookId)
            .Select(g => new { BookId = g.Key, Pages = g.Sum(p => p.Pages), First = g.Min(p => p.LoggedAt) })
            .ToListAsync(cancellationToken);
        var books = await db.ShelfEntries.AsNoTracking().Include(e => e.Book)
            .Where(e => e.UserId == userId)
            .ToDictionaryAsync(e => e.BookId, cancellationToken);

        int endurance = 0, wisdom = 0, imagination = 0, wanderlust = 0;
        // A book is by authors new to the reader when none of its authors wrote a book they started before.
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var book in read.OrderBy(r => r.First))
        {
            if (!books.TryGetValue(book.BookId, out var entry)) continue;
            if ((entry.PageCount ?? entry.Book.PageCount) > LongBook) endurance += book.Pages;
            switch (entry.Fiction ?? entry.Book.Fiction)
            {
                case false: wisdom += book.Pages; break;
                case true: imagination += book.Pages; break;
            }
            var authors = entry.Book.Authors;
            if (authors.Count > 0 && !authors.Any(seen.Contains)) wanderlust += book.Pages;
            seen.UnionWith(authors);
        }

        return
        [
            Attribute("Endurance", $"Pages in books over {LongBook} pages", endurance),
            Attribute("Wisdom", "Nonfiction pages", wisdom),
            Attribute("Imagination", "Fiction pages", imagination),
            Attribute("Wanderlust", "Pages by authors new to you", wanderlust),
        ];
    }

    private static AttributeResponse Attribute(string name, string from, int pages) =>
        new(name, from, pages, pages / PagesPerPoint, PagesPerPoint - pages % PagesPerPoint);

    /// <summary>One volume for each year with progress, and for the year going on; the newest first.</summary>
    public static async Task<IReadOnlyList<VolumeResponse>> VolumesAsync(
        TomekeeperDbContext db, Guid userId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var years = await db.ProgressEntries.AsNoTracking()
            .Where(p => p.UserId == userId)
            .Select(p => p.ReadOn.Year)
            .Distinct()
            .ToListAsync(cancellationToken);
        var volumes = new List<VolumeResponse>();
        foreach (var year in years.Append(now.Year).Distinct().Where(y => y <= now.Year).OrderDescending())
        {
            var sheet = await CharacterSheet.ForYearAsync(db, userId, year, cancellationToken);
            var quests = await Quests.ForYearAsync(db, userId, year, now, cancellationToken);
            var first = new DateOnly(year, 1, 1);
            var last = new DateOnly(year, 12, 31);
            var books = await db.Readings.CountAsync(
                r => r.UserId == userId && r.FinishedOn >= first && r.FinishedOn <= last, cancellationToken);
            volumes.Add(new VolumeResponse(year, sheet.PagesXp, books, sheet.Level, quests.Quests.Count(q => q.State == "done")));
        }
        return volumes;
    }
}
