using System.Security.Cryptography;
using System.Text;

namespace Tomekeeper.Api.Passwords;

public enum BreachResult
{
    NotFound,
    Breached,
    /// <summary>The service couldn't be reached. Sign-up still works; the other rules have already passed.</summary>
    Unknown,
}

public interface IBreachedPasswordCheck
{
    Task<BreachResult> CheckAsync(string password, CancellationToken cancellationToken);
}

/// <summary>
/// Asks Have I Been Pwned's Pwned Passwords service whether a password has appeared in a data breach.
/// Only the first 5 characters of the password's SHA-1 hash leave the server (k-anonymity), and padding
/// hides how many results came back. The password itself is never sent. See https://haveibeenpwned.com/API/v3#PwnedPasswords
/// </summary>
public sealed class PwnedPasswordsClient(HttpClient http, ILogger<PwnedPasswordsClient> logger) : IBreachedPasswordCheck
{
    public async Task<BreachResult> CheckAsync(string password, CancellationToken cancellationToken)
    {
        // SHA-1 is what the service uses for lookups; it is not used to store anything.
        var hash = Convert.ToHexString(SHA1.HashData(Encoding.UTF8.GetBytes(password)));
        var prefix = hash[..5];
        var suffix = hash[5..];

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"range/{prefix}");
            request.Headers.Add("Add-Padding", "true");
            using var response = await http.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            return ContainsSuffix(body, suffix) ? BreachResult.Breached : BreachResult.NotFound;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "Could not reach Pwned Passwords; the breach check was skipped.");
            return BreachResult.Unknown;
        }
    }

    /// <summary>The response has one "SUFFIX:COUNT" per line. Padding lines have a count of 0.</summary>
    internal static bool ContainsSuffix(string body, string suffix)
    {
        foreach (var line in body.Split('\n'))
        {
            var parts = line.Trim().Split(':');
            if (parts.Length == 2
                && string.Equals(parts[0], suffix, StringComparison.OrdinalIgnoreCase)
                && int.TryParse(parts[1], out var count)
                && count > 0)
            {
                return true;
            }
        }
        return false;
    }
}
