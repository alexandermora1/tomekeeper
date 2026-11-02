using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Data;

namespace Tomekeeper.Api.Game;

/// <param name="To">The last level with this title, or null for the highest title.</param>
public sealed record Title(string Name, int From, int? To);

/// <summary>
/// Experience and levels. A reader earns 1 XP per page, and a quarter of a book's pages when they finish it.
/// Levels are the same for everyone and start again each 1 January.
/// </summary>
public static class Levels
{
    /// <summary>Finishing a book earns its pages divided by this: a quarter.</summary>
    public const int FinishBonusDivisor = 4;

    public static readonly IReadOnlyList<Title> Titles =
    [
        new("Novice", 1, 4),
        new("Reader", 5, 9),
        new("Wayfarer", 10, 14),
        new("Scholar", 15, 19),
        new("Sage", 20, null),
    ];

    /// <summary>
    /// The XP needed to reach a level: 25 × (level − 1) × (level + 20). Each level costs a little more than the one
    /// before: level 2 at 550 XP (about two books), 5 at 2,500, 10 at 6,750, 15 at 12,250 and 20 at 19,000
    /// (a year of very keen reading).
    /// </summary>
    public static int XpFor(int level) => 25 * (level - 1) * (level + 20);

    public static int LevelFor(int xp)
    {
        var level = 1;
        while (XpFor(level + 1) <= xp) level++;
        return level;
    }

    public static string TitleFor(int level) => Titles.Last(t => level >= t.From).Name;
}

/// <param name="PagesXp">1 XP per page logged in the year.</param>
/// <param name="FinishXp">A quarter of the pages of each book finished in the year.</param>
/// <param name="LevelStartsAt">The XP where this level began.</param>
/// <param name="NextLevelAt">The XP where the next level begins.</param>
public sealed record CharacterResponse(
    int Year,
    int Xp,
    int PagesXp,
    int FinishXp,
    int Level,
    string Title,
    int LevelStartsAt,
    int NextLevelAt,
    IReadOnlyList<Title> Titles);

public static class CharacterSheet
{
    /// <summary>The reader's XP and level for a year, counted from their progress on their own dates.</summary>
    public static async Task<CharacterResponse> ForYearAsync(TomekeeperDbContext db, Guid userId, int year, CancellationToken cancellationToken)
    {
        var first = new DateOnly(year, 1, 1);
        var last = new DateOnly(year, 12, 31);
        var pages = await db.ProgressEntries.AsNoTracking()
            .Where(p => p.UserId == userId && p.ReadOn >= first && p.ReadOn <= last)
            .SumAsync(p => p.Pages, cancellationToken);
        // A finished reading's page is the book's last page, so it is the page count the reader used.
        var bonus = await db.Readings.AsNoTracking()
            .Where(r => r.UserId == userId && r.FinishedOn >= first && r.FinishedOn <= last)
            .SumAsync(r => r.Page / Levels.FinishBonusDivisor, cancellationToken);
        var xp = pages + bonus;
        var level = Levels.LevelFor(xp);
        return new CharacterResponse(
            year, xp, pages, bonus, level, Levels.TitleFor(level), Levels.XpFor(level), Levels.XpFor(level + 1), Levels.Titles);
    }
}
