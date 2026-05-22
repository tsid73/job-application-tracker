# UI and UX Notes

The app is a private work tracker, not a public SaaS product.

## Main Views

- `List`: active application maintenance
- `Reminders`: upcoming interviews and follow-up timing
- `Kanban`: status overview
- `Reports`: application counts and trends
- `Activity`: timeline of changes
- `Job Boards`: sourcing channels to check regularly
- `Company List`: Germany/EU target companies and career links
- `Toolkit`: lightweight job-search checklist
- `Settings`: import, export, backup, and restore

## Design Choices

- List view is the default because it supports the most frequent updates.
- Application detail pages keep notes, preparation, todos, feedback, CVs, and generated content together.
- CVs are versioned so old applications keep their original CV context.
- Generated AI outputs are saved as documents, not transient chat messages.
- The UI re-fetches affected data after mutations instead of relying on optimistic state.

## Current Limits

- No auth UI.
- No virtualized large-table rendering.
- No streaming AI output.
- No public deployment hardening in the app itself.
