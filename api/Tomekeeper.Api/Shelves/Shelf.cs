namespace Tomekeeper.Api.Shelves;

/// <summary>The four shelves every reader has. A book is on one of them at a time.</summary>
public enum Shelf
{
    Reading,
    WantToRead,
    Finished,
    SetAside,
}

public static class Shelves
{
    /// <summary>The name used by the API and the front-end: "reading", "wantToRead", "finished" or "setAside".</summary>
    public static string ToApiName(this Shelf shelf)
    {
        var name = shelf.ToString();
        return char.ToLowerInvariant(name[0]) + name[1..];
    }

    /// <summary>Reads a name such as "wantToRead". Unknown names, numbers and null give null.</summary>
    public static Shelf? FromApiName(string? name)
    {
        foreach (var shelf in Enum.GetValues<Shelf>())
        {
            if (shelf.ToApiName() == name) return shelf;
        }
        return null;
    }
}
