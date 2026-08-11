import http from 'node:http';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { statSync } from 'node:fs';
import { config } from './config.js';
import JSZip from 'jszip';
import { pool } from './db/pool.js';
import { securityHeaders, sendError, sendHtmlError, sendJson, readJson, readMultipart, serveStatic } from './utils/http.js';
import { cleanString, parseBoolean, parseDate, parseInteger, validateFeedbackSource, validateStatus, validateUrl } from './utils/validation.js';
import { createRequestGuard } from './utils/requestGuards.js';
import { csvEscape, parseCsv, changedApplicationFields, dateForLog, buildPromptExcerpt, buildSourceContext, extractCandidateSignals, extractJobSignals } from './utils/text.js';
import { LocalFileStorage } from './storage/localFileStorage.js';
import { createAIProvider } from './services/aiProvider.js';
import { createAuditLogger } from './services/audit.js';
import { normalizeApplicationInput, resolveApplicationCV, replaceTags, logActivity, ensureUniqueCVUpload } from './services/applicationHelpers.js';
import { readAIInput, saveAIDocument } from './services/aiDocuments.js';
import { createReadApi } from './services/readApi.js';
import { createApiRouter } from './routes.js';
import { extractCVText } from './services/cvTextExtractor.js';
import { applyMigrations } from './db/ensureSchema.js';
import { explainConnectionError } from './db/connectionError.js';
import { queueAWSGeneration, syncCompletedAWSJob } from './services/awsAiQueue.js';
import { createProcessStepsService } from './services/processSteps.js';

const publicDir = join(process.cwd(), 'public');
const storage = new LocalFileStorage();
const enforceRequestGuards = createRequestGuard({ config });
const audit = createAuditLogger(pool);
const readApi = createReadApi({ pool, audit });
const processSteps = createProcessStepsService({ pool, audit, logActivity });
const spaIndexPath = join(publicDir, 'index.html');
let shuttingDown = false;

const server = http.createServer(async (req, res) => {
  try {
    if (shuttingDown) {
      return respondError(req, res, 503, 'App is restarting', 'The app is shutting down after an internal failure. Wait a few seconds and refresh.');
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    enforceRequestGuards(req, res, url);

    if (serveSpecialPublicFiles(req, res, url)) {
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      await routeApi(req, res, url);
      return;
    }

    if (!serveStatic(req, res, publicDir)) {
      if (shouldServeAppShell(url.pathname)) {
        return serveAppShell(res);
      }
      respondError(req, res, 404, 'Page not found', 'The page you requested does not exist in this local app.');
    }
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error);
    const message = statusCode >= 500 ? 'Internal server error' : (error.message || 'Request failed');
    respondError(req, res, statusCode, message, statusCode >= 500 ? 'Refresh the page. If this keeps happening, check the server logs.' : '');
  }
});

const routeApi = createApiRouter({
  health: async (req, res) => sendJson(res, 200, {
    ok: true,
    ai: {
      default_provider: config.defaultAiRequestProvider,
      aws_enabled: config.awsAiEnabled
    }
  }),
  getReminders: async (req, res) => sendJson(res, 200, await readApi.getReminders()),
  getNotifications: async (req, res) => sendJson(res, 200, await readApi.getNotifications()),
  getReports: async (req, res, url) => sendJson(res, 200, await readApi.getReports(url)),
  getActivity: async (req, res, url) => sendJson(res, 200, await readApi.getActivity(url)),
  deleteActivityLogs,
  getAudit: async (req, res, url) => sendJson(res, 200, await readApi.getAudit(url)),
  getSavedFilters: async (req, res) => sendJson(res, 200, await readApi.getSavedFilters()),
  getSelectedTags,
  updateSelectedTags,
  getSelectedTagStats,
  getSelectedChartTags,
  updateSelectedChartTags,
  getSelectedChartTagStats,
  getJobBoards: async (req, res) => sendJson(res, 200, await readApi.getJobBoards()),
  getTargetCompanies: async (req, res) => sendJson(res, 200, await readApi.getTargetCompanies()),
  createSavedFilter,
  deleteSavedFilter,
  createJobBoard,
  updateJobBoard,
  checkJobBoard,
  deleteJobBoard,
  createTargetCompany,
  updateTargetCompany,
  checkTargetCompany,
  deleteTargetCompany,
  exportApplicationsCsv,
  exportCalendar,
  getStats,
  importApplicationsCsv,
  exportBackup,
  importBackup,
  getApplications: async (req, res, url) => sendJson(res, 200, await readApi.getApplications(url)),
  lookupApplications: async (req, res, url) => sendJson(res, 200, await readApi.lookupApplications(url)),
  createApplication,
  getProcessSteps: async (req, res, id) => sendJson(res, 200, { process_steps: await processSteps.list(id) }),
  createProcessStep,
  updateProcessStep,
  deleteProcessStep,
  reorderProcessSteps,
  getUpcomingProcessSteps: async (req, res) => sendJson(res, 200, { reminders: await processSteps.upcoming() }),
  getProcessStepSummaries: async (req, res, url) => sendJson(res, 200, { summaries: await processSteps.summaries(parseApplicationIds(url)) }),
  getProcessInsights: async (req, res, url) => sendJson(res, 200, await processSteps.insights({ mode: url.searchParams.get('mode'), period: url.searchParams.get('period') })),
  getApplication: async (req, res, id) => sendJson(res, 200, await readApi.getApplication(id)),
  updateApplication,
  deleteApplication,
  archiveApplication,
  restoreApplication,
  createNote,
  deleteNote,
  updatePreparation,
  createRecruiterQuestion,
  updateRecruiterQuestion,
  deleteRecruiterQuestion,
  createFeedbackEntry,
  deleteFeedbackEntry,
  createTodo,
  updateTodo,
  deleteTodo,
  getCVs: async (req, res) => sendJson(res, 200, await readApi.getCVs()),
  createCV,
  updateCV,
  deleteCV,
  downloadCV,
  viewCV,
  generateCV,
  generateCoverLetter,
  scoreRoleFit,
  checkATS,
  generateFollowUpEmail,
  getApplicationAIDocuments: async (req, res, id) => sendJson(res, 200, await readApi.getApplicationAIDocuments(id)),
  exportApplicationArtifacts,
  getAIDocument: async (req, res, id) => sendJson(res, 200, await readApi.getAIDocument(id)),
  deleteAIDocument,
  regenerateAIDocument,
  getAIJob,
  downloadAIDocument,
  notFound: (req, res) => sendError(res, 404, 'API route not found')
});

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

async function getSelectedTags(req, res) {
  const [available, selected] = await Promise.all([
    pool.query(`
      SELECT DISTINCT t.name
      FROM tags t
      JOIN application_tags at ON at.tag_id = t.id
      JOIN applications a ON a.id = at.application_id
      ORDER BY t.name
    `),
    pool.query('SELECT tag_name AS name FROM selected_tag_reports ORDER BY sort_order, tag_name')
  ]);
  sendJson(res, 200, {
    available_tags: available.rows.map((row) => row.name),
    selected_tags: selected.rows.map((row) => row.name)
  });
}

async function updateSelectedTags(req, res) {
  const body = await readJson(req, 64 * 1024);
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((tag) => cleanString(tag)).filter(Boolean))]
    : [];
  await validateSelectedTagNames(tags);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM selected_tag_reports');
    for (let index = 0; index < tags.length; index += 1) {
      await client.query(
        'INSERT INTO selected_tag_reports (tag_name, sort_order) VALUES ($1, $2)',
        [tags[index], index]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  sendJson(res, 200, { selected_tags: tags });
}

async function getSelectedChartTags(req, res) {
  const [available, selected] = await Promise.all([
    pool.query(`
      SELECT DISTINCT t.name
      FROM tags t
      JOIN application_tags at ON at.tag_id = t.id
      JOIN applications a ON a.id = at.application_id
      ORDER BY t.name
    `),
    pool.query('SELECT tag_name AS name FROM selected_chart_tags ORDER BY sort_order, tag_name')
  ]);
  sendJson(res, 200, {
    available_tags: available.rows.map((row) => row.name),
    selected_tags: selected.rows.map((row) => row.name)
  });
}

async function updateSelectedChartTags(req, res) {
  const body = await readJson(req, 64 * 1024);
  const tags = Array.isArray(body.tags)
    ? [...new Set(body.tags.map((tag) => cleanString(tag)).filter(Boolean))]
    : [];
  await validateSelectedTagNames(tags);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM selected_chart_tags');
    for (let index = 0; index < tags.length; index += 1) {
      await client.query(
        'INSERT INTO selected_chart_tags (tag_name, sort_order) VALUES ($1, $2)',
        [tags[index], index]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  sendJson(res, 200, { selected_tags: tags });
}

async function validateSelectedTagNames(tags) {
  if (!tags.length) return;
  const available = await pool.query(`
    SELECT DISTINCT t.name
    FROM tags t
    JOIN application_tags at ON at.tag_id = t.id
    JOIN applications a ON a.id = at.application_id
    WHERE t.name = ANY($1::text[])
  `, [tags]);
  const availableNames = new Set(available.rows.map((row) => row.name));
  const invalid = tags.filter((tag) => !availableNames.has(tag));
  if (invalid.length) {
    const error = new Error(`Unknown application tag: ${invalid[0]}`);
    error.statusCode = 400;
    throw error;
  }
}

async function createJobBoard(req, res) {
  const body = await readJson(req, 64 * 1024);
  const data = normalizeJobBoardInput(body);
  const result = await pool.query(
    `
      INSERT INTO job_boards (name, url, notes, last_checked_date, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, url, notes, to_char(last_checked_date, 'YYYY-MM-DD') AS last_checked_date, is_active, created_at, updated_at
    `,
    [data.name, data.url, data.notes, data.last_checked_date, data.is_active]
  );
  sendJson(res, 201, { job_board: result.rows[0] });
}

async function updateJobBoard(req, res, id) {
  const existing = await pool.query('SELECT id, name FROM job_boards WHERE id = $1', [id]);
  if (!existing.rowCount) return sendError(res, 404, 'Job board not found');

  const body = await readJson(req, 64 * 1024);
  const data = normalizeJobBoardInput({ ...existing.rows[0], ...body });
  const result = await pool.query(
    `
      UPDATE job_boards
      SET name = $1,
          url = $2,
          notes = $3,
          last_checked_date = $4,
          is_active = $5
      WHERE id = $6
      RETURNING id, name, url, notes, to_char(last_checked_date, 'YYYY-MM-DD') AS last_checked_date, is_active, created_at, updated_at
    `,
    [data.name, data.url, data.notes, data.last_checked_date, data.is_active, id]
  );
  sendJson(res, 200, { job_board: result.rows[0] });
}

async function checkJobBoard(req, res, id) {
  const result = await pool.query(
    `
      UPDATE job_boards
      SET last_checked_date = CURRENT_DATE
      WHERE id = $1
      RETURNING id, name, url, notes, to_char(last_checked_date, 'YYYY-MM-DD') AS last_checked_date, is_active, created_at, updated_at
    `,
    [id]
  );
  if (!result.rowCount) return sendError(res, 404, 'Job board not found');
  sendJson(res, 200, { job_board: result.rows[0] });
}

async function deleteActivityLogs(req, res) {
  const body = await readJson(req, 64 * 1024);
  const ids = body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return sendError(res, 400, 'Invalid or empty IDs list');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get the activity logs we are going to delete
    const selectResult = await client.query(
      'SELECT id, application_id, action, details, created_at FROM activity_logs WHERE id = ANY($1)',
      [ids]
    );

    // 2. Look for 'status_changed' activity logs.
    // For each, find the corresponding status_history record to delete.
    for (const log of selectResult.rows) {
      if (log.action === 'status_changed' && log.application_id) {
        await client.query(
          `DELETE FROM status_history 
           WHERE application_id = $1 
             AND abs(extract(epoch from (changed_at - $2))) < 5`,
          [log.application_id, log.created_at]
        );
      }
    }

    // 3. Delete the activity logs
    await client.query(
      'DELETE FROM activity_logs WHERE id = ANY($1)',
      [ids]
    );

    await client.query('COMMIT');
    sendJson(res, 200, { ok: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteJobBoard(req, res, id) {
  const result = await pool.query('DELETE FROM job_boards WHERE id = $1 RETURNING id, name', [id]);
  if (!result.rowCount) return sendError(res, 404, 'Job board not found');
  await audit.log(req, {
    targetType: 'job_board',
    targetId: id,
    action: 'delete',
    details: `Deleted job board ${result.rows[0].name}`
  });
  sendJson(res, 200, { ok: true });
}

function normalizeJobBoardInput(body) {
  const name = cleanString(body.name);
  if (!name) {
    const error = new Error('Job board name is required');
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    url: validateUrl(body.url),
    notes: cleanString(body.notes),
    last_checked_date: parseDate(body.last_checked_date, 'last_checked_date'),
    is_active: parseBoolean(body.is_active, 'is_active') ?? true
  };
}

async function createTargetCompany(req, res) {
  const body = await readJson(req, 128 * 1024);
  const data = normalizeTargetCompanyInput(body);
  const result = await pool.query(
    `
      INSERT INTO target_companies (
        name, company_url, career_url, linkedin_url, region, primary_location,
        germany_offices, additional_offices, industry, company_type, description,
        work_mode, employee_count, visa_signal, relocation_signal, fit_notes,
        source, source_notes, last_checked_date, is_active
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19, $20
      )
      RETURNING *, to_char(last_checked_date, 'YYYY-MM-DD') AS last_checked_date
    `,
    targetCompanyValues(data)
  );
  sendJson(res, 201, { target_company: result.rows[0] });
}

async function updateTargetCompany(req, res, id) {
  const existing = await pool.query('SELECT * FROM target_companies WHERE id = $1', [id]);
  if (!existing.rowCount) return sendError(res, 404, 'Target company not found');

  const body = await readJson(req, 128 * 1024);
  const data = normalizeTargetCompanyInput({ ...existing.rows[0], ...body });
  const result = await pool.query(
    `
      UPDATE target_companies
      SET name = $1,
          company_url = $2,
          career_url = $3,
          linkedin_url = $4,
          region = $5,
          primary_location = $6,
          germany_offices = $7,
          additional_offices = $8,
          industry = $9,
          company_type = $10,
          description = $11,
          work_mode = $12,
          employee_count = $13,
          visa_signal = $14,
          relocation_signal = $15,
          fit_notes = $16,
          source = $17,
          source_notes = $18,
          last_checked_date = $19,
          is_active = $20
      WHERE id = $21
      RETURNING *, to_char(last_checked_date, 'YYYY-MM-DD') AS last_checked_date
    `,
    [...targetCompanyValues(data), id]
  );
  sendJson(res, 200, { target_company: result.rows[0] });
}

async function checkTargetCompany(req, res, id) {
  const result = await pool.query(
    `
      UPDATE target_companies
      SET last_checked_date = CURRENT_DATE
      WHERE id = $1
      RETURNING *, to_char(last_checked_date, 'YYYY-MM-DD') AS last_checked_date
    `,
    [id]
  );
  if (!result.rowCount) return sendError(res, 404, 'Target company not found');
  sendJson(res, 200, { target_company: result.rows[0] });
}

async function deleteTargetCompany(req, res, id) {
  const result = await pool.query('DELETE FROM target_companies WHERE id = $1 RETURNING id, name', [id]);
  if (!result.rowCount) return sendError(res, 404, 'Target company not found');
  await audit.log(req, {
    targetType: 'target_company',
    targetId: id,
    action: 'delete',
    details: `Deleted target company ${result.rows[0].name}`
  });
  sendJson(res, 200, { ok: true });
}

function normalizeTargetCompanyInput(body) {
  const name = cleanString(body.name);
  if (!name) {
    const error = new Error('Company name is required');
    error.statusCode = 400;
    throw error;
  }

  return {
    name,
    company_url: validateUrl(body.company_url),
    career_url: validateUrl(body.career_url),
    linkedin_url: validateUrl(body.linkedin_url),
    region: cleanString(body.region),
    primary_location: cleanString(body.primary_location),
    germany_offices: cleanString(body.germany_offices),
    additional_offices: cleanString(body.additional_offices),
    industry: cleanString(body.industry),
    company_type: cleanString(body.company_type),
    description: cleanString(body.description),
    work_mode: cleanString(body.work_mode),
    employee_count: cleanString(body.employee_count),
    visa_signal: cleanString(body.visa_signal),
    relocation_signal: cleanString(body.relocation_signal),
    fit_notes: cleanString(body.fit_notes),
    source: cleanString(body.source),
    source_notes: cleanString(body.source_notes),
    last_checked_date: parseDate(body.last_checked_date, 'last_checked_date'),
    is_active: parseBoolean(body.is_active, 'is_active') ?? true
  };
}

function targetCompanyValues(data) {
  return [
    data.name,
    data.company_url,
    data.career_url,
    data.linkedin_url,
    data.region,
    data.primary_location,
    data.germany_offices,
    data.additional_offices,
    data.industry,
    data.company_type,
    data.description,
    data.work_mode,
    data.employee_count,
    data.visa_signal,
    data.relocation_signal,
    data.fit_notes,
    data.source,
    data.source_notes,
    data.last_checked_date,
    data.is_active
  ];
}

async function ensureApplicationExists(applicationId) {
  const result = await pool.query('SELECT id, company_name FROM applications WHERE id = $1', [applicationId]);
  if (!result.rowCount) {
    const error = new Error('Application not found');
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
}

async function assertNoDuplicateApplication(executor, data, excludeId = null) {
  const duplicate = await findDuplicateApplication(executor, data, excludeId);
  if (!duplicate) return;
  const error = new Error(`Duplicate application detected for ${duplicate.company_name}${duplicate.role_title ? ` - ${duplicate.role_title}` : ''}.`);
  error.statusCode = 409;
  throw error;
}

async function findDuplicateApplication(executor, data, excludeId = null) {
  const company = normalizedDuplicateValue(data.company_name);
  const role = normalizedDuplicateValue(data.role_title);
  const link = normalizedDuplicateValue(data.job_link);
  if (!company) return null;

  const result = await executor.query(
    `
      SELECT id, company_name, role_title, job_link
      FROM applications
      WHERE ($1::bigint IS NULL OR id <> $1)
        AND lower(trim(company_name)) = $2
        AND lower(trim(coalesce(role_title, ''))) = $3
    `,
    [excludeId, company, role]
  );

  return result.rows.find((row) => {
    const existingLink = normalizedDuplicateValue(row.job_link);
    if (link || existingLink) return link === existingLink;
    return true;
  }) || null;
}

function normalizedDuplicateValue(value) {
  return String(value || '').trim().toLowerCase();
}


async function exportApplicationsCsv(req, res) {
  const urlParams = new URL(req.url, `http://${req.headers.host}`);
  const idsParam = urlParams.searchParams.get('ids');
  const hasIds = !!idsParam;
  const ids = hasIds ? idsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];

  // Same filter semantics as GET /api/applications, so "export current view" matches the list.
  const knownStatuses = ['applied', 'interview_scheduled', 'offer', 'accepted', 'rejected', 'withdrawn', 'ghosted'];
  const search = (urlParams.searchParams.get('search') || '').trim();
  const statusParam = urlParams.searchParams.get('status') || '';
  const status = knownStatuses.includes(statusParam) ? statusParam : '';
  const tag = (urlParams.searchParams.get('tag') || '').trim();
  const category = (urlParams.searchParams.get('category') || '').trim();
  const archivedParam = urlParams.searchParams.get('archived') || 'all';
  const archived = ['false', 'true', 'all', 'closed'].includes(archivedParam) ? archivedParam : 'all';
  const dateFrom = /^\d{4}-\d{2}-\d{2}$/.test(urlParams.searchParams.get('dateFrom') || '') ? urlParams.searchParams.get('dateFrom') : '';
  const dateTo = /^\d{4}-\d{2}-\d{2}$/.test(urlParams.searchParams.get('dateTo') || '') ? urlParams.searchParams.get('dateTo') : '';

  const filterWhere = `
      WHERE ($1 = '' OR a.company_name ILIKE '%' || $1 || '%' OR a.role_title ILIKE '%' || $1 || '%')
        AND ($2 = '' OR a.status = $2::application_status)
        AND ($3 = '' OR a.company_category = $3)
        AND ($4 = '' OR EXISTS (
          SELECT 1 FROM application_tags at2
          JOIN tags t2 ON t2.id = at2.tag_id
          WHERE at2.application_id = a.id AND t2.name ILIKE '%' || $4 || '%'
        ))
        AND (
          $5 = 'all'
          OR ($5 = 'true' AND a.archived_at IS NOT NULL)
          OR ($5 = 'closed' AND a.archived_at IS NULL AND a.status IN ('rejected', 'withdrawn', 'ghosted'))
          OR ($5 = 'false' AND a.archived_at IS NULL AND a.status NOT IN ('rejected', 'withdrawn', 'ghosted'))
        )
        AND ($6 = '' OR a.applied_date >= $6::date)
        AND ($7 = '' OR a.applied_date < ($7::date + interval '1 day'))
    `;

  const query = `
      SELECT
        a.company_name,
        a.role_title,
        a.job_link,
        a.job_description,
        a.status,
        a.salary,
        a.location,
        a.recruiter,
        a.contact_person,
        to_char(a.applied_date, 'YYYY-MM-DD') AS applied_date,
        to_char(a.interview_date, 'YYYY-MM-DD') AS interview_date,
        a.next_action,
        to_char(a.next_action_due_date, 'YYYY-MM-DD') AS next_action_due_date,
        a.notes,
        CASE WHEN a.archived_at IS NULL THEN 'active' ELSE 'archived' END AS lifecycle,
        COALESCE(string_agg(DISTINCT t.name, ', '), '') AS tags
      FROM applications a
      LEFT JOIN application_tags at ON at.application_id = a.id
      LEFT JOIN tags t ON t.id = at.tag_id
      ${hasIds && ids.length > 0 ? 'WHERE a.id = ANY($1::int[])' : filterWhere}
      GROUP BY a.id
      ORDER BY a.applied_date DESC, a.id DESC
    `;

  const result = await pool.query(
    query,
    hasIds && ids.length > 0 ? [ids] : [search, status, category, tag, archived, dateFrom, dateTo]
  );

  const headers = ['company_name', 'role_title', 'job_link', 'job_description', 'status', 'salary', 'location', 'recruiter', 'contact_person', 'applied_date', 'interview_date', 'next_action', 'next_action_due_date', 'notes', 'lifecycle', 'tags'];
  const csv = [
    headers.join(','),
    ...result.rows.map((row) => headers.map((key) => csvEscape(row[key])).join(','))
  ].join('\n');

  res.writeHead(200, {
    ...securityHeaders,
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="job-applications.csv"'
  });
  res.end(csv);
}

async function exportCalendar(req, res) {
  const urlParams = new URL(req.url, `http://${req.headers.host}`);
  const idsParam = urlParams.searchParams.get('ids');
  const hasIds = !!idsParam;
  const ids = hasIds ? idsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];

  const query = `
      SELECT id, company_name, role_title, next_action,
        to_char(interview_date, 'YYYYMMDD') AS interview_day,
        to_char(next_action_due_date, 'YYYYMMDD') AS due_day
      FROM applications
      WHERE ${liveApplicationCondition('applications')}
        AND (interview_date IS NOT NULL OR next_action_due_date IS NOT NULL)
        ${hasIds && ids.length > 0 ? 'AND id = ANY($1::int[])' : ''}
      ORDER BY id
    `;
  const processQuery = `
      SELECT ps.id AS step_id, ps.application_id, ps.step_name, a.company_name, a.role_title,
        to_char(ps.event_date, 'YYYYMMDD') AS event_day
      FROM application_process_steps ps
      JOIN applications a ON a.id = ps.application_id
      WHERE ${liveApplicationCondition('a')}
        AND ps.source = 'manual'
        AND ps.step_state = 'scheduled'
        AND ps.tracking_state = 'open'
        ${hasIds && ids.length > 0 ? 'AND ps.application_id = ANY($1::int[])' : ''}
      ORDER BY ps.event_date, ps.id
    `;
  const params = hasIds && ids.length > 0 ? [ids] : [];
  const [result, processResult] = await Promise.all([
    pool.query(query, params),
    pool.query(processQuery, params)
  ]);

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const events = [];
  for (const row of result.rows) {
    const label = row.role_title ? `${row.company_name} (${row.role_title})` : row.company_name;
    if (row.interview_day) {
      events.push(...calendarEvent({
        uid: `interview-${row.id}`,
        day: row.interview_day,
        stamp,
        summary: `Interview - ${label}`,
        description: `Interview for job application ${row.id}`
      }));
    }
    if (row.due_day) {
      events.push(...calendarEvent({
        uid: `next-action-${row.id}`,
        day: row.due_day,
        stamp,
        summary: `${row.next_action || 'Follow up'} - ${label}`,
        description: `Next action for job application ${row.id}`
      }));
    }
  }
  for (const row of processResult.rows) {
    const label = row.role_title ? `${row.company_name} (${row.role_title})` : row.company_name;
    events.push(...calendarEvent({
      uid: `process-step-${row.step_id}`,
      day: row.event_day,
      stamp,
      summary: `${row.step_name} - ${label}`,
      description: `Hiring process step ${row.step_id} for job application ${row.application_id}`
    }));
  }

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Job Application Tracker//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
    ''
  ].join('\r\n');

  res.writeHead(200, {
    ...securityHeaders,
    'content-type': 'text/calendar; charset=utf-8',
    'content-disposition': 'attachment; filename="job-tracker.ics"',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function calendarEvent({ uid, day, stamp, summary, description }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@job-application-tracker`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${nextCalendarDay(day)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'END:VEVENT'
  ];
}

function nextCalendarDay(day) {
  const date = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8))));
  date.setUTCDate(date.getUTCDate() + 1);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`;
}

function icsEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

async function getStats(req, res, url) {
  const period = url?.searchParams.get('period') || '';
  const periodDays = { 30: 30, 60: 60, 90: 90 }[period];
  const periodScoped = period === 'all' || Boolean(periodDays);
  const allTime = periodScoped || url?.searchParams.get('mode') === 'all';
  const scopeCondition = periodDays ? `applied_date >= CURRENT_DATE - INTERVAL '${periodDays} days'` : (allTime ? 'TRUE' : 'archived_at IS NULL');
  const scopedAliasCondition = periodDays ? `a.applied_date >= CURRENT_DATE - INTERVAL '${periodDays} days'` : (allTime ? 'TRUE' : 'a.archived_at IS NULL');
  const interviewedCondition = interviewEvidenceCondition('a');

  const totals = await pool.query(
    `
      SELECT
        count(DISTINCT id) FILTER (WHERE ${scopeCondition})::int AS total,
        count(DISTINCT id) FILTER (WHERE ${scopeCondition} AND archived_at IS NULL AND status NOT IN ('rejected', 'withdrawn', 'ghosted'))::int AS active,
        count(DISTINCT id) FILTER (WHERE ${scopeCondition} AND archived_at IS NULL AND status IN ('rejected', 'withdrawn', 'ghosted'))::int AS closed,
        count(DISTINCT id) FILTER (WHERE ${scopeCondition} AND archived_at IS NOT NULL)::int AS archived,
        count(DISTINCT id) FILTER (WHERE ${scopeCondition} AND status = 'ghosted')::int AS ghosted
      FROM applications
    `
  );

  const funnel = await pool.query(
    `
      SELECT
        count(DISTINCT a.id) FILTER (WHERE ${interviewedCondition})::int AS interviewed,
        count(DISTINCT a.id) FILTER (WHERE EXISTS (SELECT 1 FROM status_history sh WHERE sh.application_id = a.id AND sh.to_status = 'offer'))::int AS offers,
        count(DISTINCT a.id) FILTER (WHERE EXISTS (SELECT 1 FROM status_history sh WHERE sh.application_id = a.id AND sh.to_status = 'accepted'))::int AS accepted,
        count(DISTINCT a.id) FILTER (WHERE EXISTS (SELECT 1 FROM status_history sh WHERE sh.application_id = a.id AND sh.to_status = 'rejected'))::int AS rejected,
        count(DISTINCT a.id) FILTER (WHERE ${interviewedCondition} OR EXISTS (SELECT 1 FROM status_history sh WHERE sh.application_id = a.id AND sh.to_status IN ('offer', 'accepted')))::int AS responded
      FROM applications a
      WHERE ${scopedAliasCondition}
    `
  );

  const timing = await pool.query(
    `
      SELECT
        (SELECT round(avg(days))::int FROM (
          SELECT min(event_day) - applied_date AS days
          FROM (
            SELECT a.id, a.applied_date, min(sh.changed_at)::date AS event_day
            FROM applications a
            JOIN status_history sh ON sh.application_id = a.id AND sh.to_status = 'interview_scheduled' AND sh.from_status IS NOT NULL
            WHERE a.applied_date IS NOT NULL AND ${scopedAliasCondition}
            GROUP BY a.id, a.applied_date
            UNION ALL
            SELECT a.id, a.applied_date, min(ps.event_date)::date AS event_day
            FROM applications a
            JOIN application_process_steps ps ON ps.application_id = a.id AND ps.step_group = 'interview' AND ps.step_state <> 'cancelled'
            WHERE a.applied_date IS NOT NULL AND ${scopedAliasCondition}
            GROUP BY a.id, a.applied_date
          ) interview_events
          WHERE event_day IS NOT NULL
          GROUP BY id, applied_date
        ) interview_days) AS avg_days_to_interview,
        (SELECT round(avg(days))::int FROM (
          SELECT min(sh.changed_at)::date - a.applied_date AS days
          FROM applications a
          JOIN status_history sh ON sh.application_id = a.id AND sh.to_status IN ('rejected', 'ghosted', 'withdrawn') AND sh.from_status IS NOT NULL
          WHERE a.applied_date IS NOT NULL AND ${scopedAliasCondition}
          GROUP BY a.id, a.applied_date
        ) close_days) AS avg_days_to_close
    `
  );

  const tags = await pool.query(
    `
      SELECT t.name AS tag,
        count(DISTINCT a.id)::int AS applications,
        count(DISTINCT a.id) FILTER (WHERE ${interviewedCondition})::int AS interviewed
      FROM tags t
      JOIN application_tags at ON at.tag_id = t.id
      JOIN applications a ON a.id = at.application_id
      WHERE ${scopedAliasCondition}
      GROUP BY t.name
      ORDER BY applications DESC, t.name
      LIMIT 12
    `
  );

  const categories = await pool.query(
    `
      SELECT company_category AS category,
        count(DISTINCT id)::int AS applications,
        count(DISTINCT id) FILTER (WHERE ${interviewedCondition})::int AS interviewed,
        count(DISTINCT id) FILTER (WHERE status = 'rejected')::int AS rejected,
        count(DISTINCT id) FILTER (WHERE status = 'ghosted')::int AS ghosted,
        count(DISTINCT id) FILTER (WHERE status = 'withdrawn')::int AS withdrawn,
        count(DISTINCT id) FILTER (WHERE status IN ('rejected', 'ghosted', 'withdrawn'))::int AS closed
      FROM applications a
      WHERE company_category IS NOT NULL AND company_category != ''
      AND ${scopedAliasCondition}
      GROUP BY company_category
      ORDER BY applications DESC, category
    `
  );

  sendJson(res, 200, {
    totals: totals.rows[0],
    funnel: funnel.rows[0],
    timing: timing.rows[0],
    tags: tags.rows,
    categories: categories.rows
  });
}

async function getSelectedTagStats(req, res, url) {
  const { scopeCondition, scopedAliasCondition } = buildInsightsScope(url);
  const interviewedCondition = interviewEvidenceCondition('a');
  const totals = await pool.query(`
    SELECT count(DISTINCT id) FILTER (WHERE ${scopeCondition})::int AS total
    FROM applications
  `);
  const tags = await pool.query(`
    SELECT selected.tag_name AS tag,
      count(DISTINCT a.id)::int AS applications,
      count(DISTINCT a.id) FILTER (WHERE ${interviewedCondition})::int AS interviewed,
      count(DISTINCT a.id) FILTER (WHERE a.status = 'rejected')::int AS rejected,
      count(DISTINCT a.id) FILTER (WHERE a.status = 'ghosted')::int AS ghosted,
      count(DISTINCT a.id) FILTER (WHERE a.status = 'withdrawn')::int AS withdrawn,
      count(DISTINCT a.id) FILTER (WHERE a.status IN ('rejected', 'ghosted', 'withdrawn'))::int AS closed
    FROM selected_tag_reports selected
    LEFT JOIN tags t ON t.name = selected.tag_name
    LEFT JOIN application_tags at ON at.tag_id = t.id
    LEFT JOIN applications a ON a.id = at.application_id AND ${scopedAliasCondition}
    GROUP BY selected.tag_name, selected.sort_order
    ORDER BY selected.sort_order, selected.tag_name
  `);
  sendJson(res, 200, {
    totals: totals.rows[0],
    tags: tags.rows
  });
}

async function getSelectedChartTagStats(req, res, url) {
  const { scopedAliasCondition } = buildInsightsScope(url);
  const interviewedCondition = interviewEvidenceCondition('a');
  const tags = await pool.query(`
    SELECT selected.tag_name AS tag,
      count(DISTINCT a.id)::int AS applications,
      count(DISTINCT a.id) FILTER (WHERE ${interviewedCondition})::int AS interviewed,
      count(DISTINCT a.id) FILTER (WHERE a.status IN ('rejected', 'ghosted', 'withdrawn'))::int AS closed
    FROM selected_chart_tags selected
    LEFT JOIN tags t ON t.name = selected.tag_name
    LEFT JOIN application_tags at ON at.tag_id = t.id
    LEFT JOIN applications a ON a.id = at.application_id AND ${scopedAliasCondition}
    GROUP BY selected.tag_name, selected.sort_order
    ORDER BY selected.sort_order, selected.tag_name
  `);
  sendJson(res, 200, { tags: tags.rows });
}

function interviewEvidenceCondition(applicationAlias) {
  return `(
    EXISTS (
      SELECT 1 FROM status_history sh
      WHERE sh.application_id = ${applicationAlias}.id
        AND sh.to_status = 'interview_scheduled'
    )
    OR EXISTS (
      SELECT 1 FROM application_process_steps ps
      WHERE ps.application_id = ${applicationAlias}.id
        AND ps.step_group = 'interview'
        AND ps.step_state <> 'cancelled'
    )
  )`;
}

function liveApplicationCondition(applicationAlias) {
  return `${applicationAlias}.archived_at IS NULL AND ${applicationAlias}.status NOT IN ('rejected', 'withdrawn', 'ghosted')`;
}

function buildInsightsScope(url) {
  const period = url?.searchParams.get('period') || '';
  const periodDays = { 30: 30, 60: 60, 90: 90 }[period];
  const periodScoped = period === 'all' || Boolean(periodDays);
  const allTime = periodScoped || url?.searchParams.get('mode') === 'all';
  return {
    allTime,
    scopeCondition: periodDays ? `applied_date >= CURRENT_DATE - INTERVAL '${periodDays} days'` : (allTime ? 'TRUE' : 'archived_at IS NULL'),
    scopedAliasCondition: periodDays ? `a.applied_date >= CURRENT_DATE - INTERVAL '${periodDays} days'` : (allTime ? 'TRUE' : 'a.archived_at IS NULL')
  };
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
      await assertNoDuplicateApplication(client, data);
      const created = await client.query(
        `
          INSERT INTO applications (company_name, company_category, role_title, job_link, job_description, status, salary, location, recruiter, contact_person, applied_date, interview_date, notes, next_action, next_action_due_date, archived_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CASE WHEN $16 = 'archived' THEN now() ELSE NULL END)
          RETURNING id
        `,
        [data.company_name, data.company_category, data.role_title, data.job_link, data.job_description, data.status, data.salary, data.location, data.recruiter, data.contact_person, data.applied_date, data.interview_date, data.notes, data.next_action, data.next_action_due_date, cleanString(fields.lifecycle)]
      );
      const applicationId = created.rows[0].id;
      await processSteps.syncLegacyInterviewStep(client, applicationId, data.interview_date);
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

async function exportBackup(req, res) {
  const backup = {
    version: 2,
    created_at: new Date().toISOString(),
    config: {
      default_provider: config.defaultAiRequestProvider,
      aws_enabled: config.awsAiEnabled,
      file_storage_mode: config.fileStorageMode,
      upload_dir: config.uploadDir
    },
    data: await readBackupData(),
    files: await readBackupFiles()
  };

  const payload = JSON.stringify(backup);
  res.writeHead(200, {
    ...securityHeaders,
    'content-type': 'application/json; charset=utf-8',
    'content-disposition': `attachment; filename="job-tracker-backup-${Date.now()}.json"`,
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

async function importBackup(req, res) {
  const { files } = await readMultipart(req, config.maxUploadBytes * 20);
  if (!files.backup) return sendError(res, 400, 'Backup file is required');

  let backup;
  try {
    backup = JSON.parse(files.backup.buffer.toString('utf8'));
  } catch {
    return sendError(res, 400, 'Backup file is not valid JSON');
  }

  validateBackupPayload(backup);
  remapBackupUploadPaths(backup);
  validateBackupFilePaths(backup.files || []);
  await restoreBackupPayload(backup);
  sendJson(res, 200, { ok: true, restored_at: new Date().toISOString() });
}

async function exportApplicationArtifacts(req, res, id) {
  const application = await pool.query('SELECT company_name, role_title FROM applications WHERE id = $1', [id]);
  if (!application.rowCount) return sendError(res, 404, 'Application not found');

  const documents = await pool.query(
    `
      SELECT id, title, document_type, content, file_path, provider_name, provider_requested, model_name, created_at
      FROM ai_documents
      WHERE application_id = $1
        AND deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
    `,
    [id]
  );

  const zip = new JSZip();
  const folderName = safeZipName(`${application.rows[0].company_name}-${application.rows[0].role_title || 'application'}`);
  const root = zip.folder(folderName);
  root.file('manifest.json', JSON.stringify({
    application_id: id,
    company_name: application.rows[0].company_name,
    role_title: application.rows[0].role_title,
    exported_at: new Date().toISOString(),
    documents: documents.rows.map((row) => ({
      id: row.id,
      title: row.title,
      document_type: row.document_type,
      provider_name: row.provider_name,
      provider_requested: row.provider_requested,
      model_name: row.model_name,
      created_at: row.created_at
    }))
  }, null, 2));

  for (const [index, document] of documents.rows.entries()) {
    const entryName = `${String(index + 1).padStart(2, '0')}-${safeZipName(document.title)}`;
    root.file(`${entryName}.txt`, document.content || '');
    if (document.file_path) {
      const buffer = await readFile(storage.resolveSafe(document.file_path)).catch(() => null);
      if (buffer) root.file(`${entryName}.docx`, buffer);
    }
  }

  const payload = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  res.writeHead(200, {
    ...securityHeaders,
    'content-type': 'application/zip',
    'content-disposition': `attachment; filename="${folderName}-artifacts.zip"`,
    'content-length': payload.length
  });
  res.end(payload);
}

async function createProcessStep(req, res, applicationId) {
  const step = await processSteps.create(req, applicationId, await readJson(req, 256 * 1024));
  sendJson(res, 201, { process_step: step });
}

async function updateProcessStep(req, res, stepId) {
  const step = await processSteps.update(req, stepId, await readJson(req, 256 * 1024));
  sendJson(res, 200, { process_step: step });
}

async function deleteProcessStep(req, res, stepId) {
  const step = await processSteps.remove(req, stepId);
  sendJson(res, 200, { process_step: step });
}

async function reorderProcessSteps(req, res, applicationId) {
  const body = await readJson(req, 256 * 1024);
  const processStepsRows = await processSteps.reorder(req, applicationId, body.ordered_ids);
  sendJson(res, 200, { process_steps: processStepsRows });
}

function parseApplicationIds(url) {
  const value = url.searchParams.get('application_ids');
  if (!value) return undefined;
  return value.split(',').map(Number);
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
    await assertNoDuplicateApplication(client, data);
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
          company_category,
          role_title,
          job_link,
          job_description,
          status,
          salary,
          location,
          recruiter,
          contact_person,
          applied_date,
          interview_date,
          notes,
          next_action,
          next_action_due_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `,
      [
        data.company_name,
        data.company_category,
        data.role_title,
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
        data.next_action,
        data.next_action_due_date
      ]
    );

    const applicationId = created.rows[0].id;
    await processSteps.syncLegacyInterviewStep(client, applicationId, data.interview_date);
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
    return sendJson(res, 200, await readApi.getApplication(applicationId, { executor: client }));
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

  const closedStatuses = ['rejected', 'withdrawn', 'ghosted'];
  if (closedStatuses.includes(data.status) && previous.status !== data.status) {
    data.next_action = '';
    data.next_action_due_date = null;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await assertNoDuplicateApplication(client, data, id);
    await client.query(
      `
        UPDATE applications
        SET company_name = $1,
            company_category = $2,
            role_title = $3,
            job_link = $4,
            job_description = $5,
            status = $6,
            salary = $7,
            location = $8,
            recruiter = $9,
            contact_person = $10,
            applied_date = $11,
            interview_date = $12,
            notes = $13,
            next_action = $14,
            next_action_due_date = $15
        WHERE id = $16
      `,
      [
        data.company_name,
        data.company_category,
        data.role_title,
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
        data.next_action,
        data.next_action_due_date,
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
      await processSteps.syncLegacyInterviewStep(client, id, data.interview_date);
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
    return sendJson(res, 200, await readApi.getApplication(id, { executor: client }));
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
  return sendJson(res, 200, await readApi.getApplication(id));
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
  return sendJson(res, 200, await readApi.getApplication(id));
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

async function deleteNote(req, res, id) {
  const result = await pool.query('DELETE FROM application_notes WHERE id = $1 RETURNING id, application_id, body', [id]);
  if (!result.rowCount) return sendError(res, 404, 'Note not found');
  await logActivity(pool, result.rows[0].application_id, 'note_deleted', result.rows[0].body.slice(0, 120));
  sendJson(res, 200, { ok: true });
}

async function updatePreparation(req, res, applicationId) {
  const application = await ensureApplicationExists(applicationId);
  const body = await readJson(req, 96 * 1024);
  const aboutCompany = cleanString(body.about_company);
  const companyValues = cleanString(body.company_values);
  const applicationNotes = cleanString(body.application_notes);

  const result = await pool.query(
    `
      INSERT INTO application_preparation (application_id, about_company, company_values, application_notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (application_id)
      DO UPDATE SET
        about_company = EXCLUDED.about_company,
        company_values = EXCLUDED.company_values,
        application_notes = EXCLUDED.application_notes
      RETURNING application_id, about_company, company_values, application_notes, created_at, updated_at
    `,
    [applicationId, aboutCompany, companyValues, applicationNotes]
  );

  await logActivity(pool, applicationId, 'preparation_updated', `${application.company_name}: preparation workspace updated`);
  sendJson(res, 200, { preparation: result.rows[0] });
}

async function createRecruiterQuestion(req, res, applicationId) {
  const application = await ensureApplicationExists(applicationId);
  const body = await readJson(req, 32 * 1024);
  const question = cleanString(body.question);
  if (!question) return sendError(res, 400, 'Question is required');

  const sortOrderResult = await pool.query(
    'SELECT COALESCE(max(sort_order), -1) + 1 AS next_order FROM recruiter_questions WHERE application_id = $1',
    [applicationId]
  );
  const result = await pool.query(
    `
      INSERT INTO recruiter_questions (application_id, question, sort_order)
      VALUES ($1, $2, $3)
      RETURNING id, question, sort_order, created_at, updated_at
    `,
    [applicationId, question, Number(sortOrderResult.rows[0].next_order)]
  );
  await logActivity(pool, applicationId, 'recruiter_question_added', `${application.company_name}: ${question.slice(0, 120)}`);
  sendJson(res, 201, { recruiter_question: result.rows[0] });
}

async function updateRecruiterQuestion(req, res, id) {
  const existing = await pool.query('SELECT id, application_id, question, sort_order FROM recruiter_questions WHERE id = $1', [id]);
  if (!existing.rowCount) return sendError(res, 404, 'Recruiter question not found');

  const body = await readJson(req, 32 * 1024);
  const nextQuestion = body.question === undefined ? existing.rows[0].question : cleanString(body.question);
  if (!nextQuestion) return sendError(res, 400, 'Question is required');
  const nextOrder = body.sort_order === undefined ? existing.rows[0].sort_order : parseInteger(body.sort_order, 'sort_order');

  const result = await pool.query(
    `
      UPDATE recruiter_questions
      SET question = $1,
          sort_order = $2
      WHERE id = $3
      RETURNING id, application_id, question, sort_order, created_at, updated_at
    `,
    [nextQuestion, nextOrder, id]
  );
  await logActivity(pool, result.rows[0].application_id, 'recruiter_question_updated', nextQuestion.slice(0, 120));
  sendJson(res, 200, { recruiter_question: result.rows[0] });
}

async function deleteRecruiterQuestion(req, res, id) {
  const result = await pool.query('DELETE FROM recruiter_questions WHERE id = $1 RETURNING id, application_id, question', [id]);
  if (!result.rowCount) return sendError(res, 404, 'Recruiter question not found');
  await logActivity(pool, result.rows[0].application_id, 'recruiter_question_deleted', result.rows[0].question.slice(0, 120));
  sendJson(res, 200, { ok: true });
}

async function createFeedbackEntry(req, res, applicationId) {
  const application = await ensureApplicationExists(applicationId);
  const body = await readJson(req, 48 * 1024);
  const feedback = cleanString(body.body);
  if (!feedback) return sendError(res, 400, 'Feedback text is required');

  const sourceType = validateFeedbackSource(body.source_type);
  const result = await pool.query(
    `
      INSERT INTO hiring_feedback (application_id, source_type, body)
      VALUES ($1, $2, $3)
      RETURNING id, application_id, source_type, body, created_at
    `,
    [applicationId, sourceType, feedback]
  );
  await logActivity(pool, applicationId, 'feedback_added', `${application.company_name}: ${sourceType}`);
  sendJson(res, 201, { feedback_entry: result.rows[0] });
}

async function deleteFeedbackEntry(req, res, id) {
  const result = await pool.query('DELETE FROM hiring_feedback WHERE id = $1 RETURNING id, application_id, source_type', [id]);
  if (!result.rowCount) return sendError(res, 404, 'Feedback entry not found');
  await logActivity(pool, result.rows[0].application_id, 'feedback_deleted', result.rows[0].source_type);
  sendJson(res, 200, { ok: true });
}

async function createTodo(req, res, applicationId) {
  const application = await ensureApplicationExists(applicationId);
  const body = await readJson(req, 32 * 1024);
  const todoBody = cleanString(body?.body || body?.text);
  if (!todoBody) return sendError(res, 400, 'To-do text is required');

  const result = await pool.query(
    `
      INSERT INTO application_todos (application_id, body, completed, due_date)
      VALUES ($1, $2, COALESCE($3, FALSE), $4)
      RETURNING id, application_id, body, completed, to_char(due_date, 'YYYY-MM-DD') AS due_date, created_at, updated_at
    `,
    [applicationId, todoBody, parseBoolean(body.completed, 'completed'), parseDate(body.due_date, 'due_date')]
  );
  await logActivity(pool, applicationId, 'todo_added', `${application.company_name}: ${todoBody.slice(0, 120)}`);
  sendJson(res, 201, { todo: result.rows[0] });
}

async function updateTodo(req, res, id) {
  const existing = await pool.query('SELECT id, application_id, body, completed, due_date FROM application_todos WHERE id = $1', [id]);
  if (!existing.rowCount) return sendError(res, 404, 'To-do not found');

  const body = await readJson(req, 32 * 1024);
  const nextText = body.body === undefined ? existing.rows[0].body : cleanString(body.body);
  if (!nextText) return sendError(res, 400, 'To-do text is required');
  const nextCompleted = body.completed === undefined ? existing.rows[0].completed : parseBoolean(body.completed, 'completed');
  const nextDueDate = body.due_date === undefined ? existing.rows[0].due_date : parseDate(body.due_date, 'due_date');

  const result = await pool.query(
    `
      UPDATE application_todos
      SET body = $1,
          completed = $2,
          due_date = $3
      WHERE id = $4
      RETURNING id, application_id, body, completed, to_char(due_date, 'YYYY-MM-DD') AS due_date, created_at, updated_at
    `,
    [nextText, nextCompleted, nextDueDate, id]
  );
  const action = nextCompleted ? 'todo_completed' : 'todo_updated';
  await logActivity(pool, result.rows[0].application_id, action, nextText.slice(0, 120));
  sendJson(res, 200, { todo: result.rows[0] });
}

async function deleteTodo(req, res, id) {
  const result = await pool.query('DELETE FROM application_todos WHERE id = $1 RETURNING id, application_id, body', [id]);
  if (!result.rowCount) return sendError(res, 404, 'To-do not found');
  await logActivity(pool, result.rows[0].application_id, 'todo_deleted', result.rows[0].body.slice(0, 120));
  sendJson(res, 200, { ok: true });
}


async function updateCV(req, res, id) {
  const body = await readJson(req, 64 * 1024);
  const versionLabel = cleanString(body.version_label);
  
  const result = await pool.query(
    `
      UPDATE cv_versions
      SET version_label = $1
      WHERE id = $2
      RETURNING id, original_name, version_label, mime_type, file_size, is_latest, created_at
    `,
    [versionLabel, id]
  );

  if (!result.rowCount) return sendError(res, 404, 'CV not found');
  sendJson(res, 200, { cv: result.rows[0] });
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
        INSERT INTO cv_versions (file_path, original_name, mime_type, file_size, version_label, is_latest, extracted_text, file_hash, storage_kind, s3_bucket, s3_key)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, original_name, version_label, file_size, is_latest, created_at
      `,
      [
        saved.relativePath,
        saved.originalName,
        saved.mimeType,
        saved.fileSize,
        versionLabel,
        isLatest,
        extractedText,
        saved.fileHash,
        saved.storageKind,
        saved.s3Bucket,
        saved.s3Key
      ]
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
    ...securityHeaders,
    'content-type': cv.mime_type,
    'content-length': stats.size,
    'content-disposition': `attachment; filename="${cv.original_name.replace(/"/g, '')}"`
  });
  storage.open(cv.file_path).pipe(res);
}

async function viewCV(req, res, id) {
  const result = await pool.query(
    'SELECT file_path, original_name, mime_type, file_size FROM cv_versions WHERE id = $1 AND deleted_at IS NULL',
    [id]
  );
  if (!result.rowCount) return sendError(res, 404, 'CV not found');

  const cv = result.rows[0];
  const absolutePath = storage.resolveSafe(cv.file_path);
  const stats = statSync(absolutePath);
  res.writeHead(200, {
    ...securityHeaders,
    'content-type': cv.mime_type,
    'content-length': stats.size,
    'content-disposition': `inline; filename="${cv.original_name.replace(/"/g, '')}"`
  });
  storage.open(cv.file_path).pipe(res);
}

async function generateCV(req, res) {
  await runAIGeneration(req, res, {
    methodName: 'generateCV',
    type: 'tailored_cv',
    buildTitle: (input) => `Tailored CV - ${input.application?.company_name || input.cv.original_name}`
  });
}

async function generateCoverLetter(req, res) {
  await runAIGeneration(req, res, {
    methodName: 'generateCoverLetter',
    type: 'cover_letter',
    buildTitle: (input) => `Cover Letter - ${input.application?.company_name || input.cv.original_name}`
  });
}

async function scoreRoleFit(req, res) {
  await runAIGeneration(req, res, {
    methodName: 'scoreRoleFit',
    type: 'role_fit',
    buildTitle: (input) => `Role Fit - ${input.application?.company_name || input.cv.original_name}`
  });
}

async function checkATS(req, res) {
  await runAIGeneration(req, res, {
    methodName: 'checkATS',
    type: 'ats_check',
    buildTitle: (input) => `ATS Check - ${input.application?.company_name || input.cv.original_name}`
  });
}

async function generateFollowUpEmail(req, res) {
  await runAIGeneration(req, res, {
    methodName: 'generateFollowUpEmail',
    type: 'follow_up_email',
    buildTitle: (input) => `Follow-up Email - ${input.application?.company_name || input.cv.original_name}`
  });
}

async function downloadAIDocument(req, res, id) {
  const result = await pool.query('SELECT title, file_path FROM ai_documents WHERE id = $1 AND file_path IS NOT NULL AND deleted_at IS NULL', [id]);
  if (!result.rowCount) return sendError(res, 404, 'AI document not found');

  const doc = result.rows[0];
  const stats = statSync(storage.resolveSafe(doc.file_path));
  res.writeHead(200, {
    ...securityHeaders,
    'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'content-length': stats.size,
    'content-disposition': `attachment; filename="${doc.title.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80)}.docx"`
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

async function runAIGeneration(req, res, { methodName, type, buildTitle }) {
  const input = await readAIRequest(req);
  const title = buildTitle(input);

  if (input.providerRequested === 'aws') {
    const job = await queueAWSGeneration({ pool, storage, config, input, type, title });
    if (input.application?.id) {
      await pool.query(
        'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
        [input.application.id, `ai_${type}_queued`, `${title} queued for AWS generation`]
      );
    }
    return sendJson(res, 202, {
      queued: true,
      provider: 'aws',
      job
    });
  }

  const providerName = input.providerRequested === 'mock' ? 'mock' : 'gemini';
  const provider = createAIProvider(providerName);

  try {
    const output = await provider[methodName](input);
    const document = await persistAIDocument({
      ...input,
      type,
      title,
      content: output.content,
      output: {
        ...output,
        providerRequested: input.providerRequested
      }
    });
    return sendJson(res, 200, { ...output, provider_requested: input.providerRequested, document });
  } catch (error) {
    error.statusCode ||= 502;
    throw normalizeAIError(error, input.providerRequested);
  }
}

async function getAIJob(req, res, id) {
  let payload = await readApi.getAIJob(id);
  if (payload.job.provider_requested === 'aws' && payload.job.status !== 'completed' && payload.job.status !== 'failed') {
    const previousDocumentId = payload.job.document_id;
    const synced = await syncCompletedAWSJob({
      pool,
      storage,
      config,
      saveAIDocument,
      job: payload.job
    });
    if (synced.document_id && synced.document_id !== previousDocumentId && synced.application_id) {
      await pool.query(
        'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
        [synced.application_id, `ai_${synced.document_type}`, `${synced.title} via ${synced.provider_used || 'aws'}`]
      );
    }
    payload = { job: synced };
  }

  const document = payload.job.document_id ? await readApi.getAIDocument(payload.job.document_id).catch(() => null) : null;
  sendJson(res, 200, { ...payload, ...(document ? document : {}) });
}

async function deleteAIDocument(req, res, id) {
  const result = await pool.query(
    `
      UPDATE ai_documents
      SET deleted_at = COALESCE(deleted_at, now())
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, application_id, title
    `,
    [id]
  );
  if (!result.rowCount) return sendError(res, 404, 'AI document not found');
  if (result.rows[0].application_id) {
    await logActivity(pool, result.rows[0].application_id, 'ai_document_deleted', result.rows[0].title);
  }
  await audit.log(req, {
    applicationId: result.rows[0].application_id,
    targetType: 'ai_document',
    targetId: id,
    action: 'delete',
    details: `Deleted generated document ${result.rows[0].title}`
  });
  sendJson(res, 200, { ok: true });
}

async function regenerateAIDocument(req, res, id) {
  const existing = await pool.query(
    `
      SELECT id, application_id, cv_id, document_type, title
      FROM ai_documents
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    [id]
  );
  if (!existing.rowCount) return sendError(res, 404, 'AI document not found');

  const body = await readJson(req, config.maxAiBytes);
  const providerRequested = normalizeRequestedProvider(cleanString(body.provider) || config.defaultAiRequestProvider);
  const record = existing.rows[0];
  const input = await loadAIInputFromIds({
    applicationId: record.application_id,
    cvId: record.cv_id,
    providerRequested
  });
  const title = record.title || buildAIDocumentTitle(record.document_type, input);

  if (providerRequested === 'aws') {
    const job = await queueAWSGeneration({
      pool,
      storage,
      config,
      input,
      type: record.document_type,
      title
    });
    return sendJson(res, 202, { queued: true, provider: 'aws', job });
  }

  const provider = createAIProvider(providerRequested === 'mock' ? 'mock' : 'gemini');
  const methodName = documentTypeToMethod(record.document_type);
  const output = await provider[methodName](input);
  const document = await persistAIDocument({
    ...input,
    type: record.document_type,
    title,
    content: output.content,
    output: {
      ...output,
      providerRequested
    }
  });
  sendJson(res, 200, { ...output, provider_requested: providerRequested, document });
}

async function readApplicationMultipart(req) {
  const { fields, files } = await readMultipart(req, config.maxUploadBytes + 512 * 1024);
  return { fields, file: files.cv || null };
}

async function readBackupData() {
  const tableQueries = {
    applications: 'SELECT * FROM applications ORDER BY id',
    application_process_steps: 'SELECT * FROM application_process_steps ORDER BY application_id, position, id',
    cv_versions: 'SELECT * FROM cv_versions ORDER BY id',
    application_cvs: 'SELECT * FROM application_cvs ORDER BY application_id, cv_id',
    status_history: 'SELECT * FROM status_history ORDER BY id',
    application_notes: 'SELECT * FROM application_notes ORDER BY id',
    tags: 'SELECT * FROM tags ORDER BY id',
    application_tags: 'SELECT * FROM application_tags ORDER BY application_id, tag_id',
    ai_documents: 'SELECT * FROM ai_documents ORDER BY id',
    ai_generation_jobs: 'SELECT * FROM ai_generation_jobs ORDER BY id',
    activity_logs: 'SELECT * FROM activity_logs ORDER BY id',
    saved_filters: 'SELECT * FROM saved_filters ORDER BY id',
    selected_tag_reports: 'SELECT * FROM selected_tag_reports ORDER BY sort_order, tag_name',
    selected_chart_tags: 'SELECT * FROM selected_chart_tags ORDER BY sort_order, tag_name',
    audit_events: 'SELECT * FROM audit_events ORDER BY id',
    application_preparation: 'SELECT * FROM application_preparation ORDER BY application_id',
    recruiter_questions: 'SELECT * FROM recruiter_questions ORDER BY id',
    hiring_feedback: 'SELECT * FROM hiring_feedback ORDER BY id',
    application_todos: 'SELECT * FROM application_todos ORDER BY id',
    job_boards: 'SELECT * FROM job_boards ORDER BY id',
    target_companies: 'SELECT * FROM target_companies ORDER BY id',
    research_sources: 'SELECT * FROM research_sources ORDER BY id',
    job_context_snapshots: 'SELECT * FROM job_context_snapshots ORDER BY id',
    knowledge_chunks: 'SELECT * FROM knowledge_chunks ORDER BY id',
    retrieval_runs: 'SELECT * FROM retrieval_runs ORDER BY id',
    agent_runs: 'SELECT * FROM agent_runs ORDER BY id',
    agent_steps: 'SELECT * FROM agent_steps ORDER BY id',
    pending_agent_actions: 'SELECT * FROM pending_agent_actions ORDER BY id'
  };

  const entries = await Promise.all(
    Object.entries(tableQueries).map(async ([key, query]) => [key, (await pool.query(query)).rows])
  );
  return Object.fromEntries(entries);
}

async function readBackupFiles() {
  const baseDir = resolve(process.cwd(), config.uploadDir);
  const exists = await stat(baseDir).then(() => true).catch(() => false);
  if (!exists) return [];
  const paths = await listFilesRecursive(baseDir);
  return Promise.all(paths.map(async (absolutePath) => ({
    path: relative(process.cwd(), absolutePath).replace(/\\/g, '/'),
    content_base64: (await readFile(absolutePath)).toString('base64')
  })));
}

async function restoreBackupPayload(backup) {
  const shouldBackfillLegacyProcessSteps = backup.version === 1 && !Object.hasOwn(backup.data, 'application_process_steps');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE TABLE
        pending_agent_actions,
        agent_steps,
        agent_runs,
        retrieval_runs,
        knowledge_chunks,
        job_context_snapshots,
        research_sources,
        application_process_steps,
        ai_generation_jobs,
        audit_events,
        hiring_feedback,
        recruiter_questions,
        application_preparation,
        application_todos,
        application_notes,
        application_tags,
        tags,
        status_history,
        application_cvs,
        ai_documents,
        activity_logs,
        job_boards,
        target_companies,
        selected_tag_reports,
        selected_chart_tags,
        saved_filters,
        applications,
        cv_versions
      RESTART IDENTITY CASCADE
    `);

    const insertionOrder = [
      'cv_versions',
      'applications',
      'application_process_steps',
      'application_cvs',
      'status_history',
      'application_notes',
      'tags',
      'application_tags',
      'ai_documents',
      'ai_generation_jobs',
      'activity_logs',
      'saved_filters',
      'selected_tag_reports',
      'selected_chart_tags',
      'audit_events',
      'application_preparation',
      'recruiter_questions',
      'hiring_feedback',
      'application_todos',
      'job_boards',
      'target_companies',
      'research_sources',
      'job_context_snapshots',
      'knowledge_chunks',
      'retrieval_runs',
      'agent_runs',
      'agent_steps',
      'pending_agent_actions'
    ];

    for (const table of insertionOrder) {
      await insertBackupRows(client, table, backup.data[table] || []);
    }

    if (shouldBackfillLegacyProcessSteps) {
      await restoreLegacyInterviewSteps(client);
    }

    await resetBackupSequences(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  await restoreBackupFiles(backup.files || []);
}

async function insertBackupRows(client, table, rows) {
  if (!rows.length) return;
  const columns = backupRowColumns(rows);
  validateBackupTableColumns(table, rows, columns);
  const valueGroups = [];
  const values = [];

  rows.forEach((row, rowIndex) => {
    const placeholders = columns.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`);
    valueGroups.push(`(${placeholders.join(', ')})`);
    values.push(...columns.map((column) => row[column]));
  });

  await client.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${valueGroups.join(', ')}`,
    values
  );
}

function validateBackupTableColumns(table, rows, columns) {
  const allowed = backupTableColumns[table];
  if (!allowed) {
    const error = new Error(`Backup table is not supported: ${table}`);
    error.statusCode = 400;
    throw error;
  }

  for (const column of columns) {
    if (!allowed.has(column)) {
      const error = new Error(`Backup contains an unsupported column for ${table}`);
      error.statusCode = 400;
      throw error;
    }
  }

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      const error = new Error(`Backup contains an invalid row for ${table}`);
      error.statusCode = 400;
      throw error;
    }
    for (const column of Object.keys(row)) {
      if (!allowed.has(column)) {
        const error = new Error(`Backup contains an unsupported column for ${table}`);
        error.statusCode = 400;
        throw error;
      }
    }
  }
}

const backupTableColumns = {
  applications: new Set(['id', 'company_name', 'company_category', 'job_link', 'job_description', 'status', 'applied_date', 'interview_date', 'notes', 'created_at', 'updated_at', 'archived_at', 'salary', 'location', 'recruiter', 'contact_person', 'role_title', 'next_action', 'next_action_due_date']),
  application_process_steps: new Set(['id', 'application_id', 'position', 'step_group', 'step_name', 'step_state', 'event_date', 'event_time', 'response_state', 'response_detail', 'response_date', 'follow_up_due_date', 'feedback_received', 'tracking_state', 'closure_reason', 'closed_at', 'contact_name', 'notes', 'source', 'created_at', 'updated_at']),
  cv_versions: new Set(['id', 'file_path', 'original_name', 'mime_type', 'file_size', 'version_label', 'is_latest', 'created_at', 'extracted_text', 'deleted_at', 'file_hash', 'storage_kind', 's3_bucket', 's3_key']),
  application_cvs: new Set(['application_id', 'cv_id', 'linked_at']),
  status_history: new Set(['id', 'application_id', 'from_status', 'to_status', 'changed_at']),
  application_notes: new Set(['id', 'application_id', 'body', 'created_at']),
  tags: new Set(['id', 'name']),
  application_tags: new Set(['application_id', 'tag_id']),
  ai_documents: new Set(['id', 'application_id', 'cv_id', 'document_type', 'title', 'content', 'file_path', 'created_at', 'provider_name', 'model_name', 'prompt_excerpt', 'source_context', 'storage_kind', 's3_bucket', 's3_key', 'deleted_at', 'version_group_id', 'provider_requested', 'generation_status']),
  ai_generation_jobs: new Set(['id', 'application_id', 'cv_id', 'document_type', 'provider_requested', 'provider_used', 'status', 'title', 'request_manifest_path', 'request_manifest_s3_key', 'result_s3_key', 'error_message', 'retry_count', 'prompt_excerpt', 'source_context', 'document_id', 'created_at', 'started_at', 'completed_at']),
  activity_logs: new Set(['id', 'application_id', 'action', 'details', 'created_at']),
  saved_filters: new Set(['id', 'name', 'search', 'status', 'tag', 'archived', 'created_at', 'updated_at']),
  selected_tag_reports: new Set(['tag_name', 'sort_order', 'created_at']),
  selected_chart_tags: new Set(['tag_name', 'sort_order', 'created_at']),
  audit_events: new Set(['id', 'application_id', 'target_type', 'target_id', 'action', 'details', 'actor_ip', 'actor_user_agent', 'created_at']),
  application_preparation: new Set(['application_id', 'about_company', 'company_values', 'application_notes', 'created_at', 'updated_at']),
  recruiter_questions: new Set(['id', 'application_id', 'question', 'sort_order', 'created_at', 'updated_at']),
  hiring_feedback: new Set(['id', 'application_id', 'source_type', 'body', 'created_at']),
  application_todos: new Set(['id', 'application_id', 'body', 'completed', 'due_date', 'created_at', 'updated_at']),
  job_boards: new Set(['id', 'name', 'url', 'notes', 'last_checked_date', 'is_active', 'created_at', 'updated_at']),
  target_companies: new Set(['id', 'name', 'company_url', 'career_url', 'linkedin_url', 'region', 'primary_location', 'germany_offices', 'additional_offices', 'industry', 'company_type', 'description', 'work_mode', 'employee_count', 'visa_signal', 'relocation_signal', 'fit_notes', 'source', 'source_notes', 'last_checked_date', 'is_active', 'created_at', 'updated_at']),
  research_sources: new Set(['id', 'application_id', 'source_type', 'url', 'title', 'content', 'confidence', 'warnings', 'extracted_at', 'created_at']),
  job_context_snapshots: new Set(['id', 'application_id', 'research_source_id', 'company_name', 'role_title', 'job_link', 'company_url', 'recruiter', 'location', 'job_description', 'extraction_confidence', 'warnings', 'created_at']),
  knowledge_chunks: new Set(['id', 'application_id', 'source_table', 'source_id', 'chunk_type', 'title', 'content', 'token_count', 'created_at']),
  retrieval_runs: new Set(['id', 'application_id', 'workflow_type', 'query', 'matched_chunk_ids', 'result_summary', 'created_at']),
  agent_runs: new Set(['id', 'application_id', 'workflow_type', 'status', 'provider_name', 'model_name', 'input_summary', 'retrieved_context', 'output_summary', 'error_message', 'created_at', 'completed_at']),
  agent_steps: new Set(['id', 'agent_run_id', 'step_order', 'step_type', 'status', 'input_text', 'output_text', 'error_message', 'created_at']),
  pending_agent_actions: new Set(['id', 'agent_run_id', 'application_id', 'action_type', 'target_type', 'target_id', 'payload', 'status', 'decision_note', 'created_at', 'decided_at'])
};

async function resetBackupSequences(client) {
  const sequences = [
    ['applications', 'applications_id_seq'],
    ['application_process_steps', 'application_process_steps_id_seq'],
    ['cv_versions', 'cv_versions_id_seq'],
    ['status_history', 'status_history_id_seq'],
    ['application_notes', 'application_notes_id_seq'],
    ['tags', 'tags_id_seq'],
    ['ai_documents', 'ai_documents_id_seq'],
    ['ai_generation_jobs', 'ai_generation_jobs_id_seq'],
    ['activity_logs', 'activity_logs_id_seq'],
    ['saved_filters', 'saved_filters_id_seq'],
    ['audit_events', 'audit_events_id_seq'],
    ['recruiter_questions', 'recruiter_questions_id_seq'],
    ['hiring_feedback', 'hiring_feedback_id_seq'],
    ['application_todos', 'application_todos_id_seq'],
    ['job_boards', 'job_boards_id_seq'],
    ['target_companies', 'target_companies_id_seq'],
    ['research_sources', 'research_sources_id_seq'],
    ['job_context_snapshots', 'job_context_snapshots_id_seq'],
    ['knowledge_chunks', 'knowledge_chunks_id_seq'],
    ['retrieval_runs', 'retrieval_runs_id_seq'],
    ['agent_runs', 'agent_runs_id_seq'],
    ['agent_steps', 'agent_steps_id_seq'],
    ['pending_agent_actions', 'pending_agent_actions_id_seq']
  ];

  for (const [table, sequence] of sequences) {
    const result = await client.query(`SELECT COALESCE(max(id), 0)::bigint AS max_id FROM ${table}`);
    const maxId = Number(result.rows[0].max_id || 0);
    await client.query('SELECT setval($1::regclass, $2, $3)', [sequence, maxId || 1, maxId > 0]);
  }
}

function validateBackupPayload(backup) {
  if (!backup || typeof backup !== 'object') {
    const error = new Error('Backup payload is required');
    error.statusCode = 400;
    throw error;
  }
  if (![1, 2].includes(backup.version)) {
    const error = new Error('Unsupported backup version');
    error.statusCode = 400;
    throw error;
  }
  if (!backup.data || typeof backup.data !== 'object') {
    const error = new Error('Backup data is missing');
    error.statusCode = 400;
    throw error;
  }
  if (!Array.isArray(backup.files)) {
    const error = new Error('Backup files are missing');
    error.statusCode = 400;
    throw error;
  }
  validateBackupDataShape(backup);
}

function validateBackupDataShape(backup) {
  const keys = Object.keys(backup.data);
  for (const key of keys) {
    if (!backupTableColumns[key]) {
      const error = new Error(`Backup contains an unsupported table: ${key}`);
      error.statusCode = 400;
      throw error;
    }
    if (!Array.isArray(backup.data[key])) {
      const error = new Error(`Backup table must be an array: ${key}`);
      error.statusCode = 400;
      throw error;
    }
    validateBackupTableColumns(key, backup.data[key], backupRowColumns(backup.data[key]));
  }

  if (backup.version === 2) {
    const expected = Object.keys(backupTableColumns).sort();
    const actual = keys.sort();
    if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
      const error = new Error('Backup version 2 must include the full supported table set');
      error.statusCode = 400;
      throw error;
    }
  }
}

function backupRowColumns(rows) {
  return [...new Set(rows.flatMap((row) => (row && typeof row === 'object' && !Array.isArray(row)) ? Object.keys(row) : []))];
}

async function restoreLegacyInterviewSteps(client) {
  await client.query(`
    INSERT INTO application_process_steps (
      application_id,
      position,
      step_group,
      step_name,
      step_state,
      event_date,
      response_state,
      tracking_state,
      source
    )
    SELECT
      id,
      1,
      'interview',
      'Interview',
      'scheduled',
      interview_date,
      'not_applicable',
      'open',
      'legacy_interview_date'
    FROM applications
    WHERE interview_date IS NOT NULL
    ON CONFLICT (application_id, position)
    DO NOTHING
  `);
}

function remapBackupUploadPaths(backup) {
  const sourceDir = backupSourceUploadDir(backup);
  const targetDir = normalizeUploadDir(config.uploadDir);
  if (!sourceDir || sourceDir === targetDir) return;

  const remap = (value) => {
    if (typeof value !== 'string' || !value) return value;
    const normalized = value.replace(/\\/g, '/');
    if (normalized === sourceDir) return targetDir;
    if (normalized.startsWith(sourceDir + '/')) return targetDir + normalized.slice(sourceDir.length);
    return value;
  };

  for (const entry of backup.files || []) {
    if (entry && typeof entry.path === 'string') entry.path = remap(entry.path);
  }
  for (const row of backup.data.cv_versions || []) {
    if (row) row.file_path = remap(row.file_path);
  }
  for (const row of backup.data.ai_documents || []) {
    if (row) row.file_path = remap(row.file_path);
  }
  for (const row of backup.data.ai_generation_jobs || []) {
    if (row) row.request_manifest_path = remap(row.request_manifest_path);
  }
}

function backupSourceUploadDir(backup) {
  if (typeof backup.config?.upload_dir === 'string' && backup.config.upload_dir) {
    return normalizeUploadDir(backup.config.upload_dir);
  }
  for (const entry of backup.files || []) {
    const match = String(entry?.path || '').replace(/\\/g, '/').match(/^(.+?)\/(cv|ai|ai-jobs)\//);
    if (match) return match[1];
  }
  return 'uploads';
}

function normalizeUploadDir(dir) {
  return String(dir).replace(/\\/g, '/').replace(/\/+$/, '');
}

function validateBackupFilePaths(files) {
  const baseDir = resolve(process.cwd(), config.uploadDir);
  for (const entry of files) {
    if (!entry?.path || !entry?.content_base64) continue;
    const relativePath = relative(baseDir, resolve(process.cwd(), entry.path));
    if (isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith('..' + sep)) {
      const error = new Error('Backup contains an invalid file path');
      error.statusCode = 400;
      throw error;
    }
  }
}

async function restoreBackupFiles(files) {
  const baseDir = resolve(process.cwd(), config.uploadDir);
  validateBackupFilePaths(files);
  await rm(baseDir, { recursive: true, force: true });
  await mkdir(baseDir, { recursive: true });
  for (const entry of files) {
    if (!entry?.path || !entry?.content_base64) continue;
    const absolutePath = resolve(process.cwd(), entry.path);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, Buffer.from(entry.content_base64, 'base64'));
  }
}

async function listFilesRecursive(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(absolutePath));
      continue;
    }
    if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

function safeZipName(value) {
  return String(value || 'artifact')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artifact';
}

startServer();

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function startServer() {
  try {
    await applyMigrations(pool);
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Error: Port ${config.port} is already in use by another process.`);
      } else {
        console.error('Server error:', error.message);
      }
      shutdown();
    });
    server.listen(config.port, config.host, () => {
      console.log(`Job tracker running at http://localhost:${config.port} (bound to ${config.host})`);
      if (config.host !== '127.0.0.1' && config.host !== 'localhost') {
        console.warn('Warning: the app has no authentication. Binding beyond localhost exposes all data to the network.');
      }
    });
  } catch (error) {
    console.error(explainConnectionError(error).message);
    await pool.end();
    process.exit(1);
  }
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  setTimeout(() => {
    console.error('Forcefully exiting after timeout to release port.');
    process.exit(1);
  }, 1500).unref();
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception');
  console.error(explainConnectionError(error).message);
  shutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection');
  const error = reason instanceof Error ? reason : new Error(String(reason));
  console.error(explainConnectionError(error).message);
  shutdown();
});

function serveSpecialPublicFiles(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  if (url.pathname === '/robots.txt') {
    const body = [
      'User-agent: *',
      'Disallow: /',
      `Sitemap: ${originFor(url)}/sitemap.xml`
    ].join('\n');
    sendPlainText(res, 200, body, 'text/plain; charset=utf-8');
    return true;
  }

  if (url.pathname === '/sitemap.xml') {
    const origin = originFor(url);
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${origin}/</loc>
  </url>
  <url>
    <loc>${origin}/security-contact.html</loc>
  </url>
</urlset>`;
    sendPlainText(res, 200, body, 'application/xml; charset=utf-8');
    return true;
  }

  if (url.pathname === '/.well-known/security.txt') {
    const origin = originFor(url);
    const body = [
      `Contact: ${origin}/security-contact.html`,
      `Policy: ${origin}/security-contact.html`,
      'Preferred-Languages: en',
      'Expires: 2027-05-06T00:00:00.000Z'
    ].join('\n');
    sendPlainText(res, 200, body, 'text/plain; charset=utf-8');
    return true;
  }

  return false;
}

function sendPlainText(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    ...securityHeaders,
    'content-type': contentType,
    'content-length': Buffer.byteLength(body),
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'cache-control': 'no-store'
  });
  res.end(body);
}

function originFor(url) {
  return `${url.protocol}//${url.host}`;
}

function shouldServeAppShell(pathname) {
  return pathname === '/' || pathname.startsWith('/applications/');
}

async function serveAppShell(res) {
  const body = await readFile(spaIndexPath);
  res.writeHead(200, {
    ...securityHeaders,
    'content-type': 'text/html; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store'
  });
  res.end(body);
}

function respondError(req, res, statusCode, message, hint = '') {
  if ((req.headers.accept || '').includes('text/html') && !String(req.url || '').startsWith('/api/')) {
    sendHtmlError(res, statusCode, message, message, hint);
    return;
  }
  sendError(res, statusCode, message);
}

async function loadAIInputFromIds({ applicationId, cvId, providerRequested }) {
  const applicationResult = applicationId
    ? await pool.query('SELECT id, company_name, job_description FROM applications WHERE id = $1', [applicationId])
    : { rowCount: 0, rows: [] };
  const cvResult = await pool.query(
    'SELECT id, original_name, version_label, extracted_text, file_path FROM cv_versions WHERE id = $1 AND deleted_at IS NULL',
    [cvId]
  );

  if (!cvResult.rowCount) {
    const error = new Error('CV not found');
    error.statusCode = 404;
    throw error;
  }

  const application = applicationResult.rowCount ? applicationResult.rows[0] : null;
  const cv = cvResult.rows[0];
  const jobDescription = cleanString(application?.job_description);
  if (!jobDescription) {
    const error = new Error('Job description is required');
    error.statusCode = 400;
    throw error;
  }
  if (!cv.extracted_text && cv.file_path) {
    const buffer = await readFile(storage.resolveSafe(cv.file_path)).catch(() => null);
    if (buffer) {
      cv.extracted_text = await extractCVText({ filename: cv.original_name, buffer });
      await pool.query('UPDATE cv_versions SET extracted_text = $1 WHERE id = $2', [cv.extracted_text, cv.id]);
    }
  }

  return {
    application,
    cv,
    jobDescription,
    jobSignals: extractJobSignals(jobDescription),
    candidateSignals: extractCandidateSignals(cv.extracted_text || ''),
    providerRequested,
    previousDocumentId: null,
    promptExcerpt: buildPromptExcerpt(jobDescription, cv),
    sourceContext: buildSourceContext(application, cv)
  };
}

function documentTypeToMethod(type) {
  const mapping = {
    tailored_cv: 'generateCV',
    cover_letter: 'generateCoverLetter',
    role_fit: 'scoreRoleFit',
    ats_check: 'checkATS',
    follow_up_email: 'generateFollowUpEmail'
  };
  const methodName = mapping[type];
  if (!methodName) {
    const error = new Error(`Unsupported document type ${type}`);
    error.statusCode = 400;
    throw error;
  }
  return methodName;
}

function buildAIDocumentTitle(type, input) {
  const target = input.application?.company_name || input.cv.original_name;
  const mapping = {
    tailored_cv: `Tailored CV - ${target}`,
    cover_letter: `Cover Letter - ${target}`,
    role_fit: `Role Fit - ${target}`,
    ats_check: `ATS Check - ${target}`,
    follow_up_email: `Follow-up Email - ${target}`
  };
  return mapping[type] || `Generated Document - ${target}`;
}

function normalizeAIError(error, provider) {
  const wrapped = new Error(error.message || 'AI generation failed');
  wrapped.statusCode = error.statusCode || 502;
  wrapped.provider = provider;
  return wrapped;
}

function normalizeRequestedProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  if (provider === 'aws' || provider === 'mock') return provider;
  return 'gemini';
}
