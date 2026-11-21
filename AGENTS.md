# Repository Guidelines

## Project Overview

Local, single-user interview practice workspace with question prompts, saved answers, learnings, and Python coding exercises.

## Architecture & Data Flow

- React SPA → Nginx → ASP.NET Core minimal API (`/api/`) → PostgreSQL. `backend/Program.cs` initializes the schema and seeds questions at startup.
- The editor calls the aiohttp service via `/python/` for formatting, diagnostics, and completion. The API also calls it to execute coding answers in restricted processes; the service has no database credentials.
- Run checks sample and custom cases without saving a submission; Submit checks the full built-in suite and saves the result. Only a passing submission completes a coding problem.
- Drafts are autosaved per question in PostgreSQL, with pending edits retained in browser local storage for recovery. Sessions and the shared panel-width preference also persist in PostgreSQL.
- `compose.yaml` orchestrates the services. This local setup has no authentication or multi-user isolation; do not expose it to untrusted networks.

## Key Directories

- `frontend/src/`: routes, application state, React components, CodeMirror editor, and styles.
- `backend/`: API endpoints, SQL schema and seed data, and .NET project.
- `python-tools/`: Python tooling, sandboxed execution, coding suites, and service tests.
- `docs/graph-practice/`: graph exercise specification and verification constraints.

## Development Commands

```sh
docker compose up --build               # site: https://localhost:8443
docker compose down                     # retain database and TLS volumes
cd frontend && npm ci && npm run build  # TypeScript check and Vite build
cd frontend && npm run dev              # Vite dev server; Compose supplies API/tooling
dotnet build backend/InterviewPlatform.Api.csproj
cd python-tools && python -m unittest test_server
```

Install Python dependencies from `python-tools/requirements.txt` before running its tests. HTTP on port 8080 redirects to HTTPS; the local certificate is self-signed. Do not use `docker compose down -v` unless removing stored sessions and TLS certificates is intended. There is no configured repository lint command.

## Code Conventions & Common Patterns

- Use strict TypeScript, React function components and hooks; keep shared application state in `App.tsx` and pass component dependencies as props. Abort obsolete requests in effect cleanup and guard against stale editor results.
- Backend endpoints use minimal API handlers, injected singleton `NpgsqlDataSource`, asynchronous parameterized SQL, and request cancellation tokens. Return `Results.ValidationProblem` for invalid input; keep related schema and seed changes in the startup initializer.
- Python tooling uses aiohttp async handlers, validates requests, bounds concurrency and subprocess time, and cleans up subprocesses. Preserve container isolation and fail-closed sandbox behavior.
- Coding suite case IDs derive from question IDs and case names; avoid renaming cases casually. Keep suite metadata and canonical inputs synchronized.
- Follow existing naming and formatting in the file being changed; use the existing Tailwind and UI component patterns rather than introducing a parallel styling system.

## Important Files

- `frontend/src/main.tsx`, `frontend/src/App.tsx`: SPA entry point, routing, API calls, and state.
- `frontend/src/components/AnswerEditor.tsx`, `TestcaseBrowser.tsx`: CodeMirror tooling and testcase UI.
- `frontend/src/solutions.ts`: question-keyed solution explanations and examples.
- `backend/Program.cs`: routes, database initialization, SQL, and API records.
- `python-tools/server.py`, `executor.py`, `suites.py`: HTTP endpoints, execution sandbox, and coding contracts and cases.
- `frontend/nginx.conf`, `frontend/vite.config.ts`, `compose.yaml`: proxying, local development, and service configuration.
- `README.md`: usage, persistence, certificate handling, and local security limitations.

## Runtime/Tooling Preferences

- Docker images use Node 22 with npm and `frontend/package-lock.json`, .NET 8, Python 3.12 with pinned pip requirements, and PostgreSQL 17.
- Vite proxies API and Python requests to the local Compose HTTPS endpoint. The frontend production image serves the SPA through Nginx.
- Python execution requires Linux Landlock and seccomp and fails closed without them. Isolation is not a tamper-proof grading boundary; submitted code can interfere with its own tests.

## Testing & QA

- `python-tools/test_server.py` uses `unittest` and aiohttp test utilities for tooling, execution, sandbox, and custom-case behavior. Sandbox-dependent tests can skip when isolation is unavailable. No frontend or backend automated test suite or coverage threshold is configured.
- Run the narrowest relevant checks for a change. After making application changes, deploy them to the local site and verify the changed behavior on the site using the browser connection before responding. Report any deployment or verification failures.
