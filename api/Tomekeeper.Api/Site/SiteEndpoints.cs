using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using Tomekeeper.Api.Accounts;

namespace Tomekeeper.Api.Site;

/// <param name="OperatorName">Who runs the site, for the privacy policy (App:OperatorName).</param>
/// <param name="ContactEmail">Where readers write about their data or accessibility (App:ContactEmail).</param>
public sealed record SiteResponse(string? OperatorName, string? ContactEmail);

/// <summary>
/// GET /api/site: facts about the running site that the privacy policy and accessibility statement show. They are
/// settings of the deployment, so the name and address aren't in the public repository. Open to everyone, since
/// those pages are.
/// </summary>
public static class SiteEndpoints
{
    public static void MapSiteEndpoints(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/site", (IOptions<AppOptions> options) => TypedResults.Ok(new SiteResponse(
            Blank(options.Value.OperatorName), Blank(options.Value.ContactEmail)))).WithTags("Site");

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
