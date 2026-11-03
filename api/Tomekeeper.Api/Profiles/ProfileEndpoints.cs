using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Fellowship;
using Tomekeeper.Api.Game;
using Tomekeeper.Api.Reviews;
using Tomekeeper.Api.Shelves;

namespace Tomekeeper.Api.Profiles;

/// <param name="Progress">Year and volumes: pages, goal, level and past years.</param>
/// <param name="Reading">The books on Reading now.</param>
/// <param name="Reviews">Reviews the reader writes.</param>
/// <param name="Friends">Who the reader's friends are.</param>
public sealed record VisibilitySettings(string Progress, string Reading, string Reviews, string Friends)
{
    public static VisibilitySettings From(User user) => new(
        user.ProgressVisibleTo.ToApiName(), user.ReadingVisibleTo.ToApiName(), user.ReviewsVisibleTo.ToApiName(), user.FriendsVisibleTo.ToApiName());
}

public sealed record ProfileSettingsResponse(string Handle, string? Bio, VisibilitySettings Visibility);

public sealed record ProfileRequest(string? Handle, string? Bio);

/// <summary>Any of the four; the ones left out stay as they are.</summary>
public sealed record VisibilityRequest(string? Progress, string? Reading, string? Reviews, string? Friends);

public sealed record YearSection(int Year, int PagesRead, int? GoalPages, int BooksFinished, int Level, string Title);

/// <param name="BookId">Set when the viewer can open the book's page (books added by hand are the owner's alone).</param>
/// <param name="Percent">How far through, when the page count is known.</param>
public sealed record ReadingNowItem(Guid? BookId, string Title, IReadOnlyList<string> Authors, int? Percent);

/// <param name="ViewedAs">"you", "friend" or "stranger": who the profile is shown for.</param>
/// <param name="Year">Null when hidden from this viewer; the same for the other sections.</param>
/// <param name="SomethingHidden">True when this viewer can't see some part of the profile.</param>
/// <param name="Visibility">The settings, for the owner only.</param>
/// <param name="Relation">How the viewer stands with the reader ("friend", "asked", "asksYou" or "none"); null for the owner.</param>
/// <param name="Fellowship">The reader's friends, when this viewer may see them.</param>
/// <param name="Reviews">The reader's latest reviews, when this viewer may see them.</param>
public sealed record ReaderProfileResponse(
    string Handle,
    string DisplayName,
    string? Portrait,
    string? Bio,
    int Since,
    string ViewedAs,
    bool IsOwner,
    YearSection? Year,
    IReadOnlyList<ReadingNowItem>? ReadingNow,
    IReadOnlyList<VolumeResponse>? Volumes,
    bool SomethingHidden,
    VisibilitySettings? Visibility,
    string? Relation,
    IReadOnlyList<ReaderCard>? Fellowship,
    IReadOnlyList<ProfileReview>? Reviews);

/// <summary>Readers' profiles: their own settings under /api/profile, and anyone's profile under /api/readers/{handle}.</summary>
public static class ProfileEndpoints
{
    public const int BioMaxLength = 300;
    public const string HandleMessage = "Use 3 to 30 lowercase letters, digits and hyphens, starting and ending with a letter or digit.";
    public const string HandleTakenMessage = "Another reader has that address. Try another.";

    public static void MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var profile = app.MapGroup("/api/profile").WithTags("Profiles").RequireAuthorization();
        profile.MapGet("/", GetSettings);
        profile.MapPut("/", PutProfile);
        profile.MapPut("/visibility", PutVisibility);
        app.MapGet("/api/readers/{handle}", GetReader).WithTags("Profiles").RequireAuthorization();
    }

    private static async Task<Ok<ProfileSettingsResponse>> GetSettings(
        ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleAsync(u => u.Id == principal.GetUserId(), cancellationToken);
        var handle = await Handles.EnsureAsync(db, user, cancellationToken);
        return TypedResults.Ok(new ProfileSettingsResponse(handle, user.Bio, VisibilitySettings.From(user)));
    }

    private static async Task<Results<Ok<ProfileSettingsResponse>, ValidationProblem>> PutProfile(
        ProfileRequest request, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var handle = request.Handle?.Trim().ToLowerInvariant() ?? "";
        var bio = string.IsNullOrWhiteSpace(request.Bio) ? null : request.Bio.Trim();
        var user = await db.Users.SingleAsync(u => u.Id == principal.GetUserId(), cancellationToken);

        var errors = new FieldErrors();
        if (!Handles.IsValid(handle)) errors.Add("handle", HandleMessage);
        else if (await db.Users.AnyAsync(u => u.Handle == handle && u.Id != user.Id, cancellationToken)) errors.Add("handle", HandleTakenMessage);
        if (bio?.Length > BioMaxLength) errors.Add("bio", $"Keep the text about you to {BioMaxLength} characters or fewer.");
        if (errors.Any) return errors.ToProblem();

        user.Handle = handle;
        user.Bio = bio;
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Another reader took the address in the same moment.
            return new FieldErrors().Add("handle", HandleTakenMessage).ToProblem();
        }
        return TypedResults.Ok(new ProfileSettingsResponse(handle, bio, VisibilitySettings.From(user)));
    }

    private static async Task<Results<Ok<ProfileSettingsResponse>, ValidationProblem>> PutVisibility(
        VisibilityRequest request, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var user = await db.Users.SingleAsync(u => u.Id == principal.GetUserId(), cancellationToken);
        var errors = new FieldErrors();
        Set(request.Progress, "progress", v => user.ProgressVisibleTo = v);
        Set(request.Reading, "reading", v => user.ReadingVisibleTo = v);
        Set(request.Reviews, "reviews", v => user.ReviewsVisibleTo = v);
        Set(request.Friends, "friends", v => user.FriendsVisibleTo = v);
        if (errors.Any) return errors.ToProblem();

        await db.SaveChangesAsync(cancellationToken);
        var handle = await Handles.EnsureAsync(db, user, cancellationToken);
        return TypedResults.Ok(new ProfileSettingsResponse(handle, user.Bio, VisibilitySettings.From(user)));

        void Set(string? name, string field, Action<Visibility> apply)
        {
            if (name is null) return;
            if (Visibilities.FromApiName(name) is { } visibility) apply(visibility);
            else errors.Add(field, "Choose Everyone, Friends or Only you.");
        }
    }

    /// <param name="as">The owner can preview their profile as "friend" or "stranger" sees it.</param>
    private static async Task<Results<Ok<ReaderProfileResponse>, NotFound>> GetReader(
        string handle, string? @as, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var owner = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Handle == handle.ToLowerInvariant(), cancellationToken);
        if (owner is null) return TypedResults.NotFound();

        var viewerId = principal.GetUserId();
        var isOwner = owner.Id == viewerId;
        // Blocked either way: the two don't see each other.
        if (!isOwner && await Blocks.BetweenAsync(db, viewerId, owner.Id, cancellationToken)) return TypedResults.NotFound();
        var relation = isOwner ? null : await FellowshipEndpoints.RelationAsync(db, viewerId, owner.Id, cancellationToken);
        var viewedAs = isOwner ? @as is "friend" or "stranger" ? @as : "you" : relation == "friend" ? "friend" : "stranger";
        bool Can(Visibility visibility) =>
            viewedAs == "you" || visibility == Visibility.Everyone || (visibility == Visibility.Friends && viewedAs == "friend");

        var now = time.GetUtcNow();
        YearSection? year = null;
        IReadOnlyList<VolumeResponse>? volumes = null;
        if (Can(owner.ProgressVisibleTo))
        {
            var sheet = await CharacterSheet.ForYearAsync(db, owner.Id, now.Year, cancellationToken);
            var goal = await db.Goals.AsNoTracking().FirstOrDefaultAsync(g => g.UserId == owner.Id && g.Year == now.Year, cancellationToken);
            volumes = await Legacy.VolumesAsync(db, owner.Id, now, cancellationToken);
            var books = volumes.FirstOrDefault(v => v.Year == now.Year)?.Books ?? 0;
            year = new YearSection(now.Year, sheet.PagesXp, goal?.Pages, books, sheet.Level, sheet.Title);
        }

        IReadOnlyList<ReadingNowItem>? reading = null;
        if (Can(owner.ReadingVisibleTo))
        {
            var entries = await db.ShelfEntries.AsNoTracking().Include(e => e.Book)
                .Where(e => e.UserId == owner.Id && e.Shelf == Shelf.Reading)
                .OrderByDescending(e => e.ShelvedAt)
                .ToListAsync(cancellationToken);
            var pages = await db.Readings.AsNoTracking()
                .Where(r => r.UserId == owner.Id && r.FinishedOn == null)
                .ToDictionaryAsync(r => r.BookId, r => r.Page, cancellationToken);
            reading = entries.Select(e =>
            {
                var count = e.PageCount ?? e.Book.PageCount;
                int? percent = count is > 0 && pages.TryGetValue(e.BookId, out var page) ? Math.Min(100, page * 100 / count.Value) : null;
                Guid? bookId = isOwner || e.Book.AddedById is null ? e.BookId : null;
                return new ReadingNowItem(bookId, e.Book.Title, e.Book.Authors, percent);
            }).ToList();
        }

        var fellowship = Can(owner.FriendsVisibleTo) ? await FellowshipEndpoints.FriendsOfAsync(db, owner.Id, viewerId, cancellationToken) : null;

        var reviews = Can(owner.ReviewsVisibleTo) ? await ReviewEndpoints.LatestAsync(db, owner.Id, isOwner, cancellationToken) : null;

        var hidden = !Can(owner.ProgressVisibleTo) || !Can(owner.ReadingVisibleTo) || !Can(owner.FriendsVisibleTo) || !Can(owner.ReviewsVisibleTo);
        return TypedResults.Ok(new ReaderProfileResponse(
            owner.Handle!, owner.DisplayName, owner.Portrait?.ToApiName(), owner.Bio, owner.CreatedAt.Year, viewedAs, isOwner,
            year, reading, volumes, hidden, isOwner ? VisibilitySettings.From(owner) : null, relation, fellowship, reviews));
    }
}
