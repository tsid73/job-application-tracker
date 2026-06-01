import { cleanString, validateStatus } from '../utils/validation.js';

const meaningfulActivityActions = [
  'created',
  'archived',
  'restored',
  'status_changed',
  'interview_date_changed',
  'note_added',
  'preparation_updated',
  'recruiter_question_added',
  'feedback_added',
  'todo_added',
  'todo_completed',
  'ai_document_deleted'
];

const meaningfulAiActivityPattern = '^ai_(?!.*_queued$).+';

export function createReadApi({ pool, audit }) {
  return {
    async getReminders() {
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
      return { reminders: result.rows };
    },

    async getNotifications() {
      const [upcomingInterviews, followUps, upcomingTodos, nextActions] = await Promise.all([
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
        ),
        pool.query(
          `
            SELECT
              a.id,
              a.company_name,
              a.status,
              to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
              t.due_date - CURRENT_DATE AS days_remaining,
              'todo' AS type,
              'Preparation task due soon' AS message
            FROM application_todos t
            JOIN applications a ON a.id = t.application_id
            WHERE a.archived_at IS NULL
              AND t.completed = FALSE
              AND t.due_date IS NOT NULL
              AND t.due_date <= CURRENT_DATE + INTERVAL '3 days'
            ORDER BY t.due_date ASC, t.id ASC
            LIMIT 6
          `
        ),
        pool.query(
          `
            SELECT
              id,
              company_name,
              status,
              to_char(next_action_due_date, 'YYYY-MM-DD') AS due_date,
              next_action_due_date - CURRENT_DATE AS days_remaining,
              'next_action' AS type,
              COALESCE(next_action, 'Next action due') AS message
            FROM applications
            WHERE archived_at IS NULL
              AND next_action_due_date IS NOT NULL
              AND next_action_due_date <= CURRENT_DATE + INTERVAL '7 days'
            ORDER BY next_action_due_date ASC, id ASC
            LIMIT 6
          `
        )
      ]);

      return {
        notifications: [...upcomingInterviews.rows, ...nextActions.rows, ...followUps.rows, ...upcomingTodos.rows]
          .sort((left, right) => String(left.due_date || '').localeCompare(String(right.due_date || '')))
          .slice(0, 8)
      };
    },

    async getReports() {
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

      return {
        status_counts: statusCounts.rows,
        monthly_counts: monthlyCounts.rows,
        lifecycle_counts: lifecycleCounts.rows[0],
        upcoming_interviews: upcoming.rows
      };
    },

    async getActivity(url) {
      const applicationIdParam = url.searchParams.get('application_id');
      const applicationId = Number(applicationIdParam);
      const search = cleanString(url.searchParams.get('search')) || '';
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
      const limit = Math.min(50, Math.max(5, Number(url.searchParams.get('limit')) || 12));
      const offset = (page - 1) * limit;
      const params = [];
      const conditions = [
        'al.application_id IS NOT NULL',
        `al.action NOT LIKE 'job_board_%'`,
        `(al.action = ANY($1::text[]) OR al.action ~ $2)`
      ];
      params.push(meaningfulActivityActions, meaningfulAiActivityPattern);

      if (applicationIdParam && Number.isInteger(applicationId)) {
        params.push(applicationId);
        conditions.push(`al.application_id = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(al.action ILIKE $${params.length} OR al.details ILIKE $${params.length} OR a.company_name ILIKE $${params.length})`);
      }

      const where = `WHERE ${conditions.join(' AND ')}`;
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

      return {
        activity: result.rows.map(({ total, ...row }) => row),
        page,
        limit,
        total: result.rows[0]?.total || 0
      };
    },

    async getAudit(url) {
      const applicationId = Number(url.searchParams.get('application_id'));
      const limit = Math.min(100, Math.max(5, Number(url.searchParams.get('limit')) || 25));
      const events = await audit.list({
        applicationId: Number.isInteger(applicationId) ? applicationId : null,
        limit
      });
      return { audit: events };
    },

    async getSavedFilters() {
      const result = await pool.query(
        `
          SELECT id, name, search, status, tag, archived, created_at, updated_at
          FROM saved_filters
          ORDER BY lower(name) ASC, id ASC
        `
      );
      return { filters: result.rows };
    },

    async getJobBoards() {
      const result = await pool.query(
        `
          SELECT
            id,
            name,
            url,
            notes,
            to_char(last_checked_date, 'YYYY-MM-DD') AS last_checked_date,
            is_active,
            created_at,
            updated_at
          FROM job_boards
          ORDER BY is_active DESC, lower(name) ASC, id ASC
        `
      );
      return { job_boards: result.rows };
    },

    async getTargetCompanies() {
      const result = await pool.query(
        `
          SELECT
            id,
            name,
            company_url,
            career_url,
            linkedin_url,
            region,
            primary_location,
            germany_offices,
            additional_offices,
            industry,
            company_type,
            description,
            work_mode,
            employee_count,
            visa_signal,
            relocation_signal,
            fit_notes,
            source,
            source_notes,
            to_char(last_checked_date, 'YYYY-MM-DD') AS last_checked_date,
            is_active,
            created_at,
            updated_at
          FROM target_companies
          ORDER BY is_active DESC, lower(region) ASC, lower(name) ASC, id ASC
        `
      );
      return { target_companies: result.rows };
    },

    async getApplications(url) {
      const search = cleanString(url.searchParams.get('search')) || '';
      const status = cleanString(url.searchParams.get('status')) || '';
      const tag = cleanString(url.searchParams.get('tag')) || '';
      const archived = cleanString(url.searchParams.get('archived')) || 'false';
      if (status) validateStatus(status);
      if (!['false', 'true', 'all'].includes(archived)) {
        const error = new Error('archived must be false, true, or all');
        error.statusCode = 400;
        throw error;
      }

      const result = await pool.query(
        `
          SELECT
            a.id,
            a.company_name,
            a.role_title,
            a.status,
            a.salary,
            a.location,
            a.recruiter,
            a.contact_person,
            a.notes,
            to_char(a.applied_date, 'YYYY-MM-DD') AS applied_date,
            to_char(a.interview_date, 'YYYY-MM-DD') AS interview_date,
            a.next_action,
            to_char(a.next_action_due_date, 'YYYY-MM-DD') AS next_action_due_date,
            to_char(a.updated_at, 'YYYY-MM-DD') AS last_touched_date,
            CURRENT_DATE - a.updated_at::date AS days_since_touched,
            a.archived_at,
            CASE WHEN a.interview_date IS NULL THEN NULL ELSE a.interview_date - CURRENT_DATE END AS days_remaining,
            COALESCE(array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags,
            c.original_name AS cv_name
          FROM applications a
          LEFT JOIN application_tags at ON at.application_id = a.id
          LEFT JOIN tags t ON t.id = at.tag_id
          LEFT JOIN application_cvs ac ON ac.application_id = a.id
          LEFT JOIN cv_versions c ON c.id = ac.cv_id
          WHERE ($1 = '' OR a.company_name ILIKE '%' || $1 || '%' OR a.role_title ILIKE '%' || $1 || '%')
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

      return { applications: result.rows };
    },

    async getApplication(id, options = {}) {
      const executor = options.executor || pool;
      const application = await executor.query(
        `
          SELECT
            id,
            company_name,
            role_title,
            job_link,
            job_description,
            status,
            salary,
            location,
            recruiter,
            contact_person,
            to_char(applied_date, 'YYYY-MM-DD') AS applied_date,
            to_char(interview_date, 'YYYY-MM-DD') AS interview_date,
            next_action,
            to_char(next_action_due_date, 'YYYY-MM-DD') AS next_action_due_date,
            notes,
            archived_at,
            created_at,
            updated_at
          FROM applications
          WHERE id = $1
        `,
        [id]
      );

      if (!application.rowCount) {
        const error = new Error('Application not found');
        error.statusCode = 404;
        throw error;
      }

      const [cvs, history, notes, tags, activity, aiDocuments, aiJobs, auditEventsResult, preparation, recruiterQuestions, feedbackEntries, todos] = await Promise.all([
        executor.query(
          `
            SELECT
              c.id,
              c.original_name,
              c.version_label,
              c.file_size,
              c.created_at,
              ac.linked_at,
              length(c.extracted_text) AS extracted_text_length,
              c.storage_kind,
              c.s3_bucket,
              c.s3_key
            FROM application_cvs ac
            JOIN cv_versions c ON c.id = ac.cv_id
            WHERE ac.application_id = $1
            ORDER BY ac.linked_at DESC
          `,
          [id]
        ),
        executor.query(
          `
            SELECT id, from_status, to_status, changed_at
            FROM status_history
            WHERE application_id = $1
            ORDER BY changed_at DESC
          `,
          [id]
        ),
        executor.query(
          `
            SELECT id, body, created_at
            FROM application_notes
            WHERE application_id = $1
            ORDER BY created_at DESC
          `,
          [id]
        ),
        executor.query(
          `
            SELECT t.name
            FROM application_tags at
            JOIN tags t ON t.id = at.tag_id
            WHERE at.application_id = $1
            ORDER BY t.name
          `,
          [id]
        ),
        executor.query(
          `
            SELECT id, action, details, created_at
            FROM activity_logs
            WHERE application_id = $1
              AND (action = ANY($2::text[]) OR action ~ $3)
            ORDER BY created_at DESC
          `,
          [id, meaningfulActivityActions, meaningfulAiActivityPattern]
        ),
        executor.query(
          `
            SELECT
              id,
              document_type,
              title,
              content,
              created_at,
              file_path IS NOT NULL AS has_file,
              provider_name,
              provider_requested,
              model_name,
              prompt_excerpt,
              source_context,
              generation_status,
              version_group_id,
              storage_kind,
              s3_bucket,
              s3_key
            FROM ai_documents
            WHERE application_id = $1
              AND deleted_at IS NULL
            ORDER BY created_at DESC
          `,
          [id]
        ),
        executor.query(
          `
            SELECT
              id,
              document_type,
              provider_requested,
              provider_used,
              status,
              title,
              error_message,
              retry_count,
              document_id,
              created_at,
              completed_at
            FROM ai_generation_jobs
            WHERE application_id = $1
            ORDER BY created_at DESC
          `,
          [id]
        ),
        executor.query(
          `
            SELECT id, application_id, target_type, target_id, action, details, actor_ip, actor_user_agent, created_at
            FROM audit_events
            WHERE application_id = $1
            ORDER BY created_at DESC
            LIMIT 20
          `,
          [id]
        ),
        executor.query(
          `
            SELECT
              application_id,
              about_company,
              company_values,
              application_notes,
              created_at,
              updated_at
            FROM application_preparation
            WHERE application_id = $1
          `,
          [id]
        ),
        executor.query(
          `
            SELECT id, question, sort_order, created_at, updated_at
            FROM recruiter_questions
            WHERE application_id = $1
            ORDER BY sort_order ASC, id ASC
          `,
          [id]
        ),
        executor.query(
          `
            SELECT id, source_type, body, created_at
            FROM hiring_feedback
            WHERE application_id = $1
            ORDER BY created_at DESC, id DESC
          `,
          [id]
        ),
        executor.query(
          `
            SELECT
              id,
              body,
              completed,
              to_char(due_date, 'YYYY-MM-DD') AS due_date,
              created_at,
              updated_at
            FROM application_todos
            WHERE application_id = $1
            ORDER BY completed ASC, due_date ASC NULLS LAST, created_at ASC, id ASC
          `,
          [id]
        )
      ]);

      return {
        application: application.rows[0],
        cvs: cvs.rows,
        status_history: history.rows,
        notes: notes.rows,
        activity: activity.rows,
        ai_documents: aiDocuments.rows.map((row) => ({
          ...row,
          download_url: `/api/ai/documents/${row.id}/download`
        })),
        ai_jobs: aiJobs.rows,
        audit_events: auditEventsResult.rows,
        tags: tags.rows.map((row) => row.name),
        preparation: preparation.rows[0] || null,
        recruiter_questions: recruiterQuestions.rows,
        feedback_entries: feedbackEntries.rows,
        todos: todos.rows
      };
    },

    async getApplicationAIDocuments(applicationId) {
      const [documents, jobs] = await Promise.all([
        pool.query(
          `
            SELECT
              id,
              application_id,
              cv_id,
              document_type,
              title,
              content,
              created_at,
              provider_name,
              provider_requested,
              model_name,
              prompt_excerpt,
              source_context,
              generation_status,
              version_group_id,
              storage_kind,
              s3_bucket,
              s3_key,
              file_path IS NOT NULL AS has_file
            FROM ai_documents
            WHERE application_id = $1
              AND deleted_at IS NULL
            ORDER BY created_at DESC
          `,
          [applicationId]
        ),
        pool.query(
          `
            SELECT
              id,
              application_id,
              cv_id,
              document_type,
              provider_requested,
              provider_used,
              status,
              title,
              error_message,
              retry_count,
              document_id,
              created_at,
              completed_at
            FROM ai_generation_jobs
            WHERE application_id = $1
            ORDER BY created_at DESC
          `,
          [applicationId]
        )
      ]);

      return {
        documents: documents.rows.map((row) => ({
          ...row,
          download_url: `/api/ai/documents/${row.id}/download`
        })),
        jobs: jobs.rows
      };
    },

    async getAIDocument(id) {
      const result = await pool.query(
        `
          SELECT
            id,
            application_id,
            cv_id,
            document_type,
            title,
            content,
            created_at,
            provider_name,
            provider_requested,
            model_name,
            prompt_excerpt,
            source_context,
            generation_status,
            version_group_id,
            storage_kind,
            s3_bucket,
            s3_key,
            file_path IS NOT NULL AS has_file
          FROM ai_documents
          WHERE id = $1
            AND deleted_at IS NULL
        `,
        [id]
      );

      if (!result.rowCount) {
        const error = new Error('AI document not found');
        error.statusCode = 404;
        throw error;
      }

      return {
        document: {
          ...result.rows[0],
          download_url: `/api/ai/documents/${id}/download`
        }
      };
    },

    async getAIJob(id) {
      const result = await pool.query(
        `
          SELECT
            id,
            application_id,
            cv_id,
            document_type,
            provider_requested,
            provider_used,
            status,
            title,
            request_manifest_path,
            request_manifest_s3_key,
            result_s3_key,
            error_message,
            retry_count,
            prompt_excerpt,
            source_context,
            document_id,
            created_at,
            started_at,
            completed_at
          FROM ai_generation_jobs
          WHERE id = $1
        `,
        [id]
      );

      if (!result.rowCount) {
        const error = new Error('AI job not found');
        error.statusCode = 404;
        throw error;
      }

      return { job: result.rows[0] };
    },

    async getCVs() {
      const result = await pool.query(
        `
          SELECT id, original_name, version_label, file_size, is_latest, created_at, length(extracted_text) AS extracted_text_length, storage_kind, s3_bucket, s3_key
          FROM cv_versions
          WHERE deleted_at IS NULL
          ORDER BY is_latest DESC, created_at DESC
        `
      );
      return { cvs: result.rows };
    }
  };
}
