import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const sampleCvPath = path.resolve(process.cwd(), 'sample-data', 'sample-cv.pdf');

test('application REST API supports workflow CRUD and lookup', async ({ request }) => {
  const cvResponse = await request.post('/api/cv', {
    multipart: {
      version_label: 'API workflow test CV',
      is_latest: 'true',
      cv: {
        name: 'sample-cv.pdf',
        mimeType: 'application/pdf',
        buffer: fs.readFileSync(sampleCvPath)
      }
    }
  });
  expect(cvResponse.status()).toBe(201);
  const cvPayload = await cvResponse.json();
  const cvId = cvPayload.cv.id;

  const createResponse = await request.post('/api/applications', {
    data: {
      company_name: 'API Workflow Labs',
      role_title: 'Senior Backend Engineer',
      job_link: 'https://example.com/jobs/api-workflow-labs',
      job_description: 'Backend role using Node.js, PostgreSQL, APIs, and workflow tooling.',
      status: 'applied',
      salary: 'EUR 90k',
      location: 'Berlin, Germany',
      applied_date: '2026-06-14',
      next_action: 'Follow up',
      next_action_due_date: '2026-06-21',
      tags: 'Backend, Integration',
      cv_id: cvId,
      notes: 'Created from API workflow test.'
    }
  });
  expect(createResponse.status()).toBe(200);
  const createdPayload = await createResponse.json();
  const applicationId = createdPayload.application.id;
  expect(createdPayload.application.company_name).toBe('API Workflow Labs');

  const lookupResponse = await request.get('/api/applications/lookup', {
    params: {
      company_name: 'API Workflow Labs',
      role_title: 'Senior Backend Engineer'
    }
  });
  expect(lookupResponse.status()).toBe(200);
  const lookupPayload = await lookupResponse.json();
  expect(lookupPayload.applications).toHaveLength(1);
  expect(lookupPayload.applications[0]).toMatchObject({
    id: applicationId,
    company_name: 'API Workflow Labs',
    role_title: 'Senior Backend Engineer',
    status: 'applied',
    applied_date: '2026-06-14'
  });
  expect(lookupPayload.applications[0].tags).toEqual(expect.arrayContaining(['Backend', 'Integration']));

  const missingLookupResponse = await request.get('/api/applications/lookup');
  expect(missingLookupResponse.status()).toBe(400);

  const readResponse = await request.get(`/api/applications/${applicationId}`);
  expect(readResponse.status()).toBe(200);
  const readPayload = await readResponse.json();
  expect(readPayload.application.job_link).toBe('https://example.com/jobs/api-workflow-labs');

  const updateResponse = await request.put(`/api/applications/${applicationId}`, {
    data: {
      status: 'interview_scheduled',
      interview_date: '2026-06-25',
      next_action: 'Prepare interview notes',
      next_action_due_date: '2026-06-22',
      notes: 'Recruiter screen scheduled.'
    }
  });
  expect(updateResponse.status()).toBe(200);
  const updatePayload = await updateResponse.json();
  expect(updatePayload.application.status).toBe('interview_scheduled');
  expect(updatePayload.application.interview_date).toBe('2026-06-25');

  const archiveResponse = await request.post(`/api/applications/${applicationId}/archive`);
  expect(archiveResponse.status()).toBe(200);
  const archivePayload = await archiveResponse.json();
  expect(archivePayload.application.archived_at).toBeTruthy();

  const restoreResponse = await request.post(`/api/applications/${applicationId}/restore`);
  expect(restoreResponse.status()).toBe(200);
  const restorePayload = await restoreResponse.json();
  expect(restorePayload.application.archived_at).toBeNull();

  const deleteResponse = await request.delete(`/api/applications/${applicationId}`);
  expect(deleteResponse.status()).toBe(200);
  const deletedReadResponse = await request.get(`/api/applications/${applicationId}`);
  expect(deletedReadResponse.status()).toBe(404);
});

test('backup restore accepts next action fields in application rows', async ({ request }) => {
  const backup = {
    version: 1,
    data: {
      applications: [
        {
          id: 901,
          company_name: 'Restore Fields Co',
          role_title: 'Backend Engineer',
          job_link: 'https://example.com/jobs/restore-fields',
          job_description: 'Role used to verify backup restore field coverage.',
          status: 'applied',
          applied_date: '2026-06-24',
          interview_date: null,
          notes: 'Imported from backup test.',
          created_at: '2026-06-24T00:00:00.000Z',
          updated_at: '2026-06-24T00:00:00.000Z',
          archived_at: null,
          salary: 'INR 30 LPA',
          location: 'Remote',
          recruiter: 'A. Recruiter',
          contact_person: 'Hiring Manager',
          next_action: 'Send follow-up email',
          next_action_due_date: '2026-06-30'
        }
      ]
    },
    files: []
  };

  const restoreResponse = await request.post('/api/import/backup', {
    multipart: {
      backup: {
        name: 'backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backup), 'utf8')
      }
    }
  });

  expect(restoreResponse.status()).toBe(200);

  const readResponse = await request.get('/api/applications/901');
  expect(readResponse.status()).toBe(200);
  const readPayload = await readResponse.json();
  expect(readPayload.application).toMatchObject({
    company_name: 'Restore Fields Co',
    next_action: 'Send follow-up email',
    next_action_due_date: '2026-06-30'
  });
});

test('insights counts use distinct applications and consistent lifecycle conditions', async ({ request }) => {
  const application = (id, status, archivedAt = null) => ({
    id,
    company_name: `Insights Company ${id}`,
    company_category: 'Insights Test',
    role_title: 'Backend Engineer',
    job_link: `https://example.com/jobs/insights-${id}`,
    job_description: 'Role used to verify Insights lifecycle counts.',
    status,
    applied_date: '2026-07-01',
    interview_date: status === 'interview_scheduled' ? '2026-07-30' : null,
    notes: null,
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    archived_at: archivedAt,
    salary: null,
    location: 'Remote',
    recruiter: null,
    contact_person: null,
    next_action: null,
    next_action_due_date: null
  });
  const backup = {
    version: 1,
    data: {
      applications: [
        application(910, 'applied'),
        application(911, 'interview_scheduled'),
        application(912, 'rejected'),
        application(913, 'ghosted'),
        application(914, 'applied', '2026-07-10T00:00:00.000Z')
      ],
      status_history: [
        { id: 910, application_id: 910, from_status: null, to_status: 'applied', changed_at: '2026-07-01T00:00:00.000Z' },
        { id: 911, application_id: 911, from_status: 'applied', to_status: 'interview_scheduled', changed_at: '2026-07-02T00:00:00.000Z' },
        { id: 912, application_id: 912, from_status: 'applied', to_status: 'rejected', changed_at: '2026-07-03T00:00:00.000Z' },
        { id: 913, application_id: 913, from_status: 'applied', to_status: 'ghosted', changed_at: '2026-07-04T00:00:00.000Z' },
        { id: 914, application_id: 914, from_status: null, to_status: 'applied', changed_at: '2026-07-01T00:00:00.000Z' }
      ]
    },
    files: []
  };

  const restoreResponse = await request.post('/api/import/backup', {
    multipart: {
      backup: {
        name: 'insights-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(backup), 'utf8')
      }
    }
  });
  expect(restoreResponse.status()).toBe(200);

  const [statsResponse, reportsResponse, allStatsResponse, allReportsResponse] = await Promise.all([
    request.get('/api/stats'),
    request.get('/api/reports'),
    request.get('/api/stats?mode=all'),
    request.get('/api/reports?mode=all')
  ]);
  const stats = await statsResponse.json();
  const reports = await reportsResponse.json();
  const allStats = await allStatsResponse.json();
  const allReports = await allReportsResponse.json();

  expect(stats.totals).toMatchObject({ total: 4, active: 2, closed: 2, archived: 1, ghosted: 1 });
  expect(reports.lifecycle_counts).toEqual({ active: 2, closed: 2, archived: 0, total: 4 });
  expect(stats.categories).toEqual([{ category: 'Insights Test', applications: 4, interviewed: 1 }]);
  expect(allStats.totals).toMatchObject({ total: 5, active: 2, closed: 2, archived: 1, ghosted: 1 });
  expect(allReports.lifecycle_counts).toEqual({ active: 2, closed: 2, archived: 1, total: 5 });
  expect(allStats.categories).toEqual([{ category: 'Insights Test', applications: 5, interviewed: 1 }]);
});
