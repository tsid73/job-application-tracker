# Job Application Tracker

Local-first job application tracker for private use. It runs with Node.js, a static vanilla JS frontend, PGlite by default, and local file storage.

## What It Does

- Track applications, statuses, tags, reminders, and interview dates.
- Store CV versions and keep each application linked to the CV used.
- Manage preparation notes, recruiter questions, feedback, and todos.
- Track job boards and company lists for Germany/EU targets.
- Generate optional AI artifacts such as CV drafts, cover letters, ATS checks, role-fit notes, and follow-up emails.
- Export/import CSV and create full local backups.

## Important Security Note

This app has no built-in login. Run it on `localhost` or a trusted private network only. Do not expose it directly to the public internet without adding authentication, TLS, and deployment hardening.

Uploaded CVs, generated documents, backups, and `.env` values can contain private data. Do not commit `.env`, `data/`, `uploads/`, or backup files.

## Requirements

- Node.js 20+
- npm
- Docker only if you want PostgreSQL instead of the default PGlite database

## Quick Start

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm start
```

Open:

```text
http://localhost:3000
```

For development with auto-reload:

```bash
npm run dev
```

## Default Local Setup

The default `.env.example` is local and safe for onboarding:

```text
DB_CLIENT=pglite
FILE_STORAGE_MODE=local
AI_PROVIDER=mock
```

`AI_PROVIDER=mock` avoids external AI calls.

## Common Commands

```bash
npm run migrate      # apply database migrations
npm run seed         # add sample data
npm run check        # syntax-check server entry files
npm run test:e2e     # run Playwright tests
npm run db:backup    # create a database backup
```

## Project Layout

```text
public/       browser app
server/       Node.js API, services, storage, database helpers
migrations/   database schema and seed migrations
docs/         setup, architecture, AI, AWS, and security notes
scripts/      backup, restore, cleanup, and utility scripts
uploads/      local runtime files, ignored except .gitkeep files
data/         local PGlite data, ignored
```

## More Docs

- `docs/DEVELOPMENT.md`: setup, scripts, environment, testing
- `docs/ARCHITECTURE.md`: app structure and data flow
- `docs/AI_WORKFLOW.md`: AI provider behavior
- `docs/AWS_SETUP.md`: optional AWS/S3/SQS setup
- `docs/UI_UX_DECISIONS.md`: UI workflow notes
- `docs/SECURITY_PUBLIC_REPO.md`: public repo and deployment checklist
