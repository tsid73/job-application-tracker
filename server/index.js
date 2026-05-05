import http from 'node:http';
import { join } from 'node:path';
import { statSync } from 'node:fs';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { sendError, sendJson, readJson, readMultipart, serveStatic } from './utils/http.js';
import { cleanString, parseBoolean, parseDate, parseInteger, validateFeedbackSource, validateStatus, validateUrl } from './utils/validation.js';
import { createRequestGuard } from './utils/requestGuards.js';
import { csvEscape, parseCsv, changedApplicationFields, dateForLog } from './utils/text.js';
import { LocalFileStorage } from './storage/localFileStorage.js';
import { createAIProvider } from './services/aiProvider.js';
import { createAuditLogger } from './services/audit.js';
import { normalizeApplicationInput, resolveApplicationCV, replaceTags, logActivity, ensureUniqueCVUpload } from './services/applicationHelpers.js';
import { readAIInput, saveAIDocument } from './services/aiDocuments.js';
import { createReadApi } from './services/readApi.js';
import { createApiRouter } from './routes.js';
import { extractCVText } from './services/cvTextExtractor.js';

const publicDir = join(process.cwd(), 'public');
const storage = new LocalFileStorage();
const aiProvider = createAIProvider();
const enforceRequestGuards = createRequestGuard({ config });
const audit = createAuditLogger(pool);
const readApi = createReadApi({ pool, audit });

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

const routeApi = createApiRouter({
  health: async (req, res) => sendJson(res, 200, { ok: true }),
  getReminders: async (req, res) => sendJson(res, 200, await readApi.getReminders()),
  getNotifications: async (req, res) => sendJson(res, 200, await readApi.getNotifications()),
  getReports: async (req, res) => sendJson(res, 200, await readApi.getReports()),
  getActivity: async (req, res, url) => sendJson(res, 200, await readApi.getActivity(url)),
  getAudit: async (req, res, url) => sendJson(res, 200, await readApi.getAudit(url)),
  getSavedFilters: async (req, res) => sendJson(res, 200, await readApi.getSavedFilters()),
  getJobBoards: async (req, res) => sendJson(res, 200, await readApi.getJobBoards()),
  createSavedFilter,
  deleteSavedFilter,
  createJobBoard,
  updateJobBoard,
  deleteJobBoard,
  exportApplicationsCsv,
  importApplicationsCsv,
  getApplications: async (req, res, url) => sendJson(res, 200, await readApi.getApplications(url)),
  createApplication,
  getApplication: async (req, res, id) => sendJson(res, 200, await readApi.getApplication(id)),
  updateApplication,
  deleteApplication,
  archiveApplication,
  restoreApplication,
  createNote,
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
  deleteCV,
  downloadCV,
  generateCV,
  generateCoverLetter,
  scoreRoleFit,
  checkATS,
  generateFollowUpEmail,
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
  await logActivity(pool, null, 'job_board_added', result.rows[0].name);
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
  await logActivity(pool, null, 'job_board_updated', result.rows[0].name);
  sendJson(res, 200, { job_board: result.rows[0] });
}

async function deleteJobBoard(req, res, id) {
  const result = await pool.query('DELETE FROM job_boards WHERE id = $1 RETURNING id, name', [id]);
  if (!result.rowCount) return sendError(res, 404, 'Job board not found');
  await logActivity(pool, null, 'job_board_deleted', result.rows[0].name);
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

async function ensureApplicationExists(applicationId) {
  const result = await pool.query('SELECT id, company_name FROM applications WHERE id = $1', [applicationId]);
  if (!result.rowCount) {
    const error = new Error('Application not found');
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
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
  const todoBody = cleanString(body.body);
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
