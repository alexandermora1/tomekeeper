namespace Tomekeeper.Api.Accounts;

/// <summary>The woodcut that stands for a reader: details from Hans Holbein's Dance of Death, with Death left out.</summary>
public enum Portrait
{
    Astrologer,
    Knight,
    Emperor,
}

public static class Portraits
{
    /// <summary>The name used by the API and the front-end, such as "knight".</summary>
    public static string ToApiName(this Portrait portrait) => portrait.ToString().ToLowerInvariant();

    /// <summary>Reads a name such as "knight". Unknown names, numbers and null give null.</summary>
    public static Portrait? FromApiName(string? name)
    {
        var wanted = name?.Trim().ToLowerInvariant();
        foreach (var portrait in Enum.GetValues<Portrait>())
        {
            if (portrait.ToApiName() == wanted) return portrait;
        }
        return null;
    }
}
