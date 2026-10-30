using Microsoft.AspNetCore.Identity;

namespace Tomekeeper.Api.Accounts;

/// <summary>A reader's account. Identity supplies the email, password hash, lockout and so on.</summary>
public sealed class User : IdentityUser<Guid>
{
    public const int DisplayNameMaxLength = 50;

    /// <summary>The name shown on the reader's profile.</summary>
    public string DisplayName { get; set; } = "";

    public DateTimeOffset CreatedAt { get; set; }
}
