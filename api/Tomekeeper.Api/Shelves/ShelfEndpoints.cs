using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Data;

namespace Tomekeeper.Api.Shelves;

/// <param name="Shelf">"reading", "wantToRead", "finished" or "setAside".</param>
public sealed record ShelfRequest(string? Shelf);

/// <param name="Shelf">"reading", "wantToRead", "finished" or "setAside".</param>
public sealed record ShelfEntryResponse(BookResponse Book, string Shelf, DateTimeOffset ShelvedAt);

/// <param name="Books">Every book on the reader's shelves, the most recently shelved first.</param>
public sealed record ShelvesResponse(IReadOnlyList<ShelfEntryResponse> Books);

/// <summary>The signed-in reader's shelves, under /api/shelves. Nobody else can see them (yet: profiles come in stage 5).</summary>
public static class ShelfEndpoints
{
    public const string ChooseShelfMessage = "Choose a shelf.";

    public static readonly string FullMessage =
        $"You have {ShelfEntry.MaxPerReader:N0} books on your shelves, which is as many as Tomekeeper keeps. Remove some to add more.";

    public static RouteGroupBuilder MapShelfEndpoints(this IEndpointRouteBuilder app)
    {
        var shelves = app.MapGroup("/api/shelves").WithTags("Shelves").RequireAuthorization();
        shelves.MapGet("/", GetShelves);
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
            .Select(e => new { e.Book, e.Shelf, e.ShelvedAt })
            .ToListAsync(cancellationToken);
        var books = entries.Select(e => new ShelfEntryResponse(BookResponse.From(e.Book), e.Shelf.ToApiName(), e.ShelvedAt)).ToList();
        return TypedResults.Ok(new ShelvesResponse(books));
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

        var book = await db.Books.AsNoTracking().FirstOrDefaultAsync(b => b.Id == bookId, cancellationToken);
        if (book is null) return TypedResults.NotFound();

        var userId = principal.GetUserId();
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
                entry.Shelf = shelf;
                entry.ShelvedAt = now;
            }

            try
            {
                await db.SaveChangesAsync(cancellationToken);
                return TypedResults.Ok(new ShelfEntryResponse(BookResponse.From(book), entry.Shelf.ToApiName(), entry.ShelvedAt));
            }
            catch (DbUpdateException ex) when (attempt == 1 && ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // The same book was added from two tabs at the same moment, and the other one got there first.
                // Start again: this time the book is on a shelf, so it is moved instead.
                db.ChangeTracker.Clear();
            }
        }
    }

    /// <summary>Takes a book off the reader's shelves. The book stays in the catalogue for everyone else.</summary>
    private static async Task<NoContent> TakeOff(
        Guid bookId, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.GetUserId();
        await db.ShelfEntries.Where(e => e.UserId == userId && e.BookId == bookId).ExecuteDeleteAsync(cancellationToken);
        return TypedResults.NoContent();
    }
}
