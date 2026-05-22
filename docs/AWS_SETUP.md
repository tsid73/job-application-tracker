# AWS Setup

AWS is optional. Do not enable it for basic local use.

AWS support covers:

- optional S3 mirroring when `FILE_STORAGE_MODE=dual`
- queued AI generation through S3, SQS, and an external worker

## Install Optional Packages

Only install these if AWS features are enabled:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/client-sqs
```

## Required Environment

```text
FILE_STORAGE_MODE=dual
AWS_REGION=your-region
AWS_S3_BUCKET=your-private-bucket
AWS_S3_PREFIX=job-tracker
AWS_SQS_QUEUE_URL=https://sqs.your-region.amazonaws.com/account-id/queue-name
AWS_AI_ENABLED=true
AWS_STORAGE_REQUIRED=false
```

Use instance roles in deployed environments when possible. Avoid long-lived access keys.

## Minimum AWS Resources

- Private S3 bucket
- Standard SQS queue
- Worker or Lambda that reads queue messages, reads request manifests from S3, calls the AI service, and writes result JSON back to S3

## App Message Shape

The app sends queue messages with:

```json
{
  "bucket": "bucket-name",
  "key": "job-tracker/uploads/ai-jobs/requests/request.json",
  "result_key": "job-tracker/uploads/ai-jobs/results/result.json",
  "job_id": 123
}
```

## Worker Result Shape

Success:

```json
{
  "status": "completed",
  "provider": "aws-bedrock",
  "model": "model-id",
  "title": "Cover Letter - Example",
  "content": "Generated plain text content"
}
```

Failure:

```json
{
  "status": "failed",
  "provider": "aws-bedrock",
  "error": "Readable failure message"
}
```

## Security Notes

- Keep the bucket private.
- Restrict IAM permissions to only the app bucket and queue.
- Do not commit AWS credentials.
- Prefer short-lived credentials or instance roles.
- Use lifecycle rules for request/result manifests.
