using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Profiles;

namespace Tomekeeper.Api.Fellowship;

/// <summary>Another reader, as a line in a list.</summary>
/// <param name="Relation">
/// How the signed-in reader stands with them: "you", "friend", "asked" (you asked them), "asksYou" (they asked you),
/// "blocked" (you blocked them) or "none".
/// </param>
/// <param name="Since">When they became friends, or when the request was sent; null in search results.</param>
public sealed record ReaderCard(string Handle, string DisplayName, string? Portrait, string Relation, DateTimeOffset? Since);

public sealed record ReaderSearchResponse(IReadOnlyList<ReaderCard> Readers);

/// <param name="Friends">By name.</param>
/// <param name="AskingYou">Requests to the reader they haven't answered or ignored, newest first.</param>
/// <param name="YouAsked">Requests the reader sent that are still open, newest first.</param>
/// <param name="Blocked">Readers this reader has blocked, newest first.</param>
public sealed record FellowshipResponse(
    IReadOnlyList<ReaderCard> Friends, IReadOnlyList<ReaderCard> AskingYou, IReadOnlyList<ReaderCard> YouAsked, IReadOnlyList<ReaderCard> Blocked);

public sealed record RelationResponse(string Relation);

/// <summary>Finding readers, asking them to be friends, and answering.</summary>
public static class FellowshipEndpoints
{
    public const int MaxOpenRequests = 50;
    public const int MaxResults = 20;
    public const string QueryMessage = "Type at least 2 letters of a name or address.";

    public static void MapFellowshipEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/readers", Search).WithTags("Fellowship").RequireAuthorization();
        var fellowship = app.MapGroup("/api/fellowship").WithTags("Fellowship").RequireAuthorization();
        fellowship.MapGet("/", GetFellowship);
        fellowship.MapPost("/{handle}/ask", Ask);
        fellowship.MapPost("/{handle}/accept", Accept);
        fellowship.MapPost("/{handle}/ignore", Ignore);
        // Withdraws the reader's request, or ends the friendship.
        fellowship.MapDelete("/{handle}", Leave);
        fellowship.MapPost("/{handle}/block", BlockReader);
        fellowship.MapDelete("/{handle}/block", Unblock);
    }

    /// <summary>Readers whose name contains the words typed, or whose address contains them in plain letters.</summary>
    private static async Task<Results<Ok<ReaderSearchResponse>, ValidationProblem>> Search(
        string? q, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var typed = q?.Trim() ?? "";
        if (typed.Length < 2) return new FieldErrors().Add("q", QueryMessage).ToProblem();
        if (typed.Length > User.DisplayNameMaxLength) typed = typed[..User.DisplayNameMaxLength];

        var me = principal.GetUserId();
        var pattern = "%" + typed.Replace(@"\", @"\\").Replace("%", @"\%").Replace("_", @"\_") + "%";
        var plain = Handles.Plain(typed);
        var found = await db.Users.NotHiddenFrom(db, me)
            .Where(u => u.Id != me && (EF.Functions.ILike(u.DisplayName, pattern, @"\") || (plain.Length >= 2 && u.Handle != null && u.Handle.Contains(plain))))
            .OrderBy(u => u.Handle == plain ? 0 : 1)
            .ThenBy(u => u.DisplayName)
            .Take(MaxResults)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(new ReaderSearchResponse(await CardsAsync(db, me, found.Select(u => (u, (DateTimeOffset?)null)), cancellationToken)));
    }

    private static async Task<Ok<FellowshipResponse>> GetFellowship(ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        var friends = await FriendsOfAsync(db, me, me, cancellationToken);
        var askingYou = await db.FriendRequests.Where(r => r.ToId == me && r.IgnoredAt == null)
            .Join(db.Users, r => r.FromId, u => u.Id, (r, u) => new { u, r.SentAt })
            .OrderByDescending(x => x.SentAt)
            .ToListAsync(cancellationToken);
        var youAsked = await db.FriendRequests.Where(r => r.FromId == me)
            .Join(db.Users, r => r.ToId, u => u.Id, (r, u) => new { u, r.SentAt })
            .OrderByDescending(x => x.SentAt)
            .ToListAsync(cancellationToken);
        var blocked = await db.Blocks.Where(b => b.BlockerId == me)
            .Join(db.Users, b => b.BlockedId, u => u.Id, (b, u) => new { u, b.BlockedAt })
            .OrderByDescending(x => x.BlockedAt)
            .ToListAsync(cancellationToken);
        return TypedResults.Ok(new FellowshipResponse(
            friends,
            await CardsAsync(db, me, askingYou.Select(x => (x.u, (DateTimeOffset?)x.SentAt)), cancellationToken),
            await CardsAsync(db, me, youAsked.Select(x => (x.u, (DateTimeOffset?)x.SentAt)), cancellationToken),
            await CardsAsync(db, me, blocked.Select(x => (x.u, (DateTimeOffset?)x.BlockedAt)), cancellationToken)));
    }

    /// <summary>Asks to be friends. If the other reader has already asked, the two become friends at once.</summary>
    private static async Task<Results<Ok<RelationResponse>, NotFound, ProblemHttpResult>> Ask(
        string handle, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        var other = await FindAsync(db, handle, cancellationToken);
        if (other is null || await Blocks.BetweenAsync(db, me, other.Id, cancellationToken)) return TypedResults.NotFound();
        if (other.Id == me) return Problem("You can't ask yourself to be friends.");
        if (await AreFriendsAsync(db, me, other.Id, cancellationToken)) return Relation("friend");

        var theirs = await db.FriendRequests.FirstOrDefaultAsync(r => r.FromId == other.Id && r.ToId == me, cancellationToken);
        if (theirs is not null) return Relation(await BefriendAsync(db, me, other.Id, time, cancellationToken));

        if (await db.FriendRequests.AnyAsync(r => r.FromId == me && r.ToId == other.Id, cancellationToken)) return Relation("asked");
        if (await db.FriendRequests.CountAsync(r => r.FromId == me, cancellationToken) >= MaxOpenRequests)
        {
            return Problem($"You have asked {MaxOpenRequests} readers who haven't answered yet. Withdraw some requests, or wait for answers.");
        }

        db.FriendRequests.Add(new FriendRequest { FromId = me, ToId = other.Id, SentAt = Now(time) });
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Asked twice in the same moment, as with a double click.
        }
        return Relation("asked");
    }

    private static async Task<Results<Ok<RelationResponse>, NotFound, ProblemHttpResult>> Accept(
        string handle, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        var other = await FindAsync(db, handle, cancellationToken);
        if (other is null || await Blocks.BetweenAsync(db, me, other.Id, cancellationToken)) return TypedResults.NotFound();
        if (await AreFriendsAsync(db, me, other.Id, cancellationToken)) return Relation("friend");
        if (!await db.FriendRequests.AnyAsync(r => r.FromId == other.Id && r.ToId == me, cancellationToken))
        {
            return Problem($"{other.DisplayName} hasn't asked you to be friends, or has withdrawn the request.", StatusCodes.Status404NotFound);
        }
        return Relation(await BefriendAsync(db, me, other.Id, time, cancellationToken));
    }

    private static async Task<Results<Ok<RelationResponse>, NotFound, ProblemHttpResult>> Ignore(
        string handle, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        var other = await FindAsync(db, handle, cancellationToken);
        if (other is null) return TypedResults.NotFound();
        var theirs = await db.FriendRequests.FirstOrDefaultAsync(r => r.FromId == other.Id && r.ToId == me, cancellationToken);
        if (theirs is null)
        {
            return Problem($"{other.DisplayName} hasn't asked you to be friends, or has withdrawn the request.", StatusCodes.Status404NotFound);
        }
        theirs.IgnoredAt ??= Now(time);
        await db.SaveChangesAsync(cancellationToken);
        return Relation("none");
    }

    private static async Task<Results<Ok<RelationResponse>, NotFound>> Leave(
        string handle, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        var other = await FindAsync(db, handle, cancellationToken);
        if (other is null) return TypedResults.NotFound();
        await db.Friendships.Where(f => (f.UserId == me && f.FriendId == other.Id) || (f.UserId == other.Id && f.FriendId == me))
            .ExecuteDeleteAsync(cancellationToken);
        await db.FriendRequests.Where(r => r.FromId == me && r.ToId == other.Id).ExecuteDeleteAsync(cancellationToken);
        return TypedResults.Ok(new RelationResponse("none"));
    }

    /// <summary>Blocks a reader: ends any friendship and requests between the two, and hides each from the other.</summary>
    private static async Task<Results<Ok<RelationResponse>, NotFound, ProblemHttpResult>> BlockReader(
        string handle, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        var other = await FindAsync(db, handle, cancellationToken);
        if (other is null) return TypedResults.NotFound();
        if (other.Id == me) return Problem("You can't block yourself.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.Friendships.Where(f => (f.UserId == me && f.FriendId == other.Id) || (f.UserId == other.Id && f.FriendId == me))
            .ExecuteDeleteAsync(cancellationToken);
        await db.FriendRequests.Where(r => (r.FromId == me && r.ToId == other.Id) || (r.FromId == other.Id && r.ToId == me))
            .ExecuteDeleteAsync(cancellationToken);
        if (!await db.Blocks.AnyAsync(b => b.BlockerId == me && b.BlockedId == other.Id, cancellationToken))
        {
            db.Blocks.Add(new Block { BlockerId = me, BlockedId = other.Id, BlockedAt = Now(time) });
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // Blocked twice in the same moment.
            }
        }
        await transaction.CommitAsync(cancellationToken);
        return Relation("blocked");
    }

    private static async Task<Results<Ok<RelationResponse>, NotFound>> Unblock(
        string handle, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        var other = await FindAsync(db, handle, cancellationToken);
        if (other is null) return TypedResults.NotFound();
        await db.Blocks.Where(b => b.BlockerId == me && b.BlockedId == other.Id).ExecuteDeleteAsync(cancellationToken);
        return Relation("none");
    }

    /// <summary>The friends of a reader, by name, with how the viewer stands with each.</summary>
    public static async Task<IReadOnlyList<ReaderCard>> FriendsOfAsync(TomekeeperDbContext db, Guid readerId, Guid viewerId, CancellationToken cancellationToken)
    {
        var friends = await db.Friendships.Where(f => f.UserId == readerId)
            .Join(db.Users.NotHiddenFrom(db, viewerId), f => f.FriendId, u => u.Id, (f, u) => new { u, f.Since })
            .OrderBy(x => x.u.DisplayName)
            .ToListAsync(cancellationToken);
        return await CardsAsync(db, viewerId, friends.Select(x => (x.u, (DateTimeOffset?)x.Since)), cancellationToken);
    }

    /// <summary>How the viewer stands with another reader: "you", "friend", "asked", "asksYou" or "none".</summary>
    public static async Task<string> RelationAsync(TomekeeperDbContext db, Guid viewerId, Guid readerId, CancellationToken cancellationToken) =>
        (await RelationsAsync(db, viewerId, [readerId], cancellationToken))[readerId];

    private static async Task<Dictionary<Guid, string>> RelationsAsync(TomekeeperDbContext db, Guid viewerId, IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        var friends = await db.Friendships.Where(f => f.UserId == viewerId && ids.Contains(f.FriendId)).Select(f => f.FriendId).ToListAsync(cancellationToken);
        var asked = await db.FriendRequests.Where(r => r.FromId == viewerId && ids.Contains(r.ToId)).Select(r => r.ToId).ToListAsync(cancellationToken);
        // An ignored request no longer shows for the reader who ignored it.
        var asksYou = await db.FriendRequests.Where(r => r.ToId == viewerId && r.IgnoredAt == null && ids.Contains(r.FromId)).Select(r => r.FromId).ToListAsync(cancellationToken);
        var blocked = await db.Blocks.Where(b => b.BlockerId == viewerId && ids.Contains(b.BlockedId)).Select(b => b.BlockedId).ToListAsync(cancellationToken);
        return ids.Distinct().ToDictionary(id => id, id =>
            id == viewerId ? "you" : blocked.Contains(id) ? "blocked" : friends.Contains(id) ? "friend" : asked.Contains(id) ? "asked" : asksYou.Contains(id) ? "asksYou" : "none");
    }

    /// <summary>The users must be tracked, so readers without an address yet can be given one.</summary>
    public static async Task<IReadOnlyList<ReaderCard>> CardsAsync(
        TomekeeperDbContext db, Guid viewerId, IEnumerable<(User User, DateTimeOffset? Since)> readers, CancellationToken cancellationToken)
    {
        var list = readers.ToList();
        var relations = await RelationsAsync(db, viewerId, list.Select(x => x.User.Id).ToList(), cancellationToken);
        var cards = new List<ReaderCard>(list.Count);
        foreach (var (user, since) in list)
        {
            var handle = await Handles.EnsureAsync(db, user, cancellationToken);
            cards.Add(new ReaderCard(handle, user.DisplayName, user.Portrait?.ToApiName(), relations[user.Id], since));
        }
        return cards;
    }

    private static async Task<string> BefriendAsync(TomekeeperDbContext db, Guid me, Guid otherId, TimeProvider time, CancellationToken cancellationToken)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.FriendRequests.Where(r => (r.FromId == me && r.ToId == otherId) || (r.FromId == otherId && r.ToId == me))
            .ExecuteDeleteAsync(cancellationToken);
        var since = Now(time);
        db.Friendships.AddRange(
            new Friendship { UserId = me, FriendId = otherId, Since = since },
            new Friendship { UserId = otherId, FriendId = me, Since = since });
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Both accepted in the same moment: they are friends either way.
        }
        return "friend";
    }

    private static Task<bool> AreFriendsAsync(TomekeeperDbContext db, Guid me, Guid otherId, CancellationToken cancellationToken) =>
        db.Friendships.AnyAsync(f => f.UserId == me && f.FriendId == otherId, cancellationToken);

    private static Task<User?> FindAsync(TomekeeperDbContext db, string handle, CancellationToken cancellationToken) =>
        db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Handle == handle.ToLowerInvariant(), cancellationToken);

    private static Ok<RelationResponse> Relation(string relation) => TypedResults.Ok(new RelationResponse(relation));

    private static ProblemHttpResult Problem(string detail, int status = StatusCodes.Status400BadRequest) =>
        TypedResults.Problem(detail: detail, statusCode: status, title: status == 404 ? "Not found" : "That can't be done");

    /// <summary>Microseconds, as PostgreSQL stores them, so answers match what is read back later.</summary>
    private static DateTimeOffset Now(TimeProvider time)
    {
        var now = time.GetUtcNow();
        return now.AddTicks(-(now.Ticks % 10));
    }
}
