namespace Tomekeeper.Api.Fellowship;

/// <summary>
/// One reader asking another to be friends. It stays until the other accepts, or the asker withdraws it.
/// Ignoring it only hides it from the reader who was asked; the asker isn't told, so asking can't become pestering.
/// </summary>
public sealed class FriendRequest
{
    public Guid FromId { get; set; }

    public Guid ToId { get; set; }

    public DateTimeOffset SentAt { get; set; }

    /// <summary>Set when the reader who was asked chose Ignore.</summary>
    public DateTimeOffset? IgnoredAt { get; set; }
}

/// <summary>
/// Two readers who are friends. Each friendship is stored twice, once from each side, so "the friends of X" is a
/// plain lookup. Both rows are added and removed together.
/// </summary>
public sealed class Friendship
{
    public Guid UserId { get; set; }

    public Guid FriendId { get; set; }

    public DateTimeOffset Since { get; set; }
}

/// <summary>
/// One reader blocking another. While it lasts, each is hidden from the other: profile, search, reviews and
/// friends lists. Blocking ends any friendship or requests between them. The blocked reader isn't told.
/// </summary>
public sealed class Block
{
    public Guid BlockerId { get; set; }

    public Guid BlockedId { get; set; }

    public DateTimeOffset BlockedAt { get; set; }
}
