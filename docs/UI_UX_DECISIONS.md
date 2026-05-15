# UI and UX Decisions

## Design Philosophy

The app is designed as a focused personal workspace, not a broad multi-user SaaS interface.

Core goals:

- fast access to active applications
- low-friction updates during a job search
- minimal setup and minimal UI ceremony
- clear separation between tracking, preparation, and generated content

The interface favors practical density over decorative complexity.

## Workspace Layout

The main workspace is split into dedicated views:

- List
- Reminders
- Kanban
- Reports
- Activity
- Job Boards
- Toolkit
- Settings

This is intentional. Job searching is not one workflow. Different modes need different mental context, and forcing everything into one screen increases scan cost.

## Why List View Is the Default

List view is the operational center.

It supports the most common actions with the least navigation:

- search
- status filtering
- tag filtering
- archive filtering
- quick status changes
- direct access to application details

The list is optimized for ongoing maintenance rather than first-time storytelling.

## Reminders and Notifications Philosophy

The app does not try to be a full calendar product.

Instead it surfaces only high-signal items:

- upcoming interviews
- stale applications that likely need follow-up
- near-term preparation todos

This keeps reminders actionable and avoids turning the tracker into a noisy inbox.

## Kanban and Reports Rationale

Kanban exists for stage-level flow visibility.

Reports exist for trend review and portfolio health:

- status distribution
- monthly application velocity
- active versus archived balance
- upcoming interview concentration

These views are separate because operational editing and portfolio review are different tasks.

## Application Detail Workflow

Application detail pages group related work around a single job:

- core role and company details
- notes
- preparation
- recruiter questions
- feedback
- todos
- linked CV
- generated AI documents

This keeps application context together and prevents the AI workflow from feeling detached from the actual record it belongs to.

## Document Management Behavior

CV behavior is intentionally versioned.

- uploads create stored versions
- duplicate uploads are rejected by content hash
- applications can stay linked to the exact CV used at that time

This avoids a common failure mode where a later CV upload silently rewrites earlier application context.

Generated AI documents are also treated as persistent artifacts, not transient chat output.

The `Content` tab is the canonical document workspace.

- document generation is state-aware
- existing artifacts are opened directly
- regenerate lives in document actions, not as a competing overview CTA
- versions are grouped under the document type instead of displayed as repeated independent cards

## Loading State Philosophy

The UI prefers explicit refresh and completion states over aggressive optimistic updates.

Reasons:

- lower risk of UI drift from backend truth
- easier debugging in a no-framework frontend
- simpler recovery when AI generation or file handling takes longer than a normal CRUD action

This matters especially for uploads, document generation, and filtered views.

The content viewer also follows this principle:

- one large document viewer instead of inline preview columns
- one metadata presentation instead of repeating provider/model details in multiple panels
- compare and restore as contextual actions after the document exists

## Local-First Behavior

The product intentionally behaves like a private workspace:

- data is stored locally by default
- files are stored locally by default
- mock AI is the default provider
- the app works without any mandatory external service

This reduces onboarding friction and keeps the tool usable for people who do not want cloud dependencies.

## Intentional UX Tradeoffs

Tradeoffs that are deliberate:

- No authentication UI. The app assumes a trusted environment instead.
- No heavy dashboard shell. Navigation stays close to the work surface.
- No chat-style AI interface. Generated outputs are stored as managed documents.
- No full SPA framework. Simplicity and inspectability were prioritized.
- No automatic hiding of historical CV context. The app preserves document lineage.
- No duplicate content navigation. The main Content tab is the single entry point for generated document management.

## Accessibility Considerations

The app uses semantic controls and straightforward interaction patterns where possible:

- button-based view switching
- form-based data entry
- table-based scanning for dense records
- dialog-based focused tasks like CV and application management

Accessibility is helped by the deliberately simple interaction model, though it should still be treated as an area for ongoing improvement rather than a completed concern.

## Current UX Constraints

- complex workflows depend on manual refresh of data slices after mutations
- large record sets are not optimized as a virtualized interface
- AI generation is completion-based rather than stream-based
- trusted-network assumptions remove flows that public-facing apps would normally require
