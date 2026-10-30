using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Tomekeeper.Api.Accounts;
using Tomekeeper.Api.Goals;

namespace Tomekeeper.Api.Tests;

/// <summary>The first steps after signing up: choosing a portrait and a goal for the year.</summary>
public sealed class FirstStepsTests(PostgresFixture database) : IAsyncLifetime
{
    private TomekeeperApiFactory _api = null!;
    private HttpClient _client = null!;
    private static CancellationToken Cancel => TestContext.Current.CancellationToken;
    private static int ThisYear => DateTimeOffset.UtcNow.Year;

    public async ValueTask InitializeAsync()
    {
        _api = new TomekeeperApiFactory(database.ConnectionString);
        _client = await SignedUpClient();
    }

    public async ValueTask DisposeAsync()
    {
        _client.Dispose();
        await _api.DisposeAsync();
    }

    private async Task<HttpClient> SignedUpClient()
    {
        var client = _api.CreateBrowserClient();
        var email = $"reader-{Guid.NewGuid():N}@example.no";
        var response = await client.PostAsJsonAsync(
            "/api/account/register", new { displayName = "Alex", email, password = "lantern harbour winter quill" }, Cancel);
        response.EnsureSuccessStatusCode();
        return client;
    }

    private Task<HttpResponseMessage> PutGoal(int year, string? kind, int? pages, int? books, HttpClient? client = null) =>
        (client ?? _client).PutAsJsonAsync($"/api/goals/{year}", new { kind, pages, books }, Cancel);

    private static async Task<Dictionary<string, string[]>> FieldErrors(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        return problem.GetProperty("errors").Deserialize<Dictionary<string, string[]>>()!;
    }

    // Portrait

    [Fact]
    public async Task A_new_reader_has_no_portrait_yet()
    {
        var me = await _client.GetFromJsonAsync<MeResponse>("/api/account/me", Cancel);
        Assert.Null(me!.Portrait);
    }

    [Fact]
    public async Task Choosing_a_portrait_shows_in_me()
    {
        var response = await _client.PutAsJsonAsync("/api/account/portrait", new { portrait = "knight" }, Cancel);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await _client.GetFromJsonAsync<MeResponse>("/api/account/me", Cancel);
        Assert.Equal("knight", me!.Portrait);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("death")]
    [InlineData("1")]
    public async Task Only_the_three_portraits_can_be_chosen(string? portrait)
    {
        var response = await _client.PutAsJsonAsync("/api/account/portrait", new { portrait }, Cancel);
        Assert.Equal(["Choose a portrait."], (await FieldErrors(response))["portrait"]);
    }

    // Goals

    [Fact]
    public async Task A_reader_without_a_goal_gets_404()
    {
        var response = await _client.GetAsync($"/api/goals/{ThisYear}", Cancel);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Setting_a_goal_in_pages_and_reading_it_back()
    {
        var put = await PutGoal(ThisYear, "pages", 1500, books: 3);

        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var goal = await _client.GetFromJsonAsync<GoalResponse>($"/api/goals/{ThisYear}", Cancel);
        // The goal only counts pages, so the number of books is not kept.
        Assert.Equal(new GoalResponse(ThisYear, 1500, null), goal);
    }

    [Fact]
    public async Task Changing_a_goal_replaces_it()
    {
        await PutGoal(ThisYear, "pages", 1500, null);

        var put = await PutGoal(ThisYear, "both", 2000, 6);

        Assert.Equal(new GoalResponse(ThisYear, 2000, 6), await put.Content.ReadFromJsonAsync<GoalResponse>(Cancel));
        Assert.Equal(new GoalResponse(ThisYear, 2000, 6), await _client.GetFromJsonAsync<GoalResponse>($"/api/goals/{ThisYear}", Cancel));
    }

    [Fact]
    public async Task Each_year_has_its_own_goal()
    {
        await PutGoal(ThisYear, "books", null, 12);
        await PutGoal(ThisYear + 1, "pages", null, null);
        await PutGoal(ThisYear + 1, "pages", 4000, null);

        Assert.Equal(new GoalResponse(ThisYear, null, 12), await _client.GetFromJsonAsync<GoalResponse>($"/api/goals/{ThisYear}", Cancel));
        Assert.Equal(new GoalResponse(ThisYear + 1, 4000, null), await _client.GetFromJsonAsync<GoalResponse>($"/api/goals/{ThisYear + 1}", Cancel));
    }

    [Fact]
    public async Task The_goal_needs_the_numbers_its_kind_counts()
    {
        var errors = await FieldErrors(await PutGoal(ThisYear, "both", null, null));

        Assert.Equal(["Enter how many pages."], errors["pages"]);
        Assert.Equal(["Enter how many books."], errors["books"]);
    }

    [Fact]
    public async Task The_goal_must_say_what_it_counts()
    {
        var errors = await FieldErrors(await PutGoal(ThisYear, "words", 1000, null));
        Assert.Equal(["Choose pages, books or both."], errors["kind"]);
    }

    [Theory]
    [InlineData(0, 5, "pages", "Choose a number of pages from 1 to 100,000.")]
    [InlineData(100_001, 5, "pages", "Choose a number of pages from 1 to 100,000.")]
    [InlineData(500, 0, "books", "Choose a number of books from 1 to 1,000.")]
    [InlineData(500, 1001, "books", "Choose a number of books from 1 to 1,000.")]
    public async Task Numbers_must_be_in_range(int pages, int books, string field, string message)
    {
        var errors = await FieldErrors(await PutGoal(ThisYear, "both", pages, books));
        Assert.Equal([message], errors[field]);
    }

    [Fact]
    public async Task Goals_far_from_now_are_refused()
    {
        var response = await PutGoal(ThisYear + 5, "pages", 1000, null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Cancel);
        Assert.Equal(GoalEndpoints.YearOutOfReachMessage, problem.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Readers_only_see_their_own_goals()
    {
        await PutGoal(ThisYear, "pages", 1500, null);
        using var someoneElse = await SignedUpClient();

        var response = await someoneElse.GetAsync($"/api/goals/{ThisYear}", Cancel);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Goals_need_a_signed_in_reader()
    {
        using var visitor = _api.CreateBrowserClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync($"/api/goals/{ThisYear}", Cancel)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await PutGoal(ThisYear, "pages", 100, null, visitor)).StatusCode);
    }
}
