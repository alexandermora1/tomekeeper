using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Books;
using Tomekeeper.Api.Data;
using Tomekeeper.Api.Game;
using Tomekeeper.Api.Goals;
using Tomekeeper.Api.Health;
using Tomekeeper.Api.Passwords;
using Tomekeeper.Api.Fellowship;
using Tomekeeper.Api.Moderation;
using Tomekeeper.Api.Profiles;
using Tomekeeper.Api.Reviews;
using Tomekeeper.Api.Progress;
using Tomekeeper.Api.Security;
using Tomekeeper.Api.Shelves;
using Tomekeeper.Api.Site;

var builder = WebApplication.CreateBuilder(args);

// On Azure App Service: behind its HTTPS proxy (Security/SiteHosting.cs).
builder.AddProxySupport();

// The keys that protect sign-in cookies. Kept in a folder that survives restarts when DataProtection:KeysPath
// is set (on App Service, under /home), so readers stay signed in when the app restarts.
if (builder.Configuration["DataProtection:KeysPath"] is { Length: > 0 } keysPath)
{
    builder.Services.AddDataProtection().SetApplicationName("Tomekeeper").PersistKeysToFileSystem(new DirectoryInfo(keysPath));
}

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

var authentication = builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme);
authentication.AddIdentityCookies();
// "Sign in with Google", only when the Google client id and secret are set (see the README).
authentication.AddGoogleSignIn(builder.Configuration, builder.Environment);
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
// Emails: to the log in development, through Azure Communication Services when it is set up, otherwise not at all.
builder.Services.Configure<EmailOptions>(builder.Configuration.GetSection(EmailOptions.Section));
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSingleton<IAccountEmailSender, LoggingEmailSender>();
}
else if (builder.Configuration.GetSection(EmailOptions.Section).Get<EmailOptions>() is { Configured: true })
{
    builder.Services.AddSingleton<IAccountEmailSender, AzureEmailSender>();
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

// Open Library, for finding books (Books/OpenLibraryClient.cs).
builder.Services.AddMemoryCache();
builder.Services.Configure<OpenLibraryOptions>(builder.Configuration.GetSection(OpenLibraryOptions.Section));
builder.Services.AddSingleton<OpenLibraryRateLimiter>();
builder.Services.AddTransient<OpenLibraryThrottle>();
builder.Services.AddHttpClient<OpenLibraryClient>((services, client) =>
    {
        var options = services.GetRequiredService<Microsoft.Extensions.Options.IOptions<OpenLibraryOptions>>().Value;
        client.BaseAddress = new Uri(options.BaseUrl);
        client.Timeout = TimeSpan.FromSeconds(10);
        var contact = string.IsNullOrWhiteSpace(options.ContactEmail) ? "+https://github.com/alexandermora1/tomekeeper" : options.ContactEmail.Trim();
        client.DefaultRequestHeaders.UserAgent.ParseAdd($"Tomekeeper/0.1 ({contact})");
    })
    .AddHttpMessageHandler<OpenLibraryThrottle>();
// Covers (Books/Covers.cs): fetched once from Open Library, then served from memory.
builder.Services.AddSingleton<CoverCache>();
builder.Services.AddHttpClient<OpenLibraryCoverClient>((services, client) =>
{
    var options = services.GetRequiredService<Microsoft.Extensions.Options.IOptions<OpenLibraryOptions>>().Value;
    client.BaseAddress = new Uri(options.CoversUrl);
    client.Timeout = TimeSpan.FromSeconds(10);
    var contact = string.IsNullOrWhiteSpace(options.ContactEmail) ? "+https://github.com/alexandermora1/tomekeeper" : options.ContactEmail.Trim();
    client.DefaultRequestHeaders.UserAgent.ParseAdd($"Tomekeeper/0.1 ({contact})");
});

// The clock, as a service so tests could set the time.
builder.Services.AddSingleton(TimeProvider.System);

// Limits on how often the account endpoints can be called (Security/RateLimits.cs).
builder.Services.AddTomekeeperRateLimits(builder.Configuration);

builder.Services.AddHealthChecks().AddDbContextCheck<TomekeeperDbContext>(HealthEndpoints.DatabaseCheck);
builder.Services.AddProblemDetails();

var app = builder.Build();

// Creates the database and applies migrations: in development, so `dotnet run` works right after
// `docker compose up`, and on Azure (Database:MigrateOnStartup), where one instance runs and a deploy restarts it.
if (app.Environment.IsDevelopment() || app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<TomekeeperDbContext>().Database.MigrateAsync();
}

app.UseProxySupport();
if (!app.Environment.IsDevelopment())
{
    // Browsers that have been here over HTTPS use only HTTPS for a year.
    app.UseHsts();
}
app.UseSecurityHeaders();
app.UseFrontEnd();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRequestHeaderGuard();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthEndpoints();
app.MapAccountEndpoints();
app.MapGoalEndpoints();
app.MapBookEndpoints();
app.MapCoverEndpoints();
app.MapShelfEndpoints();
app.MapProgressEndpoints();
app.MapChronicleEndpoints();
app.MapCharacterEndpoints();
app.MapQuestEndpoints();
app.MapLegacyEndpoints();
app.MapProfileEndpoints();
app.MapFellowshipEndpoints();
app.MapReviewEndpoints();
app.MapReportEndpoints();
app.MapSiteEndpoints();
app.MapFrontEndFallback();

app.Run();

/// <summary>Lets the tests start the API in memory.</summary>
public partial class Program;
