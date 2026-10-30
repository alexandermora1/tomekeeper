using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Tomekeeper.Api.Passwords;

namespace Tomekeeper.Api.Accounts;

/// <summary>
/// Collects error messages per form field ("displayName", "email", "password"), written for readers,
/// and turns them into a 400 validation problem the front-end can show next to each field.
/// </summary>
public sealed partial class FieldErrors
{
    private readonly Dictionary<string, List<string>> _errors = [];

    public bool Any => _errors.Count > 0;

    public FieldErrors Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var list)) _errors[field] = list = [];
        if (!list.Contains(message)) list.Add(message);
        return this;
    }

    public bool Has(string field) => _errors.ContainsKey(field);

    public ValidationProblem ToProblem() => TypedResults.ValidationProblem(
        _errors.ToDictionary(pair => pair.Key, pair => pair.Value.ToArray()),
        title: "Some fields need attention.");

    /// <summary>Adds Identity's errors under the right field, in our own words.</summary>
    public FieldErrors AddIdentityErrors(IEnumerable<IdentityError> errors, string password)
    {
        foreach (var error in errors)
        {
            switch (error.Code)
            {
                case nameof(IdentityErrorDescriber.PasswordTooShort):
                    Add("password", PasswordRules.Message(PasswordProblem.TooShort, password.Length));
                    break;
                case TomekeeperPasswordValidator.ErrorCode:
                case TomekeeperPasswordValidator.BreachedCode:
                    Add("password", error.Description);
                    break;
                case nameof(IdentityErrorDescriber.DuplicateEmail):
                case nameof(IdentityErrorDescriber.DuplicateUserName):
                    Add("email", DuplicateEmailMessage);
                    break;
                case nameof(IdentityErrorDescriber.InvalidEmail):
                case nameof(IdentityErrorDescriber.InvalidUserName):
                    Add("email", InvalidEmailMessage);
                    break;
                default:
                    Add("form", error.Description);
                    break;
            }
        }
        return this;
    }

    public const string DuplicateEmailMessage =
        "There is already an account with this email. Sign in, or reset your password if you've forgotten it.";

    public const string InvalidEmailMessage = "Enter an email address like name@example.no.";

    /// <summary>The same simple check as the front-end: something@something.something, no spaces.</summary>
    public static bool LooksLikeEmail(string email) => EmailPattern().IsMatch(email);

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex EmailPattern();
}
