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

test('application REST API preserves more than 12 tags on create and update', async ({ request }) => {
  const cvResponse = await request.post('/api/cv', {
    multipart: {
      version_label: 'API tags test CV',
      is_latest: 'true',
      cv: {
        name: 'sample-cv.pdf',
        mimeType: 'application/pdf',
        buffer: fs.readFileSync(sampleCvPath)
      }
    }
  });
  expect([201, 409]).toContain(cvResponse.status());
  const cvPayload = cvResponse.status() === 201 ? await cvResponse.json() : null;

  const createTags = Array.from({ length: 13 }, (_, index) => `Tag ${index + 1}`);
  const createResponse = await request.post('/api/applications', {
    data: {
      company_name: 'API Tags Limit Labs',
      role_title: 'Backend Engineer',
      job_link: 'https://example.com/jobs/api-tags-limit-labs',
      job_description: 'Role used to verify tag persistence above the old twelve tag cap.',
      status: 'applied',
      applied_date: '2026-07-30',
      tags: createTags.join(', '),
      ...(cvPayload ? { cv_id: cvPayload.cv.id } : {})
    }
  });
  expect(createResponse.status()).toBe(200);
  const createdPayload = await createResponse.json();
  const applicationId = createdPayload.application.id;

  const createdReadResponse = await request.get(`/api/applications/${applicationId}`);
  expect(createdReadResponse.status()).toBe(200);
  const createdReadPayload = await createdReadResponse.json();
  expect(createdReadPayload.tags).toHaveLength(13);
  expect(createdReadPayload.tags).toEqual(expect.arrayContaining(createTags));

  const updateTags = Array.from({ length: 14 }, (_, index) => `Updated Tag ${index + 1}`);
  const updateResponse = await request.put(`/api/applications/${applicationId}`, {
    data: {
      tags: updateTags
    }
  });
  expect(updateResponse.status()).toBe(200);

  const updatedReadResponse = await request.get(`/api/applications/${applicationId}`);
  expect(updatedReadResponse.status()).toBe(200);
  const updatedReadPayload = await updatedReadResponse.json();
  expect(updatedReadPayload.tags).toHaveLength(14);
  expect(updatedReadPayload.tags).toEqual(expect.arrayContaining(updateTags));
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

test('insights returns every company category while keeping top tags capped', async ({ request }) => {
  const statusFor = (index) => {
    if (index === 1) return 'interview_scheduled';
    if (index === 2) return 'rejected';
    if (index === 3) return 'ghosted';
    if (index === 4) return 'withdrawn';
    return 'applied';
  };
  const applications = Array.from({ length: 16 }, (_, index) => {
    const id = 1001 + index;
    const categoryNumber = index < 4 ? 1 : index - 2;
    const status = statusFor(index + 1);
    return {
      id,
      company_name: `Insights Category Company ${index + 1}`,
      company_category: `Category ${String(categoryNumber).padStart(2, '0')}`,
      role_title: 'Backend Engineer',
      job_link: `https://example.com/jobs/insights-category-${index + 1}`,
      job_description: 'Role used to verify uncapped Insights category reporting.',
      status,
      applied_date: `2026-07-${String(index + 1).padStart(2, '0')}`,
      interview_date: status === 'interview_scheduled' ? '2026-07-30' : null,
      notes: null,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
      archived_at: null,
      salary: null,
      location: 'Remote',
      recruiter: null,
      contact_person: null,
      next_action: null,
      next_action_due_date: null
    };
  });
  const tags = applications.map((application, index) => ({
    id: 2001 + index,
    name: `Skill ${String(index + 1).padStart(2, '0')}`
  }));
  const applicationTags = applications.map((application, index) => ({
    application_id: application.id,
    tag_id: tags[index].id
  }));
  const statusHistory = [
    { id: 3001, application_id: 1001, from_status: 'applied', to_status: 'interview_scheduled', changed_at: '2026-07-02T00:00:00.000Z' }
  ];

  const restoreResponse = await request.post('/api/import/backup', {
    multipart: {
      backup: {
        name: 'insights-categories-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          version: 1,
          data: { applications, tags, application_tags: applicationTags, status_history: statusHistory },
          files: []
        }), 'utf8')
      }
    }
  });
  expect(restoreResponse.status()).toBe(200);

  const statsResponse = await request.get('/api/stats?mode=all');
  expect(statsResponse.status()).toBe(200);
  const stats = await statsResponse.json();

  expect(stats.tags).toHaveLength(12);
  expect(stats.categories).toHaveLength(13);
  expect(stats.categories.map((row) => row.category)).toContain('Category 13');
  expect(stats.categories.find((row) => row.category === 'Category 01')).toMatchObject({
    applications: 4,
    interviewed: 1,
    rejected: 1,
    ghosted: 1,
    withdrawn: 1,
    closed: 3
  });
  expect(stats).not.toHaveProperty('tag_details');
  expect(stats).not.toHaveProperty('category_details');
});

test('insights category period uses applied date windows', async ({ request }) => {
  const daysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
  };
  const applications = [
    { id: 4001, category: 'Recent Category', days: 5, status: 'interview_scheduled' },
    { id: 4002, category: 'Sixty Category', days: 45, status: 'rejected' },
    { id: 4003, category: 'Ninety Category', days: 75, status: 'ghosted' },
    { id: 4004, category: 'Old Category', days: 120, status: 'withdrawn' }
  ].map((item) => ({
    id: item.id,
    company_name: `Period Company ${item.id}`,
    company_category: item.category,
    role_title: 'Backend Engineer',
    job_link: `https://example.com/jobs/period-${item.id}`,
    job_description: 'Role used to verify applied-date period reporting.',
    status: item.status,
    applied_date: daysAgo(item.days),
    interview_date: item.status === 'interview_scheduled' ? daysAgo(1) : null,
    notes: null,
    created_at: `${daysAgo(item.days)}T00:00:00.000Z`,
    updated_at: `${daysAgo(item.days)}T00:00:00.000Z`,
    archived_at: null,
    salary: null,
    location: 'Remote',
    recruiter: null,
    contact_person: null,
    next_action: null,
    next_action_due_date: null
  }));
  const statusHistory = [
    { id: 5001, application_id: 4001, from_status: 'applied', to_status: 'interview_scheduled', changed_at: `${daysAgo(1)}T00:00:00.000Z` }
  ];

  const restoreResponse = await request.post('/api/import/backup', {
    multipart: {
      backup: {
        name: 'insights-period-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
          version: 1,
          data: { applications, status_history: statusHistory },
          files: []
        }), 'utf8')
      }
    }
  });
  expect(restoreResponse.status()).toBe(200);

  const [allResponse, thirtyResponse, sixtyResponse, ninetyResponse] = await Promise.all([
    request.get('/api/stats?period=all'),
    request.get('/api/stats?period=30'),
    request.get('/api/stats?period=60'),
    request.get('/api/stats?period=90')
  ]);
  const allStats = await allResponse.json();
  const thirtyStats = await thirtyResponse.json();
  const sixtyStats = await sixtyResponse.json();
  const ninetyStats = await ninetyResponse.json();

  expect(allStats.totals.total).toBe(4);
  expect(allStats.categories.map((row) => row.category)).toEqual([
    'Ninety Category',
    'Old Category',
    'Recent Category',
    'Sixty Category'
  ]);
  expect(thirtyStats.totals.total).toBe(1);
  expect(thirtyStats.categories.map((row) => row.category)).toEqual(['Recent Category']);
  expect(sixtyStats.totals.total).toBe(2);
  expect(sixtyStats.categories.map((row) => row.category).sort()).toEqual(['Recent Category', 'Sixty Category']);
  expect(ninetyStats.totals.total).toBe(3);
  expect(ninetyStats.categories.map((row) => row.category).sort()).toEqual(['Ninety Category', 'Recent Category', 'Sixty Category']);
});
