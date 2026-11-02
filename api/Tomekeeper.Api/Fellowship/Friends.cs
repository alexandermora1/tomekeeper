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
