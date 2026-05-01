import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool } from './pool.js';
import { explainConnectionError } from './connectionError.js';

async function seed() {
  const existing = await pool.query('SELECT 1 FROM applications LIMIT 1');
  if (existing.rowCount) {
    console.log('Seed skipped: applications already exist.');
    return;
  }

  const sql = await readFile(join(process.cwd(), 'sample-data', 'seed.sql'), 'utf8');
  if (pool.exec) {
    await pool.exec(sql);
  } else {
    await pool.query(sql);
  }
  console.log('Seed data inserted.');
}

seed()
  .then(() => pool.end())
  .catch((error) => {
    console.error(explainConnectionError(error).message);
    pool.end().finally(() => process.exit(1));
  });
