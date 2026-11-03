using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Net.Http.Headers;

namespace Tomekeeper.Api.Security;

/// <summary>
/// Running on a host such as Azure App Service: behind its proxy, and serving the built front-end (web/dist,
/// copied to wwwroot when publishing) from the same address as the API.
/// </summary>
public static class SiteHosting
{
    /// <summary>
    /// App:BehindProxy. Azure App Service ends HTTPS in front of the app and passes the original scheme and the
    /// reader's address in X-Forwarded-Proto and X-Forwarded-For. Trusting them makes cookies secure, rate limits
    /// count per reader, and Google's redirect address https. Only the last proxy's values are used
    /// (ForwardLimit 1), and App Service adds its own, so a reader can't pretend to come from elsewhere.
    /// </summary>
    public const string BehindProxyKey = "App:BehindProxy";

    public static void AddProxySupport(this WebApplicationBuilder builder)
    {
        if (!builder.Configuration.GetValue<bool>(BehindProxyKey)) return;
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            // App Service's proxies don't have fixed addresses.
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();
        });
    }

    public static void UseProxySupport(this WebApplication app)
    {
        if (app.Configuration.GetValue<bool>(BehindProxyKey)) app.UseForwardedHeaders();
    }

    /// <summary>
    /// The front-end's files, when there are any (after publishing; not when running locally with Vite). Files
    /// with a hash in the name (/assets/…) never change, so browsers may keep them for a year; index.html must
    /// be checked each time, so a new version reaches readers at once.
    /// </summary>
    public static void UseFrontEnd(this WebApplication app)
    {
        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = context =>
            {
                var headers = context.Context.Response.Headers;
                headers.CacheControl = context.Context.Request.Path.StartsWithSegments("/assets")
                    ? "public, max-age=31536000, immutable"
                    : "no-cache";
            },
        });
    }

    /// <summary>
    /// Addresses that aren't API calls or files are the front-end's own pages (/library, /readers/alex): they get
    /// index.html, and React Router shows the page. Unknown API addresses stay a plain 404.
    /// </summary>
    public static void MapFrontEndFallback(this WebApplication app)
    {
        app.Map("/api/{**rest}", () => TypedResults.NotFound());
        app.MapFallbackToFile("index.html", new StaticFileOptions
        {
            OnPrepareResponse = context => context.Context.Response.Headers[HeaderNames.CacheControl] = "no-cache",
        });
    }
}
