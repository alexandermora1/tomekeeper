using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Shelves;

namespace Tomekeeper.Api.Progress;

/// <summary>
/// The rules for logging progress, used by the progress endpoints and by moving a book to the Finished shelf.
/// The changes are made on tracked entities; the caller saves them.
/// </summary>
public static class ReadingLog
{
    /// <summary>The page count that applies: the reader's own edition's if they set one, otherwise the book's usual one.</summary>
    public static int? PageCountOf(ShelfEntry entry, Book book) => entry.PageCount ?? book.PageCount;

    public static Task<Reading?> OpenReadingAsync(TomekeeperDbContext db, Guid userId, Guid bookId, CancellationToken cancellationToken) =>
        db.Readings.FirstOrDefaultAsync(r => r.UserId == userId && r.BookId == bookId && r.FinishedOn == null, cancellationToken);

    /// <summary>
    /// Records that the reader reached a page. Starts a reading when none is in progress (the first time, or a
    /// re-read), puts the book on Reading now, and finishes the book on its last page.
    /// </summary>
    public static void Log(TomekeeperDbContext db, ShelfEntry entry, Book book, Reading? reading, int page, DateOnly readOn, DateTimeOffset now)
    {
        if (reading is null)
        {
            reading = new Reading { Id = Guid.CreateVersion7(), UserId = entry.UserId, BookId = entry.BookId, StartedOn = readOn };
            db.Readings.Add(reading);
        }
        var finished = PageCountOf(entry, book) is { } count && page >= count;
        Add(db, reading, readOn, now, page, finished);
        if (finished) Close(entry, reading, readOn, now);
        else MoveTo(entry, Shelf.Reading, now);
    }

    /// <summary>"I've finished it": the rest of the pages count today, and the book goes on the Finished shelf.</summary>
    public static void Finish(TomekeeperDbContext db, ShelfEntry entry, Book book, Reading reading, DateOnly readOn, DateTimeOffset now)
    {
        var last = Math.Max(PageCountOf(entry, book) ?? reading.Page, reading.Page);
        Add(db, reading, readOn, now, last, finished: true);
        Close(entry, reading, readOn, now);
    }

    /// <summary>
    /// Takes back the latest entry of the latest reading. A reading with no entries left is removed, and a
    /// finished one is opened again. False when there is nothing to take back.
    /// </summary>
    public static async Task<bool> UndoAsync(TomekeeperDbContext db, ShelfEntry entry, DateTimeOffset now, CancellationToken cancellationToken)
    {
        // Ids are version 7 UUIDs, which sort by the time they were made.
        var reading = await db.Readings.Where(r => r.UserId == entry.UserId && r.BookId == entry.BookId)
            .OrderByDescending(r => r.Id).FirstOrDefaultAsync(cancellationToken);
        if (reading is null) return false;
        var latest = await db.ProgressEntries.Where(p => p.ReadingId == reading.Id)
            .OrderByDescending(p => p.Id).Take(2).ToListAsync(cancellationToken);
        if (latest.Count == 0) return false;

        db.ProgressEntries.Remove(latest[0]);
        if (latest.Count == 1) db.Readings.Remove(reading);
        else reading.Page = latest[1].Page;
        if (latest[0].Finished)
        {
            reading.FinishedOn = null;
            MoveTo(entry, Shelf.Reading, now);
        }
        return true;
    }

    private static void Add(TomekeeperDbContext db, Reading reading, DateOnly readOn, DateTimeOffset now, int page, bool finished)
    {
        db.ProgressEntries.Add(new ProgressEntry
        {
            Id = Guid.CreateVersion7(),
            ReadingId = reading.Id,
            UserId = reading.UserId,
            BookId = reading.BookId,
            ReadOn = readOn,
            LoggedAt = now,
            Page = page,
            Pages = page - reading.Page,
            Finished = finished,
        });
        reading.Page = page;
    }

    private static void Close(ShelfEntry entry, Reading reading, DateOnly readOn, DateTimeOffset now)
    {
        reading.FinishedOn = readOn;
        MoveTo(entry, Shelf.Finished, now);
    }

    private static void MoveTo(ShelfEntry entry, Shelf shelf, DateTimeOffset now)
    {
        if (entry.Shelf == shelf) return;
        entry.Shelf = shelf;
        entry.ShelvedAt = now;
    }
}
