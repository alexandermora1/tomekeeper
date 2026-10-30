using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;

namespace Tomekeeper.Api.Goals;

/// <param name="Kind">"pages", "books" or "both": what the goal counts.</param>
public sealed record GoalRequest(string? Kind, int? Pages, int? Books);

public sealed record GoalResponse(int Year, int? Pages, int? Books)
{
    public static GoalResponse From(ReadingGoal goal) => new(goal.Year, goal.Pages, goal.Books);
}

/// <summary>The signed-in reader's yearly goals, under /api/goals/{year}.</summary>
public static class GoalEndpoints
{
    public const string YearOutOfReachMessage = "A goal can be for last year, this year or next year.";

    public static RouteGroupBuilder MapGoalEndpoints(this IEndpointRouteBuilder app)
    {
        var goals = app.MapGroup("/api/goals").WithTags("Goals").RequireAuthorization();
        goals.MapGet("/{year:int}", GetGoal);
        goals.MapPut("/{year:int}", PutGoal);
        return goals;
    }

    private static async Task<Results<Ok<GoalResponse>, NotFound>> GetGoal(
        int year, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var userId = principal.GetUserId();
        var goal = await db.Goals.AsNoTracking()
            .FirstOrDefaultAsync(g => g.UserId == userId && g.Year == year, cancellationToken);
        return goal is null ? TypedResults.NotFound() : TypedResults.Ok(GoalResponse.From(goal));
    }

    /// <summary>Sets the goal for a year, or changes it. The year is in the address, because readers' years
    /// start at different moments around the world; the API only checks that it is close to now.</summary>
    private static async Task<Results<Ok<GoalResponse>, ValidationProblem, ProblemHttpResult>> PutGoal(
        int year,
        GoalRequest request,
        ClaimsPrincipal principal,
        TomekeeperDbContext db,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        var thisYear = time.GetUtcNow().Year;
        if (year < thisYear - 1 || year > thisYear + 1)
        {
            return TypedResults.Problem(statusCode: StatusCodes.Status400BadRequest, title: "That didn't work", detail: YearOutOfReachMessage);
        }

        var (countsPages, countsBooks) = request.Kind switch
        {
            "pages" => (true, false),
            "books" => (false, true),
            "both" => (true, true),
            _ => (false, false),
        };

        var errors = new FieldErrors();
        if (!countsPages && !countsBooks) errors.Add("kind", "Choose pages, books or both.");
        if (countsPages) CheckTarget(errors, "pages", request.Pages, ReadingGoal.MaxPages);
        if (countsBooks) CheckTarget(errors, "books", request.Books, ReadingGoal.MaxBooks);
        if (errors.Any) return errors.ToProblem();

        var userId = principal.GetUserId();
        var goal = await db.Goals.FirstOrDefaultAsync(g => g.UserId == userId && g.Year == year, cancellationToken);
        if (goal is null)
        {
            goal = new ReadingGoal { UserId = userId, Year = year };
            db.Goals.Add(goal);
        }
        goal.Pages = countsPages ? request.Pages : null;
        goal.Books = countsBooks ? request.Books : null;
        goal.UpdatedAt = time.GetUtcNow();
        await db.SaveChangesAsync(cancellationToken);

        return TypedResults.Ok(GoalResponse.From(goal));
    }

    /// <param name="field">"pages" or "books", which is also the word used in the message.</param>
    private static void CheckTarget(FieldErrors errors, string field, int? value, int max)
    {
        if (value is null) errors.Add(field, $"Enter how many {field}.");
        else if (value < 1 || value > max) errors.Add(field, $"Choose a number of {field} from 1 to {max:N0}.");
    }
}
