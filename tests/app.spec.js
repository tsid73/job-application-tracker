import path from 'node:path';
import { test, expect } from '@playwright/test';

const sampleCvPath = path.resolve(process.cwd(), 'sample-data', 'sample-cv.pdf');

test('create application, run AI, archive and restore', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('/');
  await page.getByRole('button', { name: 'New Application' }).click();
  await page.getByLabel('Company Name').fill('Acme Labs');
  await page.getByLabel('Job Description').fill('Node.js backend role using PostgreSQL, APIs, and operational tooling.');
  await page.getByLabel('Tags').fill('Backend, Remote');
  await page.getByLabel('Upload CV').setInputFiles(sampleCvPath);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Acme Labs')).toBeVisible();
  await page.getByRole('button', { name: 'Open' }).first().click();

  await page.getByRole('button', { name: 'ATS Check' }).click();
  await expect(page.locator('.ai-output')).toContainText('ATS score', { timeout: 15_000 });

  await page.getByRole('button', { name: 'Close' }).first().click();
  await page.getByRole('button', { name: 'Archive' }).first().click();

  await expect(page.getByText('Archived', { exact: true }).first()).toBeVisible();

  await page.getByLabel('View').selectOption('true');
  await page.getByRole('button', { name: 'Restore' }).first().click();

  await page.getByLabel('View').selectOption('false');
  await expect(page.getByText('Acme Labs')).toBeVisible();
});

test('export CSV and save a reusable filter', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search').fill('Acme');
  await page.getByLabel('Save As').fill('Acme filter');
  await page.getByRole('button', { name: 'Save Filter' }).click();
  await expect(page.getByLabel('Saved Filter')).toHaveValue(/.+/);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('job-applications.csv');
});
