# Development

## Setup

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

Open `http://localhost:3000`.

## Environment

Default local mode:

```text
DB_CLIENT=pglite
PGLITE_DATA_DIR=data/pglite
UPLOAD_DIR=uploads
FILE_STORAGE_MODE=local
AI_PROVIDER=mock
```

Use `AI_PROVIDER=mock` for local work when you do not want external AI calls.

For PostgreSQL:

```bash
docker compose up -d
```

Then set:

```text
DB_CLIENT=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/job_tracker
```

## Scripts

- `npm start`: start the app
- `npm run dev`: start with Node watch mode
- `npm run migrate`: apply migrations
- `npm run seed`: load sample data
- `npm run check`: syntax-check main server files
- `npm run test:e2e`: run Playwright tests
- `npm run db:backup`: create a database backup
- `npm run db:restore -- /path/to/backup`: restore a database backup
- `npm run cleanup:generated`: preview generated document cleanup
- `npm run cleanup:generated -- --apply`: apply generated document cleanup

## Testing

Run the smallest useful check after changes:

```bash
npm run check
```

Run browser coverage when UI behavior changes:

```bash
npm run test:e2e
```

## Data To Keep Out Of Git

Do not commit:

- `.env`
- `data/`
- `uploads/`
- backup exports
- local Playwright output
- `node_modules/`

The repository keeps only `.gitkeep` placeholders under `uploads/`.
