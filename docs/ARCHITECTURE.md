# Architecture

## Runtime Shape

The app is one Node.js HTTP server that serves both:

- static frontend files from `public/`
- JSON API routes from `server/`

There is no frontend build step.

## Main Parts

- `public/index.html`: app shell and dialogs
- `public/js/app.js`: client boot, routing, event binding, API calls
- `public/js/render.js`: HTML rendering for views and detail pages
- `public/js/state.js`: shared browser state
- `server/index.js`: HTTP server and write handlers
- `server/routes.js`: API route map
- `server/services/readApi.js`: read-heavy API payloads
- `server/storage/localFileStorage.js`: CV, document, and manifest file storage
- `server/db/`: database selection and migration runner

## Data Storage

Default local storage:

- PGlite database under `data/pglite`
- uploaded CVs under `uploads/cv`
- AI documents under `uploads/ai`
- AWS job manifests under `uploads/ai-jobs`

PostgreSQL is supported for private deployments by setting `DB_CLIENT=postgres`.

## Main Workflows

Application tracking:

1. Create an application.
2. Link a CV version.
3. Track status, reminders, notes, preparation, questions, feedback, and todos.
4. Archive old applications instead of deleting history.

Sourcing:

1. Use `Job Boards` for boards and search channels.
2. Use `Company List` for Germany/EU target companies and career links.
3. Mark sources checked so stale sources are visible.

AI artifacts:

1. Resolve application, CV, and job description.
2. Generate or queue output.
3. Save metadata and a DOCX artifact.
4. Show outputs in the application content workspace.

## Security Boundaries

- No built-in authentication or authorization.
- Runtime files contain sensitive personal data.
- Static files are served only from `public/`.
- Uploaded file reads are constrained to `uploads/`.
- API request size and rate guards are present, but they are not a replacement for private-network deployment.
