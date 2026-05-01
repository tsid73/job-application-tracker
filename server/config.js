import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');

if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!process.env[key]) process.env[key] = valueParts.join('=');
  }
}

const aiProvider = process.env.AI_PROVIDER || 'mock';

export const config = {
  port: Number(process.env.PORT || 3000),
  dbClient: process.env.DB_CLIENT || 'pglite',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/job_tracker',
  pgliteDataDir: process.env.PGLITE_DATA_DIR || 'data/pglite',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024),
  aiProvider,
  aiApiBaseUrl: process.env.AI_API_BASE_URL || defaultAIBaseUrl(aiProvider),
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'local-model'
};

function defaultAIBaseUrl(provider) {
  if (provider === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta/openai';
  return 'http://localhost:11434/v1';
}
