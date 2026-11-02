using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;

namespace Tomekeeper.Api.Game;

/// <summary>A piece of gear a reader has earned. Gear is only for show, and it is kept for good.</summary>
public sealed class GearPiece
{
    public Guid UserId { get; set; }

    /// <summary>"spectacles", "cloak", "gloves", "satchel", "lantern" or "quill".</summary>
    public string Item { get; set; } = "";

    /// <summary>The year of the quest that earned it.</summary>
    public int Year { get; set; }

    public DateTimeOffset EarnedAt { get; set; }
}

/// <param name="State">"done", "active" (under way) or "soon" (not open yet).</param>
/// <param name="Item">The gear it earns: "gloves", "spectacles" and so on.</param>
public sealed record QuestResponse(
    string Id, string Name, string Task, string State, int Percent, string Progress, string Reward, string Slot, string Item);

/// <param name="EarnedIn">The year of the quest that earned it, or null when it isn't earned yet.</param>
public sealed record GearResponse(string Item, string Name, string Slot, string Quest, string Task, int? EarnedIn);

public sealed record QuestsResponse(int Year, IReadOnlyList<QuestResponse> Quests, IReadOnlyList<GearResponse> Gear);

public sealed record QuestDefinition(string Id, string Name, string Task, string Reward, string Slot, string Item);

/// <summary>
/// Six quests each year, one for each piece of gear. They are worked out from the reader's progress; when one is
/// done, its gear is recorded, so it stays even if the progress is changed later.
/// </summary>
public static class Quests
{
    public static readonly IReadOnlyList<QuestDefinition> All =
    [
        new("binder", "The Bookbinder", "Finish ten books.", "Bookbinder’s Gloves", "Hands", "gloves"),
        new("scholar", "The Scholar", "Read 2,000 pages of nonfiction.", "Scholar’s Spectacles", "Head", "spectacles"),
        new("road", "The Long Road", "Finish a book over 1,000 pages.", "Pilgrim’s Satchel", "Satchel", "satchel"),
        new("decades", "Five Decades", "Read books first published in five different decades.", "Wayfarer’s Cloak", "Cloak", "cloak"),
        new("quill", "The Chronicler", "Write five reviews.", "Chronicler’s Quill", "Quill", "quill"),
        new("nights", "The Long Nights", "Read 1,500 pages in December.", "Lantern of Long Nights", "Lantern", "lantern"),
    ];

    /// <summary>The gear in the order of the medallions: the left side from the top, then the right.</summary>
    public static readonly IReadOnlyList<string> GearOrder = ["spectacles", "cloak", "gloves", "satchel", "lantern", "quill"];

    public static RouteHandlerBuilder MapQuestEndpoints(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/quests/{year:int}", GetQuests).WithTags("Game").RequireAuthorization();

    private static async Task<Results<Ok<QuestsResponse>, NotFound>> GetQuests(
        int year, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        if (year < 1900 || year > now.Year + 1) return TypedResults.NotFound();
        return TypedResults.Ok(await ForYearAsync(db, principal.GetUserId(), year, now, cancellationToken));
    }

    public static async Task<QuestsResponse> ForYearAsync(
        TomekeeperDbContext db, Guid userId, int year, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var first = new DateOnly(year, 1, 1);
        var last = new DateOnly(year, 12, 31);

        // Books finished in the year, oldest first.
        var finished = await db.Readings.AsNoTracking()
            .Where(r => r.UserId == userId && r.FinishedOn >= first && r.FinishedOn <= last)
            .Join(db.Books, r => r.BookId, b => b.Id, (r, b) => new { r.Page, FinishedOn = r.FinishedOn!.Value, b.Title, b.FirstPublishedYear })
            .OrderBy(x => x.FinishedOn).ThenBy(x => x.Title)
            .ToListAsync(cancellationToken);
        // Nonfiction pages in the year: the reader's own say counts first, then the book's guess.
        var nonfiction = await db.ProgressEntries.AsNoTracking()
            .Where(p => p.UserId == userId && p.ReadOn >= first && p.ReadOn <= last)
            .Join(db.ShelfEntries.Include(e => e.Book), p => new { p.UserId, p.BookId }, e => new { e.UserId, e.BookId },
                (p, e) => new { p.Pages, Fiction = e.Fiction ?? e.Book.Fiction })
            .Where(x => x.Fiction == false)
            .SumAsync(x => x.Pages, cancellationToken);
        var december = await db.ProgressEntries.AsNoTracking()
            .Where(p => p.UserId == userId && p.ReadOn >= new DateOnly(year, 12, 1) && p.ReadOn <= last)
            .SumAsync(p => p.Pages, cancellationToken);
        // Books over 1,000 pages in progress, for The Long Road.
        var longReads = year != today.Year ? [] : await db.Readings.AsNoTracking()
            .Where(r => r.UserId == userId && r.FinishedOn == null)
            .Join(db.ShelfEntries.Include(e => e.Book), r => new { r.UserId, r.BookId }, e => new { e.UserId, e.BookId },
                (r, e) => new { r.Page, Count = e.PageCount ?? e.Book.PageCount, e.Book.Title })
            .Where(x => x.Count > 1000)
            .ToListAsync(cancellationToken);

        // Reviews with words written in the year, oldest first. Stars alone don't count.
        var yearStart = new DateTimeOffset(year, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var reviews = await db.Reviews.AsNoTracking()
            .Where(r => r.UserId == userId && r.Text != null && r.WrittenAt >= yearStart && r.WrittenAt < yearStart.AddYears(1))
            .Join(db.Books, r => r.BookId, b => b.Id, (r, b) => new { r.WrittenAt, b.Title })
            .OrderBy(x => x.WrittenAt)
            .ToListAsync(cancellationToken);

        var quests = new List<QuestResponse>();
        foreach (var quest in All)
        {
            var (state, percent, progress) = quest.Id switch
            {
                "binder" => Count(finished.Count, 10, "books",
                    finished.Count >= 10 ? $"Done in {Month(finished[9].FinishedOn)} with {finished[9].Title}." : null),
                "scholar" => Count(nonfiction, 2000, "pages", null),
                "road" => finished.FirstOrDefault(f => f.Page > 1000) is { } longBook
                    ? ("done", 100, $"Done in {Month(longBook.FinishedOn)} with {longBook.Title}.")
                    : longReads.OrderByDescending(r => (double)r.Page / r.Count!.Value).FirstOrDefault() is { } road
                        ? ("active", road.Page * 100 / road.Count!.Value, $"{road.Title}, page {road.Page:N0} of {road.Count:N0}.")
                        : ("active", 0, "Start a book over 1,000 pages."),
                "decades" => Decades(finished.Where(f => f.FirstPublishedYear is not null).Select(f => f.FirstPublishedYear!.Value / 10 * 10)),
                "quill" => reviews.Count >= 5
                    ? ("done", 100, $"Done in {Month(DateOnly.FromDateTime(reviews[4].WrittenAt.UtcDateTime))} with a review of {reviews[4].Title}.")
                    : ("active", reviews.Count * 20, $"{reviews.Count} of 5 reviews. Stars alone don’t count; write a few words."),
                "nights" => year > today.Year || (year == today.Year && today.Month < 12)
                    ? ("soon", 0, "Opens 1 December.")
                    : Count(december, 1500, "pages in December", null),
                _ => throw new InvalidOperationException($"No rules for the quest {quest.Id}."),
            };
            quests.Add(new QuestResponse(quest.Id, quest.Name, quest.Task, state, percent, progress, quest.Reward, quest.Slot, quest.Item));
        }

        var earned = await AwardAsync(db, userId, year, quests.Where(q => q.State == "done").Select(q => q.Item).ToList(), now, cancellationToken);
        var gear = GearOrder
            .Select(item => All.Single(q => q.Item == item))
            .Select(q => new GearResponse(q.Item, q.Reward, q.Slot, q.Name, q.Task, earned.TryGetValue(q.Item, out var y) ? y : null))
            .ToList();
        return new QuestsResponse(year, quests, gear);
    }

    /// <summary>Records gear for quests that are done, unless the reader has it already. Gives every piece the reader has.</summary>
    private static async Task<Dictionary<string, int>> AwardAsync(
        TomekeeperDbContext db, Guid userId, int year, IReadOnlyList<string> items, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var earned = await db.Gear.AsNoTracking().Where(g => g.UserId == userId).ToDictionaryAsync(g => g.Item, g => g.Year, cancellationToken);
        var fresh = items.Where(item => !earned.ContainsKey(item)).ToList();
        if (fresh.Count == 0) return earned;

        foreach (var item in fresh)
        {
            db.Gear.Add(new GearPiece { UserId = userId, Item = item, Year = year, EarnedAt = now });
            earned[item] = year;
        }
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The same piece was recorded by another request at the same moment. It is there either way.
            db.ChangeTracker.Clear();
        }
        return earned;
    }

    private static (string, int, string) Count(int have, int need, string noun, string? doneText) =>
        have >= need
            ? ("done", 100, doneText ?? $"Done: {have:N0} of {need:N0} {noun}.")
            : ("active", have * 100 / need, $"{have:N0} of {need:N0} {noun}.");

    private static (string, int, string) Decades(IEnumerable<int> decades)
    {
        var list = decades.Distinct().Order().Select(d => $"{d}s").ToList();
        if (list.Count == 0) return ("active", 0, "No decades yet. Finish a book to start.");
        var named = list.Count == 1 ? list[0] : $"{string.Join(", ", list[..^1])} and {list[^1]}";
        return list.Count >= 5
            ? ("done", 100, $"Done: the {named}.")
            : ("active", list.Count * 20, $"{list.Count} of 5: the {named}.");
    }

    /// <summary>"May". The API runs with invariant globalization, whose month names are English.</summary>
    private static string Month(DateOnly day) => day.ToString("MMMM", CultureInfo.InvariantCulture);
}
