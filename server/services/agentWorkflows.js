import { cleanString, parseInteger, validateUrl } from '../utils/validation.js';
import { truncateText } from '../utils/text.js';

const sourceTypes = new Set(['job_posting', 'company_page', 'recruiter', 'manual_note', 'generated']);
const workflowTypes = new Set(['job_description_analysis', 'fit_evaluation', 'draft_generation', 'company_research']);
const actionTypes = new Set(['update_preparation', 'create_note', 'create_todo']);

export function createAgentWorkflowService({ pool }) {
  return {
    async createResearchSource(applicationId, body) {
      const application = await readApplication(pool, applicationId);
      const sourceType = normalizeSourceType(body.source_type);
      const content = cleanString(body.content);
      if (!content) {
        const error = new Error('Research source content is required');
        error.statusCode = 400;
        throw error;
      }

      const confidence = normalizeConfidence(body.confidence);
      const result = await pool.query(
        `
          INSERT INTO research_sources (
            application_id,
            source_type,
            url,
            title,
            content,
            confidence,
            warnings
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `,
        [
          application.id,
          sourceType,
          validateOptionalUrl(body.url),
          cleanString(body.title),
          content,
          confidence,
          cleanString(body.warnings)
        ]
      );

      const source = result.rows[0];
      await pool.query(
        `
          INSERT INTO job_context_snapshots (
            application_id,
            research_source_id,
            company_name,
            role_title,
            job_link,
            company_url,
            recruiter,
            location,
            job_description,
            extraction_confidence,
            warnings
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          application.id,
          source.id,
          cleanString(body.company_name) || application.company_name,
          cleanString(body.role_title) || application.role_title,
          validateOptionalUrl(body.job_link) || application.job_link,
          validateOptionalUrl(body.company_url) || (sourceType === 'company_page' ? source.url : ''),
          cleanString(body.recruiter) || application.recruiter,
          cleanString(body.location) || application.location,
          sourceType === 'job_posting' ? content : application.job_description,
          confidence,
          cleanString(body.warnings)
        ]
      );

      const chunks = await replaceChunks({
        pool,
        applicationId: application.id,
        sourceTable: 'research_sources',
        sourceId: source.id,
        chunkType: sourceType,
        title: source.title || formatAction(sourceType),
        content
      });

      return { research_source: source, knowledge_chunks: chunks };
    },

    async runAgent(applicationId, body) {
      const application = await readApplication(pool, applicationId);
      const workflowType = normalizeWorkflowType(body.workflow_type);
      const query = cleanString(body.query) || defaultQuery(application, workflowType);
      const providerName = normalizeLocalProvider(body.provider);
      const modelName = providerName === 'mock-local' ? 'deterministic-local-workflow' : 'gemini-compatible-local-contract';

      const runResult = await pool.query(
        `
          INSERT INTO agent_runs (
            application_id,
            workflow_type,
            status,
            provider_name,
            model_name,
            input_summary
          )
          VALUES ($1, $2, 'running', $3, $4, $5)
          RETURNING *
        `,
        [
          application.id,
          workflowType,
          providerName,
          modelName,
          truncateText(query, 500)
        ]
      );
      const agentRun = runResult.rows[0];

      try {
        await seedApplicationChunks(pool, application);
        await insertAgentStep(pool, agentRun.id, 0, 'collect_context', `application_id=${application.id}`, 'Application, CV, notes, and saved research context collected.');
        const retrieval = await retrieveContext(pool, application.id, workflowType, query);
        await insertAgentStep(pool, agentRun.id, 1, 'retrieve_context', query, retrieval.result_summary || 'No local context matched.');

        const proposal = buildLocalProposal(application, retrieval);
        const actions = await createPendingActions(pool, agentRun.id, application.id, proposal.actions);
        await insertAgentStep(pool, agentRun.id, 2, 'propose_actions', proposal.outputSummary, `${actions.length} approval-gated actions proposed.`);

        const completed = await pool.query(
          `
            UPDATE agent_runs
            SET status = 'completed',
                retrieved_context = $2,
                output_summary = $3,
                completed_at = now()
            WHERE id = $1
            RETURNING *
          `,
          [agentRun.id, retrieval.result_summary, proposal.outputSummary]
        );

        await pool.query(
          'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
          [application.id, 'agent_run_completed', `${formatAction(workflowType)} proposed ${actions.length} local actions`]
        );

        return {
          agent_run: completed.rows[0],
          retrieval_run: retrieval.retrieval_run,
          pending_actions: actions
        };
      } catch (error) {
        const failed = await pool.query(
          `
            UPDATE agent_runs
            SET status = 'failed',
                error_message = $2,
                completed_at = now()
            WHERE id = $1
            RETURNING *
          `,
          [agentRun.id, error.message]
        );
        return { agent_run: failed.rows[0], retrieval_run: null, pending_actions: [] };
      }
    },

    async approveAction(id, auditContext = {}) {
      return decideAction({ pool, id, decision: 'approve', auditContext });
    },

    async rejectAction(id, body, auditContext = {}) {
      return decideAction({
        pool,
        id,
        decision: 'reject',
        decisionNote: cleanString(body.decision_note),
        auditContext
      });
    }
  };
}

async function readApplication(pool, applicationId) {
  const id = Number(applicationId);
  if (!Number.isInteger(id)) {
    const error = new Error('Application id is required');
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      SELECT id, company_name, role_title, job_link, job_description, location, recruiter, notes, next_action, next_action_due_date
      FROM applications
      WHERE id = $1
    `,
    [id]
  );
  if (!result.rowCount) {
    const error = new Error('Application not found');
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
}

function normalizeSourceType(value) {
  const sourceType = cleanString(value) || 'manual_note';
  if (sourceTypes.has(sourceType)) return sourceType;
  const error = new Error('Unsupported research source type');
  error.statusCode = 400;
  throw error;
}

function normalizeWorkflowType(value) {
  const workflowType = cleanString(value) || 'company_research';
  if (workflowTypes.has(workflowType)) return workflowType;
  const error = new Error('Unsupported agent workflow type');
  error.statusCode = 400;
  throw error;
}

function normalizeLocalProvider(value) {
  const provider = (cleanString(value) || '').toLowerCase();
  return provider === 'gemini' ? 'gemini-local-context' : 'mock-local';
}

function normalizeConfidence(value) {
  const parsed = parseInteger(value, 'confidence');
  if (!Number.isInteger(parsed)) return 70;
  return Math.max(0, Math.min(100, parsed));
}

function validateOptionalUrl(value) {
  const url = cleanString(value);
  return url ? validateUrl(url) : '';
}

async function seedApplicationChunks(pool, application) {
  if (application.job_description) {
    await replaceChunks({
      pool,
      applicationId: application.id,
      sourceTable: 'applications',
      sourceId: application.id,
      chunkType: 'job_description',
      title: `${application.company_name} job description`,
      content: application.job_description
    });
  }

  if (application.notes) {
    await replaceChunks({
      pool,
      applicationId: application.id,
      sourceTable: 'applications',
      sourceId: application.id,
      chunkType: 'application_notes',
      title: `${application.company_name} notes`,
      content: application.notes
    });
  }

  const preparation = await pool.query(
    `
      SELECT about_company, company_values, application_notes
      FROM application_preparation
      WHERE application_id = $1
    `,
    [application.id]
  );
  if (preparation.rowCount) {
    const row = preparation.rows[0];
    const content = [row.about_company, row.company_values, row.application_notes].filter(Boolean).join('\n\n');
    if (content) {
      await replaceChunks({
        pool,
        applicationId: application.id,
        sourceTable: 'application_preparation',
        sourceId: application.id,
        chunkType: 'preparation',
        title: `${application.company_name} preparation`,
        content
      });
    }
  }

  const cvs = await pool.query(
    `
      SELECT c.id, c.original_name, c.extracted_text
      FROM application_cvs ac
      JOIN cv_versions c ON c.id = ac.cv_id
      WHERE ac.application_id = $1
        AND c.deleted_at IS NULL
        AND c.extracted_text IS NOT NULL
      ORDER BY ac.linked_at DESC
      LIMIT 2
    `,
    [application.id]
  );
  for (const cv of cvs.rows) {
    await replaceChunks({
      pool,
      applicationId: application.id,
      sourceTable: 'cv_versions',
      sourceId: cv.id,
      chunkType: 'cv',
      title: cv.original_name,
      content: cv.extracted_text
    });
  }
}

async function replaceChunks({ pool, applicationId, sourceTable, sourceId, chunkType, title, content }) {
  await pool.query(
    `
      DELETE FROM knowledge_chunks
      WHERE application_id = $1
        AND source_table = $2
        AND source_id = $3
    `,
    [applicationId, sourceTable, sourceId]
  );

  const chunks = chunkText(content).map((chunk, index) => ({
    title: index === 0 ? title : `${title} ${index + 1}`,
    content: chunk,
    token_count: countTokens(chunk)
  }));
  if (!chunks.length) return [];

  const rows = [];
  for (const chunk of chunks) {
    const result = await pool.query(
      `
        INSERT INTO knowledge_chunks (
          application_id,
          source_table,
          source_id,
          chunk_type,
          title,
          content,
          token_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [applicationId, sourceTable, sourceId, chunkType, chunk.title, chunk.content, chunk.token_count]
    );
    rows.push(result.rows[0]);
  }
  return rows;
}

function chunkText(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const size = 900;
  const chunks = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size).trim());
  }
  return chunks.filter(Boolean);
}

function countTokens(value) {
  return String(value || '').split(/\s+/).filter(Boolean).length;
}

async function retrieveContext(pool, applicationId, workflowType, query) {
  const chunks = await pool.query(
    `
      SELECT id, chunk_type, title, content
      FROM knowledge_chunks
      WHERE application_id = $1
      ORDER BY created_at DESC, id DESC
    `,
    [applicationId]
  );
  const queryTerms = extractTerms(query);
  const scored = chunks.rows
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, queryTerms)
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score || right.id - left.id)
    .slice(0, 6);

  const matches = scored.length ? scored : chunks.rows.slice(0, 3);
  const matchedChunkIds = matches.map((chunk) => Number(chunk.id));
  const resultSummary = matches.map((chunk) => `${chunk.title || chunk.chunk_type}: ${truncateText(chunk.content, 220)}`).join('\n');
  const result = await pool.query(
    `
      INSERT INTO retrieval_runs (
        application_id,
        workflow_type,
        query,
        matched_chunk_ids,
        result_summary
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [applicationId, workflowType, query, JSON.stringify(matchedChunkIds), resultSummary]
  );

  return {
    retrieval_run: {
      ...result.rows[0],
      matched_chunk_ids: matchedChunkIds
    },
    matches,
    result_summary: resultSummary
  };
}

function extractTerms(value) {
  const stop = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'role', 'job', 'work', 'local']);
  return new Set(
    String(value || '')
      .toLowerCase()
      .match(/[a-z0-9.+#/-]{3,}/g)
      ?.filter((term) => !stop.has(term)) || []
  );
}

function scoreChunk(chunk, queryTerms) {
  const text = `${chunk.title || ''} ${chunk.content || ''}`.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (text.includes(term)) score += 1;
  }
  return score;
}

function defaultQuery(application, workflowType) {
  return [
    workflowType,
    application.company_name,
    application.role_title,
    application.location,
    application.job_description
  ].filter(Boolean).join(' ');
}

function buildLocalProposal(application, retrieval) {
  const firstMatch = retrieval.matches[0];
  const contextLine = firstMatch ? truncateText(firstMatch.content, 360) : 'No retrieved context is available yet.';
  const aboutCompany = `${application.company_name}: ${contextLine}`;
  const applicationNotes = `Retrieved context from ${retrieval.matches.length} local chunk(s). Review source evidence before using this in application material.`;
  const outputSummary = [
    `Local agent reviewed ${retrieval.matches.length} retrieved context chunk(s) for ${application.company_name}.`,
    'It proposed preparation notes, a review note, and one follow-up task. No application data was changed.'
  ].join(' ');

  return {
    outputSummary,
    actions: [
      {
        action_type: 'update_preparation',
        target_type: 'application_preparation',
        payload: {
          about_company: aboutCompany,
          company_values: 'Local research did not verify company values. Keep this blank until a source supports it.',
          application_notes: applicationNotes
        }
      },
      {
        action_type: 'create_note',
        target_type: 'application_notes',
        payload: {
          body: `Agent research proposal for ${application.company_name}: ${applicationNotes}`
        }
      },
      {
        action_type: 'create_todo',
        target_type: 'application_todos',
        payload: {
          body: `Review retrieved research for ${application.company_name} before drafting or applying.`,
          due_date: null
        }
      }
    ]
  };
}

async function createPendingActions(pool, agentRunId, applicationId, actions) {
  const rows = [];
  for (const action of actions) {
    if (!actionTypes.has(action.action_type)) continue;
    const result = await pool.query(
      `
        INSERT INTO pending_agent_actions (
          agent_run_id,
          application_id,
          action_type,
          target_type,
          payload
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [agentRunId, applicationId, action.action_type, action.target_type, JSON.stringify(action.payload)]
    );
    rows.push(decodePendingAction(result.rows[0]));
  }
  return rows;
}

async function insertAgentStep(pool, agentRunId, stepOrder, stepType, input, output) {
  await pool.query(
    `
      INSERT INTO agent_steps (
        agent_run_id,
        step_order,
        step_type,
        status,
        input_text,
        output_text
      )
      VALUES ($1, $2, $3, 'completed', $4, $5)
    `,
    [agentRunId, stepOrder, stepType, truncateText(input, 1000), truncateText(output, 1000)]
  );
}

async function decideAction({ pool, id, decision, decisionNote = '', auditContext = {} }) {
  const actionId = Number(id);
  if (!Number.isInteger(actionId)) {
    const error = new Error('Pending action id is required');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `
        SELECT *
        FROM pending_agent_actions
        WHERE id = $1
        FOR UPDATE
      `,
      [actionId]
    );
    if (!existing.rowCount) {
      const error = new Error('Pending agent action not found');
      error.statusCode = 404;
      throw error;
    }

    const action = decodePendingAction(existing.rows[0]);
    if (action.status !== 'proposed') {
      const error = new Error('Pending agent action is already decided');
      error.statusCode = 409;
      throw error;
    }

    if (decision === 'reject') {
      const rejected = await client.query(
        `
          UPDATE pending_agent_actions
          SET status = 'rejected',
              decision_note = $2,
              decided_at = now()
          WHERE id = $1
          RETURNING *
        `,
        [action.id, decisionNote]
      );
      await logAgentDecision(client, rejected.rows[0], 'reject', auditContext);
      await client.query('COMMIT');
      return { pending_action: decodePendingAction(rejected.rows[0]) };
    }

    await applyAction(client, action);
    const applied = await client.query(
      `
        UPDATE pending_agent_actions
        SET status = 'applied',
            decision_note = $2,
            decided_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [action.id, decisionNote]
    );
    await logAgentDecision(client, applied.rows[0], 'approve', auditContext);
    await client.query('COMMIT');
    return { pending_action: decodePendingAction(applied.rows[0]) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function applyAction(client, action) {
  if (action.action_type === 'update_preparation') {
    await client.query(
      `
        INSERT INTO application_preparation (
          application_id,
          about_company,
          company_values,
          application_notes
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (application_id)
        DO UPDATE SET
          about_company = EXCLUDED.about_company,
          company_values = EXCLUDED.company_values,
          application_notes = EXCLUDED.application_notes
      `,
      [
        action.application_id,
        cleanString(action.payload.about_company),
        cleanString(action.payload.company_values),
        cleanString(action.payload.application_notes)
      ]
    );
    await client.query(
      'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
      [action.application_id, 'agent_action_applied', 'Applied agent preparation update']
    );
    return;
  }

  if (action.action_type === 'create_note') {
    const body = cleanString(action.payload.body);
    if (!body) throw invalidPayload('Agent note body is required');
    await client.query(
      'INSERT INTO application_notes (application_id, body) VALUES ($1, $2)',
      [action.application_id, body]
    );
    await client.query(
      'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
      [action.application_id, 'agent_action_applied', 'Applied agent note proposal']
    );
    return;
  }

  if (action.action_type === 'create_todo') {
    const body = cleanString(action.payload.body);
    if (!body) throw invalidPayload('Agent todo body is required');
    await client.query(
      'INSERT INTO application_todos (application_id, body, completed, due_date) VALUES ($1, $2, FALSE, $3)',
      [action.application_id, body, cleanString(action.payload.due_date) || null]
    );
    await client.query(
      'INSERT INTO activity_logs (application_id, action, details) VALUES ($1, $2, $3)',
      [action.application_id, 'agent_action_applied', 'Applied agent todo proposal']
    );
    return;
  }

  throw invalidPayload('Unsupported pending action type');
}

function invalidPayload(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function logAgentDecision(client, row, action, auditContext) {
  await client.query(
    `
      INSERT INTO audit_events (
        application_id,
        target_type,
        target_id,
        action,
        details,
        actor_ip,
        actor_user_agent
      )
      VALUES ($1, 'pending_agent_action', $2, $3, $4, $5, $6)
    `,
    [
      row.application_id,
      String(row.id),
      `agent_action_${action}`,
      `${formatAction(row.action_type)} ${action}`,
      auditContext.actorIp || null,
      auditContext.actorUserAgent || null
    ]
  );
}

export function decodePendingAction(row) {
  if (!row) return row;
  return {
    ...row,
    payload: parseJson(row.payload)
  };
}

export function decodeRetrievalRun(row) {
  if (!row) return row;
  return {
    ...row,
    matched_chunk_ids: parseJson(row.matched_chunk_ids)
  };
}

function parseJson(value) {
  if (!value) return Array.isArray(value) ? value : {};
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function formatAction(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
