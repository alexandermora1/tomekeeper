using System.ComponentModel.DataAnnotations;
using System.Text;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;

namespace Tomekeeper.Api.Accounts;

public sealed class AppOptions
{
    public const string Section = "App";

    /// <summary>Where readers open the site, such as http://localhost:5173. Links in emails point here.</summary>
    [Required, Url]
    public string PublicUrl { get; set; } = "";
}

/// <summary>
/// Builds the links in account emails. Identity's tokens are made URL-safe (base64url) so they survive
/// being clicked in an email client; the front-end page sends the code back to the API as it is.
/// </summary>
public sealed class AccountLinks(IOptions<AppOptions> options)
{
    private string Base => options.Value.PublicUrl.TrimEnd('/');

    public string Confirmation(Guid userId, string token) =>
        $"{Base}/confirm-email?userId={userId}&code={Encode(token)}";

    public string PasswordReset(string email, string token) =>
        $"{Base}/reset-password?email={Uri.EscapeDataString(email)}&code={Encode(token)}";

    public static string Encode(string token) => WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));

    /// <summary>The token inside a code, or null when the code has been mangled.</summary>
    public static string? Decode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        try
        {
            return Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(code));
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
