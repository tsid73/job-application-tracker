import http from 'node:http';
import { join } from 'node:path';
import { statSync } from 'node:fs';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { sendError, sendJson, readJson, readMultipart, serveStatic } from './utils/http.js';
import { cleanString, validateStatus } from './utils/validation.js';
import { createRequestGuard } from './utils/requestGuards.js';
import { csvEscape, parseCsv, changedApplicationFields, dateForLog } from './utils/text.js';
import { LocalFileStorage } from './storage/localFileStorage.js';
import { createAIProvider } from './services/aiProvider.js';
import { createAuditLogger } from './services/audit.js';
import { normalizeApplicationInput, resolveApplicationCV, replaceTags, logActivity, ensureUniqueCVUpload } from './services/applicationHelpers.js';
import { readAIInput, saveAIDocument } from './services/aiDocuments.js';

const publicDir = join(process.cwd(), 'public');
const storage = new LocalFileStorage();
const aiProvider = createAIProvider();
const enforceRequestGuards = createRequestGuard({ config });
const audit = createAuditLogger(pool);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    enforceRequestGuards(req, url);

    if (url.pathname.startsWith('/api/')) {
      await routeApi(req, res, url);
      return;
    }

    if (!serveStatic(req, res, publicDir)) {
      sendError(res, 404, 'Not found');
    }
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error);
    sendError(res, statusCode, error.message || 'Internal server error');
  }
});

async function routeApi(req, res, url) {
  const { method } = req;
  const path = url.pathname;

  if (method === 'GET' && path === '/api/health') return sendJson(res, 200, { ok: true });
  if (method === 'GET' && path === '/api/reminders') return getReminders(req, res);
  if (method === 'GET' && path === '/api/notifications') return getNotifications(req, res);
  if (method === 'GET' && path === '/api/reports') return getReports(req, res);
  if (method === 'GET' && path === '/api/activity') return getActivity(req, res, url);
  if (method === 'GET' && path === '/api/audit') return getAudit(req, res, url);
  if (method === 'GET' && path === '/api/saved-filters') return getSavedFilters(req, res);
  if (method === 'POST' && path === '/api/saved-filters') return createSavedFilter(req, res);
  if (method === 'DELETE' && /^\/api\/saved-filters\/\d+$/.test(path)) return deleteSavedFilter(req, res, pathId(path));
  if (method === 'GET' && path === '/api/export/applications.csv') return exportApplicationsCsv(req, res);
  if (method === 'POST' && path === '/api/import/applications') return importApplicationsCsv(req, res);
  if (method === 'GET' && path === '/api/applications') return getApplications(req, res, url);
  if (method === 'POST' && path === '/api/applications') return createApplication(req, res);
  if (method === 'GET' && /^\/api\/applications\/\d+$/.test(path)) return getApplication(req, res, pathId(path));
  if (method === 'PUT' && /^\/api\/applications\/\d+$/.test(path)) return updateApplication(req, res, pathId(path));
  if (method === 'DELETE' && /^\/api\/applications\/\d+$/.test(path)) return deleteApplication(req, res, pathId(path));
  if (method === 'POST' && /^\/api\/applications\/\d+\/archive$/.test(path)) return archiveApplication(req, res, pathId(path));
  if (method === 'POST' && /^\/api\/applications\/\d+\/restore$/.test(path)) return restoreApplication(req, res, pathId(path));
  if (method === 'POST' && /^\/api\/applications\/\d+\/notes$/.test(path)) return createNote(req, res, pathId(path));

  if (method === 'GET' && path === '/api/cv') return getCVs(req, res);
  if (method === 'POST' && path === '/api/cv') return createCV(req, res);
  if (method === 'DELETE' && /^\/api\/cv\/\d+$/.test(path)) return deleteCV(req, res, pathId(path));
  if (method === 'GET' && /^\/api\/cv\/\d+\/download$/.test(path)) return downloadCV(req, res, pathId(path));

  if (method === 'POST' && path === '/api/ai/generate-cv') return generateCV(req, res);
  if (method === 'POST' && path === '/api/ai/generate-cover-letter') return generateCoverLetter(req, res);
  if (method === 'POST' && path === '/api/ai/role-fit') return scoreRoleFit(req, res);
  if (method === 'POST' && path === '/api/ai/ats-check') return checkATS(req, res);
  if (method === 'POST' && path === '/api/ai/follow-up-email') return generateFollowUpEmail(req, res);
  if (method === 'GET' && /^\/api\/ai\/documents\/\d+\/download$/.test(path)) return downloadAIDocument(req, res, pathId(path));

  sendError(res, 404, 'API route not found');
}

function pathId(path) {
  const match = path.match(/\/(\d+)(?:\/|$)/);
  return Number(match[1]);
}

async function getReminders(req, res) {
  const result = await pool.query(
    `
      SELECT
        id,
        company_name,
        status,
        to_char(interview_date, 'YYYY-MM-DD') AS interview_date,
        interview_date - CURRENT_DATE AS days_remaining
      FROM applications
      WHERE archived_at IS NULL
        AND status = 'interview_scheduled'
        AND interview_date IS NOT NULL
      ORDER BY interview_date ASC
      LIMIT 20
    `
  );
  sendJson(res, 200, { reminders: result.rows });
}

async function getNotifications(req, res) {
  const [upcomingInterviews, followUps] = await Promise.all([
    pool.query(
      `
        SELECT
          id,
          company_name,
          status,
          to_char(interview_date, 'YYYY-MM-DD') AS due_date,
          interview_date - CURRENT_DATE AS days_remaining,
          'interview' AS type,
          'Upcoming interview scheduled' AS message
        FROM applications
        WHERE archived_at IS NULL
          AND status = 'interview_scheduled'
          AND interview_date IS NOT NULL
          AND interview_date <= CURRENT_DATE + INTERVAL '7 days'
        ORDER BY interview_date ASC
        LIMIT 6
      `
    ),
    pool.query(
      `
        SELECT
          id,
          company_name,
          status,
          to_char(applied_date + INTERVAL '7 days', 'YYYY-MM-DD') AS due_date,
          CURRENT_DATE - applied_date AS days_remaining,
          'follow_up' AS type,
          'No recent update. Consider a follow-up.' AS message
        FROM applications
        WHERE archived_at IS NULL
          AND status IN ('applied', 'ghosted')
          AND applied_date <= CURRENT_DATE - INTERVAL '7 days'
          AND NOT EXISTS (
            SELECT 1
            FROM activity_logs al
            WHERE al.application_id = applications.id
              AND al.created_at >= now() - INTERVAL '7 days'
              AND al.action IN ('note_added', 'status_changed', 'interview_date_changed', 'details_updated', 'ai_follow_up_email')
          )
        ORDER BY applied_date ASC
        LIMIT 6
      `
    )
  ]);

  sendJson(res, 200, {
    notifications: [...upcomingInterviews.rows, ...followUps.rows]
      .sort((left, right) => String(left.due_date || '').localeCompare(String(right.due_date || '')))
      .slice(0, 8)
  });
}

async function getSavedFilters(req, res) {
  const result = await pool.query(
    `
      SELECT id, name, search, status, tag, archived, created_at, updated_at
      FROM saved_filters
      ORDER BY lower(name) ASC, id ASC
    `
  );
  sendJson(res, 200, { filters: result.rows });
}

async function createSavedFilter(req, res) {
  const body = await readJson(req, 32 * 1024);
  const name = cleanString(body.name);
  if (!name) return sendError(res, 400, 'Filter name is required');

  const search = cleanString(body.search);
  const status = cleanString(body.status);
  const tag = cleanString(body.tag);
  const archived = cleanString(body.archived) || 'false';

  if (status) validateStatus(status);
  if (!['false', 'true', 'all'].includes(archived)) return sendError(res, 400, 'archived must be false, true, or all');

  const result = await pool.query(
    `
      INSERT INTO saved_filters (name, search, status, tag, archived)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (name)
      DO UPDATE SET
        search = EXCLUDED.search,
        status = EXCLUDED.status,
        tag = EXCLUDED.tag,
        archived = EXCLUDED.archived
      RETURNING id, name, search, status, tag, archived, created_at, updated_at
    `,
    [name, search, status, tag, archived]
  );

  sendJson(res, 201, { filter: result.rows[0] });
}

async function deleteSavedFilter(req, res, id) {
  const result = await pool.query('DELETE FROM saved_filters WHERE id = $1 RETURNING id', [id]);
  if (!result.rowCount) return sendError(res, 404, 'Saved filter not found');
  sendJson(res, 200, { ok: true });
}

async function getReports(req, res) {
  const [statusCounts, monthlyCounts, lifecycleCounts, upcoming] = await Promise.all([
    pool.query(
      `
        SELECT status, count(*)::int AS count
        FROM applications
        WHERE archived_at IS NULL
        GROUP BY status
        ORDER BY status
      `
    ),
    pool.query(
      `
        SELECT to_char(date_trunc('month', applied_date), 'YYYY-MM') AS month, count(*)::int AS count
        FROM applications
        GROUP BY date_trunc('month', applied_date)
        ORDER BY month
      `
    ),
    pool.query(
      `
        SELECT
          count(*) FILTER (WHERE archived_at IS NULL)::int AS active,
          count(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived,
          count(*)::int AS total
        FROM applications
      `
    ),
    pool.query(
      `
        SELECT id, company_name, to_char(interview_date, 'YYYY-MM-DD') AS interview_date, interview_date - CURRENT_DATE AS days_remaining
        FROM applications
        WHERE archived_at IS NULL AND status = 'interview_scheduled' AND interview_date IS NOT NULL
        ORDER BY interview_date ASC
        LIMIT 5
      `
    )
  ]);

  sendJson(res, 200, {
    status_counts: statusCounts.rows,
    monthly_counts: monthlyCounts.rows,
    lifecycle_counts: lifecycleCounts.rows[0],
    upcoming_interviews: upcoming.rows
  });
}

async function getActivity(req, res, url) {
  const applicationIdParam = url.searchParams.get('application_id');
  const applicationId = Number(applicationIdParam);
  const search = cleanString(url.searchParams.get('search')) || '';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(5, Number(url.searchParams.get('limit')) || 12));
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (applicationIdParam && Number.isInteger(applicationId)) {
    params.push(applicationId);
    conditions.push(`al.application_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(al.action ILIKE $${params.length} OR al.details ILIKE $${params.length} OR a.company_name ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `
      SELECT
        al.id,
        al.application_id,
        a.company_name,
        al.action,
        al.details,
        al.created_at,
        count(*) OVER()::int AS total
      FROM activity_logs al
      LEFT JOIN applications a ON a.id = al.application_id
      ${where}
      ORDER BY al.created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  sendJson(res, 200, {
    activity: result.rows.map(({ total, ...row }) => row),
    page,
    limit,
    total: result.rows[0]?.total || 0
  });
}

async function getAudit(req, res, url) {
  const applicationId = Number(url.searchParams.get('application_id'));
  const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit')) || 25));
  const events = await audit.list({
    applicationId: Number.isInteger(applicationId) ? applicationId : null,
    limit
  });
  sendJson(res, 200, { audit: events });
}

async function exportApplicationsCsv(req, res) {
  const result = await pool.query(
    `
      SELECT
        a.company_name,
        a.job_link,
        a.job_description,
        a.status,
        a.salary,
        a.location,
        a.recruiter,
        a.contact_person,
        to_char(a.applied_date, 'YYYY-MM-DD') AS applied_date,
        to_char(a.interview_date, 'YYYY-MM-DD') AS interview_date,
        a.notes,
        CASE WHEN a.archived_at IS NULL THEN 'active' ELSE 'archived' END AS lifecycle,
        COALESCE(string_agg(DISTINCT t.name, ', '), '') AS tags
      FROM applications a
      LEFT JOIN application_tags at ON at.application_id = a.id
      LEFT JOIN tags t ON t.id = at.tag_id
      GROUP BY a.id
      ORDER BY a.applied_date DESC, a.id DESC
    `
  );

  const headers = ['company_name', 'job_link', 'job_description', 'status', 'salary', 'location', 'recruiter', 'contact_person', 'applied_date', 'interview_date', 'notes', 'lifecycle', 'tags'];
  const csv = [
    headers.join(','),
    ...result.rows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))
  ].join('\n');

  res.writeHead(200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="job-applications.csv"',
    'x-content-type-options': 'nosniff'
  });
  res.end(csv);
}

async function importApplicationsCsv(req, res) {
  const { files } = await readMultipart(req, config.maxUploadBytes + 1024 * 1024);
  if (!files.csv) return sendError(res, 400, 'CSV file is required');

  const rows = parseCsv(files.csv.buffer.toString('utf8'));
  if (rows.length < 2) return sendError(res, 400, 'CSV must include a header row and at least one data row');

  const headers = rows[0].map((header) => header.trim());
  const latest = await pool.query('SELECT id FROM cv_versions WHERE is_latest = TRUE AND deleted_at IS NULL LIMIT 1');
  if (!latest.rowCount) return sendError(res, 400, 'Upload a CV before importing applications');

  let imported = 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const values of rows.slice(1)) {
      const fields = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
      const data = normalizeApplicationInput({ ...fields, cv_id: latest.rows[0].id }, true);
      const created = await client.query(
        `
          INSERT INTO applications (company_name, job_link, job_description, status, salary, location, recruiter, contact_person, applied_date, interview_date, notes, archived_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $12 = 'archived' THEN now() ELSE NULL END)
          RETURNING id
        `,
        [data.company_name, data.job_link, data.job_description, data.status, data.salary, data.location, data.recruiter, data.contact_person, data.applied_date, data.interview_date, data.notes, cleanString(fields.lifecycle)]
      );
      const applicationId = created.rows[0].id;
      await client.query('INSERT INTO application_cvs (application_id, cv_id) VALUES ($1, $2)', [applicationId, latest.rows[0].id]);
      await client.query('INSERT INTO status_history (application_id, from_status, to_status) VALUES ($1, NULL, $2)', [applicationId, data.status]);
      await replaceTags(client, applicationId, data.tags);
      await logActivity(client, applicationId, 'imported', 'Imported from CSV');
      imported += 1;
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  sendJson(res, 201, { imported });
}

async function getApplications(req, res, url) {
  const search = cleanString(url.searchParams.get('search')) || '';
  const status = cleanString(url.searchParams.get('status')) || '';
  const tag = cleanString(url.searchParams.get('tag')) || '';
  const archived = cleanString(url.searchParams.get('archived')) || 'false';
  if (status) validateStatus(status);
  if (!['false', 'true', 'all'].includes(archived)) return sendError(res, 400, 'archived must be false, true, or all');

  const result = await pool.query(
    `
      SELECT
        a.id,
        a.company_name,
        a.status,
        a.salary,
        a.location,
        a.recruiter,
        a.contact_person,
        to_char(a.applied_date, 'YYYY-MM-DD') AS applied_date,
        to_char(a.interview_date, 'YYYY-MM-DD') AS interview_date,
        a.archived_at,
        CASE WHEN a.interview_date IS NULL THEN NULL ELSE a.interview_date - CURRENT_DATE END AS days_remaining,
        COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags,
        c.original_name AS cv_name
      FROM applications a
      LEFT JOIN application_tags at ON at.application_id = a.id
      LEFT JOIN tags t ON t.id = at.tag_id
      LEFT JOIN application_cvs ac ON ac.application_id = a.id
      LEFT JOIN cv_versions c ON c.id = ac.cv_id
      WHERE ($1 = '' OR a.company_name ILIKE '%' || $1 || '%')
        AND ($2 = '' OR a.status = $2::application_status)
        AND ($3 = '' OR EXISTS (
          SELECT 1
          FROM application_tags at2
          JOIN tags t2 ON t2.id = at2.tag_id
          WHERE at2.application_id = a.id AND t2.name ILIKE '%' || $3 || '%'
        ))
        AND (
          $4 = 'all'
          OR ($4 = 'true' AND a.archived_at IS NOT NULL)
          OR ($4 = 'false' AND a.archived_at IS NULL)
        )
      GROUP BY a.id, c.original_name
      ORDER BY
        a.archived_at DESC NULLS LAST,
        CASE WHEN a.status = 'interview_scheduled' THEN 0 ELSE 1 END,
        a.interview_date ASC NULLS LAST,
        a.applied_date DESC,
        a.id DESC
    `,
    [search, status, tag, archived]
  );

  sendJson(res, 200, { applications: result.rows });
}

async function getApplication(req, res, id) {
  const application = await pool.query(
    `
      SELECT
        id,
        company_name,
        job_link,
        job_description,
        status,
        salary,
        location,
        recruiter,
        contact_person,
        to_char(applied_date, 'YYYY-MM-DD') AS applied_date,
        to_char(interview_date, 'YYYY-MM-DD') AS interview_date,
        notes,
        archived_at,
        created_at,
        updated_at
      FROM applications
      WHERE id = $1
    `,
    [id]
  );

  if (!application.rowCount) return sendError(res, 404, 'Application not found');

  const [cvs, history, notes, tags, activity, aiDocuments, auditEvents] = await Promise.all([
    pool.query(
      `
        SELECT c.id, c.original_name, c.version_label, c.file_size, c.created_at, ac.linked_at, length(c.extracted_text) AS extracted_text_length
        FROM application_cvs ac
        JOIN cv_versions c ON c.id = ac.cv_id
        WHERE ac.application_id = $1
        ORDER BY ac.linked_at DESC
      `,
      [id]
    ),
    pool.query(
      `
        SELECT id, from_status, to_status, changed_at
        FROM status_history
        WHERE application_id = $1
        ORDER BY changed_at DESC
      `,
      [id]
    ),
    pool.query(
      `
        SELECT id, body, created_at
        FROM application_notes
        WHERE application_id = $1
        ORDER BY created_at DESC
      `,
      [id]
    ),
    pool.query(
      `
        SELECT t.name
        FROM application_tags at
        JOIN tags t ON t.id = at.tag_id
        WHERE at.application_id = $1
        ORDER BY t.name
      `,
      [id]
    ),
    pool.query(
      `
        SELECT id, action, details, created_at
        FROM activity_logs
        WHERE application_id = $1
        ORDER BY created_at DESC
      `,
      [id]
    ),
    pool.query(
      `
        SELECT
          id,
          document_type,
          title,
          created_at,
          file_path IS NOT NULL AS has_file,
          provider_name,
          model_name,
          prompt_excerpt,
          source_context
        FROM ai_documents
        WHERE application_id = $1
        ORDER BY created_at DESC
      `,
      [id]
    ),
    audit.list({ applicationId: id, limit: 20 })
  ]);

  sendJson(res, 200, {
    application: application.rows[0],
    cvs: cvs.rows,
    status_history: history.rows,
    notes: notes.rows,
    activity: activity.rows,
    ai_documents: aiDocuments.rows,
    audit_events: auditEvents,
    tags: tags.rows.map((row) => row.name)
  });
}

async function createApplication(req, res) {
  const contentType = req.headers['content-type'] || '';
  const payload = contentType.includes('multipart/form-data')
    ? await readApplicationMultipart(req)
    : { fields: await readJson(req, config.maxUploadBytes), file: null };

  const data = normalizeApplicationInput(payload.fields);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const cvId = await resolveApplicationCV({
      client,
      storage,
      file: payload.file,
      selectedCvId: data.cv_id,
      versionLabel: data.cv_version_label
    });

    const created = await client.query(
      `
        INSERT INTO applications (
          company_name,
          job_link,
          job_description,
          status,
          salary,
          location,
          recruiter,
          contact_person,
          applied_date,
          interview_date,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `,
      [
        data.company_name,
        data.job_link,
        data.job_description,
        data.status,
        data.salary,
        data.location,
        data.recruiter,
        data.contact_person,
        data.applied_date,
        data.interview_date,
        data.notes
      ]
    );

    const applicationId = created.rows[0].id;
    await client.query(
      'INSERT INTO application_cvs (application_id, cv_id) VALUES ($1, $2)',
      [applicationId, cvId]
    );
    await client.query(
      'INSERT INTO status_history (application_id, from_status, to_status) VALUES ($1, NULL, $2)',
      [applicationId, data.status]
    );
    await logActivity(client, applicationId, 'created', `Created application for ${data.company_name}`);
    await replaceTags(client, applicationId, data.tags);
    await client.query('COMMIT');
    return getApplication(req, res, applicationId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateApplication(req, res, id) {
  const current = await pool.query('SELECT * FROM applications WHERE id = $1', [id]);
  if (!current.rowCount) return sendError(res, 404, 'Application not found');

  const body = await readJson(req, 256 * 1024);
  const previous = current.rows[0];
  const data = normalizeApplicationInput({ ...current.rows[0], ...body });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `
        UPDATE applications
        SET company_name = $1,
            job_link = $2,
            job_description = $3,
            status = $4,
            salary = $5,
            location = $6,
            recruiter = $7,
            contact_person = $8,
            applied_date = $9,
            interview_date = $10,
            notes = $11
        WHERE id = $12
      `,
      [
        data.company_name,
        data.job_link,
        data.job_description,
        data.status,
        data.salary,
        data.location,
        data.recruiter,
        data.contact_person,
        data.applied_date,
        data.interview_date,
        data.notes,
        id
      ]
    );

    if (previous.status !== data.status) {
      await client.query(
        'INSERT INTO status_history (application_id, from_status, to_status) VALUES ($1, $2, $3)',
        [id, previous.status, data.status]
      );
      await logActivity(client, id, 'status_changed', `${data.company_name}: ${previous.status} to ${data.status}`);
    }

    if (dateForLog(previous.interview_date) !== dateForLog(data.interview_date)) {
      await logActivity(client, id, 'interview_date_changed', `${data.company_name}: ${dateForLog(previous.interview_date)} to ${dateForLog(data.interview_date)}`);
    }

    const changedFields = changedApplicationFields(previous, data);
    if (changedFields.length) {
      await logActivity(client, id, 'details_updated', `${data.company_name}: ${changedFields.join(', ')}`);
    }

    if (body.tags !== undefined) {
      await replaceTags(client, id, data.tags);
      await logActivity(client, id, 'tags_updated', `${data.company_name}: ${data.tags.length ? data.tags.join(', ') : 'Tags cleared'}`);
    }

    await client.query('COMMIT');
    return getApplication(req, res, id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteApplication(req, res, id) {
  const existing = await pool.query('SELECT company_name FROM applications WHERE id = $1', [id]);
  if (!existing.rowCount) return sendError(res, 404, 'Application not found');
  await pool.query(
    'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
    [id, 'deleted', `Deleted application for ${existing.rows[0].company_name}`]
  );
  await audit.log(req, {
    applicationId: id,
    targetType: 'application',
    targetId: id,
    action: 'delete',
    details: `Deleted application for ${existing.rows[0].company_name}`
  });
  await pool.query('DELETE FROM applications WHERE id = $1', [id]);
  sendJson(res, 200, { ok: true });
}

async function archiveApplication(req, res, id) {
  const result = await pool.query(
    `
      UPDATE applications
      SET archived_at = COALESCE(archived_at, now())
      WHERE id = $1
      RETURNING id, company_name
    `,
    [id]
  );
  if (!result.rowCount) return sendError(res, 404, 'Application not found');
  await pool.query('INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)', [id, 'archived', `Archived application for ${result.rows[0].company_name}`]);
  await audit.log(req, {
    applicationId: id,
    targetType: 'application',
    targetId: id,
    action: 'archive',
    details: `Archived application for ${result.rows[0].company_name}`
  });
  return getApplication(req, res, id);
}

async function restoreApplication(req, res, id) {
  const result = await pool.query(
    `
      UPDATE applications
      SET archived_at = NULL
      WHERE id = $1
      RETURNING id, company_name
    `,
    [id]
  );
  if (!result.rowCount) return sendError(res, 404, 'Application not found');
  await pool.query('INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)', [id, 'restored', `Restored application for ${result.rows[0].company_name}`]);
  await audit.log(req, {
    applicationId: id,
    targetType: 'application',
    targetId: id,
    action: 'restore',
    details: `Restored application for ${result.rows[0].company_name}`
  });
  return getApplication(req, res, id);
}

async function createNote(req, res, applicationId) {
  const body = await readJson(req, 64 * 1024);
  const note = cleanString(body.body);
  if (!note) return sendError(res, 400, 'Note body is required');

  const application = await pool.query('SELECT 1 FROM applications WHERE id = $1', [applicationId]);
  if (!application.rowCount) return sendError(res, 404, 'Application not found');

  const result = await pool.query(
    `
      INSERT INTO application_notes (application_id, body)
      VALUES ($1, $2)
      RETURNING id, body, created_at
    `,
    [applicationId, note]
  );
  await pool.query('INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)', [applicationId, 'note_added', note.slice(0, 500)]);
  sendJson(res, 201, { note: result.rows[0] });
}

async function getCVs(req, res) {
  const result = await pool.query(
    `
      SELECT id, original_name, version_label, file_size, is_latest, created_at, length(extracted_text) AS extracted_text_length
      FROM cv_versions
      WHERE deleted_at IS NULL
      ORDER BY is_latest DESC, created_at DESC
    `
  );
  sendJson(res, 200, { cvs: result.rows });
}

async function createCV(req, res) {
  const { fields, files } = await readMultipart(req, config.maxUploadBytes + 1024 * 1024);
  const saved = await storage.saveCV(files.cv);
  const extractedText = await extractCVText(files.cv);
  const versionLabel = cleanString(fields.version_label);
  const makeLatest = fields.is_latest !== 'false';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureUniqueCVUpload(client, saved);
    const existingLatest = await client.query('SELECT 1 FROM cv_versions WHERE is_latest = TRUE LIMIT 1');
    const isLatest = makeLatest || !existingLatest.rowCount;
    if (isLatest) await client.query('UPDATE cv_versions SET is_latest = FALSE WHERE is_latest = TRUE');

    const result = await client.query(
      `
        INSERT INTO cv_versions (file_path, original_name, mime_type, file_size, version_label, is_latest, extracted_text, file_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, original_name, version_label, file_size, is_latest, created_at
      `,
      [saved.relativePath, saved.originalName, saved.mimeType, saved.fileSize, versionLabel, isLatest, extractedText, saved.fileHash]
    );
    await client.query('COMMIT');
    sendJson(res, 201, { cv: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    await storage.remove(saved.relativePath);
    throw error;
  } finally {
    client.release();
  }
}

async function deleteCV(req, res, id) {
  const cv = await pool.query('SELECT id, file_path, is_latest FROM cv_versions WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (!cv.rowCount) return sendError(res, 404, 'CV not found');

  const linked = await pool.query(
    `
      SELECT
        (SELECT count(*) FROM application_cvs WHERE cv_id = $1)::int AS application_count,
        (SELECT count(*) FROM ai_documents WHERE cv_id = $1)::int AS document_count
    `,
    [id]
  );

  if (Number(linked.rows[0].application_count) || Number(linked.rows[0].document_count)) {
    return sendError(res, 409, 'This CV is linked to application history or generated documents and cannot be deleted.');
  }

  await storage.remove(cv.rows[0].file_path);
  await pool.query('DELETE FROM cv_versions WHERE id = $1', [id]);
  await audit.log(req, {
    targetType: 'cv',
    targetId: id,
    action: 'delete',
    details: `Deleted CV ${id}`
  });

  if (cv.rows[0].is_latest) {
    await pool.query(
      `
        UPDATE cv_versions
        SET is_latest = TRUE
        WHERE id = (
          SELECT id FROM cv_versions WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1
        )
      `
    );
  }

  sendJson(res, 200, { ok: true });
}

async function downloadCV(req, res, id) {
  const result = await pool.query(
    'SELECT file_path, original_name, mime_type, file_size FROM cv_versions WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!result.rowCount) return sendError(res, 404, 'CV not found');

  const cv = result.rows[0];
  const absolutePath = storage.resolveSafe(cv.file_path);
  const stats = statSync(absolutePath);
  res.writeHead(200, {
    'content-type': cv.mime_type,
    'content-length': stats.size,
    'content-disposition': `attachment; filename="${cv.original_name.replace(/"/g, '')}"`,
    'x-content-type-options': 'nosniff'
  });
  storage.open(cv.file_path).pipe(res);
}

async function generateCV(req, res) {
  const input = await readAIRequest(req);
  const output = await aiProvider.generateCV(input);
  const document = await persistAIDocument({ ...input, type: 'tailored_cv', title: `Tailored CV - ${input.application?.company_name || input.cv.original_name}`, content: output.content, output });
  sendJson(res, 200, { ...output, document });
}

async function generateCoverLetter(req, res) {
  const input = await readAIRequest(req);
  const output = await aiProvider.generateCoverLetter(input);
  const document = await persistAIDocument({ ...input, type: 'cover_letter', title: `Cover Letter - ${input.application?.company_name || input.cv.original_name}`, content: output.content, output });
  sendJson(res, 200, { ...output, document });
}

async function scoreRoleFit(req, res) {
  const input = await readAIRequest(req);
  const output = await aiProvider.scoreRoleFit(input);
  const document = await persistAIDocument({ ...input, type: 'role_fit', title: `Role Fit - ${input.application?.company_name || input.cv.original_name}`, content: output.content, output });
  sendJson(res, 200, { ...output, document });
}

async function checkATS(req, res) {
  const input = await readAIRequest(req);
  const output = await aiProvider.checkATS(input);
  const document = await persistAIDocument({ ...input, type: 'ats_check', title: `ATS Check - ${input.application?.company_name || input.cv.original_name}`, content: output.content, output });
  sendJson(res, 200, { ...output, document });
}

async function generateFollowUpEmail(req, res) {
  const input = await readAIRequest(req);
  const output = await aiProvider.generateFollowUpEmail(input);
  const document = await persistAIDocument({ ...input, type: 'follow_up_email', title: `Follow-up Email - ${input.application?.company_name || input.cv.original_name}`, content: output.content, output });
  sendJson(res, 200, { ...output, document });
}

async function downloadAIDocument(req, res, id) {
  const result = await pool.query('SELECT title, file_path FROM ai_documents WHERE id = $1 AND file_path IS NOT NULL', [id]);
  if (!result.rowCount) return sendError(res, 404, 'AI document not found');

  const doc = result.rows[0];
  const stats = statSync(storage.resolveSafe(doc.file_path));
  res.writeHead(200, {
    'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'content-length': stats.size,
    'content-disposition': `attachment; filename="${doc.title.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80)}.docx"`,
    'x-content-type-options': 'nosniff'
  });
  storage.open(doc.file_path).pipe(res);
}

async function readAIRequest(req) {
  return readAIInput({ req, pool, storage, readJson, cleanString, config });
}

async function persistAIDocument(payload) {
  const document = await saveAIDocument({ pool, storage, config, ...payload });
  if (payload.application?.id) {
    await pool.query(
      'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
      [payload.application.id, `ai_${payload.type}`, `${payload.title} via ${payload.output?.provider || config.aiProvider}/${payload.output?.model || config.aiModel}`]
    );
  }
  return document;
}

async function readApplicationMultipart(req) {
  const { fields, files } = await readMultipart(req, config.maxUploadBytes + 512 * 1024);
  return { fields, file: files.cv || null };
}

server.listen(config.port, () => {
  console.log(`Job tracker running at http://localhost:${config.port}`);
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}
