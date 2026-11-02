using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Goals;
using Tomekeeper.Api.Shelves;

namespace Tomekeeper.Api.Progress;

/// <param name="PagesRead">Pages logged on the reader's own dates in the year.</param>
/// <param name="BooksFinished">Readings finished in the year, re-reads included.</param>
/// <param name="PagesByMonth">Pages per month, January first: the Twelve Labours.</param>
/// <param name="ReadingNow">The books on the Reading now shelf, latest first.</param>
public sealed record ChronicleResponse(
    int Year,
    GoalResponse? Goal,
    int PagesRead,
    int BooksFinished,
    IReadOnlyList<int> PagesByMonth,
    IReadOnlyList<ShelfEntryResponse> ReadingNow);

/// <summary>The reader's year at a glance, for the chronicle page: GET /api/chronicle/{year}.</summary>
public static class ChronicleEndpoints
{
    public static RouteHandlerBuilder MapChronicleEndpoints(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/chronicle/{year:int}", GetChronicle).WithTags("Chronicle").RequireAuthorization();

    private static async Task<Results<Ok<ChronicleResponse>, NotFound>> GetChronicle(
        int year, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        if (year < 1900 || year > time.GetUtcNow().Year + 1) return TypedResults.NotFound();
        var userId = principal.GetUserId();
        var first = new DateOnly(year, 1, 1);
        var last = new DateOnly(year, 12, 31);

        var goal = await db.Goals.AsNoTracking().FirstOrDefaultAsync(g => g.UserId == userId && g.Year == year, cancellationToken);
        var months = await db.ProgressEntries.AsNoTracking()
            .Where(p => p.UserId == userId && p.ReadOn >= first && p.ReadOn <= last)
            .GroupBy(p => p.ReadOn.Month)
            .Select(g => new { Month = g.Key, Pages = g.Sum(p => p.Pages) })
            .ToListAsync(cancellationToken);
        var pagesByMonth = new int[12];
        foreach (var month in months) pagesByMonth[month.Month - 1] = month.Pages;
        var finished = await db.Readings.CountAsync(
            r => r.UserId == userId && r.FinishedOn >= first && r.FinishedOn <= last, cancellationToken);

        var reading = await db.ShelfEntries.AsNoTracking().Include(e => e.Book)
            .Where(e => e.UserId == userId && e.Shelf == Shelf.Reading)
            .OrderByDescending(e => e.ShelvedAt)
            .ToListAsync(cancellationToken);
        var readingNow = await ShelfEntryResponses.BuildAsync(db, userId, reading.Select(e => (e, e.Book)).ToList(), cancellationToken);

        return TypedResults.Ok(new ChronicleResponse(
            year, goal is null ? null : GoalResponse.From(goal), pagesByMonth.Sum(), finished, pagesByMonth, readingNow));
    }
}
