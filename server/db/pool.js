import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { config } from '../config.js';

function createPostgresPool() {
  return new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });
}

function createPglitePool() {
  const dataDir = resolve(process.cwd(), config.pgliteDataDir);
  let dbPromise;
  let lock = Promise.resolve();

  async function getDb() {
    if (!dbPromise) {
      dbPromise = mkdir(dirname(dataDir), { recursive: true }).then(() => new PGlite(dataDir));
    }
    return dbPromise;
  }

  async function acquire() {
    let release;
    const previous = lock;
    lock = new Promise((resolveLock) => {
      release = resolveLock;
    });
    await previous;
    return release;
  }

  return {
    async query(sql, params) {
      const release = await acquire();
      const db = await getDb();
      try {
        return normalizeResult(await db.query(sql, params));
      } finally {
        release();
      }
    },
    async exec(sql) {
      const release = await acquire();
      const db = await getDb();
      try {
        return await db.exec(sql);
      } finally {
        release();
      }
    },
    async connect() {
      const release = await acquire();
      const db = await getDb();
      return {
        query: async (sql, params) => normalizeResult(await db.query(sql, params)),
        release
      };
    },
    async end() {
      if (!dbPromise) return;
      const db = await dbPromise;
      await db.close();
    }
  };
}

export const pool = config.dbClient === 'postgres' ? createPostgresPool() : createPglitePool();

function normalizeResult(result) {
  if (result.rowCount !== undefined) return result;
  const rows = result.rows || [];
  return {
    ...result,
    rowCount: rows.length || result.affectedRows || 0
  };
}
