# Job Application Tracker

Local-first job application tracking app for private self-hosting. It combines structured application tracking, CV versioning, interview prep, reporting, and optional AI-assisted document generation without requiring a frontend build step or a heavy backend framework.

## Feature Overview

- Track applications with status, role, recruiter, salary, tags, notes, and interview dates.
- Preserve the exact CV linked to each application, even after newer CV uploads.
- Work across list, reminders, kanban, reports, activity, job board, and toolkit views.
- Generate tailored CVs, cover letters, role-fit analyses, ATS checks, and follow-up emails.
- Manage generated documents from a single Content workspace with version history, compare, restore, and artifact export.
- Export and import CSV data, save reusable filters, review activity and audit history, and use Settings for backup and restore.

See [docs/UI_UX_DECISIONS.md](docs/UI_UX_DECISIONS.md) for workflow rationale and intentional UX tradeoffs.

## Tech Stack

- Backend: native Node.js HTTP server
- Frontend: vanilla HTML, CSS, and JavaScript
- Database: PGlite by default, PostgreSQL for private self-hosting
- Storage: local filesystem with optional S3 mirroring
- AI: `mock`, `gemini`, OpenAI-compatible endpoints, and queued AWS generation

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design and storage model.

## Important Notes

- No authentication is included by design in the current version.
- The app is intended for `localhost` or a trusted private network only.
- Local-first behavior is intentional. Data and generated files are stored on disk by default.
- AI is optional. The default provider is safe local mock output, not a real external model call.
- If real AI provider keys are missing, the app still boots and normal non-AI workflows continue. Generation fails per request instead of crashing the process.
- AWS AI generation is disabled by default and runs as a background queue when enabled.
- Generated documents and uploaded CVs should be treated as sensitive personal data.

See [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) for generation behavior and [docs/AWS_SETUP.md](docs/AWS_SETUP.md) for AWS-specific setup.

## Installation

Requirements:

- Node.js 20 or newer
- npm
- Docker only if you want local PostgreSQL instead of PGlite

Install dependencies:

```bash
npm install
```

## Setup

Create your local environment file:

```bash
cp .env.example .env
```

Default local setup uses:

```text
DB_CLIENT=pglite
AI_PROVIDER=mock
FILE_STORAGE_MODE=local
```

This gives you an embedded database, local file storage, and no external AI calls.

Environment details, optional PostgreSQL mode, and all config variables are documented in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Running Locally

Initialize the database and sample data:

```bash
npm run migrate
npm run seed
```

Start the app:

```bash
npm start
```

For auto-reload during development:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Basic Usage Flow

1. Upload one or more CV versions.
2. Create an application and link the relevant CV.
3. Track progress through list, kanban, reminders, and reports.
4. Add notes, preparation items, recruiter questions, and follow-up tasks.
5. Generate AI documents when needed and keep the output attached to the application.
6. Use the Content tab to open, compare, restore, regenerate, and export document artifacts.
7. Use Settings for CSV import/export and full workspace backup/restore.
8. Archive older applications instead of deleting working history.

See [docs/UI_UX_DECISIONS.md](docs/UI_UX_DECISIONS.md) for workspace behavior and [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md) for document generation details.

## Intentional Product Decisions

- No auth: this keeps the app simple for single-user or trusted-network use, but it must not be exposed publicly without added auth and deployment hardening.
- Local-first storage: PGlite plus the local filesystem gives a simple default path for private personal use.
- CV version preservation: applications keep their own CV linkage so later uploads do not rewrite history.
- Separate activity and audit trails: normal workflow history and destructive actions are intentionally tracked separately.
- Background AWS jobs: remote AWS generation is asynchronous by design so the app can queue work without blocking the main request path.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md), and [docs/UI_UX_DECISIONS.md](docs/UI_UX_DECISIONS.md) for the underlying rationale.

## Project Structure

```text
job-application-tracker/
  docs/          Project documentation
  migrations/    Database schema changes
  public/        Frontend files
  sample-data/   Seed data and sample CV
  scripts/       Backup, restore, and cleanup utilities
  server/        HTTP server, routes, services, storage, and validation
  uploads/       Uploaded CVs and generated documents
  data/          Local PGlite data
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): app architecture, state flow, storage model, route structure
- [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md): provider behavior, structured prompt flow, generation lifecycle, AWS queue path
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): setup, scripts, configuration, testing, debugging, deployment notes
- [docs/UI_UX_DECISIONS.md](docs/UI_UX_DECISIONS.md): design philosophy, workflow rationale, intentional UX tradeoffs
- [docs/AWS_SETUP.md](docs/AWS_SETUP.md): optional AWS queue and storage setup

## Development Notes

- Do not commit `.env`, `data/`, `uploads/`, or `node_modules/`.
- Use PostgreSQL for private server deployments.
- Run `npm run check` for syntax checks and `npm run test:e2e` for Playwright coverage.

Contributor setup and troubleshooting live in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## License

MIT
