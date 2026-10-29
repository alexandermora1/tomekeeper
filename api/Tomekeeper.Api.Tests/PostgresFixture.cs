using Npgsql;
using Testcontainers.PostgreSql;

[assembly: AssemblyFixture(typeof(Tomekeeper.Api.Tests.PostgresFixture))]

namespace Tomekeeper.Api.Tests;

/// <summary>
/// One PostgreSQL for the whole test run, with a fresh database that is dropped afterwards.
///
/// By default it starts PostgreSQL 18 in Docker (Testcontainers), so Docker Desktop must be running.
/// To use a server you already have instead, set TOMEKEEPER_TEST_POSTGRES to a connection string
/// for a user that may create databases, for example
/// "Host=localhost;Port=5432;Username=tomekeeper;Password=tomekeeper_dev".
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    public const string ServerVariable = "TOMEKEEPER_TEST_POSTGRES";

    private PostgreSqlContainer? _container;
    private string _serverConnectionString = "";
    private readonly string _databaseName = $"tomekeeper_test_{Guid.NewGuid():N}";

    /// <summary>Connection string to this run's own database. The API creates it on startup.</summary>
    public string ConnectionString { get; private set; } = "";

    public async ValueTask InitializeAsync()
    {
        var existing = Environment.GetEnvironmentVariable(ServerVariable);
        if (!string.IsNullOrWhiteSpace(existing))
        {
            _serverConnectionString = existing;
        }
        else
        {
            _container = new PostgreSqlBuilder("postgres:18-alpine").Build();
            await _container.StartAsync();
            _serverConnectionString = _container.GetConnectionString();
        }

        ConnectionString = new NpgsqlConnectionStringBuilder(_serverConnectionString) { Database = _databaseName }.ConnectionString;
    }

    public async ValueTask DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
            return;
        }

        // A server we didn't start: remove the test database but leave everything else alone.
        NpgsqlConnection.ClearAllPools();
        var admin = new NpgsqlConnectionStringBuilder(_serverConnectionString) { Database = "postgres" }.ConnectionString;
        await using var connection = new NpgsqlConnection(admin);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)", connection);
        await command.ExecuteNonQueryAsync();
    }
}
