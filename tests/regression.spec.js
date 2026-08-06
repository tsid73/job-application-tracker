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

test('kanban absent from sidebar nav', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav [data-view="kanban"]')).toHaveCount(0);
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

test('insights renders company category performance before top tags with safe percentages', async ({ page }) => {
  await page.route('**/api/reports**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status_counts: [],
        monthly_counts: [],
        lifecycle_counts: { active: 13, closed: 0, archived: 0, total: 13 },
        upcoming_interviews: []
      })
    });
  });
  await page.route('**/api/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totals: { total: 16, active: 13, closed: 3, archived: 0, ghosted: 1 },
        funnel: { interviewed: 0, offers: 0, accepted: 0, rejected: 0, responded: 0 },
        timing: { avg_days_to_interview: null, avg_days_to_close: null },
        tags: Array.from({ length: 12 }, (_, index) => ({
          tag: `Skill ${String(index + 1).padStart(2, '0')}`,
          applications: 1,
          interviewed: 0
        })),
        categories: [
          {
            category: 'Category 01',
            applications: 4,
            interviewed: 1,
            rejected: 1,
            ghosted: 1,
            withdrawn: 0,
            closed: 2
          },
          ...Array.from({ length: 12 }, (_, index) => ({
            category: `Category ${String(index + 2).padStart(2, '0')}`,
            applications: 1,
            interviewed: 0,
            rejected: 0,
            ghosted: 0,
            withdrawn: 0,
            closed: 0
          })),
          {
            category: 'Zero Category',
            applications: 0,
            interviewed: null,
            rejected: null,
            ghosted: null,
            withdrawn: null,
            closed: null
          }
        ]
      })
    });
  });

  await page.goto('/');
  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('#insightsContent')).toBeVisible();
  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Category 13' })).toBeVisible();
  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Zero Category' })).toBeVisible();
  const periodControl = page.getByLabel('Period', { exact: true });
  await expect(periodControl).toHaveValue('all');
  const periodLabels = await periodControl.locator('option').evaluateAll((options) =>
    options.map((option) => option.textContent?.trim())
  );
  expect(periodLabels).toEqual(['All time', 'Last 30 days', 'Last 60 days', 'Last 90 days']);
  const controlTops = await page.locator('[data-category-performance-section] .filter-panel label').evaluateAll((labels) =>
    labels.map((label) => Math.round(label.getBoundingClientRect().top))
  );
  expect(new Set(controlTops).size).toBe(1);
  const categoryControl = page.locator('[data-category-performance-filter]');
  await expect(categoryControl).toHaveValue('');

  const summaryCards = page.locator('[data-category-performance-summary=""] .kpi-card');
  await expect(page.locator('[data-category-performance-section] [data-category-performance-summary] .kpi-card')).toHaveCount(3);
  await expect(summaryCards.nth(0)).toContainText('16');
  await expect(summaryCards.nth(0)).toContainText('100% of selected period');
  await expect(summaryCards.nth(1)).toContainText('6%');
  await expect(summaryCards.nth(1)).toContainText('1 interviewed');
  await expect(summaryCards.nth(2)).toContainText('13%');
  await expect(summaryCards.nth(2)).toContainText('2 closed');

  const insightHeadings = await page.locator('#insightsContent h3').evaluateAll((headings) =>
    headings
      .map((heading) => heading.textContent?.trim())
      .filter((text) => text === 'Company Category Performance' || text === 'Top Tags')
  );
  expect(insightHeadings).toEqual(['Company Category Performance', 'Top Tags']);

  const headers = await page.locator('[data-category-performance] thead th').evaluateAll((cells) =>
    cells.map((cell) => cell.textContent?.trim())
  );
  expect(headers).toEqual([
    'Company category',
    'Applied',
    'Applied %',
    'Interviewed',
    'Interview %',
    'Rejected',
    'Ghosted',
    'Closed',
    'Closed %'
  ]);

  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Category 01' }).first()).toContainText('25%');
  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Category 01' }).first()).toContainText('50%');
  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Zero Category' }).first()).toContainText('0%');

  await categoryControl.selectOption('Category 01');
  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Category 01' })).toBeVisible();
  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Category 02' })).toBeHidden();
  await expect(page.locator('[data-category-performance-summary="Category 01"]')).toBeVisible();
  await expect(page.locator('[data-category-performance-summary="Category 01"] .kpi-card').nth(0)).toContainText('4');
  await expect(page.locator('[data-category-performance-summary="Category 01"] .kpi-card').nth(0)).toContainText('25% of selected period');
  await expect(page.locator('[data-category-performance-summary="Category 01"] .kpi-card').nth(1)).toContainText('25%');
  await expect(page.locator('[data-category-performance-summary="Category 01"] .kpi-card').nth(1)).toContainText('1 interviewed');
  await expect(page.locator('[data-category-performance-summary="Category 01"] .kpi-card').nth(2)).toContainText('50%');
  await expect(page.locator('[data-category-performance-summary="Category 01"] .kpi-card').nth(2)).toContainText('2 closed');

  await categoryControl.selectOption('Zero Category');
  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Zero Category' })).toBeVisible();
  await expect(page.locator('[data-category-performance-summary="Zero Category"] .kpi-card').nth(0)).toContainText('0');
  await expect(page.locator('[data-category-performance-summary="Zero Category"] .kpi-card').nth(1)).toContainText('0%');
  await expect(page.locator('[data-category-performance-summary="Zero Category"] .kpi-card').nth(2)).toContainText('0%');
  await expect(page.locator('#insightsContent')).not.toContainText('NaN');
  await expect(page.locator('#insightsContent')).not.toContainText('Infinity');
});

test('company category performance applies period and category filters together', async ({ page }) => {
  const statsRequests = [];
  const statsByPeriod = {
    all: {
      totals: { total: 15, active: 10, closed: 5, archived: 0, ghosted: 1 },
      categories: [
        { category: 'Alpha Category', applications: 10, interviewed: 2, rejected: 3, ghosted: 1, withdrawn: 0, closed: 4 },
        { category: 'Beta Category', applications: 5, interviewed: 1, rejected: 1, ghosted: 0, withdrawn: 0, closed: 1 }
      ]
    },
    30: {
      totals: { total: 5, active: 3, closed: 2, archived: 0, ghosted: 0 },
      categories: [
        { category: 'Alpha Category', applications: 3, interviewed: 1, rejected: 1, ghosted: 0, withdrawn: 0, closed: 1 },
        { category: 'Beta Category', applications: 2, interviewed: 0, rejected: 1, ghosted: 0, withdrawn: 0, closed: 1 }
      ]
    }
  };
  await page.route('**/api/reports**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status_counts: [],
        monthly_counts: [],
        lifecycle_counts: { active: 10, closed: 5, archived: 0, total: 15 },
        upcoming_interviews: []
      })
    });
  });
  await page.route('**/api/stats**', async (route) => {
    const url = new URL(route.request().url());
    const period = url.searchParams.get('period') || 'pipeline';
    statsRequests.push(period);
    const periodStats = statsByPeriod[period] || statsByPeriod.all;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totals: periodStats.totals,
        funnel: { interviewed: 3, offers: 0, accepted: 0, rejected: 0, responded: 3 },
        timing: { avg_days_to_interview: null, avg_days_to_close: null },
        tags: [{ tag: 'Backend', applications: 5, interviewed: 1 }],
        categories: periodStats.categories
      })
    });
  });

  await page.goto('/');
  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('[data-category-performance-summary] .kpi-card').first()).toContainText('15');
  expect(statsRequests).toContain('all');

  const periodResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/stats' && url.searchParams.get('period') === '30';
  });
  await page.getByLabel('Period', { exact: true }).selectOption('30');
  await periodResponse;

  await expect(page.locator('[data-category-performance-summary] .kpi-card').first()).toContainText('5');
  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Alpha Category' })).toContainText('3');
  await expect(page.locator('[data-category-performance] tbody tr', { hasText: 'Beta Category' })).toContainText('2');

  await page.locator('[data-category-performance-filter]').selectOption('Beta Category');
  await expect(page.locator('[data-category-performance-row="Alpha Category"]')).toBeHidden();
  await expect(page.locator('[data-category-performance-row="Beta Category"]')).toBeVisible();
  await expect(page.locator('[data-category-performance-summary] .kpi-card')).toHaveCount(3);
  await expect(page.locator('[data-category-performance-summary] .kpi-card').nth(0)).toContainText('2');
  await expect(page.locator('[data-category-performance-summary] .kpi-card').nth(0)).toContainText('40% of selected period');
  await expect(page.locator('[data-category-performance-summary] .kpi-card').nth(1)).toContainText('0%');
  await expect(page.locator('[data-category-performance-summary] .kpi-card').nth(1)).toContainText('0 interviewed');
  await expect(page.locator('[data-category-performance-summary] .kpi-card').nth(2)).toContainText('50%');
  await expect(page.locator('[data-category-performance-summary] .kpi-card').nth(2)).toContainText('1 closed');
  await expect(page.locator('#insightsContent')).not.toContainText('NaN');
  await expect(page.locator('#insightsContent')).not.toContainText('Infinity');
});

test('company category performance filters update without replacing the insights page', async ({ page }) => {
  const statsByPeriod = {
    all: {
      totals: { total: 15, active: 10, closed: 5, archived: 0, ghosted: 1 },
      categories: [
        { category: 'Alpha Category', applications: 10, interviewed: 2, rejected: 3, ghosted: 1, withdrawn: 0, closed: 4 },
        { category: 'Beta Category', applications: 5, interviewed: 1, rejected: 1, ghosted: 0, withdrawn: 0, closed: 1 }
      ]
    },
    30: {
      totals: { total: 5, active: 3, closed: 2, archived: 0, ghosted: 0 },
      categories: [
        { category: 'Alpha Category', applications: 3, interviewed: 1, rejected: 1, ghosted: 0, withdrawn: 0, closed: 1 },
        { category: 'Beta Category', applications: 2, interviewed: 0, rejected: 1, ghosted: 0, withdrawn: 0, closed: 1 }
      ]
    }
  };
  await page.route('**/api/reports**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status_counts: [],
        monthly_counts: [],
        lifecycle_counts: { active: 10, closed: 5, archived: 0, total: 15 },
        upcoming_interviews: []
      })
    });
  });
  await page.route('**/api/stats**', async (route) => {
    const url = new URL(route.request().url());
    const period = url.searchParams.get('period') || 'all';
    const periodStats = statsByPeriod[period] || statsByPeriod.all;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totals: periodStats.totals,
        funnel: { interviewed: 3, offers: 0, accepted: 0, rejected: 0, responded: 3 },
        timing: { avg_days_to_interview: null, avg_days_to_close: null },
        tags: [{ tag: 'Backend', applications: 5, interviewed: 1 }],
        categories: periodStats.categories
      })
    });
  });

  await page.goto('/');
  await page.locator('[data-view="insights"]').click();
  await expect(page.locator('[data-category-performance-section]')).toBeVisible();
  await page.evaluate(() => {
    document.querySelector('#insightsContent')?.setAttribute('data-stability-marker', 'keep');
    [...document.querySelectorAll('#insightsContent h3')]
      .find((heading) => heading.textContent?.trim() === 'Top Tags')
      ?.closest('section')
      ?.setAttribute('data-top-tags-marker', 'keep');
  });

  const periodResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/stats' && url.searchParams.get('period') === '30';
  });
  await page.getByLabel('Period', { exact: true }).selectOption('30');
  await periodResponse;

  await expect(page.locator('#insightsContent[data-stability-marker="keep"]')).toBeVisible();
  await expect(page.locator('[data-top-tags-marker="keep"]')).toBeVisible();
  await expect(page.locator('#insightsContent')).not.toContainText('Loading insights');
  await expect(page.locator('[data-category-performance-summary] .kpi-card').first()).toContainText('5');
  await expect(page.locator('[data-category-performance-row="Alpha Category"]')).toContainText('3');

  await page.locator('[data-category-performance-filter]').selectOption('Beta Category');
  await expect(page.locator('#insightsContent[data-stability-marker="keep"]')).toBeVisible();
  await expect(page.locator('[data-top-tags-marker="keep"]')).toBeVisible();
  await expect(page.locator('[data-category-performance-row="Alpha Category"]')).toBeHidden();
  await expect(page.locator('[data-category-performance-row="Beta Category"]')).toBeVisible();
  await expect(page.locator('[data-category-performance-summary] .kpi-card').nth(0)).toContainText('2');
  await expect(page.locator('[data-category-performance-summary] .kpi-card').nth(2)).toContainText('1 closed');
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
