using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Security;
using Tomekeeper.Api.Shelves;
using ShelfNames = Tomekeeper.Api.Shelves.Shelves;

namespace Tomekeeper.Api.Books;

public sealed record BookResponse(
    Guid Id,
    string? OpenLibraryKey,
    string Title,
    string? Subtitle,
    IReadOnlyList<string> Authors,
    int? FirstPublishedYear,
    int? PageCount,
    int? CoverId)
{
    public static BookResponse From(Book book) => new(
        book.Id, book.OpenLibraryKey, book.Title, book.Subtitle, book.Authors, book.FirstPublishedYear, book.PageCount, book.CoverId);
}

/// <param name="BookId">Set when the book is already in Tomekeeper's catalogue.</param>
/// <param name="Shelf">The reader's shelf for the book ("reading", "wantToRead", "finished" or "setAside"), if it is on one.</param>
public sealed record BookSearchResult(
    string OpenLibraryKey,
    string Title,
    string? Subtitle,
    IReadOnlyList<string> Authors,
    int? FirstPublishedYear,
    int? PageCount,
    int? CoverId,
    int? EditionCount,
    Guid? BookId,
    string? Shelf);

public sealed record BookSearchResponse(string Query, int Total, IReadOnlyList<BookSearchResult> Results);

/// <summary>A book Open Library doesn't have, typed in by the reader, and the shelf to put it on.</summary>
public sealed record HandBookRequest(
    string? Title, string? Subtitle, IReadOnlyList<string?>? Authors, int? FirstPublishedYear, int? PageCount, string? Shelf);

/// <summary>Finding books on Open Library and keeping them in Tomekeeper's own catalogue, under /api/books.</summary>
public static partial class BookEndpoints
{
    public const int SearchLimit = 20;
    public const string OpenLibraryDownMessage = "Open Library isn't answering right now, so books can't be searched. Try again in a little while.";
    public const string NotOnOpenLibraryMessage = "Open Library doesn't have that book.";

    public static RouteGroupBuilder MapBookEndpoints(this IEndpointRouteBuilder app)
    {
        // Only for signed-in readers, so the search can't be used by anyone to send traffic to Open Library.
        var books = app.MapGroup("/api/books").WithTags("Books").RequireAuthorization();
        books.MapGet("/search", Search).RequireRateLimiting(RateLimits.SearchPolicy);
        books.MapPost("/open-library/{key}", AddFromOpenLibrary).RequireRateLimiting(RateLimits.SearchPolicy);
        books.MapGet("/{id:guid}", GetBook);
        books.MapPost("/", AddByHand).RequireRateLimiting(RateLimits.SearchPolicy);
        return books;
    }

    private static async Task<Results<Ok<BookSearchResponse>, ValidationProblem, ProblemHttpResult>> Search(
        string? q, ClaimsPrincipal principal, OpenLibraryClient openLibrary, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var query = q?.Trim() ?? "";
        if (query.Length < 2) return new FieldErrors().Add("q", "Type a title, an author or an ISBN.").ToProblem();
        if (query.Length > 200) return new FieldErrors().Add("q", "Keep the search to 200 characters or fewer.").ToProblem();

        OpenLibrarySearch found;
        try
        {
            found = await openLibrary.SearchAsync(query, SearchLimit, cancellationToken);
        }
        catch (OpenLibraryUnavailableException)
        {
            return OpenLibraryDown();
        }

        // Which of these are already in our catalogue? One query for the whole page of results.
        var keys = found.Works.Select(w => w.Key).ToList();
        var known = await db.Books.AsNoTracking()
            .Where(b => b.OpenLibraryKey != null && keys.Contains(b.OpenLibraryKey))
            .ToDictionaryAsync(b => b.OpenLibraryKey!, b => b.Id, cancellationToken);

        // And which of those are on this reader's shelves?
        var userId = principal.GetUserId();
        var knownIds = known.Values.ToList();
        var shelved = await db.ShelfEntries.AsNoTracking()
            .Where(e => e.UserId == userId && knownIds.Contains(e.BookId))
            .ToDictionaryAsync(e => e.BookId, e => e.Shelf, cancellationToken);

        var results = found.Works
            .Select(w =>
            {
                Guid? bookId = known.TryGetValue(w.Key, out var id) ? id : null;
                var shelf = bookId is { } b && shelved.TryGetValue(b, out var s) ? s.ToApiName() : null;
                return new BookSearchResult(
                    w.Key, w.Title, w.Subtitle, w.Authors, w.FirstPublishedYear, w.PageCount, w.CoverId, w.EditionCount, bookId, shelf);
            })
            .ToList();
        return TypedResults.Ok(new BookSearchResponse(query, found.Total, results));
    }

    /// <summary>
    /// Saves an Open Library work in our catalogue, or finds it if it is already there. The details are fetched
    /// from Open Library again, not taken from the request, because the catalogue is shared by all readers.
    /// </summary>
    private static async Task<Results<Created<BookResponse>, Ok<BookResponse>, ValidationProblem, ProblemHttpResult>> AddFromOpenLibrary(
        string key, OpenLibraryClient openLibrary, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        if (!WorkKey().IsMatch(key)) return new FieldErrors().Add("key", "That isn't an Open Library work id, such as OL27448W.").ToProblem();

        var existing = await db.Books.AsNoTracking().FirstOrDefaultAsync(b => b.OpenLibraryKey == key, cancellationToken);
        if (existing is not null) return TypedResults.Ok(BookResponse.From(existing));

        OpenLibraryWork? work;
        try
        {
            work = await openLibrary.GetWorkAsync(key, cancellationToken);
        }
        catch (OpenLibraryUnavailableException)
        {
            return OpenLibraryDown();
        }
        if (work is null)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Not found", detail: NotOnOpenLibraryMessage);
        }

        var now = time.GetUtcNow();
        var book = new Book
        {
            Id = Guid.CreateVersion7(),
            OpenLibraryKey = work.Key,
            Title = Cut(work.Title, Book.TitleMaxLength),
            Subtitle = work.Subtitle is null ? null : Cut(work.Subtitle, Book.TitleMaxLength),
            Authors = work.Authors.Take(20).Select(a => Cut(a, 200)).ToList(),
            FirstPublishedYear = work.FirstPublishedYear,
            PageCount = work.PageCount,
            CoverId = work.CoverId,
            AddedAt = now,
            UpdatedAt = now,
        };
        db.Books.Add(book);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Another reader added the same book at the same moment. Theirs is just as good.
            db.ChangeTracker.Clear();
            var theirs = await db.Books.AsNoTracking().FirstAsync(b => b.OpenLibraryKey == key, cancellationToken);
            return TypedResults.Ok(BookResponse.From(theirs));
        }
        return TypedResults.Created($"/api/books/{book.Id}", BookResponse.From(book));
    }

    private static async Task<Results<Ok<BookResponse>, NotFound>> GetBook(
        Guid id, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var book = await db.Books.AsNoTracking().VisibleTo(principal.GetUserId()).FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        return book is null ? TypedResults.NotFound() : TypedResults.Ok(BookResponse.From(book));
    }

    /// <summary>
    /// Adds a book by hand and puts it on one of the reader's shelves in the same go, since a book of one's own
    /// that is on no shelf would be lost. Only the reader who added it can see it.
    /// </summary>
    private static async Task<Results<Created<ShelfEntryResponse>, ValidationProblem, ProblemHttpResult>> AddByHand(
        HandBookRequest request, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        now = now.AddTicks(-(now.Ticks % 10)); // PostgreSQL keeps microseconds, so the answer matches the database.
        var title = request.Title?.Trim() ?? "";
        var subtitle = string.IsNullOrWhiteSpace(request.Subtitle) ? null : request.Subtitle.Trim();
        var authors = (request.Authors ?? []).Select(a => a?.Trim() ?? "").Where(a => a.Length > 0).ToList();
        var latestYear = now.Year + 1;

        var errors = new FieldErrors();
        if (title.Length == 0) errors.Add("title", "Enter the title.");
        else if (title.Length > Book.TitleMaxLength) errors.Add("title", $"Keep the title to {Book.TitleMaxLength} characters or fewer.");
        if (subtitle?.Length > Book.TitleMaxLength) errors.Add("subtitle", $"Keep the subtitle to {Book.TitleMaxLength} characters or fewer.");
        if (authors.Count > 20 || authors.Any(a => a.Length > 200)) errors.Add("authors", "Enter up to 20 authors, each up to 200 characters.");
        if (request.FirstPublishedYear is { } year && (year < 1 || year > latestYear))
        {
            errors.Add("firstPublishedYear", $"Enter a year from 1 to {latestYear}, or leave it empty.");
        }
        if (request.PageCount is < 1 or > ShelfEntry.MaxPageCount) errors.Add("pageCount", ShelfEndpoints.PageCountMessage);
        var shelf = ShelfNames.FromApiName(request.Shelf);
        if (shelf is null) errors.Add("shelf", ShelfEndpoints.ChooseShelfMessage);
        if (errors.Any) return errors.ToProblem();

        var userId = principal.GetUserId();
        if (await db.ShelfEntries.CountAsync(e => e.UserId == userId, cancellationToken) >= ShelfEntry.MaxPerReader)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "Your shelves are full", detail: ShelfEndpoints.FullMessage);
        }

        var book = new Book
        {
            Id = Guid.CreateVersion7(),
            Title = title,
            Subtitle = subtitle,
            Authors = authors,
            FirstPublishedYear = request.FirstPublishedYear,
            PageCount = request.PageCount,
            AddedById = userId,
            AddedAt = now,
            UpdatedAt = now,
        };
        var entry = new ShelfEntry { UserId = userId, Book = book, Shelf = shelf!.Value, AddedAt = now, ShelvedAt = now };
        db.ShelfEntries.Add(entry);
        await db.SaveChangesAsync(cancellationToken);
        return TypedResults.Created($"/api/books/{book.Id}", await ShelfEntryResponses.BuildAsync(db, entry, book, cancellationToken));
    }

    private static ProblemHttpResult OpenLibraryDown() =>
        TypedResults.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Open Library is unavailable", detail: OpenLibraryDownMessage);

    private static string Cut(string text, int max) => text.Length <= max ? text : text[..max].TrimEnd();

    [GeneratedRegex(@"^OL\d{1,12}W$")]
    private static partial Regex WorkKey();
}
