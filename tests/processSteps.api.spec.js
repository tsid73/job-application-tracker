import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const sampleCvPath = path.resolve(process.cwd(), 'sample-data', 'sample-cv.pdf');

async function createApplication(request, suffix, status = 'applied') {
  const cv = await request.post('/api/cv', {
    multipart: {
      version_label: `Process API ${suffix}`,
      is_latest: 'true',
      cv: { name: 'sample-cv.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(sampleCvPath) }
    }
  });
  expect([201, 409]).toContain(cv.status());
  const cvPayload = cv.status() === 201 ? await cv.json() : null;
  const response = await request.post('/api/applications', {
    data: {
      company_name: `Process API ${suffix}`,
      role_title: 'Backend Engineer',
      job_link: `https://example.com/process-${suffix}`,
      job_description: 'Process API regression fixture.',
      status,
      applied_date: '2026-08-01',
      ...(cvPayload ? { cv_id: cvPayload.cv.id } : {})
    }
  });
  expect(response.status()).toBe(200);
  return (await response.json()).application.id;
}

async function applicationSnapshot(request, applicationId) {
  const response = await request.get(`/api/applications/${applicationId}`);
  expect(response.status()).toBe(200);
  const payload = await response.json();
  return {
    status: payload.application.status,
    interview_date: payload.application.interview_date,
    archived_at: payload.application.archived_at,
    status_history: payload.status_history
  };
}

test('process routes support lifecycle mutations without changing application lifecycle data', async ({ request }) => {
  const applicationId = await createApplication(request, 'lifecycle');
  const before = await applicationSnapshot(request, applicationId);
  const assertUnchanged = async () => expect(await applicationSnapshot(request, applicationId)).toEqual(before);
  const steps = [];
  const inputs = [
    ['assessment', 'Pre-screening AI Test', 'completed'],
    ['interview', 'L1', 'scheduled'],
    ['interview', 'L2', 'scheduled'],
    ['screening', 'Recruiter Screen', 'scheduled'],
    ['discussion', 'Compensation Call', 'scheduled'],
    ['assessment', 'Take home', 'scheduled'],
    ['interview', 'Final Interview', 'scheduled']
  ];

  for (const [step_group, step_name, step_state] of inputs) {
    const response = await request.post(`/api/applications/${applicationId}/process-steps`, {
      data: { step_group, step_name, step_state, event_date: '2026-08-10' }
    });
    expect(response.status()).toBe(201);
    const payload = await response.json();
    steps.push(payload.process_step);
    await assertUnchanged();
  }
  expect(steps[0]).toMatchObject({ position: 1, step_group: 'assessment', step_name: 'Pre-screening AI Test', response_state: 'awaiting_response', tracking_state: 'open' });

  expect((await request.put(`/api/process-steps/${steps[1].id}`, { data: { step_state: 'completed', response_state: 'on_hold' } })).status()).toBe(200); await assertUnchanged();
  expect((await request.put(`/api/process-steps/${steps[2].id}`, { data: { step_state: 'completed', response_state: 'no_response', tracking_state: 'closed', closure_reason: 'no_response' } })).status()).toBe(200); await assertUnchanged();
  expect((await request.put(`/api/process-steps/${steps[2].id}`, { data: { tracking_state: 'open', response_state: 'advanced' } })).status()).toBe(200); await assertUnchanged();
  expect((await request.put(`/api/process-steps/${steps[3].id}`, { data: { event_date: '2026-08-15' } })).status()).toBe(200); await assertUnchanged();
  expect((await request.put(`/api/process-steps/${steps[4].id}`, { data: { step_state: 'cancelled' } })).status()).toBe(200); await assertUnchanged();
  expect((await request.put(`/api/applications/${applicationId}/process-steps/order`, { data: { ordered_ids: steps.map((step) => step.id).reverse() } })).status()).toBe(200); await assertUnchanged();
  const deleted = await request.delete(`/api/process-steps/${steps[6].id}`);
  expect(deleted.status()).toBe(200);
  expect((await deleted.json()).process_step).toMatchObject({ id: steps[6].id, step_name: 'Final Interview' });
  await assertUnchanged();

  const listed = await request.get(`/api/applications/${applicationId}/process-steps`);
  expect(listed.status()).toBe(200);
  expect((await listed.json()).process_steps).toHaveLength(6);
  expect(Object.keys(await (await request.get('/api/process-steps/upcoming')).json())).toEqual(['reminders']);
  expect(Object.keys(await (await request.get(`/api/process-steps/summaries?application_ids=${applicationId}`)).json())).toEqual(['summaries']);
  expect((await request.get('/api/process-insights')).status()).toBe(200);

  const invalid = await request.post(`/api/applications/${applicationId}/process-steps`, { data: { step_group: 'invalid' } });
  expect(invalid.status()).toBe(400);
});

test('process routes allow old rejected and archived applications and application deletion cascades', async ({ request }) => {
  const rejectedId = await createApplication(request, 'rejected');
  expect((await request.put(`/api/applications/${rejectedId}`, { data: { status: 'rejected' } })).status()).toBe(200);
  expect((await request.post(`/api/applications/${rejectedId}/process-steps`, { data: { step_group: 'interview', step_name: 'Historical interview', step_state: 'completed', event_date: '2026-08-02' } })).status()).toBe(201);

  const archivedId = await createApplication(request, 'archived');
  expect((await request.post(`/api/applications/${archivedId}/archive`)).status()).toBe(200);
  expect((await request.post(`/api/applications/${archivedId}/process-steps`, { data: { step_group: 'assessment', step_name: 'Archived assessment', step_state: 'completed', event_date: '2026-08-02' } })).status()).toBe(201);

  const deletedId = await createApplication(request, 'deleted');
  expect((await request.post(`/api/applications/${deletedId}/process-steps`, { data: { step_group: 'interview', step_name: 'Delete cascade', step_state: 'scheduled', event_date: '2026-08-03' } })).status()).toBe(201);
  expect((await request.delete(`/api/applications/${deletedId}`)).status()).toBe(200);
  expect((await request.get(`/api/applications/${deletedId}/process-steps`)).status()).toBe(404);
});

test('legacy interview dates from application create and CSV import receive derived mirrors', async ({ request }) => {
  const cv = await request.post('/api/cv', {
    multipart: {
      version_label: 'Process API legacy dates',
      is_latest: 'true',
      cv: { name: 'sample-cv.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(sampleCvPath) }
    }
  });
  expect([201, 409]).toContain(cv.status());
  const cvPayload = cv.status() === 201 ? await cv.json() : null;
  const created = await request.post('/api/applications', {
    data: {
      company_name: 'Legacy create mirror', job_link: 'https://example.com/legacy-create', job_description: 'Legacy create fixture.',
      status: 'interview_scheduled', applied_date: '2026-08-01', interview_date: '2026-08-12', ...(cvPayload ? { cv_id: cvPayload.cv.id } : {})
    }
  });
  expect(created.status()).toBe(200);
  const createdId = (await created.json()).application.id;
  expect((await (await request.get(`/api/applications/${createdId}/process-steps`)).json()).process_steps[0]).toMatchObject({ source: 'legacy_interview_date', event_date: '2026-08-12' });

  const csv = [
    'company_name,job_link,job_description,status,applied_date,interview_date',
    'Legacy CSV mirror,https://example.com/legacy-csv,Legacy CSV fixture,interview_scheduled,2026-08-01,2026-08-13'
  ].join('\n');
  const imported = await request.post('/api/import/applications', {
    multipart: { csv: { name: 'legacy.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') } }
  });
  expect(imported.status()).toBe(201);
  const lookup = await request.get('/api/applications/lookup', { params: { company_name: 'Legacy CSV mirror' } });
  const csvId = (await lookup.json()).applications[0].id;
  expect((await (await request.get(`/api/applications/${csvId}/process-steps`)).json()).process_steps[0]).toMatchObject({ source: 'legacy_interview_date', event_date: '2026-08-13' });
});

test('legacy interview date mirror can be edited into a manual process step', async ({ request }) => {
  const cv = await request.post('/api/cv', {
    multipart: {
      version_label: 'Process API editable legacy date',
      is_latest: 'true',
      cv: { name: 'sample-cv.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(sampleCvPath) }
    }
  });
  expect([201, 409]).toContain(cv.status());
  const cvPayload = cv.status() === 201 ? await cv.json() : null;
  const created = await request.post('/api/applications', {
    data: {
      company_name: `Legacy editable mirror ${Date.now()}`,
      job_link: `https://example.com/legacy-editable-${Date.now()}`,
      job_description: 'Legacy editable mirror fixture.',
      status: 'interview_scheduled',
      applied_date: '2026-08-01',
      interview_date: '2026-08-12',
      ...(cvPayload ? { cv_id: cvPayload.cv.id } : {})
    }
  });
  expect(created.status()).toBe(200);
  const applicationId = (await created.json()).application.id;
  const stepsBefore = await (await request.get(`/api/applications/${applicationId}/process-steps`)).json();
  const legacyStep = stepsBefore.process_steps[0];
  expect(legacyStep).toMatchObject({ source: 'legacy_interview_date', step_name: 'Interview' });

  const edited = await request.put(`/api/process-steps/${legacyStep.id}`, {
    data: {
      step_group: 'screening',
      step_name: 'Recruiter Call',
      step_state: 'completed',
      event_date: '2026-08-09',
      response_state: 'advanced',
      feedback_received: true
    }
  });
  expect(edited.status()).toBe(200);
  expect((await edited.json()).process_step).toMatchObject({
    id: legacyStep.id,
    source: 'manual',
    step_group: 'screening',
    step_name: 'Recruiter Call',
    step_state: 'completed',
    event_date: '2026-08-09',
    response_state: 'advanced',
    feedback_received: true
  });

  const deleted = await request.delete(`/api/process-steps/${legacyStep.id}`);
  expect(deleted.status()).toBe(200);
  expect((await (await request.get(`/api/applications/${applicationId}/process-steps`)).json()).process_steps).toHaveLength(0);
});
