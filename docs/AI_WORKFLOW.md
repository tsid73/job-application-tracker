# AI Workflow

AI is optional. The default local provider is `mock`, which does not call an external service.

## Providers

- `mock`: local deterministic placeholder output
- `gemini`: synchronous OpenAI-compatible chat request
- `aws`: queued generation through S3/SQS and an external worker

## Generated Artifacts

The app can generate:

- tailored CV drafts
- cover letters
- role-fit notes
- ATS checks
- follow-up emails

Generated outputs are saved as database rows and DOCX files under `uploads/ai`.

## Input Rules

Generation needs:

- an application or supplied job description
- a CV version
- extracted CV text
- a selected provider

If job description or CV context is missing, the request fails without crashing the app.

## Local Safe Mode

Use this for normal development:

```text
AI_PROVIDER=mock
DEFAULT_AI_REQUEST_PROVIDER=mock
```

No external model is called.

## Real Provider Mode

For Gemini/OpenAI-compatible use, configure:

```text
AI_PROVIDER=gemini
DEFAULT_AI_REQUEST_PROVIDER=gemini
AI_API_BASE_URL=...
AI_API_KEY=...
AI_MODEL=...
```

Do not commit real keys.

## AWS Mode

AWS mode is disabled by default. It queues generation jobs and expects an external worker to process them. See `AWS_SETUP.md` only if you need S3/SQS-based generation.
