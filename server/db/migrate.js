import { pool } from './pool.js';
import { explainConnectionError } from './connectionError.js';
import { applyMigrations } from './ensureSchema.js';

async function migrate() {
  await applyMigrations(pool);
}

migrate()
  .then(() => pool.end())
  .catch((error) => {
    console.error(explainConnectionError(error).message);
    pool.end().finally(() => process.exit(1));
  });
