import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Blob } from 'node:buffer';
import { PGlite } from '@electric-sql/pglite';

const outputFile = process.argv[2];
const dataDir = process.argv[3];

if (!outputFile || !dataDir) {
  throw new Error('Usage: node scripts/pglite-backup.mjs <output-file> <data-dir>');
}

await mkdir(path.dirname(outputFile), { recursive: true });

const db = new PGlite(dataDir);
try {
  const dump = await db.dumpDataDir('gzip');
  const buffer = Buffer.from(await dump.arrayBuffer());
  await writeFile(outputFile, buffer);
} finally {
  await db.close();
}
