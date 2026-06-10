# Job Application Tracker

Local-first job application tracker for private use. It runs with Node.js, a static vanilla JS frontend, PGlite by default, and local file storage.

## What It Does

- Track applications, statuses, tags, reminders, interview dates, next actions, and due dates.
- Store CV versions and keep each application linked to the CV used.
- Manage preparation notes, recruiter questions, feedback, and todos.
- Use the Today view to review due next actions, upcoming interviews, stale applications, and priority reminders.
- Track job boards and company lists for Germany/EU targets.
- Generate optional AI artifacts such as CV drafts, cover letters, ATS checks, role-fit notes, and follow-up emails.
- Export/import CSV and create full local backups.
- Export interview dates and next-action due dates as an `.ics` calendar file.
- Review your funnel in the Stats view: interview/offer rates, response rate, time in stage, and interview rate by tag.
- Select multiple applications for bulk archive, restore, or delete.

## Important Security Note

This app has no built-in login. By default the server binds to `127.0.0.1` and is only reachable from your own machine. Set `HOST=0.0.0.0` in `.env` only if you understand the risk: anyone who can reach the port can read and modify all data. Do not expose it directly to the public internet without adding authentication, TLS, and deployment hardening. If you run it behind a reverse proxy, set `TRUST_PROXY=true` so rate limiting uses the forwarded client address.

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
