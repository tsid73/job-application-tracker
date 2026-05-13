import { randomUUID } from 'node:crypto';
import { createAWSClients, ensureAWSConfig } from './awsClients.js';

export async function queueAWSGeneration({ pool, storage, config, input, type, title }) {
  if (!config.awsAiEnabled) {
    const error = new Error('AWS AI is disabled. Set AWS_AI_ENABLED=true after completing the AWS setup steps.');
    error.statusCode = 400;
    throw error;
  }
  if (!config.awsAiAllowedDocTypes.includes(type)) {
    const error = new Error(`AWS generation is not enabled for ${type}. Switch to Gemini or update AWS_AI_ALLOWED_DOC_TYPES.`);
    error.statusCode = 400;
    throw error;
  }

  ensureAWSConfig();
  await enforceDailyLimit(pool, config);

  const versionGroupId = randomUUID();
  const manifest = {
    job_type: 'ai_generation',
    version: 1,
    job: {
      document_type: type,
      title,
      provider_requested: 'aws',
      version_group_id: versionGroupId
    },
    application: input.application,
    cv: {
      id: input.cv.id,
      original_name: input.cv.original_name,
      version_label: input.cv.version_label,
      extracted_text: input.cv.extracted_text || ''
    },
    job_description: input.jobDescription,
    prompt_excerpt: input.promptExcerpt,
    source_context: input.sourceContext,
    created_at: new Date().toISOString()
  };

  const requestFile = await storage.saveJobManifest(manifest, title, 'requests');
  if (!requestFile.s3Key) {
    const error = new Error('AWS job manifest could not be uploaded to S3. Check FILE_STORAGE_MODE, AWS_S3_BUCKET, and AWS credentials.');
    error.statusCode = 500;
    throw error;
  }
  const resultS3Key = requestFile.s3Key
    ? requestFile.s3Key.replace('/requests/', '/results/')
    : null;

  const result = await pool.query(
    `
      INSERT INTO ai_generation_jobs (
        application_id,
        cv_id,
        document_type,
        provider_requested,
        status,
        title,
        request_manifest_path,
        request_manifest_s3_key,
        result_s3_key,
        prompt_excerpt,
        source_context
      )
      VALUES ($1, $2, $3, 'aws', 'queued', $4, $5, $6, $7, $8, $9)
      RETURNING id, application_id, cv_id, document_type, provider_requested, provider_used, status, title, error_message, retry_count, created_at, completed_at
    `,
    [
      input.application?.id || null,
      input.cv.id,
      type,
      title,
      requestFile.relativePath,
      requestFile.s3Key,
      resultS3Key,
      input.promptExcerpt,
      input.sourceContext
    ]
  );

  try {
    const { sqs, SendMessageCommand } = await createAWSClients();
    await sqs.send(new SendMessageCommand({
      QueueUrl: config.awsSqsQueueUrl,
      MessageBody: JSON.stringify({
        bucket: requestFile.s3Bucket || config.awsS3Bucket,
        key: requestFile.s3Key,
        result_key: resultS3Key,
        job_id: result.rows[0].id
      })
    }));
  } catch (error) {
    await pool.query(
      `
        UPDATE ai_generation_jobs
        SET status = 'failed',
            error_message = $2,
            completed_at = now()
        WHERE id = $1
      `,
      [result.rows[0].id, error.message]
    );
    error.statusCode ||= 502;
    throw error;
  }

  return result.rows[0];
}

export async function syncCompletedAWSJob({ pool, storage, config, saveAIDocument, job }) {
  if (!job || job.document_id || !job.result_s3_key || job.status === 'completed') return job;
  const resultPayload = await readResultPayload(config, job.result_s3_key);
  if (!resultPayload) return job;

  if (String(resultPayload.status || '').toLowerCase() === 'failed') {
    const failed = await pool.query(
      `
        UPDATE ai_generation_jobs
        SET status = 'failed',
            provider_used = COALESCE($2, provider_used),
            error_message = $3,
            completed_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [job.id, resultPayload.provider || 'aws', resultPayload.error || 'AWS job failed']
    );
    return failed.rows[0];
  }

  const output = {
    provider: resultPayload.provider || 'aws',
    providerRequested: 'aws',
    model: resultPayload.model || 'aws-model',
    generationStatus: 'completed',
    versionGroupId: resultPayload.version_group_id || randomUUID()
  };

  const document = await saveAIDocument({
    pool,
    storage,
    config,
    application: job.application_id ? { id: job.application_id, company_name: resultPayload.company_name || '' } : null,
    cv: {
      id: job.cv_id,
      original_name: resultPayload.cv_original_name || resultPayload.title || 'CV'
    },
    type: job.document_type,
    title: resultPayload.title || job.title,
    content: String(resultPayload.content || '').trim(),
    promptExcerpt: job.prompt_excerpt,
    sourceContext: job.source_context,
    output
  });

  const completed = await pool.query(
    `
      UPDATE ai_generation_jobs
      SET status = 'completed',
          provider_used = $2,
          document_id = $3,
          completed_at = now(),
          error_message = NULL
      WHERE id = $1
      RETURNING *
    `,
    [job.id, output.provider, document.id]
  );
  return completed.rows[0];
}

async function enforceDailyLimit(pool, config) {
  const result = await pool.query(
    `
      SELECT count(*)::int AS count
      FROM ai_generation_jobs
      WHERE provider_requested = 'aws'
        AND created_at >= date_trunc('day', now())
    `
  );
  if (Number(result.rows[0]?.count || 0) >= config.awsAiDailyLimit) {
    const error = new Error(`AWS daily generation limit reached. Increase AWS_AI_DAILY_LIMIT or switch to Gemini.`);
    error.statusCode = 429;
    throw error;
  }
}

async function readResultPayload(config, resultS3Key) {
  try {
    const { s3, GetObjectCommand } = await createAWSClients();
    const response = await s3.send(new GetObjectCommand({
      Bucket: config.awsS3Bucket,
      Key: resultS3Key
    }));
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (error) {
    if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}
