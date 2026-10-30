namespace Tomekeeper.Api.Goals;

/// <summary>
/// What a reader wants to read in one calendar year: a number of pages, a number of books, or both.
/// Each reader has at most one goal per year.
/// </summary>
public sealed class ReadingGoal
{
    public const int MaxPages = 100_000;
    public const int MaxBooks = 1_000;

    public Guid UserId { get; set; }

    public int Year { get; set; }

    /// <summary>Pages to read by 31 December, or null when the goal only counts books.</summary>
    public int? Pages { get; set; }

    /// <summary>Books to finish by 31 December, or null when the goal only counts pages.</summary>
    public int? Books { get; set; }

    public DateTimeOffset UpdatedAt { get; set; }
}
