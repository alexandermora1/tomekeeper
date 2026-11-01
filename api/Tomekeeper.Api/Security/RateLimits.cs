using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Tomekeeper.Api.Security;

/// <summary>How many tries are allowed. The defaults are in the code; tests and appsettings can change them.</summary>
public sealed class RateLimitSettings
{
    public const string Section = "RateLimits";

    /// <summary>Signing in, signing up, confirming and resetting: requests per minute from one IP address.</summary>
    public int AccountRequestsPerMinute { get; set; } = 10;

    /// <summary>Asking for an email (password reset, a new confirmation link): requests per 15 minutes from one IP address.</summary>
    public int EmailRequestsPer15Minutes { get; set; } = 5;

    /// <summary>Emails of one kind sent to one address per hour, however many IP addresses ask.</summary>
    public int EmailsPerAddressPerHour { get; set; } = 3;

    /// <summary>Book searches (which go on to Open Library) per minute from one IP address.</summary>
    public int SearchRequestsPerMinute { get; set; } = 30;
}

/// <summary>
/// Limits on how often the account endpoints can be called, so nobody can guess passwords quickly or use the
/// site to flood someone's inbox. Lockout after 5 wrong passwords protects one account; these limits protect
/// against one attacker trying many accounts.
/// </summary>
public static class RateLimits
{
    public const string AccountPolicy = "accounts";
    public const string EmailPolicy = "emails";
    public const string SearchPolicy = "search";
    public const string TooManyMessage = "Too many attempts from this connection. Wait a little and try again.";

    public static IServiceCollection AddTomekeeperRateLimits(this IServiceCollection services, IConfiguration configuration)
    {
        var settings = configuration.GetSection(RateLimitSettings.Section).Get<RateLimitSettings>() ?? new RateLimitSettings();

        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, cancellationToken) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        Math.Ceiling(retryAfter.TotalSeconds).ToString(CultureInfo.InvariantCulture);
                }
                var problems = context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
                await problems.WriteAsync(new ProblemDetailsContext
                {
                    HttpContext = context.HttpContext,
                    ProblemDetails = { Status = StatusCodes.Status429TooManyRequests, Title = "Too many requests", Detail = TooManyMessage },
                });
            };

            options.AddPolicy(AccountPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                ClientAddress(http),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = settings.AccountRequestsPerMinute, Window = TimeSpan.FromMinutes(1) }));

            options.AddPolicy(EmailPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                ClientAddress(http),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = settings.EmailRequestsPer15Minutes, Window = TimeSpan.FromMinutes(15) }));

            options.AddPolicy(SearchPolicy, http => RateLimitPartition.GetFixedWindowLimiter(
                ClientAddress(http),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = settings.SearchRequestsPerMinute, Window = TimeSpan.FromMinutes(1) }));
        });

        services.AddSingleton(new EmailLimiter(settings.EmailsPerAddressPerHour));
        return services;
    }

    /// <summary>
    /// The visitor's IP address. Locally every request comes through the Vite proxy, so they all share one.
    /// Behind Azure's proxy this needs the forwarded headers set up in stage 6.
    /// </summary>
    private static string ClientAddress(HttpContext http) => http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
}

/// <summary>
/// Counts emails per address, such as "password reset for reader@example.no", and says no after a few an hour.
/// The endpoints still answer as usual, so the limit doesn't reveal anything.
/// </summary>
public sealed class EmailLimiter(int perAddressPerHour) : IDisposable
{
    private readonly PartitionedRateLimiter<string> _limiter = PartitionedRateLimiter.Create<string, string>(key =>
        RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = perAddressPerHour,
            Window = TimeSpan.FromHours(1),
        }));

    /// <param name="kind">What the email is, such as "reset".</param>
    /// <param name="address">Who it goes to. Case doesn't matter.</param>
    public bool MaySend(string kind, string address)
    {
        using var lease = _limiter.AttemptAcquire($"{kind}:{address.Trim().ToUpperInvariant()}");
        return lease.IsAcquired;
    }

    public void Dispose() => _limiter.Dispose();
}
