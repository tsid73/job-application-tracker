import { mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const inputFile = process.argv[2];
const dataDir = process.argv[3];

if (!inputFile || !dataDir) {
  throw new Error('Usage: node scripts/pglite-restore.mjs <input-file> <data-dir>');
}

await rm(dataDir, { recursive: true, force: true });
await mkdir(dataDir, { recursive: true });

await new Promise((resolve, reject) => {
  const child = spawn('tar', ['-xzf', inputFile, '-C', dataDir], { stdio: 'inherit' });
  child.on('exit', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`tar restore failed with code ${code}`));
  });
});
