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
