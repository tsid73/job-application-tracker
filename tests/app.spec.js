import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const sampleCvPath = path.resolve(process.cwd(), 'sample-data', 'sample-cv.pdf');

test('create application, run AI, archive and restore', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/');
  await page.getByRole('button', { name: 'New Application' }).click();
  const applicationDialog = page.locator('#applicationDialog');
  await applicationDialog.getByLabel('Company Name').fill('Acme Labs');
  await applicationDialog.getByLabel('Job Description').fill('Node.js backend role using PostgreSQL, APIs, and operational tooling.');
  await applicationDialog.getByLabel('Tags').fill('Backend, Remote');
  await applicationDialog.getByLabel('Next Action', { exact: true }).fill('Follow up with recruiter');
  await applicationDialog.getByLabel('Next Action Due', { exact: true }).fill('2026-06-03');
  await applicationDialog.getByLabel('Upload CV').setInputFiles(sampleCvPath);
  await applicationDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(page.getByText('Acme Labs')).toBeVisible();
  await page.getByRole('link', { name: 'Open workflow' }).waitFor();

  const atsCard = page.locator('.artifact-card').filter({ hasText: 'ATS Check' });
  await atsCard.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByText('ATS score')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('link', { name: 'Tracker' }).click();
  await page.getByRole('button', { name: 'Open' }).first().click();
  await page.getByRole('button', { name: 'Archive' }).first().click();
  await page.getByRole('button', { name: 'Confirm' }).click();

  await expect(page.getByText('Archived', { exact: true }).first()).toBeVisible();

  await page.getByLabel('View').selectOption('true');
  await page.getByRole('button', { name: 'Restore' }).first().click();

  await page.getByLabel('View').selectOption('false');
  await expect(page.getByText('Acme Labs')).toBeVisible();
});

test('export CSV and save a reusable filter', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('searchbox', { name: 'Search' }).fill('Acme');
  await page.getByLabel('Save As').fill('Acme filter');
  await page.getByRole('button', { name: 'Save Filter', exact: true }).click();
  await expect(page.getByLabel('Saved Filter')).toHaveValue(/.+/);

  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/export/applications.csv') && res.status() === 200),
    page.getByRole('button', { name: 'Export CSV', exact: true }).click()
  ]);
  expect(response.headers()['content-disposition']).toContain('job-applications.csv');
});

test('settings restore shows selected backup before restore', async ({ page }, testInfo) => {
  const backupPath = testInfo.outputPath('sample-backup.json');
  fs.writeFileSync(backupPath, JSON.stringify({ version: 1, data: {}, files: [] }));

  await page.goto('/');

  await page.getByRole('button', { name: 'Settings' }).click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose Backup' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(backupPath);

  await expect(page.locator('#restoreBackupFileName')).toHaveText('sample-backup.json');
  await expect(page.getByRole('button', { name: 'Restore Selected' })).toBeEnabled();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.locator('#restoreBackupSelection')).toBeHidden();
});

test('manage preparation workspace and job boards', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'New Application' }).click();
  const applicationDialog = page.locator('#applicationDialog');
  await applicationDialog.getByLabel('Company Name').fill('Northstar Systems');
  await applicationDialog.getByLabel('Job Description').fill('Platform engineering role focused on APIs, observability, and delivery systems.');
  await applicationDialog.getByLabel('Upload CV').setInputFiles(sampleCvPath);
  await applicationDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('link', { name: 'Workflow', exact: true }).click();

  await page.getByLabel('About The Company').fill('B2B infrastructure platform with a strong enterprise focus.');
  await page.getByLabel('Company Values').fill('Ownership, clarity, and steady execution.');
  await page.getByLabel('Application Notes').fill('Prepare migration story and incident response example.');
  await page.getByRole('button', { name: 'Save Research' }).click();

  await page.locator('[data-question-form] textarea[name="question"]').fill('How does the team define success in the first 90 days?');
  await page.getByRole('button', { name: 'Add Question' }).click();
  await expect(page.getByText('How does the team define success in the first 90 days?')).toBeVisible();

  await page.getByLabel('Source').selectOption('recruiter');
  await page.locator('[data-feedback-form] textarea[name="body"]').fill('Recruiter said the team values strong ownership and concise communication.');
  await page.getByRole('button', { name: 'Add Feedback' }).click();
  await expect(page.getByText('Recruiter said the team values strong ownership and concise communication.')).toBeVisible();

  await page.locator('[data-todo-form] textarea[name="body"]').fill('Prepare 3 recruiter questions');
  await page.locator('[data-todo-form] input[name="due_date"]').fill('08-05-2026');
  await page.getByRole('button', { name: 'Add Task' }).click();
  await expect(page.getByText('Prepare 3 recruiter questions')).toBeVisible();
  await page.locator('[data-todo-toggle]').check();

  await page.getByRole('link', { name: 'Tracker' }).click();

  await page.getByRole('button', { name: 'Job Boards' }).click();
  await page.getByLabel('Board Name').fill('LinkedIn Jobs');
  await page.getByLabel('URL').fill('https://www.linkedin.com/jobs/');
  await page.getByLabel('Last Checked').fill('2026-05-05');
  await page.getByLabel('Notes').fill('Use saved search for platform and backend roles.');
  await page.getByRole('button', { name: 'Save Board' }).click();

  await expect(page.getByText('LinkedIn Jobs')).toBeVisible();
  await page.getByRole('button', { name: 'Mark inactive' }).click();
  await expect(page.getByText('Inactive')).toBeVisible();
});
