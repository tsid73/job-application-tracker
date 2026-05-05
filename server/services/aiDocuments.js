import { readFile } from 'node:fs/promises';
import { createDocxBuffer } from './docx.js';
import { extractCVText } from './cvTextExtractor.js';
import { buildPromptExcerpt, buildSourceContext } from '../utils/text.js';

export async function readAIInput({ req, pool, storage, readJson, cleanString, config }) {
  const body = await readJson(req, config.maxAiBytes);
  let jobDescription = cleanString(body.job_description);
  let cvId = Number(body.cv_id);
  const applicationId = Number(body.application_id);
  let application = null;

  if (Number.isInteger(applicationId)) {
    const app = await pool.query(
      `
        SELECT id, company_name, job_description
        FROM applications
        WHERE id = $1
      `,
      [applicationId]
    );
    if (!app.rowCount) {
      const error = new Error('Application not found');
      error.statusCode = 404;
      throw error;
    }
    application = app.rows[0];
    jobDescription ||= cleanString(application.job_description);

    if (!Number.isInteger(cvId)) {
      const linkedCv = await pool.query(
        `
          SELECT cv_id
          FROM application_cvs
          WHERE application_id = $1
          ORDER BY linked_at DESC
          LIMIT 1
        `,
        [applicationId]
      );
      if (linkedCv.rowCount) cvId = Number(linkedCv.rows[0].cv_id);
    }
  }

  if (!jobDescription) {
    const error = new Error('Job description is required');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isInteger(cvId)) {
    const error = new Error('cv_id is required');
    error.statusCode = 400;
    throw error;
  }

  const cv = await pool.query(
    'SELECT id, original_name, version_label, extracted_text, file_path FROM cv_versions WHERE id = $1 AND deleted_at IS NULL',
    [cvId]
  );
  if (!cv.rowCount) {
    const error = new Error('CV not found');
    error.statusCode = 404;
    throw error;
  }

  const cvRow = cv.rows[0];
  if (!cvRow.extracted_text) {
    const buffer = await readFile(storage.resolveSafe(cvRow.file_path)).catch(() => null);
    if (buffer) {
      cvRow.extracted_text = await extractCVText({ filename: cvRow.original_name, buffer });
      await pool.query('UPDATE cv_versions SET extracted_text = $1 WHERE id = $2', [cvRow.extracted_text, cvRow.id]);
    }
  }

  return {
    jobDescription,
    cv: cvRow,
    application,
    promptExcerpt: buildPromptExcerpt(jobDescription, cvRow),
    sourceContext: buildSourceContext(application, cvRow)
  };
}

export async function saveAIDocument({ pool, storage, config, application, cv, type, title, content, promptExcerpt, sourceContext, output }) {
  const buffer = await createDocxBuffer(title, content);
  const filePath = await storage.saveGeneratedDocx(buffer, title);
  const result = await pool.query(
    `
      INSERT INTO ai_documents (
        application_id,
        cv_id,
        document_type,
        title,
        content,
        file_path,
        provider_name,
        model_name,
        prompt_excerpt,
        source_context
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, document_type, title, created_at, provider_name, model_name, prompt_excerpt, source_context
    `,
    [
      application?.id || null,
      cv.id,
      type,
      title,
      content,
      filePath,
      output?.provider || config.aiProvider,
      output?.model || config.aiModel,
      promptExcerpt,
      sourceContext
    ]
  );
  return { ...result.rows[0], download_url: `/api/ai/documents/${result.rows[0].id}/download` };
}
