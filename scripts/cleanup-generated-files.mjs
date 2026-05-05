import { config } from '../server/config.js';
import { pool } from '../server/db/pool.js';
import { LocalFileStorage } from '../server/storage/localFileStorage.js';
import { cleanupGeneratedAssets } from '../server/services/retention.js';
import { createAuditLogger } from '../server/services/audit.js';

const dryRun = process.argv.includes('--apply') ? false : true;

async function main() {
  const storage = new LocalFileStorage();
  const audit = createAuditLogger(pool);
  const report = await cleanupGeneratedAssets({
    pool,
    storage,
    olderThanDays: config.aiDocumentRetentionDays,
    keepPerApplication: config.keepLatestAiDocumentsPerApplication,
    dryRun
  });

  if (!dryRun && (report.deletedDocuments.length || report.orphanedFiles.length)) {
    await audit.log(null, {
      targetType: 'generated_assets',
      targetId: 'retention-cleanup',
      action: 'cleanup',
      details: `Deleted ${report.deletedDocuments.length} tracked files and ${report.orphanedFiles.length} orphaned files`
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
