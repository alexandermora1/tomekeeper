using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Fellowship;
using Tomekeeper.Api.Game;
using Tomekeeper.Api.Goals;
using Tomekeeper.Api.Progress;
using Tomekeeper.Api.Reviews;
using Tomekeeper.Api.Shelves;

namespace Tomekeeper.Api.Data;

/// <summary>
/// The database. Table and column names are snake_case, as is usual in PostgreSQL.
/// IdentityUserContext gives accounts without roles: users, user_claims, user_logins (Google, from step 1.4)
/// and user_tokens. Our own tables: reading goals, books, shelves, progress, gear, friend requests, friendships and reviews.
/// </summary>
public sealed class TomekeeperDbContext(DbContextOptions<TomekeeperDbContext> options)
    : IdentityUserContext<User, Guid>(options)
{
    public DbSet<ReadingGoal> Goals => Set<ReadingGoal>();

    public DbSet<Book> Books => Set<Book>();

    public DbSet<ShelfEntry> ShelfEntries => Set<ShelfEntry>();

    public DbSet<Reading> Readings => Set<Reading>();

    public DbSet<ProgressEntry> ProgressEntries => Set<ProgressEntry>();

    public DbSet<GearPiece> Gear => Set<GearPiece>();

    public DbSet<FriendRequest> FriendRequests => Set<FriendRequest>();

    public DbSet<Friendship> Friendships => Set<Friendship>();

    public DbSet<Review> Reviews => Set<Review>();

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
            // Lowercase letters, digits and hyphens (checked by the API), unique across readers.
            user.Property(u => u.Handle).HasMaxLength(Profiles.Handles.MaxLength);
            user.HasIndex(u => u.Handle).IsUnique();
            user.Property(u => u.Bio).HasMaxLength(Profiles.ProfileEndpoints.BioMaxLength);
            // Stored as the name; existing readers get the private default, Friends.
            foreach (var visibility in new[] { nameof(User.ProgressVisibleTo), nameof(User.ReadingVisibleTo), nameof(User.ReviewsVisibleTo), nameof(User.FriendsVisibleTo) })
            {
                user.Property<Profiles.Visibility>(visibility).HasConversion<string>().HasMaxLength(10).HasDefaultValue(Profiles.Visibility.Friends);
            }
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

        builder.Entity<Book>(book =>
        {
            book.ToTable("books");
            book.Property(b => b.OpenLibraryKey).HasMaxLength(Book.OpenLibraryKeyMaxLength);
            // Each Open Library work is in the catalogue at most once. Books added by hand have no key.
            book.HasIndex(b => b.OpenLibraryKey).IsUnique();
            book.Property(b => b.Title).HasMaxLength(Book.TitleMaxLength).IsRequired();
            book.Property(b => b.Subtitle).HasMaxLength(Book.TitleMaxLength);
            // A PostgreSQL text[] column: author names in order.
            book.Property(b => b.Authors).IsRequired();
            // A book added by hand goes with the reader who added it.
            book.HasOne<User>().WithMany().HasForeignKey(b => b.AddedById).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ShelfEntry>(entry =>
        {
            entry.ToTable("shelf_entries", table =>
            {
                var names = string.Join(", ", Enum.GetNames<Shelf>().Select(name => $"'{name}'"));
                table.HasCheckConstraint("ck_shelf_entries_shelf", $"shelf IN ({names})");
                table.HasCheckConstraint("ck_shelf_entries_page_count", $"page_count IS NULL OR page_count BETWEEN 1 AND {ShelfEntry.MaxPageCount}");
            });
            // One row per reader and book, so a book is on one shelf at a time.
            entry.HasKey(e => new { e.UserId, e.BookId });
            entry.HasOne<User>().WithMany().HasForeignKey(e => e.UserId).OnDelete(DeleteBehavior.Cascade);
            // The catalogue is shared, so a book that is on someone's shelf can't be deleted from it. NO ACTION
            // (not RESTRICT) checks at the end of the statement: deleting an account removes the reader's shelf
            // entries and the books they added by hand together, in either order.
            entry.HasOne(e => e.Book).WithMany().HasForeignKey(e => e.BookId).OnDelete(DeleteBehavior.NoAction);
            // Stored as the name ("WantToRead"), like portraits.
            entry.Property(e => e.Shelf).HasConversion<string>().HasMaxLength(20);
            // The shelves are listed per reader, latest first.
            entry.HasIndex(e => new { e.UserId, e.ShelvedAt });
        });

        builder.Entity<Reading>(reading =>
        {
            reading.ToTable("readings", table => table.HasCheckConstraint("ck_readings_page", "page >= 0"));
            // Readings belong to the book on the reader's shelves: taking it off the shelves deletes them.
            reading.HasOne<ShelfEntry>().WithMany().HasForeignKey(r => new { r.UserId, r.BookId }).OnDelete(DeleteBehavior.Cascade);
            // At most one reading of a book in progress per reader.
            reading.HasIndex(r => new { r.UserId, r.BookId }).IsUnique().HasFilter("finished_on IS NULL").HasDatabaseName("ix_readings_one_in_progress");
            // Books finished in a year, for the books goal.
            reading.HasIndex(r => new { r.UserId, r.FinishedOn });
        });

        builder.Entity<ProgressEntry>(entry =>
        {
            entry.ToTable("progress_entries", table =>
            {
                table.HasCheckConstraint("ck_progress_entries_page", "page >= 0");
                table.HasCheckConstraint("ck_progress_entries_pages", "pages >= 0");
            });
            entry.HasOne<Reading>().WithMany().HasForeignKey(p => p.ReadingId).OnDelete(DeleteBehavior.Cascade);
            // Pages read in a year or a month, for the goal and the Twelve Labours.
            entry.HasIndex(p => new { p.UserId, p.ReadOn });
        });

        builder.Entity<GearPiece>(gear =>
        {
            gear.ToTable("gear");
            // Each piece once per reader: earned once, kept for good.
            gear.HasKey(g => new { g.UserId, g.Item });
            gear.Property(g => g.Item).HasMaxLength(20);
            gear.HasOne<User>().WithMany().HasForeignKey(g => g.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<FriendRequest>(request =>
        {
            request.ToTable("friend_requests", table => table.HasCheckConstraint("ck_friend_requests_not_self", "from_id <> to_id"));
            // One open request from a reader to another.
            request.HasKey(r => new { r.FromId, r.ToId });
            request.HasOne<User>().WithMany().HasForeignKey(r => r.FromId).OnDelete(DeleteBehavior.Cascade);
            request.HasOne<User>().WithMany().HasForeignKey(r => r.ToId).OnDelete(DeleteBehavior.Cascade);
            // The requests a reader has been sent.
            request.HasIndex(r => r.ToId);
        });

        builder.Entity<Friendship>(friendship =>
        {
            // Stored once from each side.
            friendship.ToTable("friendships", table => table.HasCheckConstraint("ck_friendships_not_self", "user_id <> friend_id"));
            friendship.HasKey(f => new { f.UserId, f.FriendId });
            friendship.HasOne<User>().WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
            friendship.HasOne<User>().WithMany().HasForeignKey(f => f.FriendId).OnDelete(DeleteBehavior.Cascade);
            friendship.HasIndex(f => f.FriendId);
        });

        builder.Entity<Review>(review =>
        {
            review.ToTable("reviews", table => table.HasCheckConstraint("ck_reviews_rating", "rating BETWEEN 1 AND 5"));
            // One review per reader and book.
            review.HasKey(r => new { r.UserId, r.BookId });
            review.Property(r => r.Text).HasMaxLength(Review.MaxTextLength);
            // A review belongs to the book on the reader's shelves: taking it off the shelves deletes the review.
            review.HasOne<ShelfEntry>().WithMany().HasForeignKey(r => new { r.UserId, r.BookId }).OnDelete(DeleteBehavior.Cascade);
            // Reviews of a book, newest first; a reader's reviews for their profile and The Chronicler.
            review.HasIndex(r => new { r.BookId, r.WrittenAt });
            review.HasIndex(r => new { r.UserId, r.WrittenAt });
        });
    }
}
