using System.Net;
using System.Net.Http.Json;
using Tomekeeper.Api.Health;

namespace Tomekeeper.Api.Tests;

public sealed class HealthTests(PostgresFixture database)
{
    [Fact]
    public async Task Live_answers_without_checking_the_database()
    {
        await using var api = new TomekeeperApiFactory(database.ConnectionString);
        using var client = api.CreateClient();

        var response = await client.GetAsync("/api/health/live", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>(TestContext.Current.CancellationToken);
        Assert.NotNull(body);
        Assert.Equal("Healthy", body.Status);
        Assert.Empty(body.Checks);
    }

    [Fact]
    public async Task Ready_reports_a_healthy_database()
    {
        await using var api = new TomekeeperApiFactory(database.ConnectionString);
        using var client = api.CreateClient();

        var response = await client.GetAsync("/api/health/ready", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>(TestContext.Current.CancellationToken);
        Assert.NotNull(body);
        Assert.Equal("Healthy", body.Status);
        var check = Assert.Single(body.Checks);
        Assert.Equal(HealthEndpoints.DatabaseCheck, check.Name);
        Assert.Equal("Healthy", check.Status);
    }

    [Fact]
    public async Task Ready_returns_503_when_the_database_is_unreachable()
    {
        // Nothing listens on port 1. "Testing" skips the startup migration, which would fail first.
        const string nowhere = "Host=127.0.0.1;Port=1;Database=none;Username=none;Password=none;Timeout=2";
        await using var api = new TomekeeperApiFactory(nowhere, environment: "Testing");
        using var client = api.CreateClient();

        var response = await client.GetAsync("/api/health/ready", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>(TestContext.Current.CancellationToken);
        Assert.NotNull(body);
        Assert.Equal("Unhealthy", body.Status);
    }
}
