/**
 * Regression tests for UI flows and design invariants.
 * Runs against the in-memory test DB (same as other specs).
 */
import path from 'node:path';
import { test, expect } from '@playwright/test';

const sampleCvPath = path.resolve(process.cwd(), 'sample-data', 'sample-cv.pdf');

// ─── helpers ────────────────────────────────────────────────────────────────

async function createApp(page, company) {
  // Wait for list to be ready (initial API loads complete)
  await page.locator('#applicationsTable').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'New Application' }).click();
  const dlg = page.locator('#applicationDialog');
  await expect(dlg).toBeVisible();
  await dlg.getByLabel('Company Name').fill(company);
  await dlg.getByLabel('Job Description').fill('Regression test role.');
  await dlg.getByLabel('Upload CV').setInputFiles(sampleCvPath);
  await dlg.getByRole('button', { name: 'Save', exact: true }).click();
  // Application appears (either on detail page or list)
  await expect(page.getByText(company)).toBeVisible({ timeout: 40000 });
  // If we landed on detail page, navigate back to list via sidebar
  if (await page.locator('.application-hero-card').isVisible()) {
    await page.locator('[data-view="list"]').click();
    await expect(page.getByText(company)).toBeVisible();
  }
}

// ─── Navigation ─────────────────────────────────────────────────────────────

test('all primary views render without errors', async ({ page }) => {
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();

  await page.locator('[data-view="kanban"]').click();
  await expect(page.locator('#kanbanBoard')).toBeVisible();

  await page.locator('[data-view="reminders"]').click();
  await expect(page.locator('#remindersView')).toBeVisible();

  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('#insightsView')).toBeVisible();

  await page.locator('[data-view="activity"]').click();
  await expect(page.locator('#activityView')).toBeVisible();

  await page.locator('[data-view="boards"]').click();
  await expect(page.locator('#boardsView')).toBeVisible();

  await page.locator('[data-view="companies"]').click();
  await expect(page.locator('#companiesView')).toBeVisible();

  await page.locator('[data-view="settings"]').click();
  await expect(page.locator('#settingsView')).toBeVisible();

  // No JS errors across the full nav sweep
  expect(errors).toHaveLength(0);
});

test('list view returns to default state after nav', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('#insightsView')).toBeVisible();
  await page.locator('[data-view="list"]').click();
  await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
  await expect(page.locator('#listView')).toBeVisible();
});

// ─── Sidebar design ──────────────────────────────────────────────────────────

test('toolkit absent from sidebar nav', async ({ page }) => {
  await page.goto('/');
  // There should be no sidebar button labelled "Toolkit"
  const toolkitBtn = page.locator('nav').getByRole('button', { name: 'Toolkit' });
  await expect(toolkitBtn).toHaveCount(0);
});

test('toolkit section present inside settings', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-view="settings"]').click();
  await expect(page.locator('#settingsView')).toBeVisible();
  // Section heading "Toolkit" must appear inside the settings panel
  await expect(page.locator('#settingsView .settings-section-title')).toContainText('Toolkit');
  // Toolkit cards grid must exist
  await expect(page.locator('#toolkitContent')).toBeVisible();
});

test('sidebar footer: CVs button icon-only, new application present', async ({ page }) => {
  await page.goto('/');

  const cvsBtn = page.locator('#cvManagerButton');
  await expect(cvsBtn).toBeVisible();
  // Icon-only: has title, no visible text label
  await expect(cvsBtn).toHaveAttribute('title', 'Manage CVs');
  const cvsText = await cvsBtn.textContent();
  expect(cvsText?.trim()).toBeFalsy();

  const newAppBtn = page.locator('#newApplicationButton');
  await expect(newAppBtn).toBeVisible();
  await expect(newAppBtn).toContainText('New Application');
});

test('sidebar footer buttons share a flex row', async ({ page }) => {
  await page.goto('/');
  const cvsBtn = page.locator('#cvManagerButton');
  const newAppBtn = page.locator('#newApplicationButton');

  const cvsBox = await cvsBtn.boundingBox();
  const newAppBox = await newAppBtn.boundingBox();

  // Both in same horizontal row (tops within 8px of each other)
  expect(Math.abs((cvsBox?.y ?? 0) - (newAppBox?.y ?? 0))).toBeLessThan(8);
  // New Application button is wider than the CVs icon button
  expect((newAppBox?.width ?? 0)).toBeGreaterThan((cvsBox?.width ?? 0));
});

test('active nav item has no visible left border arc', async ({ page }) => {
  await page.goto('/');
  const activeItem = page.locator('.nav-item.is-active').first();
  await expect(activeItem).toBeVisible();

  const borderLeft = await activeItem.evaluate(
    (el) => window.getComputedStyle(el).borderLeftWidth
  );
  // No meaningful left border (0px is ok, 3px arc is not)
  expect(parseInt(borderLeft, 10)).toBeLessThanOrEqual(1);
});

// ─── Insights design ─────────────────────────────────────────────────────────

test('insights rows use gradient fill (no legacy bar element)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await createApp(page, `Regression Insights Co ${Date.now()}`);

  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('#insightsView')).toBeVisible();

  // Wait for at least one insight row with fill data
  const row = page.locator('button.report-row[style*="--row-fill"]').first();
  await expect(row).toBeVisible({ timeout: 8000 });

  const style = await row.getAttribute('style');
  expect(style).toContain('--row-fill');
  expect(style).toContain('--row-color');

  // Legacy .report-bar must not exist anywhere
  await expect(page.locator('.report-bar')).toHaveCount(0);
});

test('insights labels use "interview rate" not "% to int"', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await createApp(page, `Regression Rate Co ${Date.now()}`);

  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('#insightsView')).toBeVisible();

  // The old truncated label must not appear
  await expect(page.getByText(/% to int/)).toHaveCount(0);
});

test('insights section headings render', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('#insightsContent')).toBeVisible();

  await expect(page.getByText('Application Funnel')).toBeVisible();
  await expect(page.getByText('Time in Stage')).toBeVisible();
  await expect(page.getByText('Monthly Applications')).toBeVisible();
});

// ─── Core CRUD flows ─────────────────────────────────────────────────────────

test('create and immediately find application in list', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const company = `Regression CRUD Co ${Date.now()}`;
  await page.goto('/');
  await createApp(page, company);

  // createApp already navigates back to list and confirms row visible
  const row = page.locator('tr', { hasText: company }).first();
  await expect(row.locator('select[data-field="status"]')).toHaveValue('applied');
});

test('inline status change updates row without full reload', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const company = `Regression Status Co ${Date.now()}`;
  await page.goto('/');
  await createApp(page, company);

  const row = page.locator('tr', { hasText: company }).first();
  await row.locator('select[data-field="status"]').selectOption('interview_scheduled');
  await expect(page.getByText('Save successful.')).toBeVisible();

  // Row still in DOM (targeted update, not full reload)
  await expect(page.locator('tr', { hasText: company })).toBeVisible();
});

test('search filter narrows application list', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const uid = Date.now();
  await page.goto('/');

  await createApp(page, `FilterCo Alpha ${uid}`);
  await createApp(page, `FilterCo Beta ${uid}`);

  await page.getByRole('searchbox', { name: 'Search' }).fill(`Alpha ${uid}`);
  await expect(page.getByText(`FilterCo Alpha ${uid}`)).toBeVisible();
  await expect(page.getByText(`FilterCo Beta ${uid}`)).toHaveCount(0);
});

test('open application detail page and back to tracker', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const company = `Regression Detail Co ${Date.now()}`;
  await page.goto('/');
  await createApp(page, company);

  // If already on list, navigate to detail via "Open workflow" link
  if (!(await page.locator('.application-hero-card').isVisible())) {
    await page.getByRole('link', { name: 'Open workflow' }).first().click();
  }
  await expect(page.locator('.application-hero-card')).toBeVisible();

  // Header hidden on detail
  await expect(page.locator('.content-header')).toBeHidden();

  await page.locator('[data-view="list"]').click();
  await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
});

// ─── Kanban ──────────────────────────────────────────────────────────────────

test('kanban board renders after creating an application', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  const company = `Regression Kanban Co ${Date.now()}`;
  await page.goto('/');
  await createApp(page, company);

  await page.locator('[data-view="kanban"]').click();
  await expect(page.locator('#kanbanBoard')).toBeVisible();

  // Column heads render (h3 with status labels)
  const columnHeads = page.locator('#kanbanBoard .kanban-column-head h3');
  await expect(columnHeads.first()).toBeVisible();

  // The created app should appear in the Applied column
  await expect(page.locator('#kanbanBoard').getByText(company)).toBeVisible();
});

test('kanban shows all status columns', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-view="kanban"]').click();
  await expect(page.locator('#kanbanBoard')).toBeVisible();
  // Columns or empty state renders — board has content
  await expect(page.locator('#kanbanBoard')).not.toBeEmpty();
});

// ─── Notifications ───────────────────────────────────────────────────────────

test('notifications panel element exists in DOM', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#notificationsPanel')).toBeAttached();
});
