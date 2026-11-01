namespace Tomekeeper.Api.Books;

/// <summary>
/// A book in Tomekeeper's own catalogue. Books come from Open Library and are saved here the first time a reader
/// picks one, so shelves and progress never depend on Open Library being up. Books Open Library doesn't have
/// can be added by hand; those belong to the reader who added them, and nobody else sees them.
/// </summary>
public sealed class Book
{
    public const int TitleMaxLength = 500;
    public const int OpenLibraryKeyMaxLength = 20;

    public Guid Id { get; set; }

    /// <summary>Open Library's id for the work, such as "OL27448W". A work is the book itself, across all editions.</summary>
    public string? OpenLibraryKey { get; set; }

    public string Title { get; set; } = "";

    public string? Subtitle { get; set; }

    /// <summary>Author names in the order Open Library gives them.</summary>
    public List<string> Authors { get; set; } = [];

    public int? FirstPublishedYear { get; set; }

    /// <summary>A typical page count across editions (Open Library's median). Readers can set their own later.</summary>
    public int? PageCount { get; set; }

    /// <summary>Open Library's id for the cover image, if there is one.</summary>
    public int? CoverId { get; set; }

    /// <summary>The reader who added the book by hand, or null for books from Open Library, which everyone can see.</summary>
    public Guid? AddedById { get; set; }

    public DateTimeOffset AddedAt { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}

public static class BookQueries
{
    /// <summary>The books a reader may see: everything from Open Library, and the books they added by hand themselves.</summary>
    public static IQueryable<Book> VisibleTo(this IQueryable<Book> books, Guid userId) =>
        books.Where(b => b.AddedById == null || b.AddedById == userId);
}
