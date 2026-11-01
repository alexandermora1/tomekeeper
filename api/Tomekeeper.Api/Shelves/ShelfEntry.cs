using Tomekeeper.Api.Books;

namespace Tomekeeper.Api.Shelves;

/// <summary>
/// A book on one reader's shelves. The book itself is in the shared catalogue; this row says which shelf
/// the reader keeps it on. Each reader has each book at most once. (Progress and finish dates come in stage 3.)
/// </summary>
public sealed class ShelfEntry
{
    /// <summary>A limit on books per reader, so one account can't fill the database.</summary>
    public const int MaxPerReader = 10_000;

    public Guid UserId { get; set; }

    public Guid BookId { get; set; }

    public Book Book { get; set; } = null!;

    public Shelf Shelf { get; set; }

    /// <summary>When the reader first put the book on one of their shelves.</summary>
    public DateTimeOffset AddedAt { get; set; }

    /// <summary>When the book was put on the shelf it is on now. The shelves list the latest first.</summary>
    public DateTimeOffset ShelvedAt { get; set; }
}
