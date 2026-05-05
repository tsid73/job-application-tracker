import { mkdir, rm, writeFile, access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const tempRoot = path.join(rootDir, '.tmp', 'verify-backup-restore');
const dataDir = path.join(tempRoot, 'pglite');
const uploadDir = path.join(tempRoot, 'uploads');
const backupDir = path.join(tempRoot, 'backup-bundle');
const port = 4332;
const env = {
  ...process.env,
  PORT: String(port),
  DB_CLIENT: 'pglite',
  PGLITE_DATA_DIR: path.relative(rootDir, dataDir),
  UPLOAD_DIR: path.relative(rootDir, uploadDir),
  AI_PROVIDER: 'mock'
};

let serverProcess;

try {
  await rm(tempRoot, { recursive: true, force: true });
  await mkdir(tempRoot, { recursive: true });

  await runNode('server/db/migrate.js');
  serverProcess = startNode('server/index.js');
  await waitForHealth();

  const created = await createApplicationWithUploads();
  const atsDoc = await generateAtsDocument(created.application.id, created.cvs[0].id);
  await ensureFileExists(path.join(uploadDir, 'cv'));
  await ensureFileExists(path.join(uploadDir, 'ai'));

  await stopServer(serverProcess);
  serverProcess = null;

  await runCommand('bash', ['scripts/db-backup.sh', backupDir]);

  await rm(dataDir, { recursive: true, force: true });
  await rm(uploadDir, { recursive: true, force: true });

  await runCommand('bash', ['scripts/db-restore.sh', backupDir]);

  serverProcess = startNode('server/index.js');
  await waitForHealth();

  const restored = await getJson(`/api/applications/${created.application.id}`);
  if (restored.application.company_name !== created.application.company_name) {
    throw new Error('Round-trip restore mismatch for application data');
  }

  const restoredDoc = restored.ai_documents.find((item) => item.id === atsDoc.document.id);
  if (!restoredDoc) {
    throw new Error('Round-trip restore missing ATS document');
  }

  await assertDownload(`/api/cv/${created.cvs[0].id}/download`);
  await assertDownload(`/api/ai/documents/${atsDoc.document.id}/download`);

  console.log(JSON.stringify({
    ok: true,
    applicationId: created.application.id,
    cvId: created.cvs[0].id,
    aiDocumentId: atsDoc.document.id,
    backupDir
  }, null, 2));
} finally {
  if (serverProcess) {
    await stopServer(serverProcess).catch(() => {});
  }
}

async function createApplicationWithUploads() {
  const sampleCv = await readFile(path.join(rootDir, 'sample-data', 'sample-cv.pdf'));
  const boundary = `----codex-${Date.now()}`;
  const parts = [];
  pushField(parts, boundary, 'company_name', 'Roundtrip Systems');
  pushField(parts, boundary, 'job_description', 'Node.js backend role with PostgreSQL, APIs, and reporting.');
  pushField(parts, boundary, 'status', 'applied');
  pushField(parts, boundary, 'tags', 'roundtrip,backup');
  pushFile(parts, boundary, 'cv', 'sample-cv.pdf', 'application/pdf', sampleCv);
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);
  return getJson('/api/applications', {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body
  });
}

async function generateAtsDocument(applicationId, cvId) {
  return getJson('/api/ai/ats-check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ application_id: applicationId, cv_id: cvId })
  });
}

async function getJson(endpoint, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Request failed for ${endpoint}: ${payload.error || response.status}`);
  }
  return payload;
}

async function assertDownload(endpoint) {
  const response = await fetch(`http://127.0.0.1:${port}${endpoint}`);
  if (!response.ok) {
    throw new Error(`Download failed for ${endpoint}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error(`Empty download for ${endpoint}`);
  }
}

async function waitForHealth() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for health endpoint');
}

function startNode(script) {
  const child = spawn('node', [script], { cwd: rootDir, env, stdio: 'pipe' });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

async function runNode(script) {
  await runCommand('node', [script]);
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, env, stdio: 'pipe' });
    let stderr = '';
    child.stdout.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed: ${stderr.trim()}`));
    });
  });
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGINT');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000))
  ]);

  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 3_000))
    ]);
  }

  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await new Promise((resolve) => child.once('exit', resolve));
  }
}

async function ensureFileExists(directory) {
  await access(directory, constants.F_OK);
}

function pushField(parts, boundary, name, value) {
  parts.push(Buffer.from(`--${boundary}\r\ncontent-disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
}

function pushFile(parts, boundary, name, filename, mimeType, buffer) {
  parts.push(Buffer.from(`--${boundary}\r\ncontent-disposition: form-data; name="${name}"; filename="${filename}"\r\ncontent-type: ${mimeType}\r\n\r\n`));
  parts.push(buffer);
  parts.push(Buffer.from('\r\n'));
}
