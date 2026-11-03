namespace Tomekeeper.Api.Moderation;

public enum ReportReason
{
    Spam,
    Harassment,
    Offensive,
    Other,
}

/// <summary>
/// A reader telling the moderator about another reader, or one of their reviews. It keeps a copy of what was
/// reported as it was at the time, since the reader can change or delete it afterwards. The reported reader isn't told.
/// </summary>
public sealed class Report
{
    public const int MaxDetailsLength = 1000;
    public const int MaxSnapshotLength = 6000;

    public Guid Id { get; set; }

    public Guid ReporterId { get; set; }

    public Guid ReportedId { get; set; }

    /// <summary>The book whose review was reported, or null for the reader's profile.</summary>
    public Guid? BookId { get; set; }

    public ReportReason Reason { get; set; }

    /// <summary>What the reporter wrote, if anything.</summary>
    public string? Details { get; set; }

    /// <summary>The review or the profile's name and text, as they were when the report was sent.</summary>
    public string Snapshot { get; set; } = "";

    public DateTimeOffset CreatedAt { get; set; }
}
