import { defineConfig } from '@playwright/test';

const port = 4173;
const envPrefix = [
  `PORT=${port}`,
  'DB_CLIENT=pglite',
  'PGLITE_DATA_DIR=.tmp/pglite',
  'UPLOAD_DIR=.tmp/uploads',
  'AI_PROVIDER=mock',
  // The whole suite runs against one shared server from 127.0.0.1, so every
  // request shares a single rate-limit bucket. Raise the ceilings so tests are
  // not throttled (429) by accumulated request volume.
  'GENERAL_RATE_LIMIT_MAX=100000',
  'AI_RATE_LIMIT_MAX=100000',
  'UPLOAD_RATE_LIMIT_MAX=100000',
  'MAX_CONCURRENT_UPLOADS=50'
].join(' ');

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `rm -rf .tmp/pglite .tmp/uploads && ${envPrefix} node server/db/migrate.js && ${envPrefix} node server/index.js`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe'
  }
});
