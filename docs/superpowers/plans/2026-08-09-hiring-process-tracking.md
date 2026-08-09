# Hiring Process Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unlimited, flexible hiring process steps to old and new applications while preserving existing application, status, CSV, API, and backup behavior.

**Architecture:** Store process events in a new additive child table and expose them only through dedicated APIs. A focused service owns validation, transactions, legacy interview-date mirroring, summaries, and reports. The existing application response remains unchanged; the client fetches process data only for the Hiring Process tab and additive List, Timeline, and Insights views.

**Tech Stack:** Node.js 20+, native Node HTTP server, PostgreSQL and PGlite-compatible SQL, vanilla JavaScript, CSS, Node test runner, Playwright.

## Global Constraints

- Do not add dependencies or change package versions.
- Do not modify, delete, unstage, or include the existing staged files `docs/LOCAL_AGENT_WORKFLOWS.md`, `migrations/017_local_agent_workflows.sql`, or `server/services/agentWorkflows.js` in task commits.
- Keep `applications.interview_date`, `application_status`, `status_history`, existing CSV columns, and existing application response keys unchanged.
- Do not run migration or restore commands against the user's live database. Use isolated PGlite test directories only.
- Do not automatically change application status, status history, archive state, or `applications.updated_at` from a process-step operation.
- Keep meeting link, location, format, and duration out of the process-step schema and UI.
- Support any number of steps and repeated groups or names in any order.
- Preserve JSON backup version 1 restore behavior; export version 2 with every table introduced by migrations 017 and 018.
- Use dedicated process endpoints. Do not add `process_steps` to `readApi.getApplication()`.
- Write each behavior test first, run it, and confirm the expected failure before production code.
- Run Playwright serially with `--workers=1` because the suite uses one destructive shared database.

---

### Task 1: Add the process-step schema and core service

**Files:**
- Create: `migrations/018_application_process_steps.sql`
- Create: `server/services/processSteps.js`
- Create: `tests/processSteps.test.js`
- Create: `tests/processStepsMigration.test.js`

**Interfaces:**
- Produces: `createProcessStepsService({ pool, audit, logActivity })`.
- Produces methods: `list(applicationId, executor)`, `create(req, applicationId, input)`, `update(req, stepId, input)`, `remove(req, stepId)`, `reorder(req, applicationId, orderedIds)`, `syncLegacyInterviewStep(client, applicationId, interviewDate)`, `restoreLegacyInterviewSteps(client)`, `summaries(applicationIds)`, `upcoming()`, and `insights({ mode, period })`.
- Produces pure helper: `normalizeProcessStepInput(input, currentStep)`.
- Produces pure helper: `summarizeProcessInsights(rows)`.
- Every returned step uses ISO `YYYY-MM-DD` date strings and the 21 columns defined by the design specification.

- [ ] **Step 1: Write the failing migration test**

Create an in-memory PGlite database, apply migrations 001 through 017, insert two applications, then apply migration 018. Assert the original application rows and `updated_at` values are identical, one non-null interview date creates one scheduled legacy mirror, and the null interview date creates none.

```js
test('migration 018 preserves applications and mirrors only current interview dates', async () => {
  const before = await db.query('SELECT * FROM applications ORDER BY id');
  await db.exec(await readFile(migration018, 'utf8'));
  const after = await db.query('SELECT * FROM applications ORDER BY id');
  const steps = await db.query('SELECT application_id, position, step_group, step_state, event_date::text, source FROM application_process_steps ORDER BY application_id');

  assert.deepEqual(after.rows, before.rows);
  assert.deepEqual(steps.rows, [{
    application_id: 1,
    position: 1,
    step_group: 'interview',
    step_state: 'scheduled',
    event_date: '2026-08-12',
    source: 'legacy_interview_date'
  }]);
});
```

- [ ] **Step 2: Run the migration test and verify the expected failure**

Run: `node --test tests/processStepsMigration.test.js`

Expected: FAIL because `migrations/018_application_process_steps.sql` does not exist.

- [ ] **Step 3: Write migration 018**

Create `application_process_steps` with these exact stable values:

```sql
step_group IN ('screening', 'assessment', 'interview', 'discussion', 'other')
step_state IN ('scheduled', 'completed', 'cancelled')
response_state IN ('not_applicable', 'awaiting_response', 'advanced', 'not_advanced', 'on_hold', 'no_response', 'other')
tracking_state IN ('open', 'closed')
closure_reason IN ('advanced', 'not_advanced', 'no_response', 'cancelled', 'withdrew', 'other')
source IN ('manual', 'legacy_interview_date')
```

Use a cascading application FK, positive unique `(application_id, position)`, the existing `set_updated_at()` trigger, open/closed consistency checks, application/date indexes, open follow-up and scheduled partial indexes, and one scheduled legacy mirror partial unique index. Backfill only non-null `applications.interview_date` rows as position 1, group `interview`, name `Interview`, scheduled/open/not-applicable, and source `legacy_interview_date`.

- [ ] **Step 4: Run the migration test and verify it passes**

Run: `node --test tests/processStepsMigration.test.js`

Expected: PASS with one legacy mirror and unchanged application snapshots.

- [ ] **Step 5: Write failing pure validation and report tests**

Cover these observable behaviors in `tests/processSteps.test.js`:

```js
test('summarizeProcessInsights separates events from applications and direct paths', () => {
  const result = summarizeProcessInsights([
    row({ id: 1, application_id: 10, position: 1, step_group: 'screening', step_state: 'completed', response_state: 'advanced' }),
    row({ id: 2, application_id: 10, position: 2, step_group: 'interview', step_state: 'completed', response_state: 'awaiting_response' }),
    row({ id: 3, application_id: 11, position: 1, step_group: 'assessment', step_state: 'completed', response_state: 'advanced' }),
    row({ id: 4, application_id: 11, position: 2, step_group: 'interview', step_state: 'scheduled' })
  ]);

  assert.equal(result.totals.completed_screening_calls, 1);
  assert.equal(result.totals.screened_applications, 1);
  assert.equal(result.paths.screening_to_interview, 1);
  assert.equal(result.paths.direct_to_assessment, 1);
  assert.equal(result.paths.assessment_to_interview, 1);
});
```

Also test completed defaults to `awaiting_response`, scheduled forces `not_applicable`, cancelled closes with `cancelled`, feedback null stays unknown, median response days, and invalid group/name/date/closure combinations return status code 400.

- [ ] **Step 6: Run the service tests and verify the expected failure**

Run: `node --test tests/processSteps.test.js`

Expected: FAIL because the service module and helper do not exist.

- [ ] **Step 7: Implement the focused service**

Use the factory below and keep transaction ownership inside mutating methods:

```js
export function createProcessStepsService({ pool, audit, logActivity }) {
  return {
    list,
    create,
    update,
    remove,
    reorder,
    syncLegacyInterviewStep,
    restoreLegacyInterviewSteps,
    summaries,
    upcoming,
    insights
  };
}
```

Required transition behavior:

```js
scheduled => { response_state: 'not_applicable', tracking_state: 'open', closure_reason: null, closed_at: null }
completed with no supplied response => { response_state: 'awaiting_response', tracking_state: 'open' }
cancelled => { response_state: 'not_applicable', tracking_state: 'closed', closure_reason: 'cancelled', closed_at: now }
tracking_state open => { closure_reason: null, closed_at: null }
tracking_state closed => require closure_reason and set closed_at when absent
```

Reorder in one transaction by first adding a positive offset larger than the step count, then assigning contiguous positions 1 through N. Reject missing, duplicate, or foreign step IDs. New manual steps always use the next position and `source = 'manual'`.

Legacy synchronization must update the same scheduled legacy row when the date changes, insert it at the next position when absent, and delete only the scheduled legacy row when the date clears. It must never touch a manual or completed row.

- [ ] **Step 8: Run the focused tests**

Run: `node --test tests/processSteps.test.js tests/processStepsMigration.test.js`

Expected: PASS.

- [ ] **Step 9: Commit only Task 1 files**

```bash
git add migrations/018_application_process_steps.sql server/services/processSteps.js tests/processSteps.test.js tests/processStepsMigration.test.js
git commit --only -m "feat: add hiring process step model" -- migrations/018_application_process_steps.sql server/services/processSteps.js tests/processSteps.test.js tests/processStepsMigration.test.js
```

---

### Task 2: Add dedicated APIs and legacy application mirroring

**Files:**
- Modify: `server/routes.js`
- Modify: `server/index.js`
- Modify: `server/services/readApi.js`
- Create: `tests/processSteps.api.spec.js`
- Modify: `tests/api.spec.js`

**Interfaces:**
- Consumes: `createProcessStepsService` from Task 1.
- Produces JSON shapes `{ process_steps }`, `{ process_step }`, `{ summaries }`, `{ reminders }`, and the process Insights payload.
- Existing application endpoints retain their exact keys.

- [ ] **Step 1: Write the failing API tests**

Create one application through the existing endpoint, then assert:

```js
const created = await request.post(`/api/applications/${applicationId}/process-steps`, {
  data: {
    step_group: 'assessment',
    step_name: 'Pre-screening AI Test',
    step_state: 'completed',
    event_date: '2026-08-01'
  }
});
expect(created.status()).toBe(201);
expect((await created.json()).process_step).toMatchObject({
  position: 1,
  step_group: 'assessment',
  step_name: 'Pre-screening AI Test',
  response_state: 'awaiting_response',
  tracking_state: 'open'
});
```

Cover repeated groups and names, seven steps, direct assessment and direct interview, completion, on hold, no response close, reopen, reschedule, cancel, reorder, delete, old rejected and archived applications, application deletion cascade, and validation errors. After every process mutation, read the application and assert status, interview date, archive state, and status history are unchanged.

Add exact response-key assertions for existing create, update, direct read, archive, and restore responses before and after process support.

- [ ] **Step 2: Run the API tests and verify the expected failure**

Run: `npx playwright test tests/processSteps.api.spec.js --workers=1 --reporter=line`

Expected: FAIL with 404 for the missing process route.

- [ ] **Step 3: Register thin route handlers**

Add these routes without changing generic application routes:

```text
GET    /api/applications/:applicationId/process-steps
POST   /api/applications/:applicationId/process-steps
PUT    /api/applications/:applicationId/process-steps/order
PUT    /api/process-steps/:stepId
DELETE /api/process-steps/:stepId
GET    /api/process-steps/upcoming
GET    /api/process-steps/summaries
GET    /api/process-insights
```

Read JSON in `server/index.js`, call the service, and return the dedicated shapes. Keep `readApi.getApplication()` unchanged.

- [ ] **Step 4: Mirror legacy interview dates inside existing transactions**

Call `syncLegacyInterviewStep` after the application row exists and before commit in:

```text
createApplication
updateApplication when the normalized interview date changes
importApplicationsCsv
```

The create and update HTTP responses must still come only from `readApi.getApplication()`.

- [ ] **Step 5: Expose process activity without changing History shape**

Add these action values to `meaningfulActivityActions`:

```js
'process_step_created',
'process_step_updated',
'process_step_completed',
'process_step_rescheduled',
'process_step_response_recorded',
'process_step_closed',
'process_step_reopened',
'process_step_cancelled',
'process_step_reordered',
'process_step_deleted'
```

- [ ] **Step 6: Run focused API and unit tests**

Run: `node --test tests/processSteps.test.js tests/processStepsMigration.test.js && npx playwright test tests/processSteps.api.spec.js tests/api.spec.js --workers=1 --reporter=line`

Expected: new process tests PASS. If an unrelated pre-existing assertion in `tests/api.spec.js` still fails, record it verbatim and confirm no new process test fails.

- [ ] **Step 7: Commit only Task 2 files**

```bash
git add server/routes.js server/index.js server/services/readApi.js tests/processSteps.api.spec.js tests/api.spec.js
git commit --only -m "feat: expose hiring process step APIs" -- server/routes.js server/index.js server/services/readApi.js tests/processSteps.api.spec.js tests/api.spec.js
```

---

### Task 3: Make JSON and physical backups preserve all new data

**Files:**
- Modify: `server/index.js`
- Modify: `scripts/verify-backup-restore.mjs`
- Create: `tests/processSteps.backup.spec.js`

**Interfaces:**
- Consumes: migration 017 table definitions and Task 1 process-step schema.
- Produces: JSON backup version 2; accepts versions 1 and 2.
- Version 1 is permissive for missing table keys and creates legacy mirrors after restoring applications.
- Version 2 requires the full exact table set and treats `application_process_steps`, including an empty array, as authoritative.

- [ ] **Step 1: Write failing backup compatibility tests**

Cover these independent cases:

```text
v1 without application_process_steps restores and backfills non-null interview dates
v1 backfill resets the sequence so the next manual step gets a fresh ID
v2 export contains application_process_steps plus all seven migration 017 tables
v2 round trip preserves every process-step field and original ID
v2 explicit empty application_process_steps performs no backfill
v2 missing required key returns 400 before changing sentinel data
v2 wrong table type returns 400 before changing sentinel data
v2 unknown table returns 400 before changing sentinel data
v2 unsupported column returns 400 before changing sentinel data
orphan process step rolls back and preserves sentinel data
restored highest process ID 7002 makes the next created ID 7003
```

- [ ] **Step 2: Run the backup tests and verify the expected failure**

Run: `npx playwright test tests/processSteps.backup.spec.js --workers=1 --reporter=line`

Expected: FAIL because export is version 1 and process tables are not registered.

- [ ] **Step 3: Register deterministic version 2 export queries**

Add `application_process_steps` ordered by `application_id, position, id` and these migration 017 tables:

```text
research_sources
job_context_snapshots
knowledge_chunks
retrieval_runs
agent_runs
agent_steps
pending_agent_actions
```

Add every exact column from migrations 017 and 018 to `backupTableColumns`.

- [ ] **Step 4: Add preflight validation before any truncate**

For version 2, compare `Object.keys(backup.data)` to `Object.keys(backupTableColumns)`, require every value to be an array, reject unknown tables, and call `validateBackupTableColumns` for every non-empty table before `restoreBackupPayload` begins its transaction. Keep version 1's current missing-key behavior.

- [ ] **Step 5: Add FK-safe restore and database-based sequence reset**

Insert parent rows before children in this order:

```text
cv_versions
applications
research_sources
job_context_snapshots
knowledge_chunks
retrieval_runs
agent_runs
agent_steps
pending_agent_actions
application_process_steps
remaining existing tables in their current order
```

After all rows and any version 1 legacy backfill are inserted, reset every listed sequence from the actual `SELECT max(id)` in the restored table, not only IDs present in `backup.data`.

- [ ] **Step 6: Extend the physical PGlite verifier**

Before backup, create scheduled, completed, and closed process steps through the API. After restore, compare their IDs and fields, then create another step and assert its ID exceeds the restored maximum.

- [ ] **Step 7: Run focused backup verification**

Run: `npx playwright test tests/processSteps.backup.spec.js --workers=1 --reporter=line && npm run verify:backup-restore`

Expected: PASS for JSON v1, JSON v2, and the physical PGlite round trip.

- [ ] **Step 8: Commit only Task 3 files**

```bash
git add server/index.js scripts/verify-backup-restore.mjs tests/processSteps.backup.spec.js
git commit --only -m "feat: preserve hiring process data in backups" -- server/index.js scripts/verify-backup-restore.mjs tests/processSteps.backup.spec.js
```

---

### Task 4: Build the Hiring Process application tab

**Files:**
- Modify: `public/js/app.js`
- Modify: `public/js/render.js`
- Modify: `public/css/styles.css`
- Create: `tests/hiringProcess.ui.spec.js`

**Interfaces:**
- Consumes: dedicated list/create/update/delete/order APIs.
- The tab route key is `hiring-process`.
- The application payload remains unchanged; the client temporarily combines it with `{ process_steps }` only while rendering this tab.

- [ ] **Step 1: Write the failing UI test**

Create an application, open its detail page, navigate through the accessible `Hiring Process` tab, add a scheduled `Screening Call`, add a completed `Pre-screening AI Test`, and assert both render in position order. Then complete, hold, close as no response, reopen, reorder, and delete through visible controls.

Use stable hooks:

```text
data-process-step-form
data-process-step-card
data-process-step-edit
data-process-step-move
data-process-step-close-no-response
data-process-step-reopen
data-process-step-delete
```

- [ ] **Step 2: Run the UI test and verify the expected failure**

Run: `npx playwright test tests/hiringProcess.ui.spec.js --workers=1 --reporter=line`

Expected: FAIL because the tab link does not exist.

- [ ] **Step 3: Add route-aware dedicated fetching**

Whitelist `hiring-process` in `parseRoute`. In `renderCurrentRoute`, fetch `/api/applications/:id/process-steps` every time that tab is active, then render with:

```js
const pagePayload = state.route.tab === 'hiring-process'
  ? { ...payload, process_steps: processPayload.process_steps }
  : payload;
```

Do not store process steps in `state.currentApplication`, so same-application tab caching cannot make mutations stale.

- [ ] **Step 4: Render the tab between Workflow and Content**

Add a vertical position-ordered flow with totals, completed count, next scheduled step, awaiting-response count, a flexible add/edit form, and cards. Required form fields are group, name, date, and state. Optional fields are time, response, response date, follow-up date, feedback tri-state, tracking state, closure reason, contact, and notes.

Use only existing Bootstrap icon classes and existing route-card, pill, button, form, and details patterns. Add narrowly scoped CSS for process cards, overdue/open emphasis, action wrapping, and narrow viewports.

- [ ] **Step 5: Bind form and card actions**

POST for new rows, PUT for edits and state changes, PUT ordered IDs for Move Up and Move Down, and confirmed DELETE for erroneous manual records. `Mark Complete` populates the edit form with `completed`, `awaiting_response`, and a suggested follow-up date three calendar days after `event_date`; the user saves or clears it. `Close as No Response` and `Reopen` use explicit PUT payloads.

- [ ] **Step 6: Run the UI test and syntax checks**

Run: `node --check public/js/app.js && node --check public/js/render.js && npx playwright test tests/hiringProcess.ui.spec.js --workers=1 --reporter=line`

Expected: PASS.

- [ ] **Step 7: Commit only Task 4 files**

```bash
git add public/js/app.js public/js/render.js public/css/styles.css tests/hiringProcess.ui.spec.js
git commit --only -m "feat: add hiring process application tab" -- public/js/app.js public/js/render.js public/css/styles.css tests/hiringProcess.ui.spec.js
```

---

### Task 5: Add List, Timeline, calendar, and History integration

**Files:**
- Modify: `server/index.js`
- Modify: `public/js/state.js`
- Modify: `public/js/app.js`
- Modify: `public/js/render.js`
- Modify: `tests/processSteps.api.spec.js`
- Modify: `tests/hiringProcess.ui.spec.js`

**Interfaces:**
- Consumes: `{ summaries }` and `{ reminders }` from dedicated process APIs.
- Existing `/api/applications`, `/api/reminders`, and application detail shapes remain unchanged.
- Manual calendar UID: `process-step-{stepId}`. Legacy UID remains `interview-{applicationId}`.

- [ ] **Step 1: Write failing integration tests**

Assert a legacy mirrored interview produces one Timeline event and the existing ICS UID only once. Assert two same-day manual interview steps both appear with distinct process IDs and ICS UIDs. Assert a completed open step with a follow-up due date appears as a follow-up reminder. Assert List shows process count and next step without removing the existing next action. Assert History renders process activity separately from status history.

- [ ] **Step 2: Run the focused tests and verify the expected failure**

Run: `npx playwright test tests/processSteps.api.spec.js tests/hiringProcess.ui.spec.js --workers=1 --reporter=line`

Expected: FAIL because summaries, process reminders, and process calendar events are not visible yet.

- [ ] **Step 3: Merge additive List summaries client-side**

After loading the current application page, call `/api/process-steps/summaries?ids=1,2,3`, map rows by `application_id`, and pass the matching summary to `buildApplicationRow`. Render `N process steps` and the next step name/date as secondary content. Existing next action and interview controls remain unchanged.

- [ ] **Step 4: Merge additive Timeline reminders client-side**

Load `/api/reminders` and `/api/process-steps/upcoming` in parallel. Deduplicate with:

```js
const key = `${item.process_step_id || item.id}-${item.event_date}-${item.type}`;
```

Use `event.application_id || event.id` for detail navigation. Render `STEP` and `FUP` badges and include the company-specific step name.

- [ ] **Step 5: Extend ICS without duplicating legacy events**

Keep current application query and UIDs. Query only open scheduled manual process rows for additional events. Do not emit a second ICS event for `source = 'legacy_interview_date'`.

- [ ] **Step 6: Split process activity in History**

Keep Status History unchanged. Render `process_step_` activity in a separate `Hiring Process Activity` card and exclude those rows from the general Activity card.

- [ ] **Step 7: Run focused integration tests**

Run: `node --check server/index.js && node --check public/js/app.js && node --check public/js/render.js && npx playwright test tests/processSteps.api.spec.js tests/hiringProcess.ui.spec.js --workers=1 --reporter=line`

Expected: PASS.

- [ ] **Step 8: Commit only Task 5 files**

```bash
git add server/index.js public/js/state.js public/js/app.js public/js/render.js tests/processSteps.api.spec.js tests/hiringProcess.ui.spec.js
git commit --only -m "feat: surface hiring process across workflow views" -- server/index.js public/js/state.js public/js/app.js public/js/render.js tests/processSteps.api.spec.js tests/hiringProcess.ui.spec.js
```

---

### Task 6: Add process reports and preserve legacy interview metrics

**Files:**
- Modify: `server/index.js`
- Modify: `server/services/processSteps.js`
- Modify: `public/js/app.js`
- Modify: `public/js/render.js`
- Modify: `tests/processSteps.test.js`
- Modify: `tests/processSteps.api.spec.js`
- Modify: `tests/hiringProcess.ui.spec.js`

**Interfaces:**
- Consumes: `summarizeProcessInsights(rows)` and `GET /api/process-insights`.
- Existing `/api/stats`, selected-tag, and chart-tag response keys remain unchanged.
- Existing interviewed counts use process interview evidence OR legacy status-history evidence with distinct application IDs.

- [ ] **Step 1: Write failing report tests**

Seed screening, assessment, interview, discussion, cancelled, awaiting, on-hold, no-response, feedback true, feedback false, and feedback null rows. Assert:

```text
scheduled and completed counts by group
completed screening event count
distinct screened application count
screening to assessment
screening to interview
direct to assessment
direct to interview
assessment to interview
interview to offer
awaiting and on hold excluded from failure
feedback true, false, and unknown remain separate
response, no-response, and progression rates
median response days
```

Also assert existing Stats interviewed totals do not drop for legacy history and increase once for an application that has only a process interview.

- [ ] **Step 2: Run report tests and verify the expected failure**

Run: `node --test tests/processSteps.test.js && npx playwright test tests/processSteps.api.spec.js --workers=1 --reporter=line`

Expected: FAIL on missing report values or legacy/process union counts.

- [ ] **Step 3: Complete dedicated process aggregation**

Return this stable shape:

```js
{
  mode,
  period,
  totals: {
    steps,
    scheduled,
    completed,
    completed_screening_calls,
    screened_applications,
    awaiting_response,
    on_hold,
    no_response,
    feedback_received,
    feedback_not_received,
    feedback_unknown
  },
  groups: [{
    step_group,
    scheduled,
    completed,
    responded,
    advanced,
    no_response,
    response_rate,
    progression_rate,
    no_response_rate,
    median_response_days
  }],
  paths: {
    screening_to_assessment,
    screening_to_interview,
    direct_to_assessment,
    direct_to_interview,
    assessment_to_interview,
    interview_to_offer
  }
}
```

Use event dates for process period filtering. Use position among non-cancelled steps for paths. Count events and distinct applications separately.

- [ ] **Step 4: Union process interviews into existing distinct-app metrics**

For Stats, selected-tag stats, and selected-chart-tag stats, classify an application as interviewed when either condition is true:

```sql
EXISTS (
  SELECT 1 FROM status_history sh
  WHERE sh.application_id = a.id AND sh.to_status = 'interview_scheduled'
)
OR EXISTS (
  SELECT 1 FROM application_process_steps ps
  WHERE ps.application_id = a.id
    AND ps.step_group = 'interview'
    AND ps.step_state <> 'cancelled'
)
```

Keep `COUNT(DISTINCT a.id)` so mirrors and repeated rounds do not double count.

- [ ] **Step 5: Render Process Performance in Insights**

Fetch `/api/process-insights?mode=active|all` alongside existing Insights requests. Add a section containing screening calls, screened applications, awaiting, no response, path counts, and a by-group table. Do not rename or remove current Insights cards or keys.

- [ ] **Step 6: Run focused report and UI tests**

Run: `node --test tests/processSteps.test.js && npx playwright test tests/processSteps.api.spec.js tests/hiringProcess.ui.spec.js --workers=1 --reporter=line`

Expected: PASS.

- [ ] **Step 7: Commit only Task 6 files**

```bash
git add server/index.js server/services/processSteps.js public/js/app.js public/js/render.js tests/processSteps.test.js tests/processSteps.api.spec.js tests/hiringProcess.ui.spec.js
git commit --only -m "feat: report hiring process outcomes" -- server/index.js server/services/processSteps.js public/js/app.js public/js/render.js tests/processSteps.test.js tests/processSteps.api.spec.js tests/hiringProcess.ui.spec.js
```

---

### Task 7: Run compatibility, regression, and rendered local verification

**Files:**
- Modify only files required by a reproduced feature regression.

**Interfaces:**
- Consumes all prior tasks.
- Produces final evidence without changing the live database.

- [ ] **Step 1: Run static and focused unit verification**

Run:

```bash
npm run check
node --check server/services/processSteps.js
node --check public/js/app.js
node --check public/js/render.js
node --test tests/text.test.js tests/readApi.test.js tests/processSteps.test.js tests/processStepsMigration.test.js
git diff --check
```

Expected: exit 0 for every command.

- [ ] **Step 2: Run focused Playwright verification serially**

Run:

```bash
npx playwright test tests/processSteps.api.spec.js tests/processSteps.backup.spec.js tests/hiringProcess.ui.spec.js --workers=1 --reporter=line
```

Expected: all feature tests PASS.

- [ ] **Step 3: Run the physical backup round trip**

Run: `npm run verify:backup-restore`

Expected: JSON output with `"ok": true` and restored process-step IDs.

- [ ] **Step 4: Run the existing suite serially and classify baseline failures**

Run: `npx playwright test --workers=1 --reporter=line`

Expected: no new failures. Compare any failure against the recorded pre-change baseline failures in `tests/api.spec.js` archived total and the existing brittle UI selectors; do not claim the whole suite passes if those remain.

- [ ] **Step 5: Verify source cleanliness and compatibility**

Run:

```bash
rg -n "[^\x00-\x7F]" migrations/018_application_process_steps.sql server/services/processSteps.js tests/processSteps*.js tests/hiringProcess.ui.spec.js
git status --short
```

Expected: no new non-ASCII or whitespace errors; the three pre-existing staged 017 files remain staged and untouched.

- [ ] **Step 6: Perform rendered browser verification**

Start the isolated test server, inspect List, Hiring Process, Timeline, History, and Insights at desktop and narrow widths, and verify no horizontal overflow, hidden actions, duplicate legacy events, or broken focus behavior. Use the configured local browser workflow and do not point it at the user's live database.

- [ ] **Step 7: Record verification evidence**

Append the exact commands, exit codes, test counts, and any unchanged baseline failures to the task report. If verification required a reproduced fix, that fix and its covering test must already have completed a red-green cycle and a path-limited commit before this evidence is recorded. Do not create an empty commit.
