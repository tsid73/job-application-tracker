# Architecture

## Overview

The app is a server-rendered static frontend plus a JSON API served from the same Node.js process.

- `public/` contains the entire browser app.
- `server/index.js` creates the HTTP server and wires handlers.
- `server/routes.js` maps API routes to handler functions.
- `server/services/` contains domain logic, read models, AI handling, audit logging, and retention behavior.
- `server/storage/` abstracts file persistence.
- `server/db/` selects PGlite or PostgreSQL and applies migrations.

This keeps the dependency surface small and makes local development straightforward.

## Runtime Model

Request flow:

1. The browser loads `public/index.html`.
2. Frontend code in `public/js/` loads application state through JSON endpoints.
3. `server/index.js` enforces request guards, serves static assets, or dispatches API calls.
4. Route handlers validate input, call domain helpers, then persist to the database or storage layer.
5. The UI re-renders from API responses without a frontend build pipeline.

## Frontend Structure

The frontend is organized by responsibility rather than framework conventions.

- `public/js/app.js`: bootstraps the app, route navigation, event binding, async loading
- `public/js/state.js`: shared client state, route state, filters, current view state
- `public/js/render.js`: HTML rendering for workspace views and detail panels
- `public/js/dom.js`: element lookup and workspace binding
- `public/js/utils.js`: browser helpers, API calls, formatting, debounce, date handling

Important frontend behavior:

- The workspace uses route-aware rendering for home, application detail, and document views.
- View switching is local state driven.
- Async loads are split by concern so applications, CVs, reminders, notifications, and job boards can refresh independently.
- The UI prefers direct data refresh after mutations over speculative local state mutation.

## State Management

The client uses a single shared state object in `public/js/state.js`.

Key areas:

- `applications`, `cvs`, `jobBoards`, `savedFilters`
- `currentApplication`, `currentApplicationDocuments`, `currentApplicationJobs`
- `view` and `route`
- `filters`
- `notifications` and `calendarDate`
- `activity`
- `contentWorkspace`

This is intentionally simple. There is no client state library and no component system. The tradeoff is more manual rendering, but the app stays easy to debug.

## API and Read Model Split

`server/index.js` contains write handlers and orchestration.

`server/services/readApi.js` isolates read-heavy queries for:

- reminders
- notifications
- reports
- activity
- audit history
- saved filters
- job boards
- application list and detail payloads
- CV and AI document retrieval

This separation keeps query-heavy endpoints away from mutation-heavy route code.

## Storage Approach

The app stores relational data and file assets separately.

Database:

- Default local mode uses PGlite in `data/pglite`.
- Private multi-process deployments should use PostgreSQL.
- Migrations in `migrations/` define the schema over time.

Files:

- CV uploads are stored in `uploads/cv`.
- Generated AI documents are stored in `uploads/ai`.
- AWS queue manifests are stored in `uploads/ai-jobs`.
- Full backup export serializes database content plus `uploads/` into one portable JSON file.
- `LocalFileStorage` validates file type, sanitizes names, and prevents path traversal.

Optional S3 mirroring:

- `FILE_STORAGE_MODE=dual` keeps local files and attempts to mirror them to S3.
- Local writes still happen first.
- If `AWS_STORAGE_REQUIRED=false`, S3 mirror failure does not block local operation.

## Rendering and Data Refresh Flow

The browser does not maintain a normalized cache.

Instead it follows a simpler pattern:

1. Perform the mutation through the API.
2. Re-fetch the affected slice of data.
3. Re-render the affected view.

This increases some request volume but reduces UI inconsistency and state synchronization bugs.

## Content and Document Lifecycle

CV lifecycle:

1. User uploads a PDF or DOCX CV.
2. The backend validates mime type and file signature.
3. The file is stored locally and hashed.
4. Extracted text is stored for AI workflows.
5. Applications can link to a specific CV version.

AI document lifecycle:

1. The user requests generation from an application or selected CV.
2. The server resolves the CV, job description, and provider choice.
3. Generated content is persisted in `ai_documents`.
4. A DOCX file is created and stored under `uploads/ai`.
5. Previous output can be regenerated without losing trace metadata.
6. Application-level artifact export packages generated outputs into a zip archive.

See `AI_WORKFLOW.md` for provider-specific detail.

## Tab and Workspace Isolation

The UI is intentionally split into separate workspace views:

- list
- reminders
- kanban
- reports
- activity
- boards
- toolkit
- settings

Each view owns its own rendering surface and loads only the data it needs. This prevents one busy screen from forcing a full application redraw and keeps mental context stable while switching workflows.

The `settings` workspace centralizes operational actions such as CSV import/export and full backup/restore so those actions do not compete with day-to-day tracking controls.

## Async Generation Architecture

There are two generation paths:

- synchronous generation for `mock` and `gemini`
- queued generation for `aws`

Synchronous providers return content during the request.

AWS requests create a persisted job record, write a request manifest, send a queue message, and later sync the result back into a normal AI document record. This preserves a consistent document model regardless of provider.

The synchronous prompt path is intentionally single-pass. Local text extraction creates structured context first, then one model request is made per artifact.

## Audit and Activity Design

The app intentionally separates:

- `activity_logs` for normal workflow history
- `audit_events` for destructive or security-relevant actions

This avoids burying archive, restore, and delete actions inside general activity noise.

## Security Boundaries

Important assumptions:

- There is no built-in authentication or authorization layer.
- The app is safe only on `localhost` or a trusted private network unless you add your own auth and hardening.
- Uploaded CVs, generated documents, and backups are sensitive.
- Request guard limits exist, but they are not a substitute for perimeter security.
