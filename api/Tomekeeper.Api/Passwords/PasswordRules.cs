namespace Tomekeeper.Api.Passwords;

public enum PasswordProblem
{
    TooShort,
    TooLong,
    ContainsPersonalInfo,
    TooEasyToGuess,
}

/// <summary>
/// The password rules, following NIST SP 800-63B-4: long passwords, no rules about character types,
/// and a check against passwords that are known or easy to guess. The breach check is separate
/// (<see cref="IBreachedPasswordCheck"/>) because it calls an outside service.
/// </summary>
public static class PasswordRules
{
    public const int MinimumLength = 15;
    public const int MaximumLength = 256;

    /// <summary>Keyboard rows and columns and other runs people type without thinking.</summary>
    private static readonly string[] Sequences =
    [
        "1234567890",
        "qwertyuiop",
        "asdfghjkl",
        "zxcvbnm",
        "abcdefghijklmnopqrstuvwxyz",
        "1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p",
        "qazwsxedcrfvtgbyhnujmikolp",
    ];

    /// <summary>The first problem with a password, or null if it is fine. Length is checked first.</summary>
    public static PasswordProblem? Check(string password, string? email, string? displayName)
    {
        if (password.Length < MinimumLength) return PasswordProblem.TooShort;
        if (password.Length > MaximumLength) return PasswordProblem.TooLong;

        var lower = password.ToLowerInvariant();
        if (ContainsPersonalInfo(lower, email, displayName)) return PasswordProblem.ContainsPersonalInfo;
        if (IsEasyToGuess(lower)) return PasswordProblem.TooEasyToGuess;
        return null;
    }

    public static string Message(PasswordProblem problem, int length) => problem switch
    {
        PasswordProblem.TooShort => $"Make the password at least {MinimumLength} characters. It has {length}.",
        PasswordProblem.TooLong => $"Make the password {MaximumLength} characters or fewer.",
        PasswordProblem.ContainsPersonalInfo => "Don't use your name or email address in the password.",
        PasswordProblem.TooEasyToGuess => "That password is too easy to guess. Try a few unrelated words.",
        _ => "Choose another password.",
    };

    public const string BreachedMessage =
        "That password has appeared in a data breach, so attackers will try it. Choose another.";

    internal static bool ContainsPersonalInfo(string lower, string? email, string? displayName)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(email))
        {
            var local = email.Split('@')[0].ToLowerInvariant();
            parts.Add(local);
            parts.AddRange(local.Split('.', '_', '-', '+'));
        }
        if (!string.IsNullOrWhiteSpace(displayName))
        {
            parts.AddRange(displayName.ToLowerInvariant().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        }
        return parts.Any(part => part.Length >= 4 && lower.Contains(part, StringComparison.Ordinal));
    }

    internal static bool IsEasyToGuess(string lower)
    {
        if (lower.Contains("tomekeeper", StringComparison.Ordinal)) return true;
        if (CommonPasswords.Contains(lower)) return true;

        // A common password with digits or symbols around it: "password1234567", "!!sunshine2024!!".
        var core = lower.Trim(TrimmedAround);
        if (core.Length >= 4 && core.Length < lower.Length && core.All(char.IsLetter) && CommonPasswords.Contains(core)) return true;

        if (lower.Distinct().Count() < 5) return true;
        if (IsRepetition(lower)) return true;
        if (IsKeyboardWalk(lower)) return true;
        return false;
    }

    private static readonly char[] TrimmedAround = "0123456789 !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".ToCharArray();

    /// <summary>The same chunk over and over: "passwordpassword", "abcabcabcabcabc".</summary>
    internal static bool IsRepetition(string s)
    {
        for (var unit = 1; unit <= s.Length / 2; unit++)
        {
            var repeats = true;
            for (var i = unit; i < s.Length && repeats; i++)
            {
                repeats = s[i] == s[i % unit];
            }
            if (repeats) return true;
        }
        return false;
    }

    /// <summary>
    /// True when the whole password is made of runs of three or more characters taken from keyboard rows,
    /// columns or the alphabet, forwards or backwards: "1qaz2wsx3edc4rfv", "qwertyuiop12345", "123456789987654321".
    /// </summary>
    internal static bool IsKeyboardWalk(string lower)
    {
        var s = new string(lower.Where(c => !char.IsWhiteSpace(c)).ToArray());
        var i = 0;
        while (i < s.Length)
        {
            var longest = 0;
            for (var length = s.Length - i; length >= 3; length--)
            {
                var piece = s.Substring(i, length);
                if (Sequences.Any(seq => seq.Contains(piece, StringComparison.Ordinal) || Reverse(seq).Contains(piece, StringComparison.Ordinal)))
                {
                    longest = length;
                    break;
                }
            }
            if (longest == 0) return false;
            i += longest;
        }
        return true;
    }

    private static string Reverse(string s)
    {
        var chars = s.ToCharArray();
        Array.Reverse(chars);
        return new string(chars);
    }
}
