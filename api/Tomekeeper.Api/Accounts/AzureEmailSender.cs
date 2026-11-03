using Azure;
using Azure.Communication.Email;
using Microsoft.Extensions.Options;

namespace Tomekeeper.Api.Accounts;

public sealed class EmailOptions
{
    public const string Section = "Email";

    /// <summary>The connection string of the Azure Communication Services resource.</summary>
    public string? AzureConnectionString { get; set; }

    /// <summary>The sender address, such as DoNotReply@xxxx.azurecomm.net for an Azure-managed domain.</summary>
    public string? Sender { get; set; }

    public bool Configured => !string.IsNullOrWhiteSpace(AzureConnectionString) && !string.IsNullOrWhiteSpace(Sender);
}

/// <summary>
/// Sends emails through Azure Communication Services. It hands the email over and doesn't wait for delivery. If
/// Azure refuses it, the error is logged and the request goes on: a sign-up shouldn't fail because an email didn't
/// go, and the reader can ask for a new one.
/// </summary>
public sealed class AzureEmailSender(IOptions<EmailOptions> options, ILogger<AzureEmailSender> logger) : IAccountEmailSender
{
    private readonly EmailClient _client = new(options.Value.AzureConnectionString);

    public async Task SendAsync(AccountEmail email, CancellationToken cancellationToken)
    {
        try
        {
            await _client.SendAsync(WaitUntil.Started, options.Value.Sender, email.To, email.Subject, htmlContent: null, plainTextContent: email.Body,
                cancellationToken);
        }
        catch (RequestFailedException ex)
        {
            // The status and Azure's error code only: no addresses or links in the log.
            logger.LogError("The email \"{Subject}\" couldn't be sent: {Status} {Code}.", email.Subject, ex.Status, ex.ErrorCode);
        }
    }
}
