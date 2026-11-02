using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Progress;

namespace Tomekeeper.Api.Shelves;

/// <param name="Shelf">"reading", "wantToRead", "finished" or "setAside".</param>
/// <param name="ReadOn">Today's date where the reader is (yyyy-mm-dd). Moving a book in progress to Finished finishes it on this day.</param>
public sealed record ShelfRequest(string? Shelf, string? ReadOn = null);

/// <param name="PageCount">The reader's own page count for the book, or null to use the book's usual one.</param>
public sealed record PageCountRequest(int? PageCount);

/// <param name="Shelf">"reading", "wantToRead", "finished" or "setAside".</param>
/// <param name="PageCount">The page count of the reader's own edition, if they have set one.</param>
/// <param name="Page">The page reached in the reading in progress, or null when none is.</param>
/// <param name="PagesRead">All pages logged for the book, in every reading.</param>
/// <param name="Fiction">The reader's own say on fiction or nonfiction, if they gave one (the book's guess is in Book).</param>
public sealed record ShelfEntryResponse(BookResponse Book, string Shelf, DateTimeOffset ShelvedAt, int? PageCount, int? Page, int PagesRead, bool? Fiction);

/// <param name="Fiction">True for fiction, false for nonfiction, null to go back to Tomekeeper's guess.</param>
public sealed record KindRequest(bool? Fiction);

public static class ShelfEntryResponses
{
    /// <summary>Answers for books on one reader's shelves, with their progress: two queries for the whole list.</summary>
    public static async Task<IReadOnlyList<ShelfEntryResponse>> BuildAsync(
        TomekeeperDbContext db, Guid userId, IReadOnlyList<(ShelfEntry Entry, Book Book)> entries, CancellationToken cancellationToken)
    {
        // For a few books, ask about those; for a whole shelf list, ask about all of the reader's books.
        var ids = entries.Select(e => e.Entry.BookId).ToList();
        var few = ids.Count <= 20;
        var open = await db.Readings.AsNoTracking()
            .Where(r => r.UserId == userId && r.FinishedOn == null && (!few || ids.Contains(r.BookId)))
            .ToDictionaryAsync(r => r.BookId, r => r.Page, cancellationToken);
        var read = await db.ProgressEntries.AsNoTracking()
            .Where(p => p.UserId == userId && (!few || ids.Contains(p.BookId)))
            .GroupBy(p => p.BookId)
            .Select(g => new { BookId = g.Key, Pages = g.Sum(p => p.Pages) })
            .ToDictionaryAsync(x => x.BookId, x => x.Pages, cancellationToken);
        return entries
            .Select(e => new ShelfEntryResponse(
                BookResponse.From(e.Book), e.Entry.Shelf.ToApiName(), e.Entry.ShelvedAt, e.Entry.PageCount,
                open.TryGetValue(e.Entry.BookId, out var page) ? page : null,
                read.GetValueOrDefault(e.Entry.BookId),
                e.Entry.Fiction))
            .ToList();
    }

    public static async Task<ShelfEntryResponse> BuildAsync(
        TomekeeperDbContext db, ShelfEntry entry, Book book, CancellationToken cancellationToken) =>
        (await BuildAsync(db, entry.UserId, [(entry, book)], cancellationToken))[0];
}

/// <param name="Books">Every book on the reader's shelves, the most recently shelved first.</param>
public sealed record ShelvesResponse(IReadOnlyList<ShelfEntryResponse> Books);

/// <summary>The signed-in reader's shelves, under /api/shelves. Nobody else can see them (yet: profiles come in stage 5).</summary>
public static class ShelfEndpoints
{
    public const string ChooseShelfMessage = "Choose a shelf.";

    public static readonly string PageCountMessage = $"Enter a number of pages from 1 to {ShelfEntry.MaxPageCount:N0}, or leave it empty.";

    public static readonly string FullMessage =
        $"You have {ShelfEntry.MaxPerReader:N0} books on your shelves, which is as many as Tomekeeper keeps. Remove some to add more.";

    public static RouteGroupBuilder MapShelfEndpoints(this IEndpointRouteBuilder app)
    {
        var shelves = app.MapGroup("/api/shelves").WithTags("Shelves").RequireAuthorization();
        shelves.MapGet("/", GetShelves);
        shelves.MapGet("/{bookId:guid}", GetEntry);
        shelves.MapPut("/{bookId:guid}/page-count", PutPageCount);
        shelves.MapPut("/{bookId:guid}/kind", PutKind);
        shelves.MapPut("/{bookId:guid}", PutOnShelf);
        shelves.MapDelete("/{bookId:guid}", TakeOff);
        return shelves;
    }

    private static async Task<Ok<ShelvesResponse>> GetShelves(
        ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.GetUserId();
        var entries = await db.ShelfEntries.AsNoTracking()
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.ShelvedAt)
            .Include(e => e.Book)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(new ShelvesResponse(await ShelfEntryResponses.BuildAsync(db, userId, entries.Select(e => (e, e.Book)).ToList(), cancellationToken)));
    }

    /// <summary>One book on the reader's shelves, for the book page. 404 when it isn't on them.</summary>
    private static async Task<Results<Ok<ShelfEntryResponse>, NotFound>> GetEntry(
        Guid bookId, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.GetUserId();
        var entry = await db.ShelfEntries.AsNoTracking().Include(e => e.Book)
            .FirstOrDefaultAsync(e => e.UserId == userId && e.BookId == bookId, cancellationToken);
        return entry is null ? TypedResults.NotFound() : TypedResults.Ok(await ShelfEntryResponses.BuildAsync(db, entry, entry.Book, cancellationToken));
    }

    /// <summary>Sets the page count of the reader's own edition, or clears it with null. Only for books on their shelves.</summary>
    private static async Task<Results<Ok<ShelfEntryResponse>, ValidationProblem, NotFound>> PutPageCount(
        Guid bookId, PageCountRequest request, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        if (request.PageCount is < 1 or > ShelfEntry.MaxPageCount)
        {
            return new FieldErrors().Add("pageCount", PageCountMessage).ToProblem();
        }
        var userId = principal.GetUserId();
        var entry = await db.ShelfEntries.Include(e => e.Book)
            .FirstOrDefaultAsync(e => e.UserId == userId && e.BookId == bookId, cancellationToken);
        if (entry is null) return TypedResults.NotFound();

        entry.PageCount = request.PageCount;
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(await ShelfEntryResponses.BuildAsync(db, entry, entry.Book, cancellationToken));
    }

    /// <summary>
    /// Puts a book from the catalogue on one of the reader's shelves, or moves it there from another shelf.
    /// Putting it on the shelf it is already on changes nothing, so the request can safely be sent twice.
    /// </summary>
    private static async Task<Results<Ok<ShelfEntryResponse>, ValidationProblem, ProblemHttpResult, NotFound>> PutOnShelf(
        Guid bookId,
        ShelfRequest request,
        ClaimsPrincipal principal,
        TomekeeperDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        if (Shelves.FromApiName(request.Shelf) is not { } shelf)
        {
            return new FieldErrors().Add("shelf", ChooseShelfMessage).ToProblem();
        }

        var userId = principal.GetUserId();
        var book = await db.Books.AsNoTracking().VisibleTo(userId).FirstOrDefaultAsync(b => b.Id == bookId, cancellationToken);
        if (book is null) return TypedResults.NotFound();

        for (var attempt = 1; ; attempt++)
        {
            // PostgreSQL keeps times to the microsecond and .NET to a tenth of one. Cut off the rest, so the
            // answer says the same time as the database will.
            var now = time.GetUtcNow();
            now = now.AddTicks(-(now.Ticks % 10));
            var entry = await db.ShelfEntries.FirstOrDefaultAsync(e => e.UserId == userId && e.BookId == bookId, cancellationToken);
            if (entry is null)
            {
                var count = await db.ShelfEntries.CountAsync(e => e.UserId == userId, cancellationToken);
                if (count >= ShelfEntry.MaxPerReader)
                {
                    return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "Your shelves are full", detail: FullMessage);
                }
                entry = new ShelfEntry { UserId = userId, BookId = bookId, Shelf = shelf, AddedAt = now, ShelvedAt = now };
                db.ShelfEntries.Add(entry);
            }
            else if (entry.Shelf != shelf)
            {
                // A book in progress that goes on the Finished shelf is finished: the rest of its pages count today.
                var reading = shelf == Shelf.Finished ? await ReadingLog.OpenReadingAsync(db, userId, bookId, cancellationToken) : null;
                if (reading is not null)
                {
                    var readOn = ReadingDays.TryRead(request.ReadOn, time, out var day) ? day : DateOnly.FromDateTime(now.UtcDateTime);
                    ReadingLog.Finish(db, entry, book, reading, readOn, now);
                }
                entry.Shelf = shelf;
                entry.ShelvedAt = now;
            }

            try
            {
                await db.SaveChangesAsync(cancellationToken);
                return TypedResults.Ok(await ShelfEntryResponses.BuildAsync(db, entry, book, cancellationToken));
            }
            catch (DbUpdateException ex) when (attempt == 1 && ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // The same book was added from two tabs at the same moment, and the other one got there first.
                // Start again: this time the book is on a shelf, so it is moved instead.
                db.ChangeTracker.Clear();
            }
        }
    }

    /// <summary>Fiction or nonfiction, in the reader's own view. It decides which quests and attributes the pages count for.</summary>
    private static async Task<Results<Ok<ShelfEntryResponse>, NotFound>> PutKind(
        Guid bookId, KindRequest request, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.GetUserId();
        var entry = await db.ShelfEntries.Include(e => e.Book)
            .FirstOrDefaultAsync(e => e.UserId == userId && e.BookId == bookId, cancellationToken);
        if (entry is null) return TypedResults.NotFound();
        entry.Fiction = request.Fiction;
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Ok(await ShelfEntryResponses.BuildAsync(db, entry, entry.Book, cancellationToken));
    }

    /// <summary>
    /// Takes a book off the reader's shelves. A book from Open Library stays in the catalogue for everyone else;
    /// a book the reader added by hand is deleted, since nobody else can see it.
    /// </summary>
    private static async Task<NoContent> TakeOff(
        Guid bookId, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.GetUserId();
        await db.ShelfEntries.Where(e => e.UserId == userId && e.BookId == bookId).ExecuteDeleteAsync(cancellationToken);
        await db.Books.Where(b => b.Id == bookId && b.AddedById == userId).ExecuteDeleteAsync(cancellationToken);
        return TypedResults.NoContent();
    }
}
