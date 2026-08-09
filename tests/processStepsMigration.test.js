import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const rootDir = process.cwd();
const migrationsDir = path.join(rootDir, 'migrations');
const migration018 = path.join(migrationsDir, '018_application_process_steps.sql');

async function applyMigrationsThrough017(db) {
  const files = (await readdir(migrationsDir))
    .filter((file) => /^0(?:0[1-9]|1[0-7])_.*\.sql$/.test(file))
    .sort();

  for (const file of files) {
    await db.exec(await readFile(path.join(migrationsDir, file), 'utf8'));
  }
}

test('migration 018 preserves applications and mirrors only current interview dates', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await applyMigrationsThrough017(db);

  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date, interview_date)
    VALUES
      ('Interview Date Co', 'https://example.com/interview-date', 'interview_scheduled', '2026-08-01', '2026-08-12'),
      ('No Interview Date Co', 'https://example.com/no-interview-date', 'applied', '2026-08-02', NULL)
  `);

  const before = await db.query('SELECT * FROM applications ORDER BY id');
  await db.exec(await readFile(migration018, 'utf8'));
  const after = await db.query('SELECT * FROM applications ORDER BY id');
  const indexes = await db.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE tablename = 'application_process_steps'
    ORDER BY indexname
  `);
  const steps = await db.query(`
    SELECT application_id, position, step_group, step_state, event_date::text, source
    FROM application_process_steps
    ORDER BY application_id
  `);

  assert.deepEqual(after.rows, before.rows);
  assert.deepEqual(steps.rows, [{
    application_id: 1,
    position: 1,
    step_group: 'interview',
    step_state: 'scheduled',
    event_date: '2026-08-12',
    source: 'legacy_interview_date'
  }]);
  assert.equal(indexes.rows.some((index) => index.indexname === 'application_process_steps_application_date_idx'), true);
  assert.equal(indexes.rows.some((index) => index.indexname === 'application_process_steps_open_follow_up_idx'), true);
  assert.equal(indexes.rows.some((index) => index.indexname === 'application_process_steps_open_scheduled_idx'), true);
  assert.equal(indexes.rows.some((index) => index.indexname === 'application_process_steps_one_scheduled_legacy_idx'), true);

  await db.query(`
    UPDATE application_process_steps
    SET step_name = 'Updated Interview', updated_at = '2000-01-01T00:00:00.000Z'
    WHERE application_id = 1
  `);
  const updated = await db.query('SELECT step_name, updated_at FROM application_process_steps WHERE application_id = 1');
  assert.equal(updated.rows[0].step_name, 'Updated Interview');
  assert.notEqual(String(updated.rows[0].updated_at), '2000-01-01T00:00:00.000Z');

  await assert.rejects(
    db.query(`
      INSERT INTO application_process_steps (
        application_id, position, step_group, step_name, step_state, event_date,
        response_state, tracking_state, source
      ) VALUES (1, 2, 'interview', 'Duplicate legacy', 'scheduled', '2026-08-13', 'not_applicable', 'open', 'legacy_interview_date')
    `),
    /duplicate key|unique/i
  );
});
