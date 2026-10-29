using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Health;

var builder = WebApplication.CreateBuilder(args);

// The connection string is read when the database is first used, so tests can swap it.
// Locally it comes from appsettings.Development.json (the Docker Compose database);
// elsewhere from the environment variable ConnectionStrings__Tomekeeper.
builder.Services.AddDbContext<TomekeeperDbContext>((services, options) =>
{
    var connectionString = services.GetRequiredService<IConfiguration>().GetConnectionString("Tomekeeper")
        ?? throw new InvalidOperationException(
            "The connection string 'Tomekeeper' is missing. Locally, start the database with `docker compose up -d`.");
    options.UseNpgsql(connectionString);
});

builder.Services.AddHealthChecks().AddDbContextCheck<TomekeeperDbContext>(HealthEndpoints.DatabaseCheck);
builder.Services.AddProblemDetails();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Creates the database and applies migrations, so `dotnet run` works right after `docker compose up`.
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>().Database.MigrateAsync();
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapHealthEndpoints();

app.Run();

/// <summary>Lets the tests start the API in memory.</summary>
public partial class Program;
