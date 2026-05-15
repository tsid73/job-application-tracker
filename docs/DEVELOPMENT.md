# Development

## Local Development Setup

Requirements:

- Node.js 20 or newer
- npm
- Docker only if you want local PostgreSQL

Standard setup:

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Common local defaults:

```text
PORT=3000
DB_CLIENT=pglite
PGLITE_DATA_DIR=data/pglite
UPLOAD_DIR=uploads
FILE_STORAGE_MODE=local
AI_PROVIDER=mock
DEFAULT_AI_REQUEST_PROVIDER=gemini
```

Important variables by area:

Database:

- `DB_CLIENT`
- `PGLITE_DATA_DIR`
- `DATABASE_URL`

Uploads and request limits:

- `UPLOAD_DIR`
- `MAX_UPLOAD_BYTES`
- `MAX_JSON_BYTES`
- `MAX_AI_BYTES`

Rate limiting:

- `GENERAL_RATE_LIMIT_WINDOW_MS`
- `GENERAL_RATE_LIMIT_MAX`
- `AI_RATE_LIMIT_WINDOW_MS`
- `AI_RATE_LIMIT_MAX`
- `UPLOAD_RATE_LIMIT_WINDOW_MS`
- `UPLOAD_RATE_LIMIT_MAX`

AI:

- `AI_PROVIDER`
- `DEFAULT_AI_REQUEST_PROVIDER`
- `AI_API_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`

Retention:

- `AI_DOCUMENT_RETENTION_DAYS`
- `KEEP_LATEST_AI_DOCUMENTS_PER_APPLICATION`

AWS:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `AWS_S3_BUCKET`
- `AWS_S3_PREFIX`
- `AWS_SQS_QUEUE_URL`
- `AWS_AI_ENABLED`
- `AWS_AI_DAILY_LIMIT`
- `AWS_AI_ALLOWED_DOC_TYPES`
- `AWS_STORAGE_REQUIRED`

See `.env.example` for the full reference.

## Database Modes

### PGlite

Default local mode.

- zero external database setup
- data stored under `data/pglite`
- best for local private use and quick onboarding

### PostgreSQL

Recommended for private deployments and multi-process use.

Local Docker flow:

```bash
docker compose up -d
```

Then set:

```text
DB_CLIENT=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/job_tracker
```

Then run:

```bash
npm run migrate
npm run seed
npm start
```

## Scripts

- `npm start`: start the app
- `npm run dev`: start in watch mode
- `npm run migrate`: apply database migrations
- `npm run seed`: load sample data
- `npm run check`: syntax-check main server files
- `npm run test:e2e`: run Playwright tests
- `npm run db:backup`: create a backup bundle
- `npm run db:restore -- /path/to/backup`: restore from a backup bundle
- `npm run cleanup:generated`: preview generated document cleanup
- `npm run cleanup:generated -- --apply`: apply generated document cleanup
- `npm run verify:backup-restore`: verify backup and restore flow

## Coding Conventions

Project-level conventions reflected in the codebase:

- small dependency surface
- native Node.js HTTP instead of Express
- vanilla JS frontend with no build step
- service-oriented backend helpers
- route-level validation before persistence
- relative simplicity over abstraction-heavy patterns

When adding code:

- keep route handlers thin
- move reusable domain logic into `server/services/`
- keep read-heavy query logic in `server/services/readApi.js`
- preserve local-first defaults unless a change explicitly targets deployment infrastructure

## Testing

Current test coverage includes:

- Playwright end-to-end tests in `tests/app.spec.js`
- utility tests in `tests/text.test.js`

Recommended manual checks after feature work:

1. Create and update an application.
2. Upload a CV and verify duplicate protection.
3. Generate at least one AI artifact and open it from the Content tab.
4. Verify version compare, restore, and regenerate flows if documents exist.
5. Switch among list, reminders, kanban, reports, activity, and settings views.
6. Export and import CSV data if relevant to the change.
7. Export a backup from Settings if the change touches storage or document lifecycle.

## Build and Runtime Model

There is no frontend build pipeline.

- static assets are served directly from `public/`
- backend code runs directly from `server/`
- deployment artifacts are the checked-in source plus local runtime data directories

This keeps contributor setup simple and makes production inspection easier.

## Debugging

Common failure cases:

Database connection failure:

- If using PGlite, confirm `DB_CLIENT=pglite`.
- If using PostgreSQL, confirm the database is running and `DATABASE_URL` is correct.

Upload failure:

- confirm `UPLOAD_DIR` exists or can be created
- confirm the app process can write to that directory
- confirm the file is a real PDF or DOCX

AI failure:

- confirm `AI_PROVIDER`
- confirm `AI_API_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` for external providers
- confirm AWS variables only if using queued AWS generation
- if `AI_PROVIDER=mock`, no external key is needed
- if a real provider key is missing, the server should still boot and only the AI request should fail

Missing generated files:

- inspect `uploads/ai`
- inspect retention settings
- inspect storage mode if S3 mirroring is enabled

## Deployment Notes

Private self-hosting expectations:

- use PostgreSQL
- put the app behind a private reverse proxy or trusted network boundary
- use HTTPS for any remote access
- back up both the database and the `uploads/` tree

The app does not include built-in authentication. Public internet exposure without added auth is not acceptable.

## Known Limitations

- no built-in authentication or multi-user model
- no frontend build tooling or component framework
- no real-time collaborative state
- no token streaming UI for AI responses
- AWS generation requires external infrastructure outside this repository
- the current provider normalization favors `mock`, `gemini`, and `aws`
- backup restore replaces current local state and should be tested carefully on non-production data first

## Roadmap Areas

Likely future improvement areas based on the current shape of the project:

- stronger deployment hardening
- broader automated test coverage
- richer AI provider support normalization
- more explicit background job visibility
- deeper document and preparation workflows
