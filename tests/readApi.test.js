import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createReadApi } from '../server/services/readApi.js';

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'migrations');

async function createDatabase() {
  const db = new PGlite();
  const files = (await readdir(migrationsDir))
    .filter((file) => /^0(?:0[1-9]|1[0-8])_.*\.sql$/.test(file))
    .sort();
  for (const file of files) {
    await db.exec(await readFile(path.join(migrationsDir, file), 'utf8'));
  }
  return db;
}

test('getNotifications excludes follow-up and todo reminders', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("'interview' AS type")) {
        return { rows: [{ id: 1, type: 'interview', due_date: '2026-08-02' }] };
      }
      if (sql.includes("'follow_up' AS type")) {
        return { rows: [{ id: 2, type: 'follow_up', due_date: '2026-08-03' }] };
      }
      if (sql.includes("'todo' AS type")) {
        return { rows: [{ id: 3, type: 'todo', due_date: '2026-08-04' }] };
      }
      if (sql.includes("'next_action' AS type")) {
        return { rows: [{ id: 4, type: 'next_action', due_date: '2026-08-05' }] };
      }
      return { rows: [] };
    },
  };

  const readApi = createReadApi({ pool, audit: {} });
  const result = await readApi.getNotifications();

  assert.deepEqual(
    result.notifications.map((notification) => notification.type),
    ['interview', 'next_action'],
  );
});

test('getNotifications suppresses legacy interview reminder after matching process step is completed', async () => {
  const db = await createDatabase();
  const readApi = createReadApi({ pool: db, audit: {} });

  const created = await db.query(
    `INSERT INTO applications (company_name, job_link, status, applied_date, interview_date)
     VALUES ('Mobile Programming LLC', 'https://example.com/mobile', 'interview_scheduled', '2026-08-06', '2026-08-08')
     RETURNING id`,
  );
  const applicationId = created.rows[0].id;
  await db.query(
    `INSERT INTO application_process_steps (
       application_id, position, step_group, step_name, step_state, event_date,
       response_state, tracking_state, source
     )
     VALUES ($1, 1, 'interview', 'Interview', 'completed', '2026-08-08',
       'awaiting_response', 'open', 'manual')`,
    [applicationId],
  );

  const result = await readApi.getNotifications();

  assert.deepEqual(result.notifications, []);
});
