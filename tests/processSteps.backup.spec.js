import { test, expect } from '@playwright/test';

function application(id, interviewDate = null) {
  return {
    id,
    company_name: `Backup Process ${id}`,
    company_category: 'Backup',
    role_title: 'Backend Engineer',
    job_link: `https://example.com/backup-process-${id}`,
    job_description: 'Backup restore fixture.',
    status: interviewDate ? 'interview_scheduled' : 'applied',
    applied_date: '2026-08-01',
    interview_date: interviewDate,
    notes: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    archived_at: null,
    salary: null,
    location: 'Remote',
    recruiter: null,
    contact_person: null,
    next_action: null,
    next_action_due_date: null
  };
}

async function restoreBackup(request, backup) {
  return request.post('/api/import/backup', {
    multipart: {
      backup: {
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backup), 'utf8')
      }
    }
  });
}

async function fullV2Data(overrides = {}) {
  return {
    applications: [],
    application_process_steps: [],
    cv_versions: [],
    application_cvs: [],
    status_history: [],
    application_notes: [],
    tags: [],
    application_tags: [],
    ai_documents: [],
    ai_generation_jobs: [],
    activity_logs: [],
    saved_filters: [],
    selected_tag_reports: [],
    selected_chart_tags: [],
    audit_events: [],
    application_preparation: [],
    recruiter_questions: [],
    hiring_feedback: [],
    application_todos: [],
    job_boards: [],
    target_companies: [],
    research_sources: [],
    job_context_snapshots: [],
    knowledge_chunks: [],
    retrieval_runs: [],
    agent_runs: [],
    agent_steps: [],
    pending_agent_actions: [],
    ...overrides
  };
}

test('v1 backup restore backfills legacy interview dates and keeps process sequence usable', async ({ request }) => {
  const restore = await restoreBackup(request, {
    version: 1,
    data: {
      applications: [application(9201, '2026-08-20')]
    },
    files: []
  });
  expect(restore.status()).toBe(200);

  const backfilled = await request.get('/api/applications/9201/process-steps');
  expect(backfilled.status()).toBe(200);
  expect((await backfilled.json()).process_steps).toEqual([
    expect.objectContaining({
      id: 1,
      application_id: 9201,
      position: 1,
      step_group: 'interview',
      step_name: 'Interview',
      step_state: 'scheduled',
      event_date: '2026-08-20',
      source: 'legacy_interview_date'
    })
  ]);

  const created = await request.post('/api/applications/9201/process-steps', {
    data: {
      step_group: 'interview',
      step_name: 'Second round',
      step_state: 'scheduled',
      event_date: '2026-08-22'
    }
  });
  expect(created.status()).toBe(201);
  expect((await created.json()).process_step).toMatchObject({ id: 2, position: 2 });
});

test('v2 export includes process steps and staged agent workflow tables', async ({ request }) => {
  const restore = await restoreBackup(request, {
    version: 2,
    data: await fullV2Data({
      applications: [application(9202)],
      application_process_steps: [{
        id: 15,
        application_id: 9202,
        position: 1,
        step_group: 'assessment',
        step_name: 'Pre-screening AI Test',
        step_state: 'completed',
        event_date: '2026-08-21',
        event_time: null,
        response_state: 'advanced',
        response_detail: null,
        response_date: '2026-08-22',
        follow_up_due_date: null,
        feedback_received: false,
        tracking_state: 'closed',
        closure_reason: 'advanced',
        closed_at: '2026-08-22T00:00:00.000Z',
        contact_name: null,
        notes: 'Advanced to interview.',
        source: 'manual',
        created_at: '2026-08-21T00:00:00.000Z',
        updated_at: '2026-08-22T00:00:00.000Z'
      }],
      research_sources: [{
        id: 1,
        application_id: 9202,
        source_type: 'manual_note',
        url: null,
        title: 'Source',
        content: 'Research content',
        confidence: 70,
        warnings: null,
        extracted_at: '2026-08-21T00:00:00.000Z',
        created_at: '2026-08-21T00:00:00.000Z'
      }]
    }),
    files: []
  });
  expect(restore.status()).toBe(200);

  const exported = await request.get('/api/export/backup');
  expect(exported.status()).toBe(200);
  const backup = await exported.json();
  expect(backup.version).toBe(2);
  expect(Object.keys(backup.data).sort()).toEqual(Object.keys(await fullV2Data()).sort());
  expect(backup.data.application_process_steps).toEqual([
    expect.objectContaining({ id: 15, application_id: 9202, step_name: 'Pre-screening AI Test' })
  ]);
  expect(backup.data.research_sources).toEqual([
    expect.objectContaining({ id: 1, application_id: 9202, source_type: 'manual_note' })
  ]);
});

test('v2 explicit empty process steps does not backfill interview date mirrors', async ({ request }) => {
  const restore = await restoreBackup(request, {
    version: 2,
    data: await fullV2Data({
      applications: [application(9203, '2026-08-23')],
      application_process_steps: []
    }),
    files: []
  });
  expect(restore.status()).toBe(200);

  const steps = await request.get('/api/applications/9203/process-steps');
  expect(steps.status()).toBe(200);
  expect((await steps.json()).process_steps).toEqual([]);
});

test('backup restore rejects unsupported tables and row shapes before restore', async ({ request }) => {
  const restore = await restoreBackup(request, {
    version: 1,
    data: {
      applications: [application(9204)],
      unsupported_table: []
    },
    files: []
  });
  expect(restore.status()).toBe(400);

  const malformed = await restoreBackup(request, {
    version: 1,
    data: {
      applications: [null]
    },
    files: []
  });
  expect(malformed.status()).toBe(400);
});
