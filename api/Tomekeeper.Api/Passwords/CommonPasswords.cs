namespace Tomekeeper.Api.Passwords;

/// <summary>About 49,000 of the most common passwords from public data breaches, read once from an embedded file.</summary>
internal static class CommonPasswords
{
    private static readonly Lazy<HashSet<string>> List = new(Load);

    public static bool Contains(string lowercasePassword) => List.Value.Contains(lowercasePassword);

    public static int Count => List.Value.Count;

    private static HashSet<string> Load()
    {
        using var stream = typeof(CommonPasswords).Assembly.GetManifestResourceStream("Tomekeeper.Api.Passwords.common-passwords.txt")
            ?? throw new InvalidOperationException("The common password list is missing from the build.");
        using var reader = new StreamReader(stream);
        var set = new HashSet<string>(StringComparer.Ordinal);
        while (reader.ReadLine() is { } line)
        {
            if (line.Length > 0 && line[0] != '#') set.Add(line);
        }
        return set;
    }
}
