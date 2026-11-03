using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;

namespace Tomekeeper.Api.Fellowship;

/// <summary>Leaving out readers hidden by a block, in either direction.</summary>
public static class Blocks
{
    /// <summary>The users the viewer may see: not blocked by the viewer, and not blocking the viewer.</summary>
    public static IQueryable<User> NotHiddenFrom(this IQueryable<User> users, TomekeeperDbContext db, Guid viewerId) =>
        users.Where(u => !db.Blocks.Any(b => (b.BlockerId == viewerId && b.BlockedId == u.Id) || (b.BlockerId == u.Id && b.BlockedId == viewerId)));

    /// <summary>True when either reader has blocked the other.</summary>
    public static Task<bool> BetweenAsync(TomekeeperDbContext db, Guid one, Guid other, CancellationToken cancellationToken) =>
        db.Blocks.AnyAsync(b => (b.BlockerId == one && b.BlockedId == other) || (b.BlockerId == other && b.BlockedId == one), cancellationToken);
}
