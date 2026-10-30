namespace Tomekeeper.Api.Accounts;

public sealed record AccountEmail(string To, string Subject, string Body);

public interface IAccountEmailSender
{
    Task SendAsync(AccountEmail email, CancellationToken cancellationToken);
}

public static class AccountEmails
{
    public static AccountEmail Confirmation(User user, string link) => new(
        user.Email!,
        "Confirm your email for Tomekeeper",
        $"""
        Hello {user.DisplayName},

        Confirm your email address for Tomekeeper by opening this link:
        {link}

        The link works for 24 hours. If you didn't create a Tomekeeper account, you can ignore this email.
        """);

    public static AccountEmail PasswordReset(User user, string link) => new(
        user.Email!,
        "Reset your Tomekeeper password",
        $"""
        Hello {user.DisplayName},

        Choose a new password for Tomekeeper by opening this link:
        {link}

        The link works for 24 hours. If you didn't ask for this, you can ignore this email and your password stays the same.
        """);

    /// <summary>Sent after the account is gone, so the reader has a record, and notices if it wasn't them.</summary>
    public static AccountEmail Deleted(User user, DateTimeOffset when) => new(
        user.Email!,
        "Your Tomekeeper account is deleted",
        $"""
        Hello {user.DisplayName},

        Your Tomekeeper account for {user.Email} was deleted on {when:d MMMM yyyy}, together with everything in it.

        You are welcome to create a new account at any time.
        """);
}

/// <summary>
/// For development: writes each email to the log instead of sending it, so you can copy the link from
/// the terminal running the API. A real email service comes before the site goes online (stage 6).
/// </summary>
public sealed class LoggingEmailSender(ILogger<LoggingEmailSender> logger) : IAccountEmailSender
{
    public Task SendAsync(AccountEmail email, CancellationToken cancellationToken)
    {
        logger.LogInformation("Email to {To}: {Subject}\n{Body}", email.To, email.Subject, email.Body);
        return Task.CompletedTask;
    }
}

/// <summary>Outside development, until an email service is set up: logs that nothing was sent, without personal data or links.</summary>
public sealed class NotConfiguredEmailSender(ILogger<NotConfiguredEmailSender> logger) : IAccountEmailSender
{
    public Task SendAsync(AccountEmail email, CancellationToken cancellationToken)
    {
        logger.LogWarning("No email service is set up, so the email \"{Subject}\" was not sent.", email.Subject);
        return Task.CompletedTask;
    }
}
