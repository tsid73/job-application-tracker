# AWS Setup

AWS support is optional. The default product path remains local-first with Gemini as the main real-time provider and AWS disabled by default.

Read [../README.md](../README.md) first for standard onboarding, then use this document only if you want queued AWS generation or optional S3 mirroring.

## What AWS Adds

AWS support is used for two separate concerns:

- queued AI generation through S3, SQS, and an external worker or Lambda
- optional file mirroring when `FILE_STORAGE_MODE=dual`

AWS is not required for normal local development.

## 1. Install AWS SDK Packages

Run this in the repo root before enabling AWS features:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/client-sqs
```

## 2. Update `.env`

Use these placeholders in `.env`:

```text
FILE_STORAGE_MODE=dual
DEFAULT_AI_REQUEST_PROVIDER=gemini
AWS_REGION=your-aws-region
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_SESSION_TOKEN=
AWS_S3_BUCKET=your-s3-bucket-name
AWS_S3_PREFIX=job-tracker
AWS_SQS_QUEUE_URL=https://sqs.your-region.amazonaws.com/123456789012/job-tracker-ai
AWS_AI_ENABLED=true
AWS_AI_DAILY_LIMIT=20
AWS_AI_ALLOWED_DOC_TYPES=tailored_cv,cover_letter,role_fit,ats_check,follow_up_email
AWS_STORAGE_REQUIRED=false
```

## 3. Create IAM User or Role

Create an IAM identity for the Node app with:

- `s3:PutObject`
- `s3:GetObject`
- `sqs:SendMessage`

Restrict access to:

- your app bucket
- your app queue

If you deploy on EC2, prefer an instance role over long-lived access keys.

## 4. Create S3 Bucket

Create one private bucket, for example:

```text
your-s3-bucket-name
```

Recommended prefixes used by the app:

- `job-tracker/uploads/cv/`
- `job-tracker/uploads/ai/`
- `job-tracker/uploads/ai-jobs/requests/`
- `job-tracker/uploads/ai-jobs/results/`

Recommended bucket settings:

- private bucket
- versioning enabled
- lifecycle rule for `ai-jobs/requests/` and `ai-jobs/results/` to expire after 7 to 14 days

## 5. Create SQS Queue

Create a standard queue for AI jobs:

```text
job-tracker-ai
```

Recommended settings:

- visibility timeout: at least 2x the Lambda timeout
- dead-letter queue enabled
- receive message wait time: 10 to 20 seconds

The app sends one message per AWS AI request with:

```json
{
  "bucket": "your-s3-bucket-name",
  "key": "job-tracker/uploads/ai-jobs/requests/....json",
  "result_key": "job-tracker/uploads/ai-jobs/results/....json",
  "job_id": 123
}
```

## 6. Create Lambda or Worker

Create a Lambda that:

1. Reads SQS messages.
2. Downloads the request manifest from S3.
3. Calls your chosen AWS AI service.
4. Writes result JSON to `result_key` in S3.

The worker does not need database access. It only needs to read manifests, generate output, and write result payloads.

Recommended Lambda settings:

- runtime: Node.js 20+
- reserved concurrency: `1`
- timeout: 60 to 120 seconds
- batch size: `1`

IAM permissions needed by Lambda:

- `sqs:ReceiveMessage`
- `sqs:DeleteMessage`
- `sqs:GetQueueAttributes`
- `s3:GetObject`
- `s3:PutObject`
- permissions for the AI service you choose

## 7. Result JSON Contract

The app expects a result object like this:

```json
{
  "status": "completed",
  "provider": "aws-bedrock",
  "model": "your-model-id",
  "version_group_id": "optional-uuid",
  "title": "Cover Letter - Example Company",
  "content": "Generated plain text content"
}
```

Failure shape:

```json
{
  "status": "failed",
  "provider": "aws-bedrock",
  "error": "Readable failure message"
}
```

## 8. Connect SQS to Lambda

Add the SQS queue as an event source to the Lambda.

Recommended values:

- batch size: `1`
- maximum batching window: `0`

## 9. Optional S3 Event Notification

The current app already sends SQS messages directly after writing the request manifest.

Because of that, S3 event notifications are optional here. If you prefer the `S3 -> SQS -> Lambda` pattern, you can move queue publishing out of the app later, but do not enable both flows at once or you will process the same job twice.

## 10. Choose AWS AI Service

The app is provider-agnostic on the Lambda side. You can use:

- Amazon Bedrock for text generation
- another AWS-managed AI service if it can produce plain text output

Recommended starting path:

- use a low-cost Bedrock text model
- keep request truncation in place
- keep the app daily limit low until the flow is stable

## 11. How the App Behaves

- Gemini is still the default provider.
- The Content workspace uses the top-level Gemini/AWS provider toggle for generation requests.
- If you choose AWS:
  - the app writes a request manifest
  - the app queues a background job
  - the Content workspace shows job status
  - the app ingests the result from S3 when it becomes available

## 12. Important Guardrails

- Keep `AWS_AI_ENABLED=false` until all AWS pieces are ready.
- Start with `AWS_AI_DAILY_LIMIT=5` or `10`.
- Keep Lambda reserved concurrency at `1`.
- Keep the queue batch size at `1`.
- Do not expose this app publicly without authentication.

For the broader generation lifecycle, see [AI_WORKFLOW.md](AI_WORKFLOW.md). For local development and environment details, see [DEVELOPMENT.md](DEVELOPMENT.md).
