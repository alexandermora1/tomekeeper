using System.Net.Http.Json;
using Tomekeeper.Api.Site;

namespace Tomekeeper.Api.Tests;

/// <summary>GET /api/site: who runs the site, for the privacy policy, open to everyone.</summary>
public sealed class SiteTests(PostgresFixture database)
{
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Anyone_can_read_who_runs_the_site()
    {
        await using var api = new TomekeeperApiFactory(database.ConnectionString, settings: new Dictionary<string, string>
        {
            ["App:OperatorName"] = " Kari Nordmann ",
            ["App:ContactEmail"] = "kari@example.no",
        });
        using var client = api.CreateClient();

        var site = await client.GetFromJsonAsync<SiteResponse>("/api/site", Cancel);

        Assert.Equal(new SiteResponse("Kari Nordmann", "kari@example.no"), site);
    }

    [Fact]
    public async Task Without_the_settings_both_are_null()
    {
        await using var api = new TomekeeperApiFactory(database.ConnectionString);
        using var client = api.CreateClient();

        Assert.Equal(new SiteResponse(null, null), await client.GetFromJsonAsync<SiteResponse>("/api/site", Cancel));
    }
}
