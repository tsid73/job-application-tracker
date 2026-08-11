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
  await db.query('DELETE FROM application_process_steps');
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

test('getNotifications returns scheduled manual process steps without an application interview date', async () => {
  const db = await createDatabase();
  await db.query('DELETE FROM application_process_steps');
  const readApi = createReadApi({ pool: db, audit: {} });

  const created = await db.query(
    `INSERT INTO applications (company_name, job_link, status, applied_date)
     VALUES ('Deloitte', 'https://example.com/deloitte', 'interview_scheduled', '2026-08-06')
     RETURNING id`,
  );
  const applicationId = created.rows[0].id;
  await db.query(
    `INSERT INTO application_process_steps (
       application_id, position, step_group, step_name, step_state, event_date,
       response_state, tracking_state, source
     )
     VALUES ($1, 1, 'assessment', 'AI Test', 'scheduled', CURRENT_DATE + INTERVAL '2 days',
       'not_applicable', 'open', 'manual')`,
    [applicationId],
  );

  const result = await readApi.getNotifications();

  assert.deepEqual(
    result.notifications.map((notification) => [notification.type, notification.message]),
    [['process_step', 'AI Test scheduled']],
  );
});

test('getReminders suppresses legacy interview event when a manual process step exists on the same date', async () => {
  const db = await createDatabase();
  await db.query('DELETE FROM application_process_steps');
  const readApi = createReadApi({ pool: db, audit: {} });

  const created = await db.query(
    `INSERT INTO applications (company_name, job_link, status, applied_date, interview_date)
     VALUES ('Wipro', 'https://example.com/wipro', 'interview_scheduled', '2026-08-06', '2026-08-13')
     RETURNING id`,
  );
  const applicationId = created.rows[0].id;
  await db.query(
    `INSERT INTO application_process_steps (
       application_id, position, step_group, step_name, step_state, event_date,
       response_state, tracking_state, source
     )
     VALUES ($1, 2, 'interview', 'L1', 'scheduled', '2026-08-13',
       'not_applicable', 'open', 'manual')`,
    [applicationId],
  );

  const result = await readApi.getReminders();

  assert.equal(result.reminders.some((reminder) => reminder.type === 'interview'), false);
});

test('getReminders returns completed and scheduled manual process steps as timeline events', async () => {
  const db = await createDatabase();
  await db.query('DELETE FROM application_process_steps');
  const readApi = createReadApi({ pool: db, audit: {} });

  const created = await db.query(
    `INSERT INTO applications (company_name, job_link, status, applied_date, interview_date)
     VALUES ('Mobile Programming LLC', 'https://example.com/mobile-process', 'interview_scheduled', '2026-08-06', '2026-08-08')
     RETURNING id`,
  );
  const applicationId = created.rows[0].id;
  await db.query(
    `INSERT INTO application_process_steps (
       application_id, position, step_group, step_name, step_state, event_date,
       response_state, tracking_state, source
     )
     VALUES
       ($1, 1, 'assessment', 'AI Test', 'completed', '2026-08-08',
        'advanced', 'open', 'manual'),
       ($1, 2, 'discussion', 'HR Call', 'scheduled', '2026-08-13',
        'not_applicable', 'open', 'manual')`,
    [applicationId],
  );

  const result = await readApi.getReminders();

  assert.equal(result.reminders.some((reminder) => reminder.type === 'interview'), false);
  assert.deepEqual(
    result.reminders
      .filter((reminder) => reminder.type === 'process_step')
      .map((reminder) => [reminder.event_date, reminder.details]),
    [
      ['2026-08-08', 'AI Test (Completed)'],
      ['2026-08-13', 'HR Call (Scheduled)'],
    ],
  );
});

test('closed applications stop active reminders but keep process and closure history', async () => {
  const db = await createDatabase();
  await db.query('DELETE FROM application_process_steps');
  const readApi = createReadApi({ pool: db, audit: {} });

  const created = await db.query(
    `INSERT INTO applications (company_name, job_link, status, applied_date)
     VALUES ('Closed Process Co', 'https://example.com/closed-process', 'withdrawn', CURRENT_DATE - INTERVAL '5 days')
     RETURNING id`,
  );
  const applicationId = created.rows[0].id;
  await db.query(
    `INSERT INTO status_history (application_id, from_status, to_status, changed_at)
     VALUES ($1, 'interview_scheduled', 'withdrawn', NOW())`,
    [applicationId],
  );
  await db.query(
    `INSERT INTO application_process_steps (
       application_id, position, step_group, step_name, step_state, event_date,
       response_state, tracking_state, source
     )
     VALUES
       ($1, 1, 'assessment', 'Closed AI Test', 'completed', CURRENT_DATE - INTERVAL '2 days',
        'advanced', 'open', 'manual'),
       ($1, 2, 'discussion', 'Closed HR Call', 'scheduled', CURRENT_DATE + INTERVAL '2 days',
        'not_applicable', 'open', 'manual')`,
    [applicationId],
  );

  const [notifications, timeline] = await Promise.all([
    readApi.getNotifications(),
    readApi.getReminders(),
  ]);

  assert.deepEqual(notifications.notifications, []);
  assert.equal(timeline.reminders.some((reminder) => reminder.details === 'Closed HR Call (Scheduled)'), false);
  assert.equal(timeline.reminders.some((reminder) => reminder.details === 'Closed AI Test (Completed)'), true);
  assert.equal(timeline.reminders.some((reminder) => reminder.type === 'status_change_withdrawn'), true);
});
