import { config } from '../config.js';

let cachedClients = null;

export async function createAWSClients() {
  if (cachedClients) return cachedClients;
  ensureAWSConfig();

  let s3Module;
  let sqsModule;
  try {
    [s3Module, sqsModule] = await Promise.all([
      import('@aws-sdk/client-s3'),
      import('@aws-sdk/client-sqs')
    ]);
  } catch (error) {
    const wrapped = new Error('AWS SDK packages are not installed. Install @aws-sdk/client-s3 and @aws-sdk/client-sqs before enabling AWS features.');
    wrapped.statusCode = 500;
    wrapped.cause = error;
    throw wrapped;
  }

  const clientConfig = {
    region: config.awsRegion,
    credentials: config.awsAccessKeyId && config.awsSecretAccessKey
      ? {
          accessKeyId: config.awsAccessKeyId,
          secretAccessKey: config.awsSecretAccessKey,
          ...(config.awsSessionToken ? { sessionToken: config.awsSessionToken } : {})
        }
      : undefined
  };

  cachedClients = {
    s3: new s3Module.S3Client(clientConfig),
    sqs: new sqsModule.SQSClient(clientConfig),
    PutObjectCommand: s3Module.PutObjectCommand,
    GetObjectCommand: s3Module.GetObjectCommand,
    HeadObjectCommand: s3Module.HeadObjectCommand,
    SendMessageCommand: sqsModule.SendMessageCommand
  };
  return cachedClients;
}

export function ensureAWSConfig() {
  if (!config.awsRegion || !config.awsS3Bucket || !config.awsSqsQueueUrl) {
    const error = new Error('AWS configuration is incomplete. Set AWS_REGION, AWS_S3_BUCKET, and AWS_SQS_QUEUE_URL.');
    error.statusCode = 400;
    throw error;
  }
}

