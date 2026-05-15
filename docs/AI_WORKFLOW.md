# AI Workflow

## Overview

AI features are optional. The default local setup uses `AI_PROVIDER=mock`, which produces deterministic placeholder output and does not call an external model.

Supported request paths:

- `mock`
- `gemini`
- `aws`

The app also contains an OpenAI-compatible provider implementation, but current provider normalization and UI behavior are centered on `mock`, `gemini`, and queued `aws`.

## Supported Outputs

The app can generate:

- tailored CV drafts
- cover letters
- role-fit analyses
- ATS checks
- follow-up emails

Each generated result is stored with metadata about the provider, model, prompt excerpt, and source context.

## Input Resolution

All generation starts with `readAIInput`.

The server resolves:

- the target application, if provided
- the job description, either from the request or the application record
- the CV ID, either explicitly or from the latest linked CV for the application
- extracted CV text, generating it on demand when needed
- structured job signals from the job description
- structured candidate signals from extracted CV text
- the requested provider
- prompt excerpt and source context metadata

Generation is blocked if:

- the job description is missing
- the CV is missing
- the application reference is invalid

## Prompt Handling

Prompt construction is document-specific, single-pass, and cost-conscious.

- The app builds compact local summaries from the job description and extracted CV text before calling the model.
- Each document type has its own prompt template and output section order.
- The real provider path sends:
  - one shared system instruction
  - one document-specific user prompt
- The app avoids a second AI analysis pass to keep latency and token cost under control.
- The app stores a prompt excerpt instead of the full prompt.
- It also stores a source-context summary so later output can be traced back to the originating application and CV.

This keeps prompts more reliable than the earlier raw-text dump approach without turning generation into a multi-step orchestration flow.

## Synchronous Generation Flow

`mock` and `gemini` use the synchronous flow:

1. Resolve input and provider.
2. Build structured local context from the CV and job description.
3. Build the provider prompt.
4. Submit the request to the selected provider.
5. Receive plain text output.
6. Normalize spacing, headings, and bullets locally.
7. Create a DOCX file.
8. Persist a row in `ai_documents`.
9. Return the saved document metadata to the UI.

The OpenAI-compatible implementation sends a `chat/completions` request to the configured base URL and model.

## Provider Behavior

### Mock

- Default for safe local onboarding
- No network call
- Returns structured placeholder content derived from the uploaded CV text and job description

### Gemini

- Uses the OpenAI-compatible chat endpoint shape
- Intended as the main real-time provider in the current product setup
- Returns plain text that is then converted into a DOCX artifact
- If `AI_API_KEY` is missing, the app still starts. Only the generation request fails.

### AWS

- Disabled by default
- Runs as an asynchronous background workflow
- Intended for queued generation instead of inline request completion

## AWS Queue Flow

When the user selects AWS and AWS is enabled:

1. The app validates that AWS generation is enabled for the requested document type.
2. It enforces a daily AWS generation limit.
3. It writes a request manifest under `uploads/ai-jobs/requests`.
4. In `dual` storage mode, that manifest is mirrored to S3.
5. The app creates an `ai_generation_jobs` row with status `queued`.
6. It sends an SQS message containing the request manifest key and expected result key.
7. External AWS infrastructure processes the job and writes a result JSON object to S3.
8. The app polls or reloads job state and syncs completed results into `ai_documents`.

This design keeps the main app stateless with respect to long-running AWS work.

## Result Ingestion

Completed AWS jobs are normalized into the same document model used by synchronous providers.

That means:

- the final output still becomes an `ai_documents` row
- a DOCX file is still created locally
- the UI can present documents consistently regardless of provider

If the AWS result reports failure, the job is marked failed and the error is persisted on the job record.

## Regeneration

AI documents support regeneration.

Regeneration reuses:

- the original document type
- the associated application and CV context
- the same persistence model

This keeps version history predictable and avoids mixing ad hoc document records with standalone output.

## Viewer and Content Behavior

- The `Content` tab is the canonical document workspace.
- Generated documents are treated as persistent artifacts, not inline previews.
- The document viewer keeps metadata compact in the sticky header and avoids repeating provider/model details across multiple panels.
- Version compare and restore operate inside the content workflow rather than from separate navigation surfaces.

## Document Lifecycle

Generated content passes through these stages:

1. request submitted
2. provider selected
3. content generated or job queued
4. DOCX artifact created
5. metadata persisted
6. document listed on the application detail screen
7. optional later regeneration
8. optional later retention cleanup

Generated files are stored locally unless storage mirroring is enabled.

## Queue and Streaming Notes

- The current app uses queued background processing for AWS.
- The synchronous provider path is request-response based.
- There is no token-by-token UI streaming path in the current implementation.
- The product instead favors simple completion states and persisted output.

## Safety and Traceability

The AI workflow is intentionally conservative:

- local mock output is the default
- generated documents store provider and model metadata
- source context is preserved
- prompt excerpts are persisted
- document retention can be cleaned up later
- missing keys or upstream provider errors fail the request, not the whole app

This helps contributors debug output quality and provider behavior without adding a large orchestration layer.

## Operational Notes

- `AI_PROVIDER=mock` is the safest default for development.
- Real provider calls may send CV text and job descriptions to external services.
- AWS generation depends on S3, SQS, and an external worker or Lambda implementation.

For environment variables and setup, see `DEVELOPMENT.md` and `AWS_SETUP.md`.
