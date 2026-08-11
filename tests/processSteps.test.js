import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

import {
  createProcessStepsService,
  normalizeProcessStepInput,
  summarizeProcessInsights
} from '../server/services/processSteps.js';

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

function row(overrides = {}) {
  return {
    id: 1,
    application_id: 1,
    position: 1,
    step_group: 'screening',
    step_name: 'Screening Call',
    step_state: 'completed',
    event_date: '2026-08-01',
    event_time: null,
    response_state: 'awaiting_response',
    response_detail: null,
    response_date: null,
    follow_up_due_date: null,
    feedback_received: null,
    tracking_state: 'open',
    closure_reason: null,
    closed_at: null,
    contact_name: null,
    notes: null,
    source: 'manual',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides
  };
}

test('summarizeProcessInsights separates events from applications and direct paths', () => {
  const result = summarizeProcessInsights([
    row({ id: 1, application_id: 10, position: 1, step_group: 'screening', step_state: 'completed', response_state: 'advanced' }),
    row({ id: 2, application_id: 10, position: 2, step_group: 'interview', step_state: 'completed', response_state: 'awaiting_response' }),
    row({ id: 3, application_id: 11, position: 1, step_group: 'assessment', step_state: 'completed', response_state: 'advanced' }),
    row({ id: 4, application_id: 11, position: 2, step_group: 'interview', step_state: 'scheduled' })
  ]);

  assert.equal(result.totals.completed_screening_calls, 1);
  assert.equal(result.totals.screened_applications, 1);
  assert.equal(result.paths.screening_to_interview, 1);
  assert.equal(result.paths.direct_to_assessment, 1);
  assert.equal(result.paths.assessment_to_interview, 1);
});

test('normalizeProcessStepInput applies state defaults without converting unknown feedback to false', () => {
  const completed = normalizeProcessStepInput({
    step_group: 'assessment',
    step_name: 'Take home',
    step_state: 'completed',
    event_date: '2026-08-10',
    feedback_received: null
  });
  const scheduled = normalizeProcessStepInput({
    step_group: 'interview',
    step_name: 'L1',
    step_state: 'scheduled',
    event_date: '2026-08-12',
    response_state: 'advanced'
  });
  const cancelled = normalizeProcessStepInput({
    step_group: 'discussion',
    step_name: 'Offer call',
    step_state: 'cancelled',
    event_date: '2026-08-13'
  });

  assert.equal(completed.response_state, 'awaiting_response');
  assert.equal(completed.feedback_received, null);
  assert.equal(scheduled.response_state, 'not_applicable');
  assert.equal(scheduled.tracking_state, 'open');
  assert.equal(cancelled.response_state, 'not_applicable');
  assert.equal(cancelled.tracking_state, 'closed');
  assert.equal(cancelled.closure_reason, 'cancelled');
  assert.ok(cancelled.closed_at);
});

test('normalizeProcessStepInput preserves explicit completed responses on create and transition', () => {
  const created = normalizeProcessStepInput({
    step_group: 'interview',
    step_name: 'L1',
    step_state: 'completed',
    event_date: '2026-08-12',
    response_state: 'advanced'
  });
  const transitioned = normalizeProcessStepInput({
    step_state: 'completed',
    response_state: 'on_hold'
  }, row({ step_state: 'scheduled', response_state: 'not_applicable' }));
  const notApplicable = normalizeProcessStepInput({
    step_group: 'interview',
    step_name: 'L2',
    step_state: 'completed',
    event_date: '2026-08-13',
    response_state: 'not_applicable'
  });

  assert.equal(created.response_state, 'advanced');
  assert.equal(transitioned.response_state, 'on_hold');
  assert.equal(notApplicable.response_state, 'awaiting_response');
});

test('service persists explicit advanced responses on create and update', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date)
    VALUES ('Explicit Response Co', 'https://example.com/explicit-response', 'applied', '2026-08-01')
  `);
  const service = createProcessStepsService({ pool: db, audit: null, logActivity: async () => {} });

  const created = await service.create({}, 1, {
    step_group: 'interview', step_name: 'L1', step_state: 'completed', event_date: '2026-08-10', response_state: 'advanced'
  });
  const awaiting = await service.create({}, 1, {
    step_group: 'interview', step_name: 'L2', step_state: 'completed', event_date: '2026-08-11'
  });
  const updated = await service.update({}, awaiting.id, { response_state: 'advanced' });

  assert.equal(created.response_state, 'advanced');
  assert.equal(updated.response_state, 'advanced');
});

test('summarizeProcessInsights preserves feedback unknowns and calculates median response days', () => {
  const result = summarizeProcessInsights([
    row({ id: 1, application_id: 20, event_date: '2026-08-01', response_date: '2026-08-03', feedback_received: true }),
    row({ id: 2, application_id: 21, event_date: '2026-08-03', response_date: '2026-08-10', feedback_received: false }),
    row({ id: 3, application_id: 22, feedback_received: null })
  ]);

  assert.equal(result.totals.feedback_received, 1);
  assert.equal(result.totals.feedback_not_received, 1);
  assert.equal(result.totals.feedback_unknown, 1);
  assert.equal(result.timing.median_response_days, 4.5);
});

test('summarizeProcessInsights returns grouped conversion rates and outcome timing data', () => {
  const result = summarizeProcessInsights([
    row({ id: 1, application_id: 30, position: 1, step_group: 'screening', step_state: 'completed', response_state: 'advanced', application_status: 'offer' }),
    row({ id: 2, application_id: 30, position: 2, step_group: 'interview', step_state: 'completed', response_state: 'advanced', application_status: 'offer' }),
    row({ id: 3, application_id: 31, position: 1, step_group: 'assessment', step_state: 'completed', response_state: 'no_response', application_status: 'ghosted' }),
    row({ id: 4, application_id: 31, position: 2, step_group: 'interview', step_state: 'scheduled', response_state: 'not_applicable', application_status: 'ghosted' })
  ]);

  assert.deepEqual(result.groups.screening, {
    scheduled: 0,
    completed: 1,
    responded: 1,
    advanced: 1,
    no_response: 0,
    response_rate: 1,
    no_response_rate: 0,
    progression_rate: 1
  });
  assert.equal(result.paths.interview_to_offer, 1);
  assert.deepEqual(result.outcomes.offer, {
    applications: 1,
    average_completed_steps: 2
  });
  assert.deepEqual(result.outcomes.ghosted, {
    applications: 1,
    average_completed_steps: 1
  });
});

test('summarizeProcessInsights excludes completed steps after the recorded outcome', () => {
  const result = summarizeProcessInsights([
    row({ id: 1, application_id: 40, position: 1, step_group: 'screening', step_state: 'completed', event_date: '2026-08-10', application_status: 'offer', outcome_at: '2026-08-12T10:00:00.000Z' }),
    row({ id: 2, application_id: 40, position: 2, step_group: 'interview', step_state: 'completed', event_date: '2026-08-13', application_status: 'offer', outcome_at: '2026-08-12T10:00:00.000Z' })
  ]);

  assert.deepEqual(result.outcomes.offer, {
    applications: 1,
    average_completed_steps: 1
  });
});

test('service insights uses the first terminal status transition as the outcome cutoff', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date)
    VALUES ('Outcome Cutoff Co', 'https://example.com/outcome-cutoff', 'offer', '2026-08-01')
  `);
  await db.query(`
    INSERT INTO status_history (application_id, from_status, to_status, changed_at)
    VALUES (1, 'applied', 'offer', '2026-08-12T10:00:00.000Z')
  `);
  const service = createProcessStepsService({ pool: db, audit: null, logActivity: async () => {} });
  await service.create({}, 1, { step_group: 'screening', step_name: 'Before offer', step_state: 'completed', event_date: '2026-08-10' });
  await service.create({}, 1, { step_group: 'interview', step_name: 'After offer', step_state: 'completed', event_date: '2026-08-13' });

  const result = await service.insights({ mode: 'all', period: 'all' });
  assert.deepEqual(result.outcomes.offer, { applications: 1, average_completed_steps: 1 });
});

test('upcoming process reminders exclude closed applications', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date)
    VALUES
      ('Active Upcoming Co', 'https://example.com/active-upcoming', 'interview_scheduled', CURRENT_DATE),
      ('Closed Upcoming Co', 'https://example.com/closed-upcoming', 'withdrawn', CURRENT_DATE)
  `);
  await db.query(`
    INSERT INTO application_process_steps (
      application_id, position, step_group, step_name, step_state, event_date,
      response_state, tracking_state, source, follow_up_due_date
    )
    VALUES
      (1, 1, 'interview', 'Active L1', 'scheduled', CURRENT_DATE + INTERVAL '1 day',
       'not_applicable', 'open', 'manual', NULL),
      (2, 1, 'interview', 'Closed L1', 'scheduled', CURRENT_DATE + INTERVAL '1 day',
       'not_applicable', 'open', 'manual', NULL),
      (2, 2, 'assessment', 'Closed AI Test', 'completed', CURRENT_DATE - INTERVAL '1 day',
       'awaiting_response', 'open', 'manual', CURRENT_DATE + INTERVAL '1 day')
  `);
  const service = createProcessStepsService({ pool: db, audit: null, logActivity: async () => {} });

  const reminders = await service.upcoming();

  assert.deepEqual(reminders.map((reminder) => reminder.step_name), ['Active L1']);
});

test('normalizeProcessStepInput rejects invalid group, name, date, and closure combinations', () => {
  const invalidInputs = [
    { step_group: 'phone', step_name: 'Screen', step_state: 'scheduled', event_date: '2026-08-10' },
    { step_group: 'screening', step_name: '   ', step_state: 'scheduled', event_date: '2026-08-10' },
    { step_group: 'screening', step_name: 'Screen', step_state: 'scheduled', event_date: 'not-a-date' },
    { step_group: 'screening', step_name: 'Screen', step_state: 'completed', event_date: '2026-08-10', tracking_state: 'closed' }
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => normalizeProcessStepInput(input),
      (error) => error.statusCode === 400
    );
  }
});

test('process-step service mutates only process steps and keeps positions safe during reorder and legacy sync', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date)
    VALUES ('Process Steps Co', 'https://example.com/process-steps', 'applied', '2026-08-01')
  `);

  const activity = [];
  const service = createProcessStepsService({
    pool: db,
    logActivity: async (client, applicationId, action, details) => {
      activity.push({ applicationId, action, details });
      await client.query(
        'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
        [applicationId, action, details]
      );
    },
    audit: {
      log: async (req, event) => {
        await db.query(
          'INSERT INTO audit_events (application_id, target_type, target_id, action, details) VALUES ($1, $2, $3, $4, $5)',
          [event.applicationId, event.targetType, String(event.targetId), event.action, event.details]
        );
      }
    }
  });

  const scheduled = await service.create({}, 1, {
    step_group: 'screening',
    step_name: 'Recruiter Screen',
    step_state: 'scheduled',
    event_date: '2026-08-12'
  });
  const completed = await service.update({}, scheduled.id, { step_state: 'completed' });
  const assessment = await service.create({}, 1, {
    step_group: 'assessment',
    step_name: 'Take home',
    step_state: 'completed',
    event_date: '2026-08-13'
  });

  assert.equal(Object.keys(scheduled).length, 21);
  assert.equal(scheduled.response_state, 'not_applicable');
  assert.equal(completed.response_state, 'awaiting_response');
  assert.equal(assessment.position, 2);

  const reordered = await service.reorder({}, 1, [assessment.id, scheduled.id]);
  assert.deepEqual(reordered.map((step) => [step.id, step.position]), [[assessment.id, 1], [scheduled.id, 2]]);

  const legacy = await service.syncLegacyInterviewStep(db, 1, '2026-08-20');
  const changedLegacy = await service.syncLegacyInterviewStep(db, 1, '2026-08-21');
  assert.equal(legacy.source, 'legacy_interview_date');
  assert.equal(changedLegacy.id, legacy.id);
  assert.equal(changedLegacy.event_date, '2026-08-21');

  await service.syncLegacyInterviewStep(db, 1, null);
  assert.deepEqual((await service.list(1)).map((step) => step.source), ['manual', 'manual']);
  assert.equal(activity.some((entry) => entry.action === 'process_step_reordered'), true);
});

test('clearing a legacy interview date deletes only its scheduled mirror', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date)
    VALUES ('Legacy Isolation Co', 'https://example.com/legacy-isolation', 'applied', '2026-08-01')
  `);
  const service = createProcessStepsService({
    pool: db,
    audit: null,
    logActivity: async () => {}
  });

  await service.syncLegacyInterviewStep(db, 1, '2026-08-20');
  const manual = await service.create({}, 1, {
    step_group: 'assessment',
    step_name: 'Manual assessment',
    step_state: 'scheduled',
    event_date: '2026-08-21'
  });

  await service.syncLegacyInterviewStep(db, 1, null);
  const rows = await service.list(1);
  assert.deepEqual(rows.map((step) => [step.id, step.position, step.source]), [[manual.id, 2, 'manual']]);
});

test('service converts legacy interview mirrors to manual steps on edit', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date)
    VALUES ('Legacy Protection Co', 'https://example.com/legacy-protection', 'applied', '2026-08-01')
  `);
  const service = createProcessStepsService({ pool: db, audit: null, logActivity: async () => {} });
  const legacy = await service.syncLegacyInterviewStep(db, 1, '2026-08-20');

  const updated = await service.update({}, legacy.id, {
    step_group: 'screening',
    step_name: 'Recruiter Screen',
    step_state: 'completed',
    event_date: '2026-08-19',
    response_state: 'advanced'
  });
  assert.equal(updated.source, 'manual');
  assert.equal(updated.step_name, 'Recruiter Screen');
  assert.equal(updated.step_group, 'screening');
  assert.equal(updated.response_state, 'advanced');

  const secondLegacy = await service.syncLegacyInterviewStep(db, 1, '2026-08-20');
  await assert.rejects(
    service.remove({}, secondLegacy.id),
    (error) => error.statusCode === 400
  );
});

test('service rejects legacy interview mirrors in reorder requests', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date)
    VALUES ('Legacy Reorder Co', 'https://example.com/legacy-reorder', 'applied', '2026-08-01')
  `);
  const service = createProcessStepsService({ pool: db, audit: null, logActivity: async () => {} });
  const legacy = await service.syncLegacyInterviewStep(db, 1, '2026-08-20');
  const manual = await service.create({}, 1, {
    step_group: 'assessment', step_name: 'Manual assessment', step_state: 'scheduled', event_date: '2026-08-21'
  });

  await assert.rejects(
    service.reorder({}, 1, [manual.id, legacy.id]),
    (error) => error.statusCode === 400
  );
});

test('service hides legacy interview mirror when a manual step exists on the same date', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date)
    VALUES ('Canonical Process Co', 'https://example.com/canonical-process', 'interview_scheduled', '2026-08-01')
  `);
  const service = createProcessStepsService({ pool: db, audit: null, logActivity: async () => {} });
  await service.syncLegacyInterviewStep(db, 1, '2026-08-13');
  const manual = await service.create({}, 1, {
    step_group: 'interview', step_name: 'L1', step_state: 'scheduled', event_date: '2026-08-13'
  });

  const listed = await service.list(1);
  const summaries = await service.summaries([1]);
  const insights = await service.insights({ mode: 'active', period: 'all' });

  assert.deepEqual(listed.map((step) => [step.id, step.source, step.step_name]), [
    [manual.id, 'manual', 'L1']
  ]);
  assert.equal(summaries[0].total_steps, 1);
  assert.equal(summaries[0].next_scheduled_name, 'L1');
  assert.equal(insights.groups.interview.scheduled, 1);
});

test('upcoming returns manual scheduled steps and open follow-up reminders without legacy duplicates', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date)
    VALUES ('Upcoming Co', 'https://example.com/upcoming', 'applied', '2026-08-01')
  `);
  const service = createProcessStepsService({ pool: db, audit: null, logActivity: async () => {} });
  await service.syncLegacyInterviewStep(db, 1, '2026-08-20');
  const scheduled = await service.create({}, 1, {
    step_group: 'interview', step_name: 'Manual L1', step_state: 'scheduled', event_date: '2026-08-21'
  });
  const completed = await service.create({}, 1, {
    step_group: 'assessment', step_name: 'Submitted test', step_state: 'completed', event_date: '2026-08-19', follow_up_due_date: '2026-08-23'
  });

  const rows = await service.upcoming();
  assert.deepEqual(rows.map((step) => [step.id, step.reminder_type, step.reminder_date]), [
    [scheduled.id, 'scheduled_step', '2026-08-21'],
    [completed.id, 'follow_up', '2026-08-23']
  ]);
});

test('active process insights exclude archived applications even for all-time periods', async (t) => {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query(`
    INSERT INTO applications (company_name, job_link, status, applied_date, archived_at)
    VALUES
      ('Active insights', 'https://example.com/active-insights', 'applied', '2026-08-01', NULL),
      ('Archived insights', 'https://example.com/archived-insights', 'applied', '2026-08-01', now())
  `);
  const service = createProcessStepsService({ pool: db, audit: null, logActivity: async () => {} });
  await service.create({}, 1, { step_group: 'screening', step_name: 'Active screen', step_state: 'completed', event_date: '2026-08-10' });
  await service.create({}, 2, { step_group: 'screening', step_name: 'Archived screen', step_state: 'completed', event_date: '2026-08-10' });

  const result = await service.insights({ mode: 'active', period: 'all' });
  assert.equal(result.totals.completed_screening_calls, 1);
});
