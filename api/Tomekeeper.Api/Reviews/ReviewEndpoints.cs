using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Fellowship;
using Tomekeeper.Api.Profiles;

namespace Tomekeeper.Api.Reviews;

public sealed record ReviewRequest(int? Rating, string? Text);

/// <param name="Reader">Who wrote it, with how the viewer stands with them.</param>
public sealed record ReviewResponse(ReaderCard Reader, int Rating, string? Text, DateTimeOffset WrittenAt, DateTimeOffset? EditedAt);

/// <param name="Mine">The signed-in reader's own review, if they have written one.</param>
/// <param name="Others">Other readers' reviews this reader may see, newest first.</param>
public sealed record BookReviewsResponse(ReviewResponse? Mine, IReadOnlyList<ReviewResponse> Others);

/// <summary>A review on a reader's profile.</summary>
/// <param name="BookId">Set when the viewer can open the book's page (books added by hand are the owner's alone).</param>
public sealed record ProfileReview(Guid? BookId, string Title, IReadOnlyList<string> Authors, int Rating, string? Text, DateTimeOffset WrittenAt);

/// <summary>Reviews on a book's page: /api/books/{bookId}/reviews to read, /api/books/{bookId}/review for your own.</summary>
public static class ReviewEndpoints
{
    public const int MaxOthers = 50;
    public const int ProfileCount = 10;
    public const string RatingMessage = "Choose from 1 to 5 stars.";
    public const string NotShelvedMessage = "Put the book on one of your shelves before you review it.";

    public static void MapReviewEndpoints(this IEndpointRouteBuilder app)
    {
        var book = app.MapGroup("/api/books/{bookId:guid}").WithTags("Reviews").RequireAuthorization();
        book.MapGet("/reviews", GetReviews);
        book.MapPut("/review", PutReview);
        book.MapDelete("/review", DeleteReview);
    }

    private static async Task<Results<Ok<BookReviewsResponse>, NotFound>> GetReviews(
        Guid bookId, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        if (!await db.Books.VisibleTo(me).AnyAsync(b => b.Id == bookId, cancellationToken)) return TypedResults.NotFound();

        var mine = await db.Reviews.Where(r => r.UserId == me && r.BookId == bookId)
            .Join(db.Users, r => r.UserId, u => u.Id, (r, u) => new { r, u })
            .ToListAsync(cancellationToken);
        // Shared with everyone, or with friends when the two are friends.
        var others = await db.Reviews.Where(r => r.BookId == bookId && r.UserId != me)
            .Join(db.Users.NotHiddenFrom(db, me), r => r.UserId, u => u.Id, (r, u) => new { r, u })
            .Where(x => x.u.ReviewsVisibleTo == Visibility.Everyone ||
                        (x.u.ReviewsVisibleTo == Visibility.Friends && db.Friendships.Any(f => f.UserId == me && f.FriendId == x.u.Id)))
            .OrderByDescending(x => x.r.WrittenAt)
            .Take(MaxOthers)
            .ToListAsync(cancellationToken);

        var cards = await FellowshipEndpoints.CardsAsync(db, me, mine.Concat(others).Select(x => (x.u, (DateTimeOffset?)null)), cancellationToken);
        var responses = mine.Concat(others).Select((x, i) => new ReviewResponse(cards[i], x.r.Rating, x.r.Text, x.r.WrittenAt, x.r.EditedAt)).ToList();
        return TypedResults.Ok(new BookReviewsResponse(mine.Count > 0 ? responses[0] : null, responses.Skip(mine.Count).ToList()));
    }

    private static async Task<Results<Ok<ReviewResponse>, ValidationProblem, NotFound, ProblemHttpResult>> PutReview(
        Guid bookId, ReviewRequest request, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        if (!await db.Books.VisibleTo(me).AnyAsync(b => b.Id == bookId, cancellationToken)) return TypedResults.NotFound();

        var text = string.IsNullOrWhiteSpace(request.Text) ? null : request.Text.Trim().ReplaceLineEndings("\n");
        var errors = new FieldErrors();
        if (request.Rating is not (>= 1 and <= 5)) errors.Add("rating", RatingMessage);
        if (text?.Length > Review.MaxTextLength) errors.Add("text", $"Keep the review to {Review.MaxTextLength:N0} characters or fewer. It has {text.Length:N0}.");
        if (errors.Any) return errors.ToProblem();
        if (!await db.ShelfEntries.AnyAsync(e => e.UserId == me && e.BookId == bookId, cancellationToken))
        {
            return TypedResults.Problem(detail: NotShelvedMessage, statusCode: StatusCodes.Status409Conflict, title: "Not on your shelves");
        }

        var now = time.GetUtcNow();
        now = now.AddTicks(-(now.Ticks % 10));
        var review = await db.Reviews.FirstOrDefaultAsync(r => r.UserId == me && r.BookId == bookId, cancellationToken);
        if (review is null)
        {
            review = new Review { UserId = me, BookId = bookId, WrittenAt = now };
            db.Reviews.Add(review);
        }
        else if (review.Rating != request.Rating || review.Text != text)
        {
            review.EditedAt = now;
        }
        review.Rating = request.Rating!.Value;
        review.Text = text;
        await db.SaveChangesAsync(cancellationToken);

        var user = await db.Users.SingleAsync(u => u.Id == me, cancellationToken);
        var card = (await FellowshipEndpoints.CardsAsync(db, me, [(user, null)], cancellationToken))[0];
        return TypedResults.Ok(new ReviewResponse(card, review.Rating, review.Text, review.WrittenAt, review.EditedAt));
    }

    private static async Task<NoContent> DeleteReview(Guid bookId, ClaimsPrincipal principal, TomekeeperDbContext db, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        await db.Reviews.Where(r => r.UserId == me && r.BookId == bookId).ExecuteDeleteAsync(cancellationToken);
        return TypedResults.NoContent();
    }

    /// <summary>A reader's latest reviews, for their profile.</summary>
    public static async Task<IReadOnlyList<ProfileReview>> LatestAsync(
        TomekeeperDbContext db, Guid readerId, bool isOwner, CancellationToken cancellationToken)
    {
        var latest = await db.Reviews.AsNoTracking().Where(r => r.UserId == readerId)
            .Join(db.Books, r => r.BookId, b => b.Id, (r, b) => new { r, b })
            .OrderByDescending(x => x.r.WrittenAt)
            .Take(ProfileCount)
            .ToListAsync(cancellationToken);
        return latest.Select(x => new ProfileReview(
            isOwner || x.b.AddedById is null ? x.b.Id : null, x.b.Title, x.b.Authors, x.r.Rating, x.r.Text, x.r.WrittenAt)).ToList();
    }
}
