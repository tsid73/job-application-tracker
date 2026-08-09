# Local Agent Workflows

This document describes the local agent research workflow that supports the Agent tab.

## Current Scope

The current implementation is a local, deterministic orchestration layer around existing tracker data. It stores source evidence, builds local context chunks, retrieves matching context with keyword scoring, records run steps, and proposes actions that must be approved before they change application records.

Accurate current wording:

```text
Built a local-first job application tracker with CV/JD storage, Gemini-compatible document generation, deterministic local retrieval over job and company context, agent run logging, and approval-gated proposed actions for preparation notes, notes, and tasks.
```

Do not describe the current implementation as external MCP orchestration or embedding-backed vector RAG. Those are planned extensions, not implemented behavior.

## User Flow

1. Open an application detail page.
2. Use the Agent tab to save verified source text, such as a job posting, company page, recruiter note, manual note, or generated note.
3. The server stores the raw source and creates a structured job context snapshot.
4. The server chunks the source into local knowledge chunks.
5. Run the local agent workflow.
6. The service refreshes chunks from the application job description, notes, preparation fields, linked CV text, and saved research sources.
7. Retrieval scores chunks against the workflow query and saves the matched chunk IDs.
8. The run records ordered steps and produces proposed actions.
9. The UI shows proposed actions with approve and reject controls.
10. Approved actions apply writes inside a database transaction. Rejected actions are recorded without changing application data.

## Architecture

The workflow is intentionally small and local-first.

| Layer | Files | Responsibility |
| --- | --- | --- |
| UI | `public/js/render.js`, `public/js/app.js` | Render Agent tab, save research sources, run the agent, approve or reject pending actions. |
| Routes | `server/routes.js` | Expose research source, agent run, and agent action endpoints. |
| Write service | `server/services/agentWorkflows.js` | Validate inputs, create context snapshots, chunk content, retrieve context, create pending actions, apply approved actions. |
| Read service | `server/services/readApi.js` | Return research sources, context snapshots, chunks, retrieval runs, agent runs, steps, and pending actions on the application detail payload. |
| Persistence | `migrations/017_local_agent_workflows.sql` | Store sources, snapshots, chunks, retrieval logs, agent runs, steps, and pending actions. |
| Backup and restore | `server/index.js` | Include agent workflow tables in local backup, restore, and sequence reset flows. |

## API Contract

### Save Research Source

`POST /api/applications/:id/research-sources`

Request body:

```json
{
  "source_type": "job_posting",
  "title": "Backend Engineer posting",
  "url": "https://example.com/jobs/backend-engineer",
  "content": "Pasted source text",
  "confidence": "85",
  "warnings": "Salary absent from source"
}
```

Supported `source_type` values:

- `job_posting`
- `company_page`
- `recruiter`
- `manual_note`
- `generated`

Response:

```json
{
  "research_source": {},
  "knowledge_chunks": []
}
```

### Run Agent Workflow

`POST /api/applications/:id/agent-runs`

Request body:

```json
{
  "workflow_type": "company_research",
  "provider": "mock"
}
```

Supported `workflow_type` values:

- `job_description_analysis`
- `fit_evaluation`
- `draft_generation`
- `company_research`

Provider behavior:

- `mock` or omitted provider records `mock-local` and uses deterministic local output.
- `gemini` records `gemini-local-context`, but the current workflow still uses local deterministic proposal creation. It does not call Gemini from this agent path.

Response:

```json
{
  "agent_run": {},
  "retrieval_run": {},
  "pending_actions": []
}
```

### Approve Agent Action

`POST /api/agent-actions/:id/approve`

Supported action types:

- `update_preparation`: upserts application preparation fields.
- `create_note`: adds an application note.
- `create_todo`: adds an application todo.

Approval runs in a transaction, marks the pending action as `applied`, writes an activity log, and writes an audit event.

### Reject Agent Action

`POST /api/agent-actions/:id/reject`

Request body:

```json
{
  "decision_note": "Rejected from local Agent tab."
}
```

Rejection marks the pending action as `rejected` and writes an audit event. It does not change application preparation, notes, or todos.

## Data Model

| Table | Purpose |
| --- | --- |
| `research_sources` | Raw source evidence for one application. |
| `job_context_snapshots` | Structured source-derived job context at save time. |
| `knowledge_chunks` | Local chunks from sources, job descriptions, notes, preparation content, and linked CV text. |
| `retrieval_runs` | Query text, matched chunk IDs, and retrieval summary. |
| `agent_runs` | Workflow type, provider label, model label, run status, retrieved context, and output summary. |
| `agent_steps` | Ordered step log for context collection, retrieval, and proposal creation. |
| `pending_agent_actions` | Proposed writes waiting for approval or rejection. |

All rows are scoped by `application_id` directly or through `agent_run_id`. Deleting an application cascades workflow data for that application.

## Retrieval Design

Retrieval is dependency-free and deterministic:

1. Source text is normalized and split into roughly 900 character chunks.
2. The workflow query is built from the requested workflow type, company, role, location, and job description unless the caller provides a query.
3. Query terms shorter than three characters and common stop words are ignored.
4. Each chunk receives one point for each query term contained in its title or body.
5. The top six scored chunks are used. If no chunk scores, the newest three chunks are used as fallback.
6. Matched chunk IDs and a short summary are stored in `retrieval_runs`.

This design favors auditability, local execution, and zero new dependencies. It does not provide semantic matching, cross-application retrieval, or embedding similarity.

## Agent Proposal Design

The local proposal builder creates three conservative actions:

- Update preparation with company context and a note that source evidence must be reviewed.
- Add an application note summarizing that local context was retrieved.
- Add a todo reminding the user to review retrieved research before drafting or applying.

The proposal text intentionally avoids unsupported claims such as verified company values when the saved sources do not prove them.

## Safety And Approval Boundary

The workflow follows these invariants:

- Saving a source can create research, snapshot, and chunk records only.
- Running an agent can create run, step, retrieval, and pending action records only.
- Application preparation, notes, and todos change only after explicit approval.
- Rejecting an action never mutates application data.
- A pending action can be decided only once. Repeated approval or rejection returns a conflict.
- Approval runs inside a transaction so action status and resulting application writes stay consistent.
- Agent decision events are written to `audit_events`.

## Tradeoffs

| Decision | Chosen approach | Reason | Cost | Future option |
| --- | --- | --- | --- | --- |
| Retrieval | Local keyword scoring | Simple, deterministic, testable, no dependency or service setup. | Misses semantic matches and synonyms. | Add embeddings and vector search behind the same retrieval run table. |
| Action execution | Approval gated pending actions | Prevents accidental mutation of private application data. | Requires manual review for every proposal. | Add per-action trust rules only after audit and undo controls exist. |
| Agent provider | Local deterministic proposal path | Keeps development safe and testable with `AI_PROVIDER=mock`. | Provider label is informational in this path. | Add model-backed proposal generation after prompt, privacy, and review controls are defined. |
| Source capture | User supplied source text | Avoids scraping, auth, CAPTCHA, and unexpected external requests. | More manual than browser or MCP ingestion. | Add explicit MCP or browser ingestion with rate limits and source provenance. |
| Storage | Relational tables in the tracker database | Backups, restore, and application scoping stay simple. | Large source text increases local database size. | Move raw source blobs to file storage if volume becomes high. |
| Chunking | Fixed character windows | Fast and predictable. | Can split sentences and sections awkwardly. | Add structured section parsing for job descriptions and company pages. |

## Security And Privacy

The Agent tab can store CV text, job descriptions, recruiter notes, company research, and generated application material. Treat the database and backups as sensitive.

Operational rules:

- Keep `AI_PROVIDER=mock` and `DEFAULT_AI_REQUEST_PROVIDER=mock` for local testing when external calls are not intended.
- Do not paste passwords, cookies, API keys, or private session tokens into research sources.
- Do not expose the app publicly without authentication, TLS, authorization, and deployment hardening.
- Do not commit `data/`, `uploads/`, backups, `.env`, or copied job source material.

## Testing Coverage

The implementation is covered by:

- API tests for source creation, agent runs, pending actions, approval, rejection, and data readback.
- Browser tests for the Agent tab flow and approval controls.
- Regression tests that include the agent tables in backup and restore coverage.
- Syntax checks through `npm run check`.

For documentation-only edits, `git diff --check` is usually enough. For API or UI behavior changes, run:

```bash
npm run check
node --test tests/text.test.js
npx playwright test --reporter=line
```

## Implementation Plan

### Phase 1: Local Agent Foundation

Status: implemented.

- Add agent workflow tables.
- Save application-scoped research sources.
- Store job context snapshots.
- Chunk saved sources and existing application context.
- Run deterministic local retrieval.
- Record agent runs and ordered steps.
- Create approval gated pending actions.
- Apply or reject pending actions from the Agent tab.
- Include agent workflow tables in backup and restore flows.

### Phase 2: Stronger Local Retrieval

Status: planned.

- Add source metadata fields for captured date, source owner, language, and source freshness.
- Parse job descriptions into structured sections such as responsibilities, requirements, benefits, location, salary, and visa notes.
- Improve ranking with field-specific weights.
- Add visible source citations for every proposed action.
- Add a retrieval debug view showing why each chunk matched.

### Phase 3: Model-Backed Proposals

Status: planned.

- Add a prompt contract for each workflow type.
- Pass only retrieved source snippets, not the entire tracker database.
- Require JSON schema validation for model output.
- Store model request metadata without storing secrets.
- Keep the same pending action approval boundary.
- Add tests using the mock provider before enabling real provider calls.

### Phase 4: External Tool Orchestration

Status: planned.

- Define a local MCP or tool registry for approved actions.
- Add source connectors only when they can preserve source provenance.
- Add rate limits and human pacing for any browser or portal lookups.
- Keep writes approval gated unless an action is reversible and explicitly trusted.
- Add an undo or rollback story before broader automated writes.

## Completion Criteria

The workflow can be described as RAG-powered or MCP-orchestrated only after the corresponding planned phase is implemented and verified:

- Embedding-backed or semantic retrieval exists and is used by agent runs.
- External MCP tools or a local MCP server/tool registry exists.
- Proposed external actions include source provenance and approval logs.
- Tests cover retrieval, tool invocation, approval, rejection, backup, and restore.
