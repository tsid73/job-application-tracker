# AWS Setup For Job Application Tracker

This app keeps Gemini as the default provider. AWS is optional and disabled by default.

## 1. Install AWS SDK packages

Run this in the repo root before enabling AWS features:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/client-sqs
```

## 2. Fill `.env`

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

## 3. Create IAM user or role

Create an IAM identity for the Node app with:

- `s3:PutObject`
- `s3:GetObject`
- `sqs:SendMessage`

Restrict access to:

- your app bucket
- your app queue

If you deploy on EC2, prefer an instance role over long-lived access keys.

## 4. Create S3 bucket

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

## 5. Create SQS queue

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

## 6. Create Lambda

Create a Lambda that:

1. Reads SQS messages.
2. Downloads the request manifest from S3.
3. Calls your chosen AWS AI service.
4. Writes result JSON to `result_key` in S3.

The Lambda does not need database access.

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

## 7. Result JSON contract

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

## 9. Optional S3 event notification

The current app already sends SQS messages directly after writing the request manifest.

Because of that, S3 event notifications are optional here. If you prefer the `S3 -> SQS -> Lambda` pattern, you can move queue publishing out of the app later, but do not enable both flows at once or you will process the same job twice.

## 10. Choose AWS AI service

The app is provider-agnostic on the Lambda side. You can use:

- Amazon Bedrock for text generation
- another AWS-managed AI service if it can produce plain text output

Recommended starting path:

- use a low-cost Bedrock text model
- keep request truncation in place
- keep the app daily limit low until the flow is stable

## 11. How the app behaves

- Gemini is still the default provider.
- The UI lets you switch providers per AI request.
- If you choose AWS:
  - the app writes a request manifest
  - the app queues a background job
  - the generated content page shows job status
  - the app ingests the result from S3 when it becomes available

## 12. Important guardrails

- Keep `AWS_AI_ENABLED=false` until all AWS pieces are ready.
- Start with `AWS_AI_DAILY_LIMIT=5` or `10`.
- Keep Lambda reserved concurrency at `1`.
- Keep the queue batch size at `1`.
- Do not expose this app publicly without authentication.
