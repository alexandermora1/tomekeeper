namespace Tomekeeper.Api.Security;

/// <summary>
/// Headers on every API response that tell browsers to be strict with it (OWASP REST Security Cheat Sheet).
/// The pages themselves get their Content Security Policy from the front-end build (web/vite.config.ts).
/// </summary>
public static class SecurityHeaders
{
    /// <summary>API answers are data, never pages: no scripts, styles or frames of any kind.</summary>
    public const string ApiContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                // Don't guess the type of a response from its content.
                headers.XContentTypeOptions = "nosniff";
                // Never show an API response inside a frame on another site.
                headers.XFrameOptions = "DENY";
                headers.ContentSecurityPolicy = ApiContentSecurityPolicy;
                headers["Cross-Origin-Opener-Policy"] = "same-origin";
                headers["Cross-Origin-Resource-Policy"] = "same-origin";
                headers["Referrer-Policy"] = "no-referrer";
                headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
                // Answers are about one reader; browsers and proxies must not keep copies. Unless the endpoint
                // has said otherwise itself, as covers do (the same picture for everyone, kept in the browser).
                if (context.Request.Path.StartsWithSegments("/api") && string.IsNullOrEmpty(headers.CacheControl)) headers.CacheControl = "no-store";
                return Task.CompletedTask;
            });
            await next(context);
        });
}
