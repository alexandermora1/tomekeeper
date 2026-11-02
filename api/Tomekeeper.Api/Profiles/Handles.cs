using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;

namespace Tomekeeper.Api.Profiles;

/// <summary>
/// Who can see a part of a profile. Friends comes first so that it is the default value (0): the database's
/// default is Friends too, and Entity Framework leaves a value out of an insert when it is the default.
/// </summary>
public enum Visibility
{
    Friends,
    Everyone,
    OnlyYou,
}

public static class Visibilities
{
    /// <summary>"everyone", "friends" or "onlyYou".</summary>
    public static string ToApiName(this Visibility visibility) => visibility switch
    {
        Visibility.Everyone => "everyone",
        Visibility.Friends => "friends",
        _ => "onlyYou",
    };

    public static Visibility? FromApiName(string? name) => name switch
    {
        "everyone" => Visibility.Everyone,
        "friends" => Visibility.Friends,
        "onlyYou" => Visibility.OnlyYou,
        _ => null,
    };
}

/// <summary>
/// Readers' addresses on the site, such as "alex" in /readers/alex: 3 to 30 lowercase letters, digits and
/// hyphens. A reader gets one made from their name the first time it is needed, and can change it.
/// </summary>
public static partial class Handles
{
    public const int MaxLength = 30;

    /// <summary>Words that would clash with pages of the site.</summary>
    private static readonly HashSet<string> Reserved = ["admin", "api", "edit", "me", "new", "readers", "search", "settings", "tomekeeper"];

    public static bool IsValid(string handle) => Pattern().IsMatch(handle) && !Reserved.Contains(handle);

    /// <summary>The reader's handle, making one from their name if they have none yet. The user must be tracked.</summary>
    public static async Task<string> EnsureAsync(TomekeeperDbContext db, User user, CancellationToken cancellationToken)
    {
        if (user.Handle is not null) return user.Handle;
        var stem = Slug(user.DisplayName);
        for (var n = 1; ; n++)
        {
            var candidate = n == 1 ? stem : $"{stem[..Math.Min(stem.Length, MaxLength - 6)]}-{(n < 50 ? n : Random.Shared.Next(1000, 99999))}";
            if (!IsValid(candidate) || await db.Users.AnyAsync(u => u.Handle == candidate, cancellationToken)) continue;
            user.Handle = candidate;
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                return candidate;
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                user.Handle = null; // Another reader took it at the same moment. Try the next one.
            }
        }
    }

    /// <summary>"Åse Ødegård" becomes "ase-odegard". Letters outside a–z that have no plain form are left out.</summary>
    public static string Slug(string name)
    {
        var slug = Plain(name);
        if (slug.Length > MaxLength) slug = slug[..MaxLength].TrimEnd('-');
        return slug.Length >= 3 ? slug : "reader";
    }

    /// <summary>The name in the letters an address can have, of any length: "Åse Ø" becomes "ase-o".</summary>
    public static string Plain(string name)
    {
        var builder = new StringBuilder();
        foreach (var c in name.ToLowerInvariant())
        {
            var plain = c switch
            {
                'æ' => "ae", 'ø' or 'ö' or 'ó' or 'ò' or 'ô' => "o", 'å' or 'ä' or 'á' or 'à' or 'â' => "a",
                'é' or 'è' or 'ê' or 'ë' => "e", 'í' or 'ì' or 'î' or 'ï' => "i", 'ú' or 'ù' or 'û' or 'ü' => "u",
                'ñ' => "n", 'ç' => "c", 'ß' => "ss",
                >= 'a' and <= 'z' or >= '0' and <= '9' => c.ToString(),
                _ => "-",
            };
            builder.Append(plain);
        }
        return Hyphens().Replace(builder.ToString(), "-").Trim('-');
    }

    [GeneratedRegex("^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$")]
    private static partial Regex Pattern();

    [GeneratedRegex("-+")]
    private static partial Regex Hyphens();
}
