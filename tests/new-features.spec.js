import path from 'node:path';
import { test, expect } from '@playwright/test';

const sampleCvPath = path.resolve(process.cwd(), 'sample-data', 'sample-cv.pdf');

test('stats view, calendar export, bulk actions, targeted row update', async ({ page }) => {
  // Inline status changes to ghosted/rejected/withdrawn open a window.prompt.
  page.on('dialog', (dialog) => dialog.accept());

  const company = `Bulk Test Co ${Date.now()}`;

  await page.goto('/');

  await page.getByRole('button', { name: 'New Application' }).click();
  const applicationDialog = page.locator('#applicationDialog');
  await applicationDialog.getByLabel('Company Name').fill(company);
  await applicationDialog.getByLabel('Job Description').fill('Backend role for verifying new features.');
  await applicationDialog.getByLabel('Next Action', { exact: true }).fill('Follow up');
  await applicationDialog.getByLabel('Next Action Due', { exact: true }).fill('2026-07-01');
  await applicationDialog.getByLabel('Upload CV').setInputFiles(sampleCvPath);
  await applicationDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('link', { name: 'Tracker' }).click();

  // Isolate this run's row by filtering the list to the unique company name.
  await page.getByRole('searchbox', { name: 'Search' }).fill(company);
  await expect(page.getByText(company)).toBeVisible();

  // Stats view renders funnel panels
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.getByText('Application Funnel')).toBeVisible();
  await expect(page.getByText('Time in Stage')).toBeVisible();

  // Calendar export returns an ICS file containing this application's event
  const icsResponse = await page.request.get('/api/export/calendar.ics');
  expect(icsResponse.status()).toBe(200);
  const ics = await icsResponse.text();
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain(company);

  // Targeted row update: change status inline; row updates without a full table rebuild
  await page.getByRole('button', { name: 'List', exact: true }).click();
  const row = page.locator('tr', { hasText: company }).first();
  await row.locator('select[data-field="status"]').selectOption('ghosted');
  await expect(page.getByText('Save successful.')).toBeVisible();

  // Bulk actions: select the row and archive via the bulk bar
  const freshRow = page.locator('tr', { hasText: company }).first();
  await freshRow.locator('input[data-select-id]').check();
  await expect(page.locator('#bulkActionsBar')).toBeVisible();
  await expect(page.locator('#bulkCount')).toHaveText('1 selected');
  await page.getByRole('button', { name: 'Archive Selected' }).click();
  await expect(page.getByText('Applications archived.')).toBeVisible();
  await expect(page.locator('#bulkActionsBar')).toBeHidden();
});
