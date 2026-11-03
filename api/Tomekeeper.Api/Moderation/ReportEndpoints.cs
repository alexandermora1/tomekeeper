using System.Security.Claims;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Profiles;

namespace Tomekeeper.Api.Moderation;

/// <param name="Handle">The reader reported.</param>
/// <param name="BookId">Set to report their review of this book; left out to report the reader's profile.</param>
/// <param name="Reason">"spam", "harassment", "offensive" or "other".</param>
public sealed record ReportRequest(string? Handle, Guid? BookId, string? Reason, string? Details);

public sealed record ReportResponse(Guid Id);

/// <summary>
/// POST /api/reports: stores a report and emails it to the moderator address (App:ModeratorEmail). There is no
/// moderation page yet; the moderator works from the email.
/// </summary>
public static class ReportEndpoints
{
    public const int MaxPerDay = 20;
    public const string ReasonMessage = "Choose what is wrong.";
    public const string DetailsNeededMessage = "Say what is wrong, so the moderator knows what to look for.";

    private static readonly Dictionary<string, ReportReason> Reasons = new()
    {
        ["spam"] = ReportReason.Spam,
        ["harassment"] = ReportReason.Harassment,
        ["offensive"] = ReportReason.Offensive,
        ["other"] = ReportReason.Other,
    };

    public static void MapReportEndpoints(this IEndpointRouteBuilder app) =>
        app.MapPost("/api/reports", PostReport).WithTags("Moderation").RequireAuthorization();

    private static async Task<Results<Ok<ReportResponse>, ValidationProblem, NotFound, ProblemHttpResult>> PostReport(
        ReportRequest request, ClaimsPrincipal principal, TomekeeperDbContext db, TimeProvider time, IAccountEmailSender email,
        IOptions<AppOptions> options, ILoggerFactory loggers, CancellationToken cancellationToken)
    {
        var me = principal.GetUserId();
        var handle = request.Handle?.Trim().ToLowerInvariant() ?? "";
        // Readers blocked either way can still be reported: blocking first and reporting after is common.
        var reported = await db.Users.FirstOrDefaultAsync(u => u.Handle == handle, cancellationToken);
        if (reported is null) return TypedResults.NotFound();
        if (reported.Id == me) return Problem("You can't report yourself.", StatusCodes.Status400BadRequest);

        var details = string.IsNullOrWhiteSpace(request.Details) ? null : request.Details.Trim().ReplaceLineEndings("\n");
        var errors = new FieldErrors();
        var reason = ReportReason.Other;
        if (request.Reason is null || !Reasons.TryGetValue(request.Reason, out reason)) errors.Add("reason", ReasonMessage);
        else if (reason == ReportReason.Other && details is null) errors.Add("details", DetailsNeededMessage);
        if (details?.Length > Report.MaxDetailsLength) errors.Add("details", $"Keep it to {Report.MaxDetailsLength:N0} characters or fewer. It has {details.Length:N0}.");
        if (errors.Any) return errors.ToProblem();

        string snapshot;
        string? bookTitle = null;
        if (request.BookId is { } bookId)
        {
            var review = await db.Reviews.Where(r => r.UserId == reported.Id && r.BookId == bookId)
                .Join(db.Books, r => r.BookId, b => b.Id, (r, b) => new { r.Rating, r.Text, b.Title })
                .FirstOrDefaultAsync(cancellationToken);
            if (review is null) return Problem("That review is gone. It may have been deleted.", StatusCodes.Status404NotFound);
            bookTitle = review.Title;
            snapshot = $"Review of {review.Title}, {review.Rating} of 5 stars:\n{review.Text ?? "(stars only, no words)"}";
        }
        else
        {
            snapshot = $"Name: {reported.DisplayName}\nAbout: {reported.Bio ?? "(no text)"}";
        }
        if (snapshot.Length > Report.MaxSnapshotLength) snapshot = snapshot[..Report.MaxSnapshotLength];

        var now = time.GetUtcNow();
        now = now.AddTicks(-(now.Ticks % 10));
        var dayAgo = now.AddDays(-1);
        // The same report twice in a day, as with a double click or a second try, is one report.
        var earlier = await db.Reports.FirstOrDefaultAsync(
            r => r.ReporterId == me && r.ReportedId == reported.Id && r.BookId == request.BookId && r.CreatedAt > dayAgo, cancellationToken);
        if (earlier is not null) return TypedResults.Ok(new ReportResponse(earlier.Id));
        if (await db.Reports.CountAsync(r => r.ReporterId == me && r.CreatedAt > dayAgo, cancellationToken) >= MaxPerDay)
        {
            return Problem($"You have sent {MaxPerDay} reports today. Try again tomorrow.", StatusCodes.Status429TooManyRequests);
        }

        var report = new Report
        {
            Id = Guid.CreateVersion7(),
            ReporterId = me,
            ReportedId = reported.Id,
            BookId = request.BookId,
            Reason = reason,
            Details = details,
            Snapshot = snapshot,
            CreatedAt = now,
        };
        db.Reports.Add(report);
        await db.SaveChangesAsync(cancellationToken);

        var moderator = options.Value.ModeratorEmail?.Trim();
        if (string.IsNullOrEmpty(moderator))
        {
            loggers.CreateLogger("Tomekeeper.Reports").LogWarning(
                "Report {ReportId} was stored, but no moderator address is set (App:ModeratorEmail), so no email was sent.", report.Id);
        }
        else
        {
            var reporter = await db.Users.SingleAsync(u => u.Id == me, cancellationToken);
            var reporterHandle = await Handles.EnsureAsync(db, reporter, cancellationToken);
            var site = options.Value.PublicUrl.TrimEnd('/');
            var what = bookTitle is null ? "a reader" : "a review";
            await email.SendAsync(new AccountEmail(
                moderator,
                $"Tomekeeper report: {ReasonText(reason).ToLowerInvariant()}, about {what} by {reported.DisplayName}",
                $"""
                A reader has reported {what} on Tomekeeper.

                Reported: {reported.DisplayName}, {site}/readers/{handle}
                {(bookTitle is null ? "" : $"Book: {bookTitle}, {site}/books/{request.BookId}\n")}Reason: {ReasonText(reason)}
                From the reporter: {details ?? "(nothing more)"}

                What was reported, as it was when the report was sent:
                {snapshot}

                Sent by: {reporter.DisplayName}, {site}/readers/{reporterHandle}
                Report {report.Id}, {report.CreatedAt:yyyy-MM-dd HH:mm} UTC
                """), cancellationToken);
        }
        return TypedResults.Ok(new ReportResponse(report.Id));
    }

    public static string ReasonText(ReportReason reason) => reason switch
    {
        ReportReason.Spam => "Spam or advertising",
        ReportReason.Harassment => "Harassment or bullying",
        ReportReason.Offensive => "Hateful or offensive",
        _ => "Something else",
    };

    private static ProblemHttpResult Problem(string detail, int status) =>
        TypedResults.Problem(detail: detail, statusCode: status, title: "The report wasn't sent");
}
