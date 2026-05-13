# Job Application Tracker

Self-hostable job application tracking app with a small dependency surface.

## Security Model

This app is intentionally local-first and does not include authentication.

Run it on `localhost` or behind your own trusted private network only. Do not expose it directly to the public internet unless you add authentication, authorization, rate limiting, and deployment hardening.

Anyone who can access the running app can view, create, edit, delete, export, upload, and download all stored application data and CV files.

AI features are optional. The default `AI_PROVIDER=mock` does not call an external model. If you configure Gemini, an OpenAI-compatible provider, Ollama, or another remote endpoint, the app may send CV text and job descriptions to that provider.

## What This App Does

- Track job applications, status, interview dates, notes, tags, salary, location, recruiter, and contact person.
- Upload and manage CV versions.
- Preserve the exact CV used for each application, even if newer CVs are uploaded later.
- Archive, restore, delete, and view archived entries.
- View reminders in a full month calendar and surface in-app interview and follow-up notifications.
- Use Kanban, reports, CSV import/export, and a searchable activity log.
- Save reusable filter presets for repeated searches.
- Generate AI-assisted tailored CV drafts, cover letters, role-fit analysis, ATS checks, and follow-up emails with stored trace metadata.
- Keep destructive actions in a dedicated audit trail separate from the general activity log.

## Tech Stack

- Backend: Node.js native HTTP server. No Express or heavy backend framework.
- Database: PGlite by default for local use, PostgreSQL for private self-hosting.
- Frontend: Vanilla HTML, CSS, and JavaScript. No frontend build step.
- File storage: Local filesystem through a storage abstraction.
- AI: Optional provider abstraction. Supports mock, OpenAI-compatible endpoints, and Gemini-compatible setup.

Runtime dependencies are intentionally limited: `pg`, `@electric-sql/pglite`, `pdf-parse`, and `jszip`.

## Project Structure

```text
job-application-tracker/
  migrations/        Database migrations
  public/            Frontend files
  sample-data/       Seed data and sample CV
  server/            Backend, services, storage, validation
  uploads/           Uploaded CV files
  data/              Local PGlite data
```

## Architecture Diagram

```mermaid
flowchart LR
  User["User Browser"] --> UI["Vanilla UI<br/>public/index.html<br/>public/js/*"]
  UI --> Server["Node.js HTTP Server<br/>server/index.js"]
  Server --> ReadApi["Read API / Route Layer<br/>server/routes.js<br/>server/services/readApi.js"]
  Server --> AppServices["Application Services<br/>validation, AI input, audit, retention"]
  Server --> Storage["Local File Storage<br/>uploads/cv<br/>uploads/ai"]
  Server --> DB["Database Layer<br/>PGlite or PostgreSQL"]
  AppServices --> AI["AI Provider Adapter<br/>mock / Gemini / OpenAI-compatible"]
  AppServices --> Storage
  AppServices --> DB
  ReadApi --> DB
  Scripts["Ops Scripts<br/>backup / restore / cleanup / verify"] --> DB
  Scripts --> Storage
```

## UML Component View

```mermaid
classDiagram
  class BrowserUI {
    +loadApplications()
    +loadNotifications()
    +openDetail()
    +runAI()
  }

  class ApiRouter {
    +routeApi(req,res,url)
  }

  class ReadApi {
    +getApplications()
    +getApplication()
    +getReports()
    +getActivity()
    +getAudit()
  }

  class RequestGuards {
    +enforceRequestGuards(req,url)
  }

  class ApplicationHelpers {
    +normalizeApplicationInput()
    +resolveApplicationCV()
    +replaceTags()
    +logActivity()
  }

  class AIDocuments {
    +readAIInput()
    +saveAIDocument()
  }

  class AuditService {
    +log()
    +list()
  }

  class RetentionService {
    +cleanupGeneratedAssets()
  }

  class LocalFileStorage {
    +saveCV()
    +saveGeneratedDocx()
    +open()
    +remove()
    +resolveSafe()
  }

  class AIProvider {
    +generateCV()
    +generateCoverLetter()
    +scoreRoleFit()
    +checkATS()
    +generateFollowUpEmail()
  }

  BrowserUI --> ApiRouter
  ApiRouter --> RequestGuards
  ApiRouter --> ReadApi
  ApiRouter --> ApplicationHelpers
  ApiRouter --> AIDocuments
  ApiRouter --> AuditService
  ApiRouter --> RetentionService
  ApplicationHelpers --> LocalFileStorage
  AIDocuments --> LocalFileStorage
  AIDocuments --> AIProvider
```

## Entity Relationship Diagram

```mermaid
erDiagram
  APPLICATIONS ||--o{ APPLICATION_CVS : uses
  CV_VERSIONS ||--o{ APPLICATION_CVS : linked_to
  APPLICATIONS ||--o{ STATUS_HISTORY : has
  APPLICATIONS ||--o{ APPLICATION_NOTES : has
  APPLICATIONS ||--o{ APPLICATION_TAGS : tagged_with
  TAGS ||--o{ APPLICATION_TAGS : maps
  APPLICATIONS ||--o{ AI_DOCUMENTS : generates
  CV_VERSIONS ||--o{ AI_DOCUMENTS : source_cv
  APPLICATIONS ||--o{ ACTIVITY_LOGS : records
  APPLICATIONS ||--o{ AUDIT_EVENTS : audits

  APPLICATIONS {
    bigint id PK
    text company_name
    text job_link
    text job_description
    application_status status
    date applied_date
    date interview_date
    text salary
    text location
    text recruiter
    text contact_person
    text notes
    timestamptz archived_at
    timestamptz created_at
    timestamptz updated_at
  }

  CV_VERSIONS {
    bigint id PK
    text file_path
    text original_name
    text mime_type
    bigint file_size
    text version_label
    boolean is_latest
    text extracted_text
    text file_hash
    timestamptz deleted_at
    timestamptz created_at
  }

  APPLICATION_CVS {
    bigint application_id FK
    bigint cv_id FK
    timestamptz linked_at
  }

  STATUS_HISTORY {
    bigint id PK
    bigint application_id FK
    application_status from_status
    application_status to_status
    timestamptz changed_at
  }

  APPLICATION_NOTES {
    bigint id PK
    bigint application_id FK
    text body
    timestamptz created_at
  }

  TAGS {
    bigint id PK
    text name
  }

  APPLICATION_TAGS {
    bigint application_id FK
    bigint tag_id FK
  }

  AI_DOCUMENTS {
    bigint id PK
    bigint application_id FK
    bigint cv_id FK
    text document_type
    text title
    text content
    text file_path
    text provider_name
    text model_name
    text prompt_excerpt
    text source_context
    timestamptz created_at
  }

  ACTIVITY_LOGS {
    bigint id PK
    bigint application_id FK
    text action
    text details
    timestamptz created_at
  }

  AUDIT_EVENTS {
    bigint id PK
    bigint application_id FK
    text target_type
    text target_id
    text action
    text details
    text actor_ip
    text actor_user_agent
    timestamptz created_at
  }

  SAVED_FILTERS {
    bigint id PK
    text name
    text search
    application_status status
    text tag
    text archived
    timestamptz created_at
    timestamptz updated_at
  }
```

## Request Lifecycle

```mermaid
sequenceDiagram
  participant User
  participant UI as Browser UI
  participant API as Node HTTP Server
  participant Guard as Request Guards
  participant Service as Domain Services
  participant DB as DB
  participant FS as File Storage
  participant AI as AI Provider

  User->>UI: Submit application / request action
  UI->>API: HTTP request
  API->>Guard: body + rate-limit checks
  Guard-->>API: allowed
  API->>Service: validate and execute use case
  Service->>DB: read/write records
  Service->>FS: save/read CV or generated doc
  opt AI feature
    Service->>AI: send CV text + job description
    AI-->>Service: generated content
  end
  Service-->>API: response payload
  API-->>UI: JSON / file download
  UI-->>User: updated screen
```

## Local Setup

Requirements:

- Node.js 20 or newer
- npm
- Docker only if you want PostgreSQL locally

Install:

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

Default local mode uses PGlite:

```text
DB_CLIENT=pglite
PGLITE_DATA_DIR=data/pglite
```

This does not need PostgreSQL running.

## Before Publishing to GitHub

Do not upload the whole folder through the GitHub web UI. Use Git so `.gitignore` is applied.

These local files and folders must not be published:

```text
.env
data/
uploads/
node_modules/
```

Safe publish flow:

```bash
git init
git status --short --ignored
git add .
git status --short
```

Before committing, confirm `git status --short` does not show `.env`, `data/`, `uploads/`, or `node_modules/`.

If a real API key was ever committed, rotate that key immediately before making the repository public.

## Start, Stop, Restart

Start:

```bash
npm start
```

Start in watch mode for development:

```bash
npm run dev
```

Stop when running in the terminal:

```text
Press Ctrl+C
```

Stop a background Node process if needed:

```bash
pkill -f "node server/index.js"
```

Restart:

```bash
pkill -f "node server/index.js" || true
npm start
```

## Database

Run migrations:

```bash
npm run migrate
```

Seed sample data:

```bash
npm run seed
```

Run syntax checks:

```bash
npm run check
```

Run Playwright end to end tests:

```bash
npm run test:e2e
```

Create a backup:

```bash
npm run db:backup
```

Restore from a backup bundle directory:

```bash
npm run db:restore -- /absolute/path/to/backup-directory
```

Preview generated-file cleanup without deleting anything:

```bash
npm run cleanup:generated
```

Apply the cleanup policy:

```bash
npm run cleanup:generated -- --apply
```

### PostgreSQL Local Mode

Start PostgreSQL with Docker:

```bash
docker compose up -d
```

Set `.env`:

```text
DB_CLIENT=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/job_tracker
```

Then:

```bash
npm run migrate
npm run seed
npm start
```

Stop PostgreSQL:

```bash
docker compose down
```

Remove PostgreSQL data too:

```bash
docker compose down -v
```

## Configuration

`.env.example`:

```text
PORT=3000
DB_CLIENT=pglite
PGLITE_DATA_DIR=data/pglite
DATABASE_URL=postgres://postgres:postgres@localhost:5432/job_tracker
UPLOAD_DIR=uploads
MAX_UPLOAD_BYTES=5242880
MAX_JSON_BYTES=262144
MAX_AI_BYTES=131072
GENERAL_RATE_LIMIT_WINDOW_MS=60000
GENERAL_RATE_LIMIT_MAX=120
AI_RATE_LIMIT_WINDOW_MS=60000
AI_RATE_LIMIT_MAX=12
UPLOAD_RATE_LIMIT_WINDOW_MS=60000
UPLOAD_RATE_LIMIT_MAX=10
AI_DOCUMENT_RETENTION_DAYS=60
KEEP_LATEST_AI_DOCUMENTS_PER_APPLICATION=5
AI_PROVIDER=mock
DEFAULT_AI_REQUEST_PROVIDER=gemini
AI_API_BASE_URL=http://localhost:11434/v1
AI_API_KEY=
AI_MODEL=local-model
FILE_STORAGE_MODE=local
AWS_REGION=your-aws-region
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_SESSION_TOKEN=
AWS_S3_BUCKET=your-s3-bucket-name
AWS_S3_PREFIX=job-tracker
AWS_SQS_QUEUE_URL=https://sqs.your-region.amazonaws.com/123456789012/job-tracker-ai
AWS_AI_ENABLED=false
AWS_AI_DAILY_LIMIT=20
AWS_AI_ALLOWED_DOC_TYPES=tailored_cv,cover_letter,role_fit,ats_check,follow_up_email
AWS_STORAGE_REQUIRED=false
```

Use `AI_PROVIDER=mock` if you do not want AI calls.

Gemini example:

```text
AI_PROVIDER=gemini
AI_API_KEY=YOUR_GEMINI_API_KEY
AI_MODEL=gemini-3-flash-preview
```

OpenAI-compatible local provider example:

```text
AI_PROVIDER=openai-compatible
AI_API_BASE_URL=http://localhost:11434/v1
AI_API_KEY=
AI_MODEL=your-local-model
```

Notes:

- CV uploads are limited to verified `PDF` and `DOCX` files and duplicate uploads are rejected by content hash.
- AI routes and upload routes are rate-limited separately from general API traffic.
- AI-generated documents now store provider, model, prompt excerpt, and source context for traceability.
- Backup bundles now include both the database and the `uploads/` tree, so restores recover CVs and generated documents together.
- Destructive actions such as archive, restore, and permanent deletion are written to `audit_events` with actor IP and user agent.
- Generated AI documents can be pruned with the retention script, which also removes orphaned files from `uploads/ai`.
- AWS setup steps and required placeholders are documented in [docs/AWS_SETUP.md](docs/AWS_SETUP.md).

Do not commit `.env`.

## API Summary

Applications:

- `POST /api/applications`
- `GET /api/applications`
- `GET /api/applications/:id`
- `PUT /api/applications/:id`
- `DELETE /api/applications/:id`
- `POST /api/applications/:id/archive`
- `POST /api/applications/:id/restore`
- `POST /api/applications/:id/notes`

CVs:

- `POST /api/cv`
- `GET /api/cv`
- `DELETE /api/cv/:id`
- `GET /api/cv/:id/download`

Other:

- `GET /api/reminders`
- `GET /api/reports`
- `GET /api/activity`
- `GET /api/export/applications.csv`
- `POST /api/import/applications`
- `GET /api/health`

AI:

- `POST /api/ai/generate-cv`
- `POST /api/ai/generate-cover-letter`
- `POST /api/ai/role-fit`
- `POST /api/ai/follow-up-email`

## Private Self-Hosting on VPS or AWS EC2

This section is for private self-hosting only. The app has no built-in authentication. Do not expose it publicly unless you add authentication and harden the deployment.

Use PostgreSQL for private self-hosting. PGlite is useful for local use, but PostgreSQL is safer for server deployment, backups, and multi-process operation.

Recommended private self-hosting pieces:

- Ubuntu 22.04 or 24.04 VPS, AWS EC2, Lightsail, Hetzner, DigitalOcean, etc.
- Node.js 20+
- PostgreSQL 16
- Nginx reverse proxy
- systemd service for the Node app
- HTTPS through Certbot or your load balancer
- Regular database and upload backups

### 1. Install Packages

```bash
sudo apt update
sudo apt install -y git nginx postgresql postgresql-contrib
```

Install Node.js 20 using your preferred source, for example NodeSource or `nvm`.

### 2. Create PostgreSQL Database

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE USER job_tracker WITH PASSWORD 'change_this_password';
CREATE DATABASE job_tracker OWNER job_tracker;
\q
```

### 3. Deploy App Files

```bash
cd /var/www
sudo git clone YOUR_REPO_URL job-application-tracker
sudo chown -R $USER:$USER /var/www/job-application-tracker
cd /var/www/job-application-tracker
npm ci --omit=dev
cp .env.example .env
```

Edit `.env`:

```text
PORT=3000
DB_CLIENT=postgres
DATABASE_URL=postgres://job_tracker:change_this_password@localhost:5432/job_tracker
UPLOAD_DIR=uploads
MAX_UPLOAD_BYTES=5242880
AI_PROVIDER=mock
```

Run migrations:

```bash
npm run migrate
```

Seed only if you want sample data:

```bash
npm run seed
```

### 4. systemd Service

Create:

```bash
sudo nano /etc/systemd/system/job-tracker.service
```

Service file:

```ini
[Unit]
Description=Job Application Tracker
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/var/www/job-application-tracker
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

Permissions:

```bash
sudo chown -R www-data:www-data /var/www/job-application-tracker/uploads /var/www/job-application-tracker/data
```

Start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable job-tracker
sudo systemctl start job-tracker
```

Check logs:

```bash
sudo journalctl -u job-tracker -f
```

Stop:

```bash
sudo systemctl stop job-tracker
```

Restart:

```bash
sudo systemctl restart job-tracker
```

### 5. Nginx Reverse Proxy

Create:

```bash
sudo nano /etc/nginx/sites-available/job-tracker
```

Config:

```nginx
server {
  listen 80;
  server_name your-domain.com;

  client_max_body_size 10m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/job-tracker /etc/nginx/sites-enabled/job-tracker
sudo nginx -t
sudo systemctl reload nginx
```

Add HTTPS:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 6. Backups

Database backup:

```bash
pg_dump "$DATABASE_URL" > job_tracker_$(date +%F).sql
```

Uploads backup:

```bash
tar -czf uploads_$(date +%F).tar.gz uploads/
```

Restore database:

```bash
psql "$DATABASE_URL" < backup.sql
```

## AWS Notes

Simple private AWS setup:

- EC2 Ubuntu instance for the Node app.
- RDS PostgreSQL for the database.
- Security group allows inbound traffic only from trusted IPs, VPN, or a private reverse proxy.
- EC2 can connect outbound to RDS on `5432`.
- Store `.env` on the instance or use AWS Systems Manager Parameter Store.
- Put uploads on the EC2 disk for simplest setup, or replace `LocalFileStorage` with S3 later.

For RDS:

```text
DB_CLIENT=postgres
DATABASE_URL=postgres://USER:PASSWORD@RDS_HOST:5432/job_tracker
```

Run on EC2:

```bash
npm ci --omit=dev
npm run migrate
sudo systemctl restart job-tracker
```

## Troubleshooting

Migration error `ECONNREFUSED 127.0.0.1:5432` means the app is configured for PostgreSQL but PostgreSQL is not reachable.

Fix one of these:

```text
Use DB_CLIENT=pglite for local embedded database.
Start PostgreSQL with docker compose up -d.
Correct DATABASE_URL host, port, username, password, or database name.
```

If uploads fail, check:

```text
UPLOAD_DIR exists.
The app process can write to UPLOAD_DIR.
Nginx client_max_body_size is larger than MAX_UPLOAD_BYTES.
```

If AI fails, check:

```text
AI_PROVIDER
AI_API_BASE_URL
AI_API_KEY
AI_MODEL
```

## Security Notes

- Do not expose this app publicly without adding authentication. No auth is included by design.
- Use HTTPS for any non-local deployment.
- Keep `.env` private.
- Treat uploaded CVs, generated documents, database files, and backups as sensitive personal data.
- Back up PostgreSQL and uploads.
- Limit upload size at both app and reverse proxy levels.
- Run the app as a non-root user.
- Keep Node.js and system packages updated.
