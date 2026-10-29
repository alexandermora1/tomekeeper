using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Tomekeeper.Api.Health;

public static class HealthEndpoints
{
    public const string DatabaseCheck = "database";

    /// <summary>
    /// <c>/api/health/live</c> answers as long as the API runs.
    /// <c>/api/health/ready</c> also checks that the database answers; it returns 503 when it doesn't.
    /// </summary>
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapHealthChecks("/api/health/live", new HealthCheckOptions
        {
            Predicate = _ => false,
            ResponseWriter = WriteJson,
        });

        app.MapHealthChecks("/api/health/ready", new HealthCheckOptions
        {
            ResponseWriter = WriteJson,
        });

        return app;
    }

    private static Task WriteJson(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json; charset=utf-8";
        var body = new HealthResponse(
            report.Status.ToString(),
            report.Entries.Select(entry => new HealthCheckResponse(entry.Key, entry.Value.Status.ToString())).ToList());
        return context.Response.WriteAsync(JsonSerializer.Serialize(body, JsonOptions));
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}

public sealed record HealthResponse(string Status, IReadOnlyList<HealthCheckResponse> Checks);

public sealed record HealthCheckResponse(string Name, string Status);
