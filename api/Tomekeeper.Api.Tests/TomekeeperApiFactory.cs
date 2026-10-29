using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Tomekeeper.Api.Tests;

/// <summary>Starts the real API in memory, pointed at a test database.</summary>
public sealed class TomekeeperApiFactory(string connectionString, string environment = "Development")
    : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(environment);
        builder.UseSetting("ConnectionStrings:Tomekeeper", connectionString);
    }
}
