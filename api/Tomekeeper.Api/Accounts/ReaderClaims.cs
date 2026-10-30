using System.Security.Claims;

namespace Tomekeeper.Api.Accounts;

public static class ReaderClaims
{
    /// <summary>
    /// The signed-in reader's id, from the sign-in cookie. Only use it in endpoints that require sign-in,
    /// so there always is one.
    /// </summary>
    public static Guid GetUserId(this ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("No reader is signed in."));
}
