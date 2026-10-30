using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Goals;

namespace Tomekeeper.Api.Data;

/// <summary>
/// The database. Table and column names are snake_case, as is usual in PostgreSQL.
/// IdentityUserContext gives accounts without roles: users, user_claims, user_logins (Google, from step 1.4)
/// and user_tokens. Our own tables: reading_goals.
/// </summary>
public sealed class TomekeeperDbContext(DbContextOptions<TomekeeperDbContext> options)
    : IdentityUserContext<User, Guid>(options)
{
    public DbSet<ReadingGoal> Goals => Set<ReadingGoal>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<User>(user =>
        {
            user.ToTable("users");
            user.Property(u => u.DisplayName).HasMaxLength(User.DisplayNameMaxLength).IsRequired();
            user.Property(u => u.CreatedAt).IsRequired();
            // Stored as the name ("Knight"), so the table is readable and the enum can grow.
            user.Property(u => u.Portrait).HasConversion<string>().HasMaxLength(20);
            // Identity names these two indexes itself; give them the same style as the rest.
            // User names are email addresses here, so the unique user name index also keeps emails unique.
            user.HasIndex(u => u.NormalizedEmail).HasDatabaseName("ix_users_normalized_email");
            user.HasIndex(u => u.NormalizedUserName).HasDatabaseName("ix_users_normalized_user_name").IsUnique();
        });
        builder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claims");
        builder.Entity<IdentityUserLogin<Guid>>().ToTable("user_logins");
        builder.Entity<IdentityUserToken<Guid>>().ToTable("user_tokens");

        builder.Entity<ReadingGoal>(goal =>
        {
            goal.ToTable("reading_goals", table =>
            {
                // The same rules as the API, so the data stays right even if someone writes to the table directly.
                table.HasCheckConstraint("ck_reading_goals_has_target", "pages IS NOT NULL OR books IS NOT NULL");
                table.HasCheckConstraint("ck_reading_goals_pages", $"pages IS NULL OR pages BETWEEN 1 AND {ReadingGoal.MaxPages}");
                table.HasCheckConstraint("ck_reading_goals_books", $"books IS NULL OR books BETWEEN 1 AND {ReadingGoal.MaxBooks}");
            });
            goal.HasKey(g => new { g.UserId, g.Year });
            goal.HasOne<User>().WithMany().HasForeignKey(g => g.UserId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
