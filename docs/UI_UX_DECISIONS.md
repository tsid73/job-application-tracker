# UI and UX Notes

The app is a private work tracker, not a public SaaS product.

## Main Views

- `List`: active application maintenance
- `Reminders`: upcoming interviews and follow-up timing
- `Kanban`: status overview
- `Today`: due next actions, upcoming interviews, stale applications, and priority reminders
- `Reports`: application counts and trends
- `Activity`: timeline of changes
- `Job Boards`: sourcing channels to check regularly
- `Company List`: Germany/EU target companies and career links
- `Toolkit`: lightweight job-search checklist
- `Settings`: import, export, backup, and restore

## Design Choices

- List view is the default because it supports the most frequent updates.
- List rows surface next action, follow-up timing, and last touched state so stale applications are visible without opening detail pages.
- Today view groups urgent operational work into one review surface.
- Application detail pages keep notes, preparation, todos, feedback, CVs, and generated content together.
- Detail overview prioritizes workflow status before AI-generated assets.
- CVs are versioned so old applications keep their original CV context.
- Generated AI outputs are saved as documents, not transient chat messages.
- AI document recommendations respond to the current application status.
- The UI re-fetches affected data after mutations instead of relying on optimistic state.

## Current Limits

- No auth UI.
- No virtualized large-table rendering.
- No streaming AI output.
- No public deployment hardening in the app itself.
