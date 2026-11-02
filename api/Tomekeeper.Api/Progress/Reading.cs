using System.Globalization;

namespace Tomekeeper.Api.Progress;

/// <summary>
/// One time through a book, from the first page logged to the end. Reading a book again starts a new one,
/// so re-reads count too. A reader has at most one reading of a book in progress.
/// </summary>
public sealed class Reading
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid BookId { get; set; }

    /// <summary>The reader's own date for the first entry.</summary>
    public DateOnly StartedOn { get; set; }

    /// <summary>Set when the reader finishes the book; null while the reading is in progress.</summary>
    public DateOnly? FinishedOn { get; set; }

    /// <summary>The page the reader has reached.</summary>
    public int Page { get; set; }
}

/// <summary>One entry in the log: on this day, the reader reached this page.</summary>
public sealed class ProgressEntry
{
    public Guid Id { get; set; }

    public Guid ReadingId { get; set; }

    public Guid UserId { get; set; }

    public Guid BookId { get; set; }

    /// <summary>The reader's own date. Years and months for goals are counted by it, wherever the reader lives.</summary>
    public DateOnly ReadOn { get; set; }

    public DateTimeOffset LoggedAt { get; set; }

    /// <summary>The page reached.</summary>
    public int Page { get; set; }

    /// <summary>Pages read since the entry before. This is what counts towards goals.</summary>
    public int Pages { get; set; }

    /// <summary>Whether this entry finished the book.</summary>
    public bool Finished { get; set; }
}

public static class ReadingDays
{
    public const string Message = "Send today's date where you are, as yyyy-mm-dd.";

    /// <summary>
    /// Reads the reader's date for an entry. It must be today somewhere on Earth: UTC's date, or the day before
    /// or after it, since time zones run from 12 hours behind UTC to 14 ahead.
    /// </summary>
    public static bool TryRead(string? text, TimeProvider time, out DateOnly day)
    {
        var today = DateOnly.FromDateTime(time.GetUtcNow().UtcDateTime);
        return DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out day)
            && day >= today.AddDays(-1)
            && day <= today.AddDays(1);
    }
}
