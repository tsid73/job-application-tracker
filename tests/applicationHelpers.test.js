import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApplicationInput } from '../server/services/applicationHelpers.js';

test('normalizeApplicationInput allows interview scheduled status without legacy interview date', () => {
  const result = normalizeApplicationInput({
    company_name: 'Process First Co',
    job_link: 'https://example.com/process-first',
    status: 'interview_scheduled',
    applied_date: '2026-08-01',
    interview_date: ''
  });

  assert.equal(result.status, 'interview_scheduled');
  assert.equal(result.interview_date, null);
});
