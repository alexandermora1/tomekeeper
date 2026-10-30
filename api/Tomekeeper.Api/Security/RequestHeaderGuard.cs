namespace Tomekeeper.Api.Security;

/// <summary>
/// Protection against cross-site request forgery (CSRF) for the cookie sign-in.
///
/// Every request that changes something (POST, PUT, PATCH, DELETE) under /api must carry the header
/// X-Tomekeeper-Request. Our own front-end adds it to every call. A page on another site can't add a custom
/// header to a cross-site request without the API allowing it through CORS, and this API allows no other sites.
/// The sign-in cookie is also SameSite=Lax, so browsers leave it off most cross-site requests anyway.
/// This is the "custom request header" defence from the OWASP CSRF Prevention Cheat Sheet.
/// </summary>
public static class RequestHeaderGuard
{
    public const string HeaderName = "X-Tomekeeper-Request";

    public static IApplicationBuilder UseRequestHeaderGuard(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var request = context.Request;
            var changesSomething = !(HttpMethods.IsGet(request.Method) || HttpMethods.IsHead(request.Method) || HttpMethods.IsOptions(request.Method));
            if (changesSomething && request.Path.StartsWithSegments("/api") && !request.Headers.ContainsKey(HeaderName))
            {
                await Results.Problem(
                    statusCode: StatusCodes.Status400BadRequest,
                    title: "Missing request header",
                    detail: $"Requests that change something must include the {HeaderName} header.").ExecuteAsync(context);
                return;
            }
            await next(context);
        });
}
