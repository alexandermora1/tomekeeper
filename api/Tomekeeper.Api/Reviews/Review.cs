namespace Tomekeeper.Api.Reviews;

/// <summary>
/// A reader's review of a book on their shelves: 1 to 5 stars and, if they like, some words. One per reader and
/// book; taking the book off the shelves deletes it. Who can see it follows the reader's "Reviews" setting.
/// </summary>
public sealed class Review
{
    public const int MaxTextLength = 5000;

    public Guid UserId { get; set; }

    public Guid BookId { get; set; }

    /// <summary>1 to 5 stars.</summary>
    public int Rating { get; set; }

    /// <summary>The words of the review, or null for stars alone.</summary>
    public string? Text { get; set; }

    public DateTimeOffset WrittenAt { get; set; }

    /// <summary>When it was last changed, if it has been.</summary>
    public DateTimeOffset? EditedAt { get; set; }
}
