using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection must be configured.");
builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));
builder.Services.AddSingleton(new HttpClient
{
    BaseAddress = new Uri(builder.Configuration["PythonToolsUrl"] ?? "http://python-tools:8080"),
    Timeout = TimeSpan.FromSeconds(30)
});

var app = builder.Build();
var dataSource = app.Services.GetRequiredService<NpgsqlDataSource>();
await InitializeDatabaseAsync(dataSource, app.Logger, app.Lifetime.ApplicationStopping);

app.MapGet("/api/questions", async (NpgsqlDataSource db, HttpClient python, CancellationToken cancellationToken) =>
{
    var suites = await GetSuitesAsync(python, cancellationToken);
    if (suites is null)
        return Results.Problem("The coding test service is unavailable.", statusCode: StatusCodes.Status503ServiceUnavailable);

    var questions = new List<Question>();
    await using var command = db.CreateCommand("SELECT id, category, difficulty, title, prompt FROM questions ORDER BY category, title");
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
    {
        var id = reader.GetString(0);
        var category = reader.GetString(1);
        var coding = IsCoding(category);
        var suite = suites.FirstOrDefault(s => s.Id == id);
        if (coding && suite is null)
            return Results.Problem($"No coding test suite is available for {id}.", statusCode: StatusCodes.Status503ServiceUnavailable);
        questions.Add(new Question(id, category, reader.GetString(2), reader.GetString(3), reader.GetString(4),
            coding, false, suite?.StarterCode, suite?.TestInstructions));
    }
    await reader.CloseAsync();
    for (var i = 0; i < questions.Count; i++)
    {
        if (!questions[i].Coding)
            continue;
        await using var completed = db.CreateCommand($"SELECT EXISTS (SELECT 1 FROM {SubmissionTable(questions[i].Id)} WHERE passed)");
        questions[i] = questions[i] with { Complete = (bool)(await completed.ExecuteScalarAsync(cancellationToken))! };
    }
    return Results.Ok(questions);
});

app.MapGet("/api/questions/{id}/testcases", async (string id, NpgsqlDataSource db, HttpClient python, CancellationToken cancellationToken) =>
{
    var knownId = await FindCodingQuestionAsync(db, id, cancellationToken);
    if (knownId is null)
        return Results.NotFound();

    TestcaseMetadata? metadata;
    try
    {
        using var response = await python.GetAsync($"/python/testcases/{Uri.EscapeDataString(knownId)}", cancellationToken);
        response.EnsureSuccessStatusCode();
        metadata = await response.Content.ReadFromJsonAsync<TestcaseMetadata>(cancellationToken);
    }
    catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
    {
        return Results.Problem("The coding test service is unavailable.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    if (metadata?.Cases is null || metadata.CustomTemplate is null ||
        metadata.CustomTemplate.Description is null || metadata.CustomTemplate.Input is null ||
        metadata.Cases.Any(c => c is null || string.IsNullOrWhiteSpace(c.Id) || c.Input is null || c.Sample is null) ||
        metadata.Cases.Select(c => c.Id).Distinct(StringComparer.Ordinal).Count() != metadata.Cases.Length)
        return Results.Problem("The coding test service returned invalid testcase metadata.", statusCode: StatusCodes.Status502BadGateway);

    return Results.Ok(metadata);
});

app.MapPost("/api/questions/{id}/run", async (string id, CodeRequest request, NpgsqlDataSource db, HttpClient python, CancellationToken cancellationToken) =>
    await ExecuteCodeAsync(id, request, false, db, python, cancellationToken));

app.MapPost("/api/questions/{id}/submit", async (string id, CodeRequest request, NpgsqlDataSource db, HttpClient python, CancellationToken cancellationToken) =>
    await ExecuteCodeAsync(id, request, true, db, python, cancellationToken));

app.MapGet("/api/questions/{id}/draft", async (string id, NpgsqlDataSource db, CancellationToken cancellationToken) =>
{
    await using var command = db.CreateCommand("""
        SELECT d.answer FROM questions q
        LEFT JOIN question_drafts d ON d.question_id = q.id
        WHERE q.id = @id
        """);
    command.Parameters.AddWithValue("id", id);
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    if (!await reader.ReadAsync(cancellationToken))
        return Results.NotFound();
    return Results.Ok(new DraftResponse(reader.IsDBNull(0) ? null : reader.GetString(0)));
});

app.MapPut("/api/questions/{id}/draft", async (string id, DraftRequest request, NpgsqlDataSource db, CancellationToken cancellationToken) =>
{
    if (request.Answer is null)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["answer"] = ["Answer is required."] });
    if (request.Answer.Length > 204800)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["answer"] = ["Answer must be 204,800 characters or fewer."] });

    await using var command = db.CreateCommand("""
        INSERT INTO question_drafts (question_id, answer)
        SELECT id, @answer FROM questions WHERE id = @id
        ON CONFLICT (question_id) DO UPDATE SET answer = EXCLUDED.answer
        RETURNING answer
        """);
    command.Parameters.AddWithValue("id", id);
    command.Parameters.AddWithValue("answer", request.Answer);
    var answer = (string?)await command.ExecuteScalarAsync(cancellationToken);
    return answer is null ? Results.NotFound() : Results.Ok(new DraftResponse(answer));
});

app.MapGet("/api/questions/{id}/submissions", async (string id, NpgsqlDataSource db, CancellationToken cancellationToken) =>
{
    var knownId = await FindCodingQuestionAsync(db, id, cancellationToken);
    if (knownId is null)
        return Results.NotFound();
    var submissions = new List<CodingSubmission>();
    await using var command = db.CreateCommand($"SELECT code, passed, total, failed_test_ids, error, created_at, failures FROM {SubmissionTable(knownId)} ORDER BY created_at DESC, id DESC");
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
        submissions.Add(new CodingSubmission(reader.GetString(0), reader.GetBoolean(1), reader.GetInt32(2),
            reader.GetFieldValue<Guid[]>(3).Select(g => g.ToString()).ToArray(),
            reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetFieldValue<DateTime>(5),
            reader.IsDBNull(6) ? null : JsonSerializer.Deserialize<TestFailure[]>(reader.GetString(6))));
    return Results.Ok(submissions);
});

app.MapGet("/api/sessions", async (NpgsqlDataSource db, CancellationToken cancellationToken) =>
{
    var sessions = new List<Session>();
    await using var command = db.CreateCommand("""
        SELECT s.id, s.question_id, q.title, q.category, s.answer, s.created_at
        FROM sessions s JOIN questions q ON q.id = s.question_id
        ORDER BY s.created_at DESC, s.id DESC
        """);
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
        sessions.Add(ReadSession(reader));
    return Results.Ok(sessions);
});

app.MapPost("/api/sessions", async (CreateSessionRequest request, NpgsqlDataSource db, CancellationToken cancellationToken) =>
{
    var errors = new Dictionary<string, string[]>();
    if (string.IsNullOrWhiteSpace(request.QuestionId))
        errors["questionId"] = ["Question ID is required."];
    if (string.IsNullOrWhiteSpace(request.Answer))
        errors["answer"] = ["Answer is required."];
    else if (request.Answer.Length > 20000)
        errors["answer"] = ["Answer must be 20,000 characters or fewer."];
    if (errors.Count > 0)
        return Results.ValidationProblem(errors);

    // Inserting from the question table makes the existence check and insert atomic.
    await using var command = db.CreateCommand("""
        WITH inserted AS (
            INSERT INTO sessions (id, question_id, answer, created_at)
            SELECT @id, id, @answer, @created_at FROM questions WHERE id = @question_id
            RETURNING id, question_id, answer, created_at
        )
        SELECT i.id, i.question_id, q.title, q.category, i.answer, i.created_at
        FROM inserted i JOIN questions q ON q.id = i.question_id
        """);
    command.Parameters.AddWithValue("id", Guid.NewGuid().ToString());
    command.Parameters.AddWithValue("question_id", request.QuestionId!);
    command.Parameters.AddWithValue("answer", request.Answer!.Trim());
    command.Parameters.AddWithValue("created_at", NpgsqlDbType.TimestampTz, DateTime.UtcNow);
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    if (!await reader.ReadAsync(cancellationToken))
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["questionId"] = ["Question does not exist."] });
    var session = ReadSession(reader);
    return Results.Json(session, statusCode: StatusCodes.Status201Created);
});

app.MapGet("/api/preferences", async (NpgsqlDataSource db, CancellationToken cancellationToken) =>
{
    await using var command = db.CreateCommand("SELECT description_width FROM user_preferences WHERE id = 1");
    var width = await command.ExecuteScalarAsync(cancellationToken);
    return Results.Ok(new Preferences(width is double value ? value : 50));
});

app.MapPut("/api/preferences", async (PreferencesRequest request, NpgsqlDataSource db, CancellationToken cancellationToken) =>
{
    if (request.DescriptionWidth is not double width || !double.IsFinite(width) || width < 20 || width > 80)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["descriptionWidth"] = ["Description width must be between 20 and 80 percent."] });

    await using var command = db.CreateCommand("""
        INSERT INTO user_preferences (id, description_width) VALUES (1, @width)
        ON CONFLICT (id) DO UPDATE SET description_width = EXCLUDED.description_width
        """);
    command.Parameters.AddWithValue("width", width);
    await command.ExecuteNonQueryAsync(cancellationToken);
    return Results.Ok(new Preferences(width));
});

app.Run();

static Session ReadSession(NpgsqlDataReader reader) => new(
    reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
    reader.GetString(4), reader.GetFieldValue<DateTime>(5));

static bool IsCoding(string category) => category is "Algorithms" or "Design Patterns";

// The name is derived only from an ID retrieved from questions, never from a request.
static string SubmissionTable(string knownId) =>
    "\"submissions_" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(knownId)))[..48].ToLowerInvariant() + "\"";

static async Task<string?> FindCodingQuestionAsync(NpgsqlDataSource db, string id, CancellationToken cancellationToken)
{
    await using var command = db.CreateCommand("SELECT id FROM questions WHERE id = @id AND category IN ('Algorithms', 'Design Patterns')");
    command.Parameters.AddWithValue("id", id);
    return (string?)await command.ExecuteScalarAsync(cancellationToken);
}

static async Task<SuiteMetadata[]?> GetSuitesAsync(HttpClient python, CancellationToken cancellationToken)
{
    try
    {
        return await python.GetFromJsonAsync<SuiteMetadata[]>("/python/suites", cancellationToken);
    }
    catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
    {
        return null;
    }
}

static async Task<IResult> ExecuteCodeAsync(string id, CodeRequest request, bool submit, NpgsqlDataSource db, HttpClient python, CancellationToken cancellationToken)
{
    if (request.Code is null)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["Code is required."] });
    if (submit && request.CustomCases is { Length: > 0 })
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["customCases"] = ["Custom cases are only allowed when running code."] });
    if (request.CustomCases is { } customCases &&
        (customCases.Length > 10 ||
         customCases.Any(c => c is null || !Guid.TryParse(c.Id, out _) || c.Input is null ||
             Encoding.UTF8.GetByteCount(c.Input) > 8192 ||
             (c.Expected is not null && Encoding.UTF8.GetByteCount(c.Expected) > 8192)) ||
         customCases.Select(c => Guid.Parse(c.Id)).Distinct().Count() != customCases.Length))
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["customCases"] = ["Provide at most 10 cases with unique UUID ids and inputs and expected values no larger than 8 KiB each."] });
    var knownId = await FindCodingQuestionAsync(db, id, cancellationToken);
    if (knownId is null)
        return Results.NotFound();

    RunResult? result;
    try
    {
        using var response = submit
            ? await python.PostAsJsonAsync("/python/execute", new { questionId = knownId, code = request.Code, mode = "submit" }, cancellationToken)
            : await python.PostAsJsonAsync("/python/execute", new { questionId = knownId, code = request.Code, mode = "run", customCases = request.CustomCases ?? [] }, cancellationToken);
        response.EnsureSuccessStatusCode();
        result = await response.Content.ReadFromJsonAsync<RunResult>(cancellationToken);
    }
    catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
    {
        return Results.Problem("The coding test service is unavailable.", statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    if (result is null || result.Total <= 0 || result.FailedTestIds is null || result.Failures is null ||
        result.FailedTestIds.Length > result.Total ||
        result.FailedTestIds.Any(id => !Guid.TryParse(id, out _)) ||
        result.FailedTestIds.Select(Guid.Parse).Distinct().Count() != result.FailedTestIds.Length ||
        result.Failures.Length != result.FailedTestIds.Length ||
        result.Failures.Any(f => f is null || !Guid.TryParse(f.Id, out _) ||
            f.Input is null || f.Expected is null || f.Actual is null) ||
        !result.Failures.Select(f => Guid.Parse(f.Id)).ToHashSet().SetEquals(result.FailedTestIds.Select(Guid.Parse)) ||
        (result.Passed && (result.FailedTestIds.Length != 0 || result.Error is not null)) ||
        (!result.Passed && result.FailedTestIds.Length == 0 && result.Error is null))
        return Results.Problem("The coding test service returned an invalid result.", statusCode: StatusCodes.Status502BadGateway);

    if (!submit && request.CustomCases is { Length: > 0 } requestedCases)
    {
        if (result.CustomResults is null || result.CustomResults.Length != requestedCases.Length ||
            result.CustomResults.Any(r => r is null || r.Id is null || r.Input is null || r.Actual is null ||
                (r.Error is not null ? r.Passed != false : (r.Expected is null) != (r.Passed is null))) ||
            result.CustomResults.Select(r => r.Id).Distinct(StringComparer.Ordinal).Count() != requestedCases.Length ||
            result.CustomResults.Any(r => !requestedCases.Any(c => c.Id == r.Id && c.Input == r.Input && c.Expected == r.Expected)))
            return Results.Problem("The coding test service returned invalid custom results.", statusCode: StatusCodes.Status502BadGateway);
    }

    if (submit)
    {
        await using var command = db.CreateCommand($"""
            INSERT INTO {SubmissionTable(knownId)} (id, code, passed, total, failed_test_ids, error, created_at, failures)
            VALUES (@id, @code, @passed, @total, @failed_test_ids, @error, @created_at, @failures)
            """);
        command.Parameters.AddWithValue("id", Guid.NewGuid());
        command.Parameters.AddWithValue("code", request.Code);
        command.Parameters.AddWithValue("passed", result.Passed);
        command.Parameters.AddWithValue("total", result.Total);
        command.Parameters.AddWithValue("failed_test_ids", result.FailedTestIds.Select(Guid.Parse).ToArray());
        command.Parameters.AddWithValue("error", NpgsqlDbType.Text, (object?)result.Error ?? DBNull.Value);
        command.Parameters.AddWithValue("failures", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(result.Failures));
        command.Parameters.AddWithValue("created_at", NpgsqlDbType.TimestampTz, DateTime.UtcNow);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
    return Results.Ok(result);
}

static async Task InitializeDatabaseAsync(NpgsqlDataSource db, ILogger logger, CancellationToken cancellationToken)
{
    const int maxAttempts = 15;
    for (var attempt = 1; ; attempt++)
    {
        try
        {
            await using var connection = await db.OpenConnectionAsync(cancellationToken);
            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
            await using var command = new NpgsqlCommand("""
                CREATE TABLE IF NOT EXISTS questions (
                    id text PRIMARY KEY,
                    category text NOT NULL,
                    difficulty text NOT NULL,
                    title text NOT NULL,
                    prompt text NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    id text PRIMARY KEY,
                    question_id text NOT NULL REFERENCES questions(id),
                    answer text NOT NULL,
                    created_at timestamptz NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_sessions_created_at ON sessions (created_at DESC);
                CREATE TABLE IF NOT EXISTS question_drafts (
                    question_id text PRIMARY KEY REFERENCES questions(id),
                    answer text NOT NULL
                );
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id integer PRIMARY KEY CHECK (id = 1),
                    description_width double precision NOT NULL CHECK (description_width >= 20 AND description_width <= 80)
                );
                INSERT INTO questions (id, category, difficulty, title, prompt) VALUES
                    ('behavioral-conflict', 'Behavioral', 'Medium', 'Navigating conflict', 'Tell me about a time you disagreed with a teammate. How did you handle it, and what was the outcome?'),
                    ('behavioral-failure', 'Behavioral', 'Easy', 'Learning from failure', 'Describe a time something did not go as planned. What did you learn and what did you do differently afterward?'),
                    ('behavioral-impact', 'Behavioral', 'Medium', 'Making an impact', 'Describe a project where you made a meaningful impact. What was your contribution and how did you measure success?'),
                    ('algorithms-two-sum', 'Algorithms', 'Easy', 'Two sum', 'Given an array of integers and a target, describe how you would find two numbers that add up to the target. Discuss time and space complexity.'),
                    ('algorithms-intervals', 'Algorithms', 'Medium', 'Merge intervals', 'Given a collection of intervals, explain how you would merge overlapping intervals and analyze your approach.'),
                    ('algorithms-cache', 'Algorithms', 'Hard', 'Design an LRU cache', 'Design a least recently used cache that supports efficient lookup and insertion. Explain your data structures and complexity.'),
                    ('system-url-shortener', 'System Design', 'Medium', 'Design a URL shortener', 'Design a URL shortening service. Discuss the API, storage, identifier generation, and scaling considerations.'),
                    ('system-rate-limiter', 'System Design', 'Hard', 'Design a rate limiter', 'Design a distributed rate limiter. Discuss enforcement, consistency, failure handling, and trade-offs.'),
                    ('technical-debugging', 'Technical', 'Medium', 'Debugging a production issue', 'A service has suddenly become slow in production. How would you investigate, mitigate the issue, and prevent recurrence?'),
                    ('patterns-strategy', 'Design Patterns', 'Easy', 'Choose a pricing strategy', 'A checkout service supports regular, seasonal, and member discounts. Design a Strategy-based solution in Python that lets the caller choose a pricing rule without changing the checkout service. Explain how you would test the rules and handle invalid prices.'),
                    ('patterns-observer', 'Design Patterns', 'Medium', 'Publish order updates', 'An order service must notify email and inventory components when an order changes. Design an Observer-based solution in Python that supports subscribing and unsubscribing. Discuss what happens if one observer fails and how you would avoid duplicate subscriptions.'),
                    ('patterns-factory', 'Design Patterns', 'Medium', 'Create notification channels', 'An application sends notifications by email or SMS, with more channels planned. Design a Factory-based solution in Python that creates the appropriate sender from configuration. Explain how unsupported channel types and sender dependencies should be handled.'),
                    ('patterns-decorator', 'Design Patterns', 'Medium', 'Compose request behavior', 'A client sends requests through a common interface. Add optional logging and retry behavior using the Decorator pattern in Python without changing the underlying client. Explain how decorator order affects behavior and when retries are unsafe.'),
                    ('google-message-dedup', 'Algorithms', 'Medium', 'Deduplicate a message stream', 'Implement a message filter that receives messages in nondecreasing timestamp order. Accept a message only if the same text has not been accepted in the preceding 60 seconds. A message exactly 60 seconds after the previous accepted copy is allowed. Return whether each message is accepted. Explain time and space complexity. Follow-up: evict expired entries so memory depends on recent traffic, not all historical messages.'),
                    ('google-islands-lakes', 'Algorithms', 'Hard', 'Islands and enclosed lakes', 'Given a rectangular grid of land and water, count the islands, where land cells connect horizontally or vertically. Then count water regions that do not touch the grid boundary. Explain how you avoid counting the ocean as a lake. Follow-up: how would you maintain the island count as water cells become land one at a time?'),
                    ('google-shift-timeline', 'Algorithms', 'Hard', 'Build a shift timeline', 'Given shifts as (person, start, end), produce maximal time segments during which the set of people on shift is constant. Shifts are half-open: a person ending at time t is not present at t, while a person starting at t is. A person may have overlapping shifts. Omit empty segments. Explain how you handle simultaneous events and analyze complexity.'),
                    ('google-meeting-rooms', 'Algorithms', 'Medium', 'Minimum meeting rooms', 'Given half-open meeting intervals [start, end), return the minimum number of rooms needed. Meetings ending when another starts can share a room. Explain your algorithm and complexity. Follow-up: assign each meeting a room and identify the room used most often, breaking ties by room number.'),
                    ('google-cheapest-flights', 'Algorithms', 'Medium', 'Cheapest flight with a stop limit', 'Given directed flights (origin, destination, nonnegative price), a source, a destination, and a maximum number of intermediate stops, find the cheapest valid price or report that none exists. Explain why tracking only one best price per city may be insufficient. Follow-up: return the route as well as its price.'),
                    ('google-train-schedule', 'Algorithms', 'Hard', 'Earliest arrival by train', 'Given trains (origin, destination, departure, arrival), a starting station, a start time, and a destination, find the earliest possible arrival and return an itinerary. A transfer is allowed when the next departure is at or after the previous arrival. Times are absolute and every train arrives after it departs. Explain your approach and complexity.'),
                    ('google-router-reachability', 'Algorithms', 'Medium', 'Message routing with broken routers', 'Routers have coordinates and individual transmission radii. A working router receiving a message broadcasts it once to every working router within its radius. Given the routers, broken router IDs, a source, and a destination, determine whether the message can reach the destination. Discuss directed reachability, boundary distances, and complexity. Follow-up: return a route with the fewest hops.'),
                    ('google-top-k-similar', 'Algorithms', 'Medium', 'Top similar recommendations', 'Movies form an undirected graph; each movie has a similarity score to a given starting movie. Return the top k distinct reachable movies, excluding the start, ordered by descending score with ID as a tie-breaker. Handle cycles and fewer than k reachable movies. Analyze time and space complexity. Follow-up: how would you reduce memory used for ranking?'),
                    ('google-dag-longest-path', 'Algorithms', 'Medium', 'Longest path in a DAG', 'Given a directed acyclic graph, find the longest path by number of edges and return its vertices. The graph may be disconnected or contain isolated vertices. Explain how your algorithm uses the DAG property and analyze its complexity. Follow-up: handle weighted edges, including negative weights.'),
                    ('google-dependency-order', 'Algorithms', 'Medium', 'Schedule dependent tasks', 'Given tasks and directed prerequisite pairs, return an order in which every prerequisite precedes its dependent task, or report that no such order exists. Include tasks with no dependencies. Explain how you detect cycles and analyze complexity. Follow-up: group tasks into the fewest parallel rounds assuming unlimited workers.'),
                    ('google-connect-sticks', 'Algorithms', 'Medium', 'Minimum cost to connect segments', 'Given nonnegative segment lengths, repeatedly join any two segments; each join costs the sum of their lengths and creates a segment of that length. Return the minimum total cost to join all segments, with zero cost for fewer than two. Explain why your choice is optimal and analyze complexity. Follow-up: return the sequence of joins.'),
                    ('google-string-transform', 'Algorithms', 'Hard', 'Transform characters with global replacements', 'Given equal-length strings over lowercase English letters, determine whether the first can become the second using any number of operations that replace every occurrence of one letter with another letter. Explain conflicts and cycles, including when no spare letter is available. Analyze complexity. Follow-up: produce a sequence of replacements when possible.'),
                    ('google-dynamic-intervals', 'Algorithms', 'Hard', 'Maintain booking availability', 'Design a class for a single room with book(start, end) and cancel(start, end). Bookings are half-open intervals; reject a booking that overlaps an existing one, and cancel only an exact existing booking. Explain the data structures, operation costs, and boundary cases. Follow-up: support finding the first available slot of a requested duration after a given time.'),
                    ('google-news-feed', 'System Design', 'Hard', 'Design a news feed', 'Design a news feed for users following other accounts. Clarify functional and scale requirements, then discuss APIs, storage, ranking, fanout, pagination, freshness, and failure handling. Compare fanout on write and fanout on read, including the impact of highly popular authors.'),
                    ('google-video-distribution', 'System Design', 'Hard', 'Design video distribution', 'Design a service that uploads, processes, and streams video to a global audience. Define the scope and scale assumptions; discuss upload, transcoding, object storage, delivery, reliability, and playback latency. Explain trade-offs and bottlenecks.'),
                    ('google-ambiguity', 'Behavioral', 'Medium', 'Lead through ambiguity', 'Describe a time you made progress on an ambiguous engineering problem. How did you clarify the goal, involve others, decide what to do, and measure the outcome? What would you change?'),
                    ('google-user-first', 'Behavioral', 'Medium', 'Put users first', 'Describe a time you prioritized users when technical or business pressures pointed elsewhere. What evidence informed your decision, how did you align stakeholders, and what was the outcome?')
                ON CONFLICT (id) DO NOTHING;
                """, connection, transaction);
            await command.ExecuteNonQueryAsync(cancellationToken);
            var codingIds = new List<string>();
            await using (var select = new NpgsqlCommand("SELECT id FROM questions WHERE category IN ('Algorithms', 'Design Patterns')", connection, transaction))
            await using (var reader = await select.ExecuteReaderAsync(cancellationToken))
                while (await reader.ReadAsync(cancellationToken))
                    codingIds.Add(reader.GetString(0));
            foreach (var id in codingIds)
            {
                await using var create = new NpgsqlCommand($"""
                    CREATE TABLE IF NOT EXISTS {SubmissionTable(id)} (
                        id uuid PRIMARY KEY,
                        code text NOT NULL,
                        passed boolean NOT NULL,
                        total integer NOT NULL,
                        failed_test_ids uuid[] NOT NULL,
                        error text,
                        created_at timestamptz NOT NULL,
                        failures jsonb
                    );
                    ALTER TABLE {SubmissionTable(id)} ADD COLUMN IF NOT EXISTS failures jsonb
                    """, connection, transaction);
                await create.ExecuteNonQueryAsync(cancellationToken);
            }
            await transaction.CommitAsync(cancellationToken);
            return;
        }
        catch (Exception ex) when (attempt < maxAttempts && !cancellationToken.IsCancellationRequested &&
                                   (ex is NpgsqlException || ex is TimeoutException))
        {
            logger.LogWarning(ex, "Database initialization attempt {Attempt}/{MaxAttempts} failed; retrying", attempt, maxAttempts);
            await Task.Delay(TimeSpan.FromSeconds(2), cancellationToken);
        }
    }
}

record Question(string Id, string Category, string Difficulty, string Title, string Prompt, bool Coding, bool Complete, string? StarterCode, string? TestInstructions);
record SuiteMetadata(string Id, string StarterCode, string TestInstructions);
record Testcase(string Id, string Input, bool? Sample);
record CustomTemplate(string Description, string Input);
record TestcaseMetadata(Testcase[] Cases, CustomTemplate CustomTemplate);
record CustomCase(string Id, string Input, string? Expected);
record CustomResult(string Id, string Input, string? Expected, string Actual, bool? Passed, string? Error);
record CodeRequest(string? Code, CustomCase[]? CustomCases);
record TestFailure(string Id, string Input, string Expected, string Actual);
record RunResult(bool Passed, int Total, string[] FailedTestIds, string? Error, TestFailure[] Failures, CustomResult[]? CustomResults = null);
record CodingSubmission(string Code, bool Passed, int Total, string[] FailedTestIds, string? Error, DateTime CreatedAt, TestFailure[]? Failures);
record Session(string Id, string QuestionId, string QuestionTitle, string Category, string Answer, DateTime CreatedAt);
record CreateSessionRequest(string? QuestionId, string? Answer);
record DraftRequest(string? Answer);
record DraftResponse(string? Answer);
record Preferences(double DescriptionWidth);
record PreferencesRequest(double? DescriptionWidth);
