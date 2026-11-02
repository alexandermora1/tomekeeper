using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;

namespace Tomekeeper.Api.Game;

/// <summary>The reader's character for a year: GET /api/character/{year}.</summary>
public static class CharacterEndpoints
{
    public static RouteHandlerBuilder MapCharacterEndpoints(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/character/{year:int}", GetCharacter).WithTags("Game").RequireAuthorization();

    private static async Task<Results<Ok<CharacterResponse>, NotFound>> GetCharacter(
        int year, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        if (year < 1900 || year > time.GetUtcNow().Year + 1) return TypedResults.NotFound();
        return TypedResults.Ok(await CharacterSheet.ForYearAsync(db, principal.GetUserId(), year, cancellationToken));
    }
}
