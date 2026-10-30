using Microsoft.AspNetCore.Identity;
using Tomekeeper.Api.Accounts;

namespace Tomekeeper.Api.Passwords;

/// <summary>
/// Plugs the password rules into ASP.NET Core Identity. Identity's own validator checks the minimum length,
/// so this one stays quiet about short passwords and reports at most one problem.
/// </summary>
public sealed class TomekeeperPasswordValidator(IBreachedPasswordCheck breaches) : IPasswordValidator<User>
{
    public const string ErrorCode = "PasswordRules";
    public const string BreachedCode = "PasswordBreached";

    public async Task<IdentityResult> ValidateAsync(UserManager<User> manager, User user, string? password)
    {
        password ??= "";
        var problem = PasswordRules.Check(password, user.Email, user.DisplayName);
        if (problem == PasswordProblem.TooShort) return IdentityResult.Success;
        if (problem is { } found)
        {
            return IdentityResult.Failed(new IdentityError { Code = ErrorCode, Description = PasswordRules.Message(found, password.Length) });
        }

        var breach = await breaches.CheckAsync(password, CancellationToken.None);
        return breach == BreachResult.Breached
            ? IdentityResult.Failed(new IdentityError { Code = BreachedCode, Description = PasswordRules.BreachedMessage })
            : IdentityResult.Success;
    }
}
