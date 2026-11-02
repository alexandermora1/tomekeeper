using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Shelves;

namespace Tomekeeper.Api.Progress;

/// <param name="Page">The page reached. Send this or <paramref name="Percent"/>.</param>
/// <param name="Percent">How far through, for ebooks and audiobooks. Turned into a page with the page count.</param>
/// <param name="ReadOn">Today's date where the reader is, as yyyy-mm-dd.</param>
public sealed record ProgressRequest(int? Page, decimal? Percent, string? ReadOn);

public sealed record FinishRequest(string? ReadOn);

public sealed record ReadingResponse(Guid Id, DateOnly StartedOn, DateOnly? FinishedOn, int Page)
{
    public static ReadingResponse From(Reading reading) => new(reading.Id, reading.StartedOn, reading.FinishedOn, reading.Page);
}

public sealed record ProgressEntryResponse(Guid Id, DateOnly ReadOn, int Page, int Pages, bool Finished);

/// <param name="Entry">The book on the reader's shelves, after the change (logging can move it to another shelf).</param>
/// <param name="Reading">The latest reading: in progress, or the one finished last. Null before the first entry.</param>
/// <param name="Entries">The entries of that reading, newest first.</param>
/// <param name="EarlierReadings">Readings before it, newest first.</param>
public sealed record ProgressResponse(
    ShelfEntryResponse Entry,
    ReadingResponse? Reading,
    IReadOnlyList<ProgressEntryResponse> Entries,
    IReadOnlyList<ReadingResponse> EarlierReadings);

/// <summary>Logging progress in a book on the reader's shelves, under /api/shelves/{bookId}/progress.</summary>
public static class ProgressEndpoints
{
    public const string NothingToFinishMessage = "There is no reading in progress to finish. Log the page you've reached first.";
    public const string PercentNeedsPagesMessage = "A percentage needs the page count. Enter the pages in your edition first, or log a page.";

    public static RouteGroupBuilder MapProgressEndpoints(this IEndpointRouteBuilder app)
    {
        var progress = app.MapGroup("/api/shelves/{bookId:guid}/progress").WithTags("Progress").RequireAuthorization();
        progress.MapGet("/", GetProgress);
        progress.MapPost("/", LogProgress);
        progress.MapPost("/finish", FinishReading);
        progress.MapDelete("/latest", UndoLatest);
        return progress;
    }

    private static async Task<Results<Ok<ProgressResponse>, NotFound>> GetProgress(
        Guid bookId, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var entry = await FindAsync(db, principal.GetUserId(), bookId, cancellationToken);
        return entry is null ? TypedResults.NotFound() : TypedResults.Ok(await DescribeAsync(db, entry, cancellationToken));
    }

    private static async Task<Results<Ok<ProgressResponse>, ValidationProblem, NotFound>> LogProgress(
        Guid bookId, ProgressRequest request, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var errors = new FieldErrors();
        if (!ReadingDays.TryRead(request.ReadOn, time, out var readOn)) errors.Add("readOn", ReadingDays.Message);
        var entry = await FindAsync(db, principal.GetUserId(), bookId, cancellationToken);
        if (entry is null) return TypedResults.NotFound();

        var reading = await ReadingLog.OpenReadingAsync(db, entry.UserId, bookId, cancellationToken);
        var position = reading?.Page ?? 0;
        var count = ReadingLog.PageCountOf(entry, entry.Book);
        var field = request.Percent is null ? "page" : "percent";
        int page = 0;
        if (request.Page is null == request.Percent is null)
        {
            errors.Add("page", "Enter the page you've reached.");
        }
        else if (request.Percent is { } percent)
        {
            if (count is null) errors.Add(field, PercentNeedsPagesMessage);
            else if (percent <= 0 || percent > 100) errors.Add(field, "Enter a percentage from 1 to 100.");
            else page = Math.Max(1, (int)Math.Round(count.Value * percent / 100m, MidpointRounding.AwayFromZero));
        }
        else
        {
            page = request.Page!.Value;
            if (page < 1 || page > ShelfEntry.MaxPageCount) errors.Add(field, $"Enter a page from 1 to {ShelfEntry.MaxPageCount:N0}.");
        }
        if (!errors.Has(field) && !errors.Has("page"))
        {
            if (count is { } pages && page > pages)
            {
                errors.Add(field, $"This book has {pages:N0} pages. If your edition has more, change the pages in your edition first.");
            }
            else if (page <= position)
            {
                errors.Add(field, $"You're already on page {position:N0}. Enter a later page, or undo the last entry.");
            }
        }
        if (errors.Any) return errors.ToProblem();

        ReadingLog.Log(db, entry, entry.Book, reading, page, readOn, Now(time));
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(await DescribeAsync(db, entry, cancellationToken));
    }

    private static async Task<Results<Ok<ProgressResponse>, ValidationProblem, ProblemHttpResult, NotFound>> FinishReading(
        Guid bookId, FinishRequest request, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        if (!ReadingDays.TryRead(request.ReadOn, time, out var readOn)) return new FieldErrors().Add("readOn", ReadingDays.Message).ToProblem();
        var entry = await FindAsync(db, principal.GetUserId(), bookId, cancellationToken);
        if (entry is null) return TypedResults.NotFound();
        var reading = await ReadingLog.OpenReadingAsync(db, entry.UserId, bookId, cancellationToken);
        if (reading is null)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "Nothing to finish", detail: NothingToFinishMessage);
        }

        ReadingLog.Finish(db, entry, entry.Book, reading, readOn, Now(time));
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(await DescribeAsync(db, entry, cancellationToken));
    }

    private static async Task<Results<Ok<ProgressResponse>, NotFound>> UndoLatest(
        Guid bookId, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var entry = await FindAsync(db, principal.GetUserId(), bookId, cancellationToken);
        if (entry is null || !await ReadingLog.UndoAsync(db, entry, Now(time), cancellationToken)) return TypedResults.NotFound();
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(await DescribeAsync(db, entry, cancellationToken));
    }

    private static Task<ShelfEntry?> FindAsync(TomekeeperDbContext db, Guid userId, Guid bookId, CancellationToken cancellationToken) =>
        db.ShelfEntries.Include(e => e.Book).FirstOrDefaultAsync(e => e.UserId == userId && e.BookId == bookId, cancellationToken);

    /// <summary>PostgreSQL keeps microseconds, so times are cut to them and the answers match the database.</summary>
    private static DateTimeOffset Now(TimeProvider time)
    {
        var now = time.GetUtcNow();
        return now.AddTicks(-(now.Ticks % 10));
    }

    private static async Task<ProgressResponse> DescribeAsync(TomekeeperDbContext db, ShelfEntry entry, CancellationToken cancellationToken)
    {
        var readings = await db.Readings.AsNoTracking()
            .Where(r => r.UserId == entry.UserId && r.BookId == entry.BookId)
            .OrderByDescending(r => r.Id)
            .ToListAsync(cancellationToken);
        var latest = readings.FirstOrDefault();
        var entries = latest is null
            ? []
            : await db.ProgressEntries.AsNoTracking()
                .Where(p => p.ReadingId == latest.Id)
                .OrderByDescending(p => p.Id)
                .Select(p => new ProgressEntryResponse(p.Id, p.ReadOn, p.Page, p.Pages, p.Finished))
                .ToListAsync(cancellationToken);
        var shelfEntry = await ShelfEntryResponses.BuildAsync(db, entry.UserId, [(entry, entry.Book)], cancellationToken);
        return new ProgressResponse(
            shelfEntry[0],
            latest is null ? null : ReadingResponse.From(latest),
            entries,
            readings.Skip(1).Select(ReadingResponse.From).ToList());
    }
}
