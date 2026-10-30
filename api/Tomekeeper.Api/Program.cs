using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Goals;
using Tomekeeper.Api.Health;
using Tomekeeper.Api.Passwords;
using Tomekeeper.Api.Security;

var builder = WebApplication.CreateBuilder(args);

// Database. The connection string is read when the database is first used, so tests can swap it.
// Locally it comes from appsettings.Development.json (the Docker Compose database);
// elsewhere from the environment variable ConnectionStrings__Tomekeeper.
builder.Services.AddDbContext<TomekeeperDbContext>((services, options) =>
{
    var connectionString = services.GetRequiredService<IConfiguration>().GetConnectionString("Tomekeeper")
        ?? throw new InvalidOperationException(
            "The connection string 'Tomekeeper' is missing. Locally, start the database with `docker compose up -d`.");
    options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention();
});

// Accounts: ASP.NET Core Identity with cookie sign-in.
builder.Services.AddIdentityCore<User>(options =>
    {
        options.User.RequireUniqueEmail = true;

        // NIST SP 800-63B-4: a minimum length and no rules about character types.
        options.Password.RequiredLength = PasswordRules.MinimumLength;
        options.Password.RequireDigit = false;
        options.Password.RequireLowercase = false;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequiredUniqueChars = 1;

        // Five wrong passwords in a row lock the account for 15 minutes.
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
        options.Lockout.AllowedForNewUsers = true;

        // Readers can use the site before confirming their email.
        options.SignIn.RequireConfirmedEmail = false;
    })
    .AddEntityFrameworkStores<TomekeeperDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders()
    .AddPasswordValidator<TomekeeperPasswordValidator>();

builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "tomekeeper.auth";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    // Locally the site runs on plain http; everywhere else the cookie is only sent over https.
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromDays(14);
    options.SlidingExpiration = true;
    // This is an API: answer 401 and 403 instead of redirecting to a sign-in page.
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});
builder.Services.AddAuthorization();

builder.Services.AddOptions<AppOptions>().BindConfiguration(AppOptions.Section).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddSingleton<AccountLinks>();
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSingleton<IAccountEmailSender, LoggingEmailSender>();
}
else
{
    builder.Services.AddSingleton<IAccountEmailSender, NotConfiguredEmailSender>();
}

builder.Services.AddHttpClient<IBreachedPasswordCheck, PwnedPasswordsClient>(client =>
{
    client.BaseAddress = new Uri("https://api.pwnedpasswords.com/");
    client.Timeout = TimeSpan.FromSeconds(3);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("Tomekeeper/0.1 (+https://github.com/alexandermora1/tomekeeper)");
});

// The clock, as a service so tests could set the time.
builder.Services.AddSingleton(TimeProvider.System);

builder.Services.AddHealthChecks().AddDbContextCheck<TomekeeperDbContext>(HealthEndpoints.DatabaseCheck);
builder.Services.AddProblemDetails();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    // Creates the database and applies migrations, so `dotnet run` works right after `docker compose up`.
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>().Database.MigrateAsync();
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRequestHeaderGuard();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthEndpoints();
app.MapAccountEndpoints();
app.MapGoalEndpoints();

app.Run();

/// <summary>Lets the tests start the API in memory.</summary>
public partial class Program;
