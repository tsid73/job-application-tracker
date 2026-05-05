import { cleanString, parseDate, parseTags, validateStatus, validateUrl } from '../utils/validation.js';
import { today } from '../utils/text.js';
import { extractCVText } from './cvTextExtractor.js';

export function normalizeApplicationInput(fields) {
  const companyName = cleanString(fields.company_name);
  if (!companyName) {
    const error = new Error('Company name is required');
    error.statusCode = 400;
    throw error;
  }

  const jobLink = validateUrl(fields.job_link);
  const jobDescription = cleanString(fields.job_description);
  if (!jobLink && !jobDescription) {
    const error = new Error('At least one of job link or job description is required');
    error.statusCode = 400;
    throw error;
  }

  const status = validateStatus(fields.status);
  const interviewDate = parseDate(fields.interview_date, 'interview_date');
  if (status === 'interview_scheduled' && !interviewDate) {
    const error = new Error('Interview date is required when status is interview_scheduled');
    error.statusCode = 400;
    throw error;
  }
  if (status !== 'interview_scheduled' && interviewDate) {
    const error = new Error('Interview date is only allowed when status is interview_scheduled');
    error.statusCode = 400;
    throw error;
  }

  return {
    company_name: companyName,
    job_link: jobLink,
    job_description: jobDescription,
    status,
    salary: cleanString(fields.salary),
    location: cleanString(fields.location),
    recruiter: cleanString(fields.recruiter),
    contact_person: cleanString(fields.contact_person),
    applied_date: parseDate(fields.applied_date, 'applied_date') || today(),
    interview_date: status === 'interview_scheduled' ? interviewDate : null,
    notes: cleanString(fields.notes),
    cv_id: Number(fields.cv_id) || null,
    cv_version_label: cleanString(fields.cv_version_label),
    tags: parseTags(fields.tags)
  };
}

export async function resolveApplicationCV({ client, storage, file, selectedCvId, versionLabel }) {
  if (file) {
    const saved = await storage.saveCV(file);
    const extractedText = await extractCVText(file);
    try {
      await ensureUniqueCVUpload(client, saved);
      await client.query('UPDATE cv_versions SET is_latest = FALSE WHERE is_latest = TRUE');
      const inserted = await client.query(
        `
          INSERT INTO cv_versions (file_path, original_name, mime_type, file_size, version_label, is_latest, extracted_text, file_hash)
          VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)
          RETURNING id
        `,
        [saved.relativePath, saved.originalName, saved.mimeType, saved.fileSize, versionLabel, extractedText, saved.fileHash]
      );
      return inserted.rows[0].id;
    } catch (error) {
      await storage.remove(saved.relativePath);
      throw error;
    }
  }

  if (selectedCvId) {
    const selected = await client.query('SELECT id FROM cv_versions WHERE id = $1 AND deleted_at IS NULL', [selectedCvId]);
    if (!selected.rowCount) {
      const error = new Error('Selected CV not found');
      error.statusCode = 400;
      throw error;
    }
    return selectedCvId;
  }

  const latest = await client.query('SELECT id FROM cv_versions WHERE is_latest = TRUE AND deleted_at IS NULL LIMIT 1');
  if (latest.rowCount) return latest.rows[0].id;

  const error = new Error('Upload a CV or create a CV version before adding an application');
  error.statusCode = 400;
  throw error;
}

export async function replaceTags(client, applicationId, tags) {
  await client.query('DELETE FROM application_tags WHERE application_id = $1', [applicationId]);
  for (const tag of tags) {
    const tagResult = await client.query(
      `
        INSERT INTO tags (name)
        VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `,
      [tag]
    );
    await client.query(
      'INSERT INTO application_tags (application_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [applicationId, tagResult.rows[0].id]
    );
  }
}

export async function logActivity(client, applicationId, action, details) {
  await client.query(
    'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
    [applicationId, action, details]
  );
}

export async function ensureUniqueCVUpload(client, saved) {
  const existing = await client.query(
    'SELECT id, original_name FROM cv_versions WHERE file_hash = $1 AND deleted_at IS NULL LIMIT 1',
    [saved.fileHash]
  );
  if (existing.rowCount) {
    const error = new Error(`This CV matches existing upload "${existing.rows[0].original_name}" and was not saved again.`);
    error.statusCode = 409;
    throw error;
  }
}
