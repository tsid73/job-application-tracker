import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';

const sampleCvPath = path.resolve(process.cwd(), 'sample-data', 'sample-cv.pdf');

test('application detail tracks flexible hiring process steps', async ({ page }) => {
  const company = `Hiring Process UI ${Date.now()}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'New Application', exact: true }).click();
  const applicationDialog = page.locator('#applicationDialog');
  await applicationDialog.getByLabel('Company Name').fill(company);
  await applicationDialog.getByLabel('Job Description').fill('Role used to verify hiring process tracking.');
  await applicationDialog.getByLabel('Upload CV').setInputFiles(sampleCvPath);
  await applicationDialog.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('link', { name: company, exact: true }).click();
  await page.getByRole('link', { name: 'Hiring Process', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Steps' })).toBeVisible();

  async function addStep({ group, name, state, date, response = 'awaiting_response', feedback = '' }) {
    await page.getByRole('button', { name: 'Add Step' }).click();
    const form = page.locator('[data-process-step-dialog-form]');
    const dialogWidth = await page.locator('#detailDialog').evaluate((node) => node.getBoundingClientRect().width);
    expect(dialogWidth).toBeLessThanOrEqual(600);
    await form.locator('select[name="step_group"]').selectOption(group);
    await form.locator('input[name="step_name"]').fill(name);
    await form.locator('select[name="step_state"]').selectOption(state);
    await form.locator('input[name="event_date"]').fill(date);
    await form.locator('details').evaluate((node) => { node.open = true; });
    await form.locator('select[name="response_state"]').selectOption(response);
    if (feedback) await form.locator('select[name="feedback_received"]').selectOption(feedback);
    await form.getByRole('button', { name: 'Add Step' }).click();
  }

  await addStep({ group: 'screening', name: 'Screening Call', state: 'completed', date: '2026-08-10', response: 'advanced', feedback: 'true' });
  await expect(page.locator('.process-step-card').filter({ hasText: 'Screening Call' })).toBeVisible();

  await addStep({ group: 'interview', name: 'L1', state: 'scheduled', date: '2026-08-12' });
  await expect(page.locator('.process-step-card').filter({ hasText: 'L1' })).toBeVisible();

  const l1Card = page.locator('.process-step-card').filter({ hasText: 'L1' });
  await l1Card.getByRole('button', { name: 'Close No Response' }).click();
  await expect(l1Card).toContainText('No Response');
  await l1Card.getByRole('button', { name: 'Reopen' }).click();
  await expect(l1Card).toContainText('Awaiting Response');

  await addStep({ group: 'assessment', name: 'AI Test', state: 'scheduled', date: '2026-08-11' });
  await expect(page.locator('.process-step-card').filter({ hasText: 'AI Test' })).toBeVisible();

  const aiCard = page.locator('.process-step-card').filter({ hasText: 'AI Test' });
  await aiCard.getByRole('button', { name: 'Edit' }).click();
  const editForm = page.locator('[data-process-step-dialog-form]');
  await editForm.locator('input[name="step_name"]').fill('AI Screening Test');
  await editForm.getByRole('button', { name: 'Save Step' }).click();
  await expect(page.locator('.process-step-card').filter({ hasText: 'AI Screening Test' })).toBeVisible();

  const editedAiCard = page.locator('.process-step-card').filter({ hasText: 'AI Screening Test' });
  await editedAiCard.getByTitle('Move up').click();
  await expect(page.locator('.process-step-card').nth(1)).toContainText('AI Screening Test');

  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page.locator('tr').filter({ hasText: company })).toContainText('3 steps');

  await page.locator('tr').filter({ hasText: company }).locator('.company-link').click();
  await page.getByRole('link', { name: 'Hiring Process', exact: true }).click();
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('.process-step-card').filter({ hasText: 'AI Screening Test' }).getByRole('button', { name: 'Delete' }).click();
  await page.locator('#confirmDialogAccept').click();
  await expect(page.locator('.process-step-card').filter({ hasText: 'AI Screening Test' })).toBeHidden();

  await page.setViewportSize({ width: 390, height: 900 });
  await page.reload();
  await expect(page.getByRole('link', { name: 'Hiring Process', exact: true })).toBeVisible();
  const titleBox = await page.locator('.hero-copy-group h1').boundingBox();
  const actionsBox = await page.locator('.application-hero-actions').boundingBox();
  expect(titleBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(actionsBox.y).toBeGreaterThan(titleBox.y + titleBox.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
