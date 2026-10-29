using Microsoft.EntityFrameworkCore;

namespace Tomekeeper.Api.Data;

/// <summary>
/// The database. It has no tables yet: accounts arrive in step 1.3, books in stage 2.
/// </summary>
public sealed class TomekeeperDbContext(DbContextOptions<TomekeeperDbContext> options) : DbContext(options)
{
}
