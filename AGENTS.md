# Repository Guidelines

## Project Overview

Local, single-user interview practice workspace with question prompts, saved answers, learnings, and optional Python editor tools.

## Architecture & Data Flow

- React SPA → Nginx → ASP.NET Core minimal API (`/api/`) → PostgreSQL. The API initializes the schema and seeds questions at startup in `backend/Program.cs`.
- The editor calls the separate aiohttp service via `/python/` for formatting, diagnostics, and completion. Submitted code is analyzed, not executed; the service has no database credentials.
- Sessions and the shared panel-width preference persist in PostgreSQL. Drafts live in React memory and do not survive reloads.
- `compose.yaml` orchestrates the services. The setup is for local use: it has no authentication or multi-user isolation.

## Key Directories

- `frontend/src/`: routes, application state, React components, CodeMirror editor, and styles.
- `backend/`: API endpoints, SQL schema and seed data, and .NET project.
- `python-tools/`: isolated Python tooling HTTP service and its tests.

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
- Python tooling uses aiohttp async handlers, validates requests, bounds concurrency and subprocess time, and cleans up subprocesses. Preserve its container isolation and avoid executing submitted answers.
- Follow existing naming and formatting in the file being changed; use the existing Tailwind and UI component patterns rather than introducing a parallel styling system.

## Important Files

- `frontend/src/main.tsx`, `frontend/src/App.tsx`: SPA entry point, routing, API calls, and state.
- `frontend/src/components/AnswerEditor.tsx`: CodeMirror and Python tooling integration.
- `backend/Program.cs`: routes, database initialization, SQL, and API records.
- `python-tools/server.py`: tooling endpoints and subprocess handling.
- `frontend/nginx.conf`, `frontend/vite.config.ts`, `compose.yaml`: proxying, local development, and service configuration.
- `README.md`: usage, persistence, certificate handling, and local security limitations.

## Runtime/Tooling Preferences

- Docker images use Node 22 with npm and `frontend/package-lock.json`, .NET 8, Python 3.12 with pinned pip requirements, and PostgreSQL 17.
- Vite proxies API and Python requests to the local Compose HTTPS endpoint. The frontend production image serves the SPA through Nginx.

## Testing & QA

- `python-tools/test_server.py` uses `unittest` and aiohttp test utilities for request validation, diagnostics, and LSP protocol handling. No frontend or backend automated test suite or coverage threshold is configured.
- Run the narrowest relevant checks for a change. After making application changes, deploy them to the local site and verify the changed behavior on the site using the browser connection before responding. Report any deployment or verification failures.
