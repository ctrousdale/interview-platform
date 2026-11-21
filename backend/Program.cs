using Npgsql;
using NpgsqlTypes;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection must be configured.");
builder.Services.AddSingleton(_ => NpgsqlDataSource.Create(connectionString));

var app = builder.Build();
var dataSource = app.Services.GetRequiredService<NpgsqlDataSource>();
await InitializeDatabaseAsync(dataSource, app.Logger, app.Lifetime.ApplicationStopping);

app.MapGet("/api/questions", async (NpgsqlDataSource db, CancellationToken cancellationToken) =>
{
    var questions = new List<Question>();
    await using var command = db.CreateCommand("SELECT id, category, difficulty, title, prompt FROM questions ORDER BY category, title");
    await using var reader = await command.ExecuteReaderAsync(cancellationToken);
    while (await reader.ReadAsync(cancellationToken))
        questions.Add(new Question(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4)));
    return Results.Ok(questions);
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
                    ('patterns-decorator', 'Design Patterns', 'Medium', 'Compose request behavior', 'A client sends requests through a common interface. Add optional logging and retry behavior using the Decorator pattern in Python without changing the underlying client. Explain how decorator order affects behavior and when retries are unsafe.')
                ON CONFLICT (id) DO NOTHING;
                """, connection, transaction);
            await command.ExecuteNonQueryAsync(cancellationToken);
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

record Question(string Id, string Category, string Difficulty, string Title, string Prompt);
record Session(string Id, string QuestionId, string QuestionTitle, string Category, string Answer, DateTime CreatedAt);
record CreateSessionRequest(string? QuestionId, string? Answer);
record Preferences(double DescriptionWidth);
record PreferencesRequest(double? DescriptionWidth);
