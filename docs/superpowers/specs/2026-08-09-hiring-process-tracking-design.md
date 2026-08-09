# Hiring Process Tracking Design

Date: 2026-08-09
Status: Approved in conversation, pending written specification review

## Summary

The tracker currently stores one application status and one interview date. That
model cannot preserve multiple screening calls, assessments, interview rounds,
holds, employer responses, or user-closed steps.

This design adds repeatable hiring process steps to every application. Steps are
actual scheduled or completed events. They are not a planned company template.
The sequence is flexible, the same type can repeat, and no step is required.

The feature is additive. Existing applications, statuses, notes, interview dates,
CSV behavior, backups, and restore flows remain valid. Old applications can gain
new process steps without being recreated or reopened.

## Goals

1. Allow any number of actual hiring process steps per application.
2. Support screening calls, assessments, interviews, and discussions in any order.
3. Preserve company-specific names such as L1, L2, or Pre-screening AI Test.
4. Separate what happened, the employer response, and the user's tracking decision.
5. Let the user close an unresolved step as No Response after a flexible deadline.
6. Preserve late responses by allowing closed steps to be reopened.
7. Produce reliable reports without forcing every company into the same process.
8. Preserve all existing live data and accept backups created before this feature.
9. Include hiring process steps in every new full backup and restore round trip.

## Non-goals

- Recording speculative or recruiter-described future stages.
- Company-specific process templates.
- Enforcing a first step or a valid next-step transition.
- Calendar provider or inbox synchronization.
- Meeting links, locations, format, or duration tracking.
- A full contact or interviewer CRM.
- Separate preparation and post-step note systems.
- Automatic step closure or automatic application status changes.
- Replacing the existing application lifecycle or status history.
- Renaming existing application statuses or labels.
- Changing existing CSV import columns in this feature.

## Existing System Constraints

The current application record has one `interview_date`. Database and server
validation allow that date only when the application status is
`interview_scheduled`. List, Timeline, notification, calendar, and some report
queries depend on that field. `status_history` records application status changes,
not individual hiring steps.

Application detail currently contains Workflow, Content, and History tabs. The
Workflow tab already contains company research, questions, feedback, and tasks.
A multi-step process would overcrowd that tab.

There are two backup paths:

1. JSON export and import through the application API.
2. Full PostgreSQL or PGlite database plus upload bundles through the backup scripts.

Both paths are part of the compatibility contract.

## Core Design Decision

Add one child table named `application_process_steps`.

An application has zero or more steps. A step has a stable reporting group and a
free company-specific name. The group provides consistent analytics. The name
preserves the real process.

Examples:

| Position | Step group | Step name |
| --- | --- | --- |
| 1 | screening | Screening Call |
| 2 | interview | L1 |
| 3 | interview | L2 |
| 1 | assessment | Pre-screening AI Test |
| 2 | interview | Technical Interview |

No group is mandatory. A process may start directly with an assessment or
interview. Groups and names may repeat.

## Data Model

### `application_process_steps`

| Column | Type | Rules and purpose |
| --- | --- | --- |
| `id` | `BIGSERIAL` | Primary key |
| `application_id` | `BIGINT` | Required FK to applications, cascade on application deletion |
| `position` | `INTEGER` | Required, greater than zero, unique within the application |
| `step_group` | `TEXT` | `screening`, `assessment`, `interview`, `discussion`, or `other` |
| `step_name` | `TEXT` | Required free text company-specific name |
| `step_state` | `TEXT` | `scheduled`, `completed`, or `cancelled` |
| `event_date` | `DATE` | Required date of the scheduled or completed step |
| `event_time` | `TIME` | Optional display-only time, excluded from reports |
| `response_state` | `TEXT` | See response states below |
| `response_detail` | `TEXT` | Optional custom explanation, especially for `other` |
| `response_date` | `DATE` | Optional date the employer response arrived |
| `follow_up_due_date` | `DATE` | Optional flexible reminder date |
| `feedback_received` | `BOOLEAN` | `true`, `false`, or `null` when not recorded |
| `tracking_state` | `TEXT` | `open` or `closed` |
| `closure_reason` | `TEXT` | Required when closed; see closure reasons below |
| `closed_at` | `TIMESTAMPTZ` | Required when closed |
| `contact_name` | `TEXT` | Optional interviewer or recruiter context |
| `notes` | `TEXT` | One optional general note field |
| `source` | `TEXT` | `manual` or `legacy_interview_date` |
| `created_at` | `TIMESTAMPTZ` | Creation audit timestamp |
| `updated_at` | `TIMESTAMPTZ` | Updated by the existing timestamp trigger pattern |

Indexes:

- Unique index on `(application_id, position)`.
- Index on `(application_id, event_date, id)`.
- Partial index on open follow-up dates.
- Partial index on open scheduled step dates.
- Unique partial index allowing at most one scheduled legacy interview-date step
  per application.

### Stable step groups

The groups are intentionally coarse:

- `screening`: recruiter, HR, hiring manager, or other screening call.
- `assessment`: AI test, online test, coding assessment, or take home assignment.
- `interview`: technical, coding, system design, behavioral, managerial, panel,
  final, L1, L2, or another human interview.
- `discussion`: HR, compensation, contract, or offer discussion.
- `other`: a real step that does not fit the four reporting groups.

Suggested names may be offered in the UI, but `step_name` remains free text.

### Step state

- `scheduled`: the event is confirmed but has not been completed.
- `completed`: the event occurred, even if there is no employer response.
- `cancelled`: the event did not occur and remains in history.

Rescheduling changes `event_date` and optionally `event_time`. It does not add a
fourth state. The old and new values are recorded in Activity.

### Employer response state

- `not_applicable`: used while scheduled or cancelled.
- `awaiting_response`: completed, with no response yet.
- `advanced`: progressed to another step or offer.
- `not_advanced`: employer confirmed no progression.
- `on_hold`: employer explicitly paused the process.
- `no_response`: user closed the waiting period without an employer response.
- `other`: custom response captured in `response_detail`.

Adding a later non-cancelled step is objective evidence that the application
advanced. Reports may use that evidence even if an earlier response state was not
updated, but the stored earlier state is not silently rewritten.

### User tracking state

Tracking state is independent from the employer response:

- `open`: the user still expects or wants to track activity for this step.
- `closed`: the user has finished tracking this step.

Supported closure reasons are `advanced`, `not_advanced`, `no_response`,
`cancelled`, `withdrew`, and `other`.

A closed step may be reopened. Reopening clears `closed_at` and `closure_reason`
and creates an Activity entry. This supports late employer responses.

### Data invariants

1. `step_name` must contain non-whitespace text.
2. `event_date` is required because only actual scheduled or completed steps are
   recorded.
3. Scheduled steps use `response_state = not_applicable`.
4. Completed steps default to `response_state = awaiting_response`.
5. Cancelled steps default to closed with closure reason `cancelled`.
6. Closed steps require both `closed_at` and `closure_reason`.
7. Open steps have neither `closed_at` nor `closure_reason`.
8. `response_date` is never invented. It remains null when unknown.
9. `feedback_received = null` means the user did not record an answer. It is not
   treated as false in reports.
10. No state or response change automatically changes the application status.

These rules are enforced by server validation and by database checks where they
do not prevent future compatible values. Free text detail remains available for
unusual cases.

## User Experience

### Placement

Add a `Hiring Process` tab to application detail:

`Workflow | Hiring Process | Content | History`

The tab is the only place that creates and edits steps. Other screens summarize
or link to the same data.

### Hiring Process tab

The tab header shows:

- Total steps.
- Completed steps.
- Next scheduled step.
- Open steps waiting for response.
- `Add Step` action.

Steps use a vertical list in process position order so the actual company flow is
never rearranged by status. Open and overdue items are visually emphasized, and
the header can jump to the next open item. Older closed items may be collapsed
when the application has more than five steps. There is no product-level maximum.

Each card shows only reportable or operational data:

- Position and company-specific name.
- Step group.
- Event date and optional time.
- Step state.
- Employer response.
- Follow-up due date when present.
- Feedback recorded state when present.
- Open or closed tracking state.

Contact and notes stay in a collapsed optional area.

### Add or edit step form

Required fields:

- Step group.
- Step name.
- Event date.
- Step state.

Conditional fields:

- A completed step shows employer response, response date, follow-up due date,
  feedback received, contact, and notes.
- A scheduled step shows optional time, contact, and notes.
- A cancelled step requires no response fields.

There are no link, location, format, or duration fields.

### Reordering

Use Move Up and Move Down actions, matching the existing recruiter-question
interaction. Reordering runs in a transaction and renumbers all affected steps.
It never changes event dates or outcome data.

## Workflows

### Add a scheduled step

1. The user selects group, name, date, and optional time.
2. The server assigns the next position unless the user is inserting historical
   data.
3. The step is saved as open and scheduled.
4. If the application is Applied, the UI offers to change it to Interviewing.
   This is a separate explicit choice.
5. Closed or archived applications are not reopened.

### Add a completed historical step

1. The user chooses Completed and provides the actual date.
2. Employer response defaults to Awaiting Response but may be set immediately.
3. The step may be added to any existing, closed, or archived application.
4. The application status and status history are not changed automatically.

### Mark a scheduled step complete

1. The user selects Mark Complete.
2. Employer response defaults to Awaiting Response.
3. The UI suggests a follow-up due date three calendar days after the event date.
4. The user may change or clear that date.
5. No background job or timer closes the step automatically.

### Record a response

The user selects Advanced, Not Advanced, On Hold, or Other and may record the
response date and whether feedback was received. The UI offers, but does not
force, a matching application status change.

### Close as no response

When the follow-up due date passes, the step is displayed as overdue and offers
`Close as No Response`. The action sets:

- `response_state = no_response`
- `tracking_state = closed`
- `closure_reason = no_response`
- `closed_at = now()`

The application remains unchanged unless the user separately chooses Ghosted or
another lifecycle status.

### Reopen after a late response

The user reopens the step, records the new response, and optionally updates the
application status. Activity preserves both the earlier no-response closure and
the later response.

### Reschedule

The user changes the event date or time. The step remains scheduled. Activity
records old and new values. Reports use the latest event date.

### Cancel or delete

Cancel retains the real event and excludes it from completed and conversion
metrics. Delete exists only for an erroneous or duplicate record and requires
confirmation. Deletion is audited.

## Application-Level Compatibility

The application lifecycle remains coarse: Applied, Interview Scheduled, Offer,
Accepted, Rejected, Withdrawn, Ghosted, and archived state. The stored
`interview_scheduled` value and its existing UI label remain unchanged for API,
database, and workflow compatibility.

The existing `applications.interview_date` column, constraint, API response field,
and backup column are not removed or renamed.

Compatibility rules:

1. New process steps are the source for the Hiring Process tab and new reports.
2. Existing list and reminder behavior is enhanced to prefer open process steps and
   fall back to `applications.interview_date` when no process step exists.
3. Existing create or update requests that use `interview_date` continue to pass
   current validation and write the application exactly as before.
4. A successful legacy interview-date write also mirrors that date to a dedicated
   `source = legacy_interview_date` step in the same transaction.
5. Clearing a legacy interview date deletes only its scheduled derived legacy
   mirror in the same transaction. It never deletes manual or completed steps.
6. New process-step writes never overwrite existing application fields.
7. Old and closed applications may receive manual historical steps without being
   reopened or having their status changed.

## Migration and Existing Live Data

Add migration `018_application_process_steps.sql` after the currently staged 017
migration.

The migration is additive:

1. Create the new table, constraints, indexes, and updated-at trigger.
2. Do not alter or delete any existing application, status history, note, tag,
   document, task, or activity record.
3. Do not rename or drop `applications.interview_date` or any application status.
4. For each application whose current `interview_date` is non-null, insert one
   scheduled legacy step with the same date.
5. Do not create historical steps from `status_history` alone because the status
   transition date is not proof of the interview event date.
6. Make the backfill idempotent with the legacy-source unique index and conflict
   handling.

The server already applies unapplied migrations at startup. Therefore an old full
PGlite or PostgreSQL backup restored into the new code receives migration 018 on
the next server start. The migration adds data but does not rewrite the restored
application rows.

No implementation or migration command will be run against live production data
during development verification. Tests use isolated temporary databases.

## Backup and Restore Compatibility

### JSON backup format

New JSON backups use backup version 2 and include
`application_process_steps`. New code accepts both versions 1 and 2.

Version 1 restore behavior:

1. Restore all existing tables exactly as the current code does.
2. Treat missing `application_process_steps` as an empty list.
3. In the same restore transaction, after applications are inserted, add legacy
   steps only for restored rows with a non-null `interview_date`.
4. Do not infer any other process history.
5. Reset the process-step sequence from the actual table maximum after backfill so
   the next insert cannot reuse a backfilled ID.

Version 2 restore behavior:

1. Restore applications before process steps.
2. Restore every process-step column and original ID.
3. Never run the version 1 legacy backfill for a version 2 backup. The explicit
   process-step list is authoritative, including when that list is empty.
4. Reset the process-step sequence to the restored maximum ID.
5. Require the complete version 2 table set and reject an unknown table, wrong
   table type, or unsupported column before any truncate occurs. Version 1 keeps
   its current permissive missing-table behavior.

Restore internals must add the new table to:

- Backup table queries.
- Transactional truncate list.
- Foreign-key-safe insertion order after applications.
- Allowed table and column whitelist.
- Sequence reset list.

Migration 017 in this checkout also adds `research_sources`,
`job_context_snapshots`, `knowledge_chunks`, `retrieval_runs`, `agent_runs`,
`agent_steps`, and `pending_agent_actions`. If 017 ships with this release, JSON
backup version 2 must register all seven in the same export, validation, truncate,
foreign-key-safe insertion, and sequence-reset structures. Otherwise a version 2
backup could still lose already-present non-process data. This requirement does
not change or restage the existing 017 files.

If any database insert fails, the existing transaction rolls back. No partial
database restore is reported as successful.

Version 2 prevents an older app version from silently accepting and discarding
new process-step data. Older application code already rejects backup versions it
does not understand.

Compatibility matrix:

| Input | New-code behavior | Data result |
| --- | --- | --- |
| Existing live database | Apply additive migration 018 once | Existing rows stay unchanged; current interview dates gain one legacy mirror |
| Version 1 JSON backup | Accept and restore through the existing path | Existing data restores; current interview dates gain one legacy mirror |
| Version 2 JSON backup | Restore the explicit process-step list | Every process step and ID is preserved exactly |
| Pre-feature full database backup | Restore, then apply migration 018 at server startup | Existing rows stay unchanged; current interview dates gain one legacy mirror |
| New full database backup | Restore the table directly | Every process step is preserved exactly |
| Version 2 JSON backup opened by old code | Reject unsupported version | No silent partial restore or process-step loss |

### Full database and uploads backup

PGlite directory backups and PostgreSQL dumps already include every database table.
No special file format change is required. New round-trip verification adds process
steps to the fixture and asserts exact restoration.

Old full backups remain usable because server startup applies missing migrations.
New full backups restore the table and data directly.

The feature adds no uploaded files. Existing CV, AI document, and upload restoration
behavior remains unchanged.

### CSV compatibility

Existing application CSV headers and imports remain unchanged. Multi-step detail is
not flattened into the existing application CSV because that would create ambiguous
or breaking rows. Detailed process data is protected by full backups. A separate
process-step CSV export is outside this feature.

## Timeline, Calendar, and History

- Timeline keeps its existing legacy interview row and adds every open manual
  scheduled process step. A legacy mirror replaces rather than duplicates that
  existing row.
- Timeline includes open follow-up due dates as response reminders.
- Calendar export preserves the existing `interview-{application_id}` UID for a
  legacy mirror and uses `process-step-{step_id}` only for manual steps. This avoids
  duplicate events in an already-subscribed calendar.
- Legacy application dates are used only as a fallback when no mirrored step exists.
- Timeline deduplication includes the process-step ID so two real same-day steps for
  one application remain visible.
- Activity records create, update, reorder, complete, response, close, reopen,
  reschedule, cancel, and delete actions.
- Application History continues to show current status history unchanged and adds a
  separate hiring-process activity stream.

## Reporting

New Insights data is grouped by step event date. Existing application reports keep
their current applied-date semantics. The UI labels this difference.

### Counts

- Scheduled steps by group.
- Completed steps by group.
- Completed screening calls.
- Distinct applications with a completed screening call.
- Awaiting-response steps.
- On-hold steps.
- No-response closures.
- Steps with recorded feedback, without feedback, and unknown feedback state.

### Progression paths

- Screening to assessment.
- Screening to interview.
- Direct to assessment, when the first non-cancelled step is an assessment.
- Direct to interview, when the first non-cancelled step is an interview.
- Assessment to interview.
- Interview to offer at the application level.

Progression is based on a later non-cancelled step position or an explicit Advanced
response. An active Awaiting Response or On Hold step is never classified as a
failure.

### Rates and timing

- Response rate by step group.
- No-response rate by step group.
- Progression rate by step group.
- Feedback-received rate with unknown values shown separately.
- Median days from event date to response date.
- Average completed steps before offer, rejection, withdrawal, ghosting, or user
  closure.

Event counts and distinct-application counts are displayed separately so multiple
screening calls for one application do not inflate the application funnel.

The current `Interviewed` application funnel remains a distinct-application metric.
It counts applications with a non-cancelled interview-group step and retains a
legacy status-history fallback so historical Insights do not drop after release.
Screening calls and assessments do not count as human interviews.

## API and Service Boundaries

Add a focused process-step service rather than placing all logic in the server entry
file. It owns validation, CRUD, reordering, mirroring legacy dates, Activity writes,
and report classification helpers.

Routes:

- `GET /api/applications/:applicationId/process-steps`
- `POST /api/applications/:applicationId/process-steps`
- `PUT /api/process-steps/:stepId`
- `DELETE /api/process-steps/:stepId`
- `PUT /api/applications/:applicationId/process-steps/order`
- `GET /api/process-steps/upcoming`
- `GET /api/process-steps/summaries`
- `GET /api/process-insights`

The Hiring Process tab fetches its rows through the dedicated GET route. Do not add
`process_steps` to `readApi.getApplication()`: POST, PUT, archive, restore, and direct
detail reads currently share that response builder, and their existing response
shapes remain unchanged.

Existing routes and response fields remain unchanged. Process summaries and reports
use dedicated new read endpoints so current List, Timeline, and Stats API contracts
do not gain required fields. The existing UI may fetch and merge these additive
responses.

All create, update, reorder, legacy mirror, and delete operations run in database
transactions with application ownership checks.

## Error Handling

- Reject missing application, group, name, state, or event date with a 400 response.
- Reject unsupported stable states while allowing custom response detail through
  `other`.
- Reject a step ID that does not belong to the requested application.
- Reject closed state without closure reason.
- Allow past scheduled dates but mark them overdue instead of blocking data entry.
- Allow response and feedback fields to remain unknown.
- Never interpret a missing next step as rejection or no response.
- Never auto-close based on a timer.
- Never auto-change an application status.
- Preserve database rollback behavior when a multi-write operation fails.

## Security and Privacy

The data remains local and follows existing application access boundaries. Text
fields use current request-size limits, validation, parameterized SQL, and escaped
HTML rendering. Contact and note fields are optional and are included in full
backups because they may contain personal information.

No new external service, credential, network dependency, or package is added.

## Verification Strategy

Implementation follows test-driven development with isolated temporary databases.

### Migration and compatibility tests

1. Apply migration 018 to a pre-feature database and verify every existing table
   row and application field is unchanged.
2. Verify one legacy step is added only for non-null current interview dates.
3. Re-run migration and verify no duplicate legacy steps.
4. Add manual steps to old, closed, and archived applications without status change.
5. Verify existing application create, update, archive, restore, and delete flows.
6. Verify old status-history-based Insights counts do not decrease.
7. Verify mirroring does not change `applications.updated_at` or the existing List
   last-touched value.

### Backup tests

1. Restore a version 1 JSON backup with no process-step key.
2. Restore a version 1 JSON backup containing applications with interview dates and
   verify safe legacy backfill.
3. Export and restore a version 2 JSON backup containing multiple steps and compare
   every field and ID.
4. Create another step after restore and verify sequence reset correctness.
5. Reject a version 2 backup with a missing required table, wrong table type,
   unknown table, unsupported column, or orphan process step before changing data.
6. Verify version 2 includes all tables from migrations 017 and 018 when both ship.
7. Extend full PGlite backup verification with scheduled, completed, closed,
   reopened, and no-response steps.
8. Verify upload, CV, and AI document restoration still passes unchanged.
9. Restore a pre-feature full database backup into new code and verify startup
   migration plus application read behavior.

### API tests

1. Create seven differently named steps with repeated groups and arbitrary order.
2. Create a process that begins directly with an assessment.
3. Create a process that begins directly with an interview.
4. Complete, hold, close, reopen, reschedule, cancel, reorder, and delete steps.
5. Verify no process action silently changes application status.
6. Verify legacy interview-date writes continue working and mirror safely.
7. Verify application deletion cascades to steps while archive and restore retain
   them.
8. Assert POST, PUT, archive, restore, and direct application response key sets are
   unchanged.

### Reporting tests

1. Separate event counts from distinct-application counts.
2. Count completed screening calls but exclude scheduled and cancelled calls.
3. Verify screening-to-assessment and screening-to-interview progression.
4. Verify direct-to-assessment and direct-to-interview paths.
5. Exclude Awaiting Response and On Hold from failure counts.
6. Keep feedback unknown separate from explicit false.
7. Verify median response timing.
8. Verify Interviewed counts human interview steps plus legacy fallback without
   double counting.
9. Verify legacy mirrors produce no duplicate Timeline or calendar entries and two
   same-day manual steps remain distinct.

### UI tests

1. Add scheduled and completed steps from application detail.
2. Add historical steps to old and closed applications.
3. Display more than seven steps without horizontal overflow.
4. Complete a step, edit the suggested follow-up date, and close as No Response.
5. Reopen a closed step and record a late response.
6. Verify Timeline, History, List summary, and Insights output.
7. Verify form labels, keyboard access, focus return, validation messages, and
   narrow viewport behavior.

### Final verification

- Focused unit and API tests.
- Existing full Playwright suite.
- Syntax checks and repository check command.
- Full backup and restore verifier.
- Fresh temporary migration and seed smoke test.
- Rendered browser checks for List, Hiring Process, Timeline, History, and Insights.
- `git diff --check` and a non-ASCII/mojibake scan for new files.

## Rollout and Recovery

1. Take a normal full backup before applying the release to live data.
2. Apply the additive migration through normal server startup.
3. Verify existing application count, status distribution, and a sample of current
   interview dates before creating new steps.
4. Verify legacy backfill counts equal applications with non-null interview dates.
5. Use the new feature without rewriting old application records.

Migration 018 is forward-only because removing a table after users create process
data would be destructive. Recovery uses the pre-release full backup. The
implementation must not provide an automatic down migration that drops user data.

## Acceptance Criteria

The feature is complete when:

1. Any old or new application can hold unlimited flexible process steps.
2. Screening, assessment, interview, discussion, and other steps can start or repeat
   in any order.
3. Completed steps can wait, go on hold, close as no response, and reopen later.
4. The Hiring Process tab is the primary edit surface.
5. Timeline, calendar, History, List, and Insights use the enhanced data without
   breaking their existing behavior.
6. Existing application fields and historical records remain unchanged.
7. Version 1 JSON backups and pre-feature full backups restore successfully.
8. Version 2 JSON and new full backups preserve every process step.
9. Existing backup, restore, application, and Insights regression tests still pass.
10. No new dependency or external service is introduced.
