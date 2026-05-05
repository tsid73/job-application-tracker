import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function cleanupGeneratedAssets({ pool, storage, olderThanDays = 60, keepPerApplication = 5, dryRun = true }) {
  const cutoffQuery = `
    SELECT id, file_path, application_id
    FROM (
      SELECT
        id,
        file_path,
        application_id,
        created_at,
        row_number() OVER (PARTITION BY COALESCE(application_id, 0) ORDER BY created_at DESC, id DESC) AS row_number
      FROM ai_documents
      WHERE file_path IS NOT NULL
        AND created_at < now() - ($1::text || ' days')::interval
    ) ranked
    WHERE row_number > $2
  `;

  const staleDocuments = await pool.query(cutoffQuery, [olderThanDays, keepPerApplication]);
  const trackedAiPaths = await pool.query(
    'SELECT file_path FROM ai_documents WHERE file_path IS NOT NULL UNION SELECT file_path FROM cv_versions WHERE file_path IS NOT NULL'
  );
  const trackedPathSet = new Set(trackedAiPaths.rows.map((row) => row.file_path));
  const orphanedAiFiles = await findUntrackedFiles(storage, 'ai', trackedPathSet);

  const report = {
    dryRun,
    olderThanDays,
    keepPerApplication,
    deletedDocuments: [],
    orphanedFiles: orphanedAiFiles
  };

  for (const document of staleDocuments.rows) {
    report.deletedDocuments.push(document.file_path);
    if (dryRun) continue;
    await storage.remove(document.file_path);
    await pool.query('UPDATE ai_documents SET file_path = NULL WHERE id = $1', [document.id]);
  }

  if (!dryRun) {
    for (const relativePath of orphanedAiFiles) {
      await storage.remove(relativePath);
    }
  }

  return report;
}

async function findUntrackedFiles(storage, subdir, trackedPathSet) {
  const absoluteDir = join(storage.baseDir, subdir);
  const entries = await readdir(absoluteDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => join(storage.configUploadDir, subdir, entry.name).replace(/\\/g, '/'))
    .filter((relativePath) => !trackedPathSet.has(relativePath));
}
