const STEP_GROUPS = new Set(['screening', 'assessment', 'interview', 'discussion', 'other']);
const STEP_STATES = new Set(['scheduled', 'completed', 'cancelled']);
const RESPONSE_STATES = new Set(['not_applicable', 'awaiting_response', 'advanced', 'not_advanced', 'on_hold', 'no_response', 'other']);
const TRACKING_STATES = new Set(['open', 'closed']);
const CLOSURE_REASONS = new Set(['advanced', 'not_advanced', 'no_response', 'cancelled', 'withdrew', 'other']);

function liveApplicationCondition(alias = 'a') {
  return `${alias}.archived_at IS NULL AND ${alias}.status NOT IN ('rejected', 'withdrawn', 'ghosted')`;
}

function selectedStepColumns(alias = '') {
  const column = (name) => `${alias}${name}`;
  return `
    ${column('id')},
    ${column('application_id')},
    ${column('position')},
    ${column('step_group')},
    ${column('step_name')},
    ${column('step_state')},
    to_char(${column('event_date')}, 'YYYY-MM-DD') AS event_date,
    to_char(${column('event_time')}, 'HH24:MI:SS') AS event_time,
    ${column('response_state')},
    ${column('response_detail')},
    to_char(${column('response_date')}, 'YYYY-MM-DD') AS response_date,
    to_char(${column('follow_up_due_date')}, 'YYYY-MM-DD') AS follow_up_due_date,
    ${column('feedback_received')},
    ${column('tracking_state')},
    ${column('closure_reason')},
    ${column('closed_at')},
    ${column('contact_name')},
    ${column('notes')},
    ${column('source')},
    ${column('created_at')},
    ${column('updated_at')}
  `;
}

function canonicalStepCondition(alias = 'ps') {
  return `NOT (
    ${alias}.source = 'legacy_interview_date'
    AND EXISTS (
      SELECT 1
      FROM application_process_steps manual_ps
      WHERE manual_ps.application_id = ${alias}.application_id
        AND manual_ps.source = 'manual'
        AND manual_ps.event_date = ${alias}.event_date
    )
  )`;
}

export function normalizeProcessStepInput(input = {}, currentStep = null) {
  const values = { ...(currentStep || {}), ...input };
  const stepGroup = requiredValue(values.step_group, STEP_GROUPS, 'step_group');
  const stepName = requiredText(values.step_name, 'step_name');
  const stepState = requiredValue(values.step_state, STEP_STATES, 'step_state');
  const eventDate = requiredDate(values.event_date, 'event_date');
  const responseWasSupplied = input.response_state !== undefined && input.response_state !== null && input.response_state !== '';

  let responseState = optionalValue(values.response_state, RESPONSE_STATES, 'response_state');
  let trackingState = optionalValue(values.tracking_state, TRACKING_STATES, 'tracking_state') || 'open';
  let closureReason = optionalValue(values.closure_reason, CLOSURE_REASONS, 'closure_reason');
  let closedAt = optionalTimestamp(values.closed_at, 'closed_at');
  let responseDetail = optionalText(values.response_detail);
  let responseDate = optionalDate(values.response_date, 'response_date');
  let followUpDueDate = optionalDate(values.follow_up_due_date, 'follow_up_due_date');

  if (stepState === 'scheduled') {
    responseState = 'not_applicable';
    trackingState = 'open';
    closureReason = null;
    closedAt = null;
    responseDetail = null;
    responseDate = null;
    followUpDueDate = null;
  } else if (stepState === 'cancelled') {
    responseState = 'not_applicable';
    trackingState = 'closed';
    closureReason = 'cancelled';
    closedAt = closedAt || new Date().toISOString();
    responseDetail = null;
    responseDate = null;
    followUpDueDate = null;
  } else {
    if (responseState === 'not_applicable' || (!responseWasSupplied && (!currentStep || currentStep.step_state !== 'completed' || !responseState))) {
      responseState = 'awaiting_response';
    }
    if (trackingState === 'open') {
      closureReason = null;
      closedAt = null;
    } else {
      if (!closureReason) throw inputError('closure_reason is required when tracking_state is closed');
      closedAt = closedAt || new Date().toISOString();
    }
  }

  return {
    step_group: stepGroup,
    step_name: stepName,
    step_state: stepState,
    event_date: eventDate,
    event_time: optionalTime(values.event_time, 'event_time'),
    response_state: responseState,
    response_detail: responseDetail,
    response_date: responseDate,
    follow_up_due_date: followUpDueDate,
    feedback_received: optionalBoolean(values.feedback_received, 'feedback_received'),
    tracking_state: trackingState,
    closure_reason: closureReason,
    closed_at: closedAt,
    contact_name: optionalText(values.contact_name),
    notes: optionalText(values.notes)
  };
}

export function summarizeProcessInsights(rows) {
  const active = rows.filter((row) => row.step_state !== 'cancelled');
  const completed = active.filter((row) => row.step_state === 'completed');
  const screenings = completed.filter((row) => row.step_group === 'screening');
  const applications = new Map();
  for (const row of active) {
    const steps = applications.get(row.application_id) || [];
    steps.push(row);
    applications.set(row.application_id, steps);
  }

  let screeningToAssessment = 0;
  let screeningToInterview = 0;
  let directToAssessment = 0;
  let directToInterview = 0;
  let assessmentToInterview = 0;
  let interviewToOffer = 0;
  for (const steps of applications.values()) {
    const ordered = [...steps].sort((left, right) => left.position - right.position || left.id - right.id);
    if (ordered[0]?.step_group === 'assessment') directToAssessment += 1;
    if (ordered[0]?.step_group === 'interview') directToInterview += 1;
    if (hasLaterGroup(ordered, 'screening', 'assessment')) screeningToAssessment += 1;
    if (hasLaterGroup(ordered, 'screening', 'interview')) screeningToInterview += 1;
    if (hasLaterGroup(ordered, 'assessment', 'interview')) assessmentToInterview += 1;
    if (ordered.some((row) => row.step_group === 'interview') && ['offer', 'accepted'].includes(ordered[0]?.application_status)) {
      interviewToOffer += 1;
    }
  }

  const responseDays = active
    .filter((row) => row.event_date && row.response_date)
    .map((row) => daysBetween(row.event_date, row.response_date))
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);

  return {
    totals: {
      scheduled_steps: active.filter((row) => row.step_state === 'scheduled').length,
      completed_steps: completed.length,
      completed_screening_calls: screenings.length,
      screened_applications: new Set(screenings.map((row) => row.application_id)).size,
      awaiting_response_steps: active.filter((row) => row.response_state === 'awaiting_response').length,
      on_hold_steps: active.filter((row) => row.response_state === 'on_hold').length,
      no_response_closures: active.filter((row) => row.response_state === 'no_response').length,
      feedback_received: active.filter((row) => row.feedback_received === true).length,
      feedback_not_received: active.filter((row) => row.feedback_received === false).length,
      feedback_unknown: active.filter((row) => row.feedback_received === null || row.feedback_received === undefined).length
    },
    groups: Object.fromEntries([...STEP_GROUPS].map((group) => [group, summarizeGroup(active, applications, group)])),
    paths: {
      screening_to_assessment: screeningToAssessment,
      screening_to_interview: screeningToInterview,
      direct_to_assessment: directToAssessment,
      direct_to_interview: directToInterview,
      assessment_to_interview: assessmentToInterview,
      interview_to_offer: interviewToOffer
    },
    timing: { median_response_days: median(responseDays) },
    outcomes: summarizeOutcomes(applications)
  };
}

export function createProcessStepsService({ pool, audit, logActivity }) {
  async function list(applicationId, executor = pool) {
    validId(applicationId, 'application ID');
    await ensureApplication(executor, applicationId);
    const result = await executor.query(
      `SELECT ${selectedStepColumns('ps.')}
       FROM application_process_steps ps
       WHERE ps.application_id = $1
         AND ${canonicalStepCondition('ps')}
       ORDER BY ps.position ASC, ps.id ASC`,
      [applicationId]
    );
    return result.rows;
  }

  async function create(req, applicationId, input) {
    validId(applicationId, 'application ID');
    return transaction(pool, async (client) => {
      await ensureApplication(client, applicationId);
      const step = await insertStep(client, applicationId, await nextPosition(client, applicationId), normalizeProcessStepInput(input), 'manual');
      await writeActivity(logActivity, client, applicationId, 'process_step_created', step);
      return step;
    });
  }

  async function update(req, stepId, input) {
    validId(stepId, 'process step ID');
    return transaction(pool, async (client) => {
      const current = await findStep(client, stepId);
      const values = normalizeProcessStepInput(input, current);
      const result = await client.query(
        `UPDATE application_process_steps
         SET step_group = $1, step_name = $2, step_state = $3, event_date = $4, event_time = $5,
             response_state = $6, response_detail = $7, response_date = $8, follow_up_due_date = $9,
             feedback_received = $10, tracking_state = $11, closure_reason = $12, closed_at = $13,
             contact_name = $14, notes = $15, source = 'manual'
         WHERE id = $16
         RETURNING ${selectedStepColumns()}`,
        [
          values.step_group, values.step_name, values.step_state, values.event_date, values.event_time,
          values.response_state, values.response_detail, values.response_date, values.follow_up_due_date,
          values.feedback_received, values.tracking_state, values.closure_reason, values.closed_at,
          values.contact_name, values.notes, stepId
        ]
      );
      const step = result.rows[0];
      await writeActivity(logActivity, client, current.application_id, updateAction(current, step), step);
      return step;
    });
  }

  async function remove(req, stepId) {
    validId(stepId, 'process step ID');
    return transaction(pool, async (client) => {
      const step = await findStep(client, stepId);
      rejectLegacyMutation(step);
      await client.query('DELETE FROM application_process_steps WHERE id = $1', [stepId]);
      await compactPositions(client, step.application_id);
      await writeActivity(logActivity, client, step.application_id, 'process_step_deleted', step);
      if (audit?.log) {
        await audit.log(req, {
          applicationId: step.application_id,
          targetType: 'process_step',
          targetId: stepId,
          action: 'delete',
          details: `Deleted hiring process step ${step.step_name}`
        }, client);
      }
      return step;
    });
  }

  async function reorder(req, applicationId, orderedIds) {
    validId(applicationId, 'application ID');
    if (!Array.isArray(orderedIds) || !orderedIds.length) throw inputError('orderedIds must contain every process step ID');
    const ids = orderedIds.map((id) => Number(id));
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      throw inputError('orderedIds must contain unique process step IDs');
    }
    return transaction(pool, async (client) => {
      await ensureApplication(client, applicationId);
      const existing = await client.query(
        `SELECT id, source
         FROM application_process_steps ps
         WHERE ps.application_id = $1
           AND ${canonicalStepCondition('ps')}
         ORDER BY ps.position, ps.id`,
        [applicationId]
      );
      const existingIds = existing.rows.map((row) => row.id);
      if (existingIds.length !== ids.length || existingIds.some((id) => !ids.includes(id))) {
        throw inputError('orderedIds must contain every process step for this application');
      }
      if (existing.rows.some((row) => row.source === 'legacy_interview_date')) {
        throw inputError('Legacy interview-date steps cannot be reordered directly');
      }
      await moveToContiguousPositions(client, applicationId, ids);
      const reordered = await list(applicationId, client);
      await logActivity(client, applicationId, 'process_step_reordered', 'Reordered hiring process steps');
      return reordered;
    });
  }

  async function syncLegacyInterviewStep(client, applicationId, interviewDate) {
    validId(applicationId, 'application ID');
    const date = optionalDate(interviewDate, 'interview_date');
    const result = await client.query(
      `SELECT ${selectedStepColumns()} FROM application_process_steps
       WHERE application_id = $1 AND source = 'legacy_interview_date' AND step_state = 'scheduled' LIMIT 1`,
      [applicationId]
    );
    const existing = result.rows[0];
    if (!date) {
      if (existing) {
        await client.query('DELETE FROM application_process_steps WHERE id = $1', [existing.id]);
      }
      return null;
    }
    if (existing) {
      const updated = await client.query(
        `UPDATE application_process_steps SET event_date = $1 WHERE id = $2 RETURNING ${selectedStepColumns()}`,
        [date, existing.id]
      );
      return updated.rows[0];
    }
    return insertStep(client, applicationId, await nextPosition(client, applicationId), legacyStep(date), 'legacy_interview_date');
  }

  async function restoreLegacyInterviewSteps(client) {
    const applications = await client.query(
      "SELECT id, to_char(interview_date, 'YYYY-MM-DD') AS interview_date FROM applications WHERE interview_date IS NOT NULL ORDER BY id"
    );
    const steps = [];
    for (const application of applications.rows) {
      steps.push(await syncLegacyInterviewStep(client, application.id, application.interview_date));
    }
    return steps;
  }

  async function summaries(applicationIds) {
    const ids = applicationIds === undefined ? null : applicationIds;
    if (ids !== null && (!Array.isArray(ids) || ids.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) <= 0))) {
      throw inputError('applicationIds must contain positive application IDs');
    }
    const result = await pool.query(
      `SELECT a.id AS application_id,
              count(ps.id)::int AS total_steps,
              count(ps.id) FILTER (WHERE ps.step_state = 'completed')::int AS completed_steps,
              min(to_char(ps.event_date, 'YYYY-MM-DD')) FILTER (WHERE ps.step_state = 'scheduled' AND ps.tracking_state = 'open') AS next_scheduled_date,
              (
                SELECT step_name
                FROM application_process_steps next_ps
                WHERE next_ps.application_id = a.id
                  AND next_ps.step_state = 'scheduled'
                  AND next_ps.tracking_state = 'open'
                  AND ${canonicalStepCondition('next_ps')}
                ORDER BY next_ps.event_date ASC, next_ps.position ASC, next_ps.id ASC
                LIMIT 1
              ) AS next_scheduled_name,
              count(ps.id) FILTER (WHERE ps.step_state = 'completed' AND ps.tracking_state = 'open' AND ps.response_state = 'awaiting_response')::int AS awaiting_response_steps
       FROM applications a
       LEFT JOIN application_process_steps ps ON ps.application_id = a.id AND ${canonicalStepCondition('ps')}
       WHERE ($1::bigint[] IS NULL OR a.id = ANY($1::bigint[]))
       GROUP BY a.id
       ORDER BY a.id`,
      [ids]
    );
    return result.rows;
  }

  async function upcoming() {
    const result = await pool.query(
      `SELECT * FROM (
         SELECT ${selectedStepColumns('ps.')}, a.company_name, a.role_title,
                'scheduled_step' AS reminder_type, to_char(ps.event_date, 'YYYY-MM-DD') AS reminder_date
         FROM application_process_steps ps
         JOIN applications a ON a.id = ps.application_id
         WHERE ${liveApplicationCondition('a')}
           AND ps.source = 'manual'
           AND ps.step_state = 'scheduled'
           AND ps.tracking_state = 'open'
         UNION ALL
         SELECT ${selectedStepColumns('ps.')}, a.company_name, a.role_title,
                'follow_up' AS reminder_type, to_char(ps.follow_up_due_date, 'YYYY-MM-DD') AS reminder_date
         FROM application_process_steps ps
         JOIN applications a ON a.id = ps.application_id
         WHERE ${liveApplicationCondition('a')}
           AND ps.tracking_state = 'open'
           AND ps.follow_up_due_date IS NOT NULL
       ) reminders
       ORDER BY reminder_date ASC, event_time ASC NULLS LAST, id ASC`
    );
    return result.rows;
  }

  async function insights({ mode, period } = {}) {
    const days = { 30: 30, 60: 60, 90: 90 }[period];
    const conditions = [];
    if (mode !== 'all') conditions.push('a.archived_at IS NULL');
    if (days) conditions.push(`ps.event_date >= CURRENT_DATE - INTERVAL '${days} days'`);
    conditions.push(canonicalStepCondition('ps'));
    const result = await pool.query(
      `SELECT ${selectedStepColumns('ps.')},
              a.status AS application_status,
              (
                SELECT min(sh.changed_at)
                FROM status_history sh
                WHERE sh.application_id = a.id
                  AND (
                    (a.status IN ('offer', 'accepted') AND sh.to_status IN ('offer', 'accepted'))
                    OR (a.status = 'rejected' AND sh.to_status = 'rejected')
                    OR (a.status = 'withdrawn' AND sh.to_status = 'withdrawn')
                    OR (a.status = 'ghosted' AND sh.to_status = 'ghosted')
                  )
              ) AS outcome_at
       FROM application_process_steps ps
       JOIN applications a ON a.id = ps.application_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY ps.application_id, ps.position, ps.id`
    );
    return summarizeProcessInsights(result.rows);
  }

  return { list, create, update, remove, reorder, syncLegacyInterviewStep, restoreLegacyInterviewSteps, summaries, upcoming, insights };
}

async function transaction(pool, operation) {
  const client = pool.connect ? await pool.connect() : { query: pool.query.bind(pool), release() {} };
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureApplication(executor, applicationId) {
  const result = await executor.query('SELECT id FROM applications WHERE id = $1', [applicationId]);
  if (!hasRows(result)) {
    const error = new Error('Application not found');
    error.statusCode = 404;
    throw error;
  }
}

async function findStep(client, stepId) {
  const result = await client.query(`SELECT ${selectedStepColumns()} FROM application_process_steps WHERE id = $1`, [stepId]);
  if (!hasRows(result)) {
    const error = new Error('Process step not found');
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
}

async function nextPosition(client, applicationId) {
  const result = await client.query('SELECT coalesce(max(position), 0)::int + 1 AS position FROM application_process_steps WHERE application_id = $1', [applicationId]);
  return result.rows[0].position;
}

async function insertStep(client, applicationId, position, step, source) {
  const result = await client.query(
    `INSERT INTO application_process_steps (
       application_id, position, step_group, step_name, step_state, event_date, event_time,
       response_state, response_detail, response_date, follow_up_due_date, feedback_received,
       tracking_state, closure_reason, closed_at, contact_name, notes, source
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING ${selectedStepColumns()}`,
    [
      applicationId, position, step.step_group, step.step_name, step.step_state, step.event_date,
      step.event_time, step.response_state, step.response_detail, step.response_date,
      step.follow_up_due_date, step.feedback_received, step.tracking_state, step.closure_reason,
      step.closed_at, step.contact_name, step.notes, source
    ]
  );
  return result.rows[0];
}

function legacyStep(eventDate) {
  return {
    step_group: 'interview', step_name: 'Interview', step_state: 'scheduled', event_date: eventDate,
    event_time: null, response_state: 'not_applicable', response_detail: null, response_date: null,
    follow_up_due_date: null, feedback_received: null, tracking_state: 'open', closure_reason: null,
    closed_at: null, contact_name: null, notes: null
  };
}

async function compactPositions(client, applicationId) {
  const rows = await client.query('SELECT id FROM application_process_steps WHERE application_id = $1 ORDER BY position, id', [applicationId]);
  if (hasRows(rows)) await moveToContiguousPositions(client, applicationId, rows.rows.map((row) => row.id));
}

async function moveToContiguousPositions(client, applicationId, ids) {
  const offset = ids.length * 2 + 1;
  await client.query('UPDATE application_process_steps SET position = position + $1 WHERE application_id = $2', [offset, applicationId]);
  for (const [index, id] of ids.entries()) {
    await client.query('UPDATE application_process_steps SET position = $1 WHERE id = $2', [index + 1, id]);
  }
}

async function writeActivity(logActivity, client, applicationId, action, step) {
  if (logActivity) await logActivity(client, applicationId, action, `${step.step_name} (${step.step_group})`);
}

function updateAction(current, next) {
  if (current.step_state === 'scheduled' && next.step_state === 'completed') return 'process_step_completed';
  if (current.step_state !== 'cancelled' && next.step_state === 'cancelled') return 'process_step_cancelled';
  if (current.tracking_state === 'open' && next.tracking_state === 'closed') return 'process_step_closed';
  if (current.tracking_state === 'closed' && next.tracking_state === 'open') return 'process_step_reopened';
  if (current.event_date !== next.event_date || current.event_time !== next.event_time) return 'process_step_rescheduled';
  if (current.response_state !== next.response_state || current.response_date !== next.response_date) return 'process_step_response_recorded';
  return 'process_step_updated';
}

function summarizeGroup(activeRows, applications, group) {
  const rows = activeRows.filter((row) => row.step_group === group);
  const completed = rows.filter((row) => row.step_state === 'completed');
  const responded = completed.filter((row) => isEmployerResponse(row.response_state));
  const advanced = rows.filter((row) => hasProgressionEvidence(row, applications.get(row.application_id) || [])).length;
  const noResponse = completed.filter((row) => row.response_state === 'no_response').length;
  return {
    scheduled: rows.filter((row) => row.step_state === 'scheduled').length,
    completed: completed.length,
    responded: responded.length,
    advanced,
    no_response: noResponse,
    response_rate: rate(responded.length, completed.length),
    no_response_rate: rate(noResponse, completed.length),
    progression_rate: rate(advanced, completed.length)
  };
}

function isEmployerResponse(responseState) {
  return ['advanced', 'not_advanced', 'on_hold', 'other'].includes(responseState);
}

function hasProgressionEvidence(row, applicationRows) {
  return row.response_state === 'advanced'
    || applicationRows.some((later) => later.position > row.position && later.step_state !== 'cancelled');
}

function summarizeOutcomes(applications) {
  const outcomes = {
    offer: [],
    rejected: [],
    withdrawn: [],
    ghosted: [],
    user_closed: []
  };
  for (const rows of applications.values()) {
    const status = rows[0]?.application_status;
    const outcomeAt = rows[0]?.outcome_at;
    const completedSteps = rows.filter((row) => row.step_state === 'completed' && occurredByOutcome(row, outcomeAt)).length;
    if (status === 'offer' || status === 'accepted') outcomes.offer.push(completedSteps);
    if (status === 'rejected') outcomes.rejected.push(completedSteps);
    if (status === 'withdrawn') outcomes.withdrawn.push(completedSteps);
    if (status === 'ghosted') outcomes.ghosted.push(completedSteps);
    if (rows.some((row) => row.tracking_state === 'closed')) outcomes.user_closed.push(completedSteps);
  }
  return Object.fromEntries(Object.entries(outcomes).map(([name, completedSteps]) => [name, {
    applications: completedSteps.length,
    average_completed_steps: rate(completedSteps.reduce((total, value) => total + value, 0), completedSteps.length)
  }]));
}

function occurredByOutcome(row, outcomeAt) {
  if (!outcomeAt) return true;
  const outcomeDate = new Date(outcomeAt).toISOString().slice(0, 10);
  return String(row.event_date).slice(0, 10) <= outcomeDate;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function hasLaterGroup(rows, fromGroup, toGroup) {
  return rows.some((row) => row.step_group === fromGroup && rows.some((later) => later.position > row.position && later.step_group === toGroup));
}

function median(values) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function daysBetween(start, end) {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
}

function requiredValue(value, allowed, field) {
  const normalized = optionalText(value);
  if (!normalized || !allowed.has(normalized)) throw inputError(`Invalid ${field}`);
  return normalized;
}

function optionalValue(value, allowed, field) {
  if (value === undefined || value === null || value === '') return null;
  return requiredValue(value, allowed, field);
}

function requiredText(value, field) {
  const normalized = optionalText(value);
  if (!normalized) throw inputError(`${field} is required`);
  return normalized;
}

function optionalText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function requiredDate(value, field) {
  const normalized = optionalDate(value, field);
  if (!normalized) throw inputError(`${field} is required`);
  return normalized;
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw inputError(`Invalid ${field}`);
  const date = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== normalized) throw inputError(`Invalid ${field}`);
  return normalized;
}

function optionalTime(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(normalized)) throw inputError(`Invalid ${field}`);
  return normalized.length === 5 ? `${normalized}:00` : normalized;
}

function optionalTimestamp(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw inputError(`Invalid ${field}`);
  return date.toISOString();
}

function optionalBoolean(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw inputError(`Invalid ${field}`);
}

function validId(value, field) {
  if (!Number.isSafeInteger(Number(value)) || Number(value) <= 0) throw inputError(`Invalid ${field}`);
}

function rejectLegacyMutation(step) {
  if (step.source === 'legacy_interview_date') {
    throw inputError('Legacy interview-date steps can only be changed through application interview_date');
  }
}

function hasRows(result) {
  return result.rows?.length > 0;
}

function inputError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
