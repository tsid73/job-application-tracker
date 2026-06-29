import { PGlite } from '@electric-sql/pglite';
import path from 'node:path';

async function main() {
  const dbPath = path.resolve(process.cwd(), 'data/development/pglite');
  console.log('Connecting to', dbPath);
  const db = new PGlite(dbPath);
  const res = await db.query('SELECT id, file_path FROM cv_versions LIMIT 5');
  console.log(res.rows);
  process.exit(0);
}
main().catch(console.error);
