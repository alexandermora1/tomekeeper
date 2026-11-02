using Microsoft.AspNetCore.Identity;

namespace Tomekeeper.Api.Accounts;

/// <summary>A reader's account. Identity supplies the email, password hash, lockout and so on.</summary>
public sealed class User : IdentityUser<Guid>
{
    public const int DisplayNameMaxLength = 50;

    /// <summary>The name shown on the reader's profile.</summary>
    public string DisplayName { get; set; } = "";

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>The woodcut that stands for the reader, chosen in the first steps after signing up.
    /// Null until then.</summary>
    public Portrait? Portrait { get; set; }

    /// <summary>The reader's address on the site, as in /readers/alex. Given the first time it is needed.</summary>
    public string? Handle { get; set; }

    /// <summary>A short text about the reader, always shown on their profile.</summary>
    public string? Bio { get; set; }

    // Who can see each part of the profile. Private by default: friends only.
    public Profiles.Visibility ProgressVisibleTo { get; set; } = Profiles.Visibility.Friends;

    public Profiles.Visibility ReadingVisibleTo { get; set; } = Profiles.Visibility.Friends;

    public Profiles.Visibility ReviewsVisibleTo { get; set; } = Profiles.Visibility.Friends;

    public Profiles.Visibility FriendsVisibleTo { get; set; } = Profiles.Visibility.Friends;
}
