import {
  activityApplicationName,
  daysClass,
  escapeAttribute,
  escapeHtml,
  formatAction,
  formatBytes,
  formatDate,
  formatDateTime,
  formatMonthLabel,
  formatMonthTitle,
  isoDate,
  maxCount,
  renderDays,
  renderInterviewControl,
  renderTags,
  reportRow
} from './utils.js';

export function renderReports(els, report, statusLabels) {
  els.reportsContent.innerHTML = `
    <section class="report-panel report-panel-status">
      <div class="panel-kicker">Snapshot</div>
      <h3>Status</h3>
      ${report.status_counts.map((row) => reportRow(statusLabels[row.status] || row.status, Number(row.count), maxCount(report.status_counts))).join('') || '<p>No status data.</p>'}
    </section>
    <section class="report-panel report-panel-lifecycle">
      <div class="panel-kicker">Portfolio</div>
      <h3>Lifecycle</h3>
      ${[
        { label: 'Active', count: Number(report.lifecycle_counts.active || 0) },
        { label: 'Archived', count: Number(report.lifecycle_counts.archived || 0) }
      ].map((row) => reportRow(row.label, row.count, Number(report.lifecycle_counts.total || 1))).join('')}
    </section>
    <section class="report-panel report-panel-monthly">
      <div class="panel-kicker">Velocity</div>
      <h3>Monthly Applications</h3>
      ${report.monthly_counts.map((row) => reportRow(formatMonthLabel(row.month), Number(row.count), maxCount(report.monthly_counts))).join('') || '<p>No monthly data.</p>'}
    </section>
    <section class="report-panel report-panel-upcoming">
      <div class="panel-kicker">Watchlist</div>
      <h3>Upcoming Interviews</h3>
      <div class="upcoming-list">
        ${report.upcoming_interviews.map((item) => `
          <article class="upcoming-card ${daysClass(item.days_remaining).replace('days-badge', '').trim()}">
            <strong>${escapeHtml(item.company_name)}</strong>
            <span>${formatDate(item.interview_date)}</span>
            ${renderDays(item.days_remaining)}
          </article>
        `).join('') || '<p>No upcoming interviews.</p>'}
      </div>
    </section>
  `;
}

export function renderActivity(els, state, payload) {
  state.activity.total = payload.total;
  els.activityEmpty.hidden = payload.activity.length !== 0;
  els.activityTable.innerHTML = payload.activity.map((item) => `
    <tr>
      <td>${formatDateTime(item.created_at)}</td>
      <td>
        <div class="company-cell">
          <strong>${escapeHtml(activityApplicationName(item))}</strong>
          <span>${item.application_id ? `ID ${item.application_id}` : 'No linked record'}</span>
        </div>
      </td>
      <td>${escapeHtml(formatAction(item.action))}</td>
      <td>${escapeHtml(item.details || '')}</td>
    </tr>
  `).join('');
  if (!payload.activity.length) {
    els.activityEmpty.innerHTML = renderEmptyState('Activity timeline', 'No actions match the current search. Try a broader query or open an application to inspect its detailed timeline.', 'Clear search to see recent activity.');
  }
  renderActivityPagination(els, state);
}

export function renderApplications(els, state, statusOptions) {
  els.table.innerHTML = '';
  els.empty.hidden = state.applications.length !== 0;

  const interviews = state.applications.filter((item) => item.status === 'interview_scheduled').length;
  const archived = state.applications.filter((item) => item.archived_at).length;
  const viewName = state.filters.archived === 'true' ? 'archived' : state.filters.archived === 'all' ? 'total' : 'active';
  els.summary.textContent = `${state.applications.length} ${viewName}, ${interviews} interviews scheduled, ${archived} archived shown`;
  if (!state.applications.length) {
    els.empty.innerHTML = renderEmptyState(
      state.filters.search || state.filters.status || state.filters.tag || state.filters.archived !== 'false' ? 'No matches found' : 'Start your tracker',
      state.filters.search || state.filters.status || state.filters.tag || state.filters.archived !== 'false'
        ? 'No applications match the current filters.'
        : 'Create your first application to unlock reminders, preparation tracking, AI outputs, and reporting.',
      state.filters.search || state.filters.status || state.filters.tag || state.filters.archived !== 'false'
        ? 'Adjust the filters or switch the view to include archived records.'
        : 'Use New Application in the top bar to add your first role.'
    );
  }

  for (const application of state.applications) {
    const row = document.createElement('tr');
    row.dataset.id = application.id;
    row.className = application.archived_at ? 'archived' : '';
    row.innerHTML = `
      <td>
        <div class="company-cell">
          <strong>${escapeHtml(application.company_name)}</strong>
          <span>${escapeHtml([application.role_title, application.location, application.salary, application.recruiter].filter(Boolean).join(' · ') || application.cv_name || 'No CV')}</span>
        </div>
      </td>
      <td>${formatDate(application.applied_date)}</td>
      <td>
        <select data-field="status" aria-label="Status for ${escapeHtml(application.company_name)}">
          ${statusOptions}
        </select>
      </td>
      <td>${application.archived_at ? '<span class="state archived-state">Archived</span>' : '<span class="state active-state">Active</span>'}</td>
      <td data-interview-cell>${renderInterviewControl(application)}</td>
      <td>${renderDays(application.days_remaining)}</td>
      <td>${renderTags(application.tags)}</td>
      <td>
        <div class="row-actions">
          ${application.archived_at ? `<button class="secondary" type="button" data-restore-row-id="${application.id}">Restore</button>` : `<button class="secondary" type="button" data-archive-row-id="${application.id}">Archive</button>`}
          <button class="secondary" type="button" data-detail-id="${application.id}">Open</button>
        </div>
      </td>
    `;

    row.querySelector('[data-field="status"]').value = application.status;
    els.table.appendChild(row);
  }
}

export function renderNotifications(els, notifications, expanded = false) {
  els.notificationsPanel.hidden = notifications.length === 0;
  if (!notifications.length) {
    els.notificationsPanel.innerHTML = '';
    return;
  }

  els.notificationsPanel.innerHTML = `
    <div class="notifications-shell ${expanded ? 'is-open' : 'is-closed'}">
      <div class="notifications-header">
        <button class="notifications-toggle" type="button" data-toggle-notifications aria-expanded="${expanded ? 'true' : 'false'}">
          <span class="notifications-toggle-copy">
            <strong>Priority reminders</strong>
            <span>${expanded ? 'Hide reminders' : 'Show reminders'}</span>
          </span>
          <span class="notifications-count">${notifications.length}</span>
        </button>
      </div>
      <div class="notifications-grid" ${expanded ? '' : 'hidden'}>
        ${notifications.map((item) => `
          <article class="notification-card ${item.type === 'follow_up' ? 'follow-up' : item.type === 'todo' ? 'todo' : 'interview'}">
            <div>
              <strong>${escapeHtml(item.company_name)}</strong>
              <span>${escapeHtml(item.message)}</span>
            </div>
            <div class="notification-meta">
              <span>${item.due_date ? formatDate(item.due_date) : 'No due date'}</span>
              ${item.type === 'interview'
                ? renderDays(item.days_remaining)
                : item.type === 'todo'
                  ? renderDays(item.days_remaining)
                  : `<span class="days-badge warning">${Number(item.days_remaining)} days since apply</span>`}
              <button class="secondary" type="button" data-notification-detail="${item.id}">Open</button>
            </div>
          </article>
        `).join('')}
      </div>
    </div>
  `;
}

export function renderSavedFilters(els, savedFilters) {
  const currentId = Number(els.savedFilterSelect.value);
  els.savedFilterSelect.innerHTML = [
    '<option value="">Current filters</option>',
    ...savedFilters.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
  ].join('');

  if (currentId && savedFilters.some((item) => item.id === currentId)) {
    els.savedFilterSelect.value = String(currentId);
  }
}

export function renderKanban(els, applications, statusLabels) {
  const groups = Object.keys(statusLabels).map((status) => ({
    status,
    items: applications.filter((application) => application.status === status && !application.archived_at)
  }));

  els.kanbanBoard.innerHTML = groups.map((group) => `
    <section class="kanban-column">
      <div class="kanban-column-head">
        <div>
          <span class="panel-kicker">Stage</span>
          <h3>${statusLabels[group.status]}</h3>
        </div>
        <span class="kanban-count">${group.items.length}</span>
      </div>
      ${group.items.map((item) => `
        <article class="kanban-card">
          <strong>${escapeHtml(item.company_name)}</strong>
          <span>${formatDate(item.applied_date)}</span>
          ${item.interview_date ? renderDays(item.days_remaining) : ''}
          ${renderTags(item.tags)}
        </article>
      `).join('') || '<p class="empty small">No entries.</p>'}
    </section>
  `).join('');
  if (!applications.some((application) => !application.archived_at)) {
    els.kanbanBoard.innerHTML = renderEmptyState('Kanban is empty', 'Active applications will appear here and group automatically by stage.', 'Create an application or restore an archived one to populate this board.');
  }
}

export function renderApplicationCVSelect(els, cvs) {
  const latest = cvs.find((cv) => cv.is_latest);
  els.applicationCvSelect.innerHTML = [
    '<option value="">Use latest CV</option>',
    ...cvs.map((cv) => `<option value="${cv.id}">${escapeHtml(cv.original_name)}${cv.version_label ? `, ${escapeHtml(cv.version_label)}` : ''}${cv.is_latest ? ' (latest)' : ''}</option>`)
  ].join('');
  if (latest) els.applicationCvSelect.value = latest.id;
}

export function renderCVs(els, cvs) {
  els.cvList.innerHTML = cvs.map((cv) => `
    <div class="cv-item">
      <strong>${escapeHtml(cv.original_name)}</strong>
      ${cv.is_latest ? '<span class="tag">Latest</span>' : ''}
      <p>${escapeHtml(cv.version_label || 'Unlabeled')} · ${formatBytes(Number(cv.file_size))}</p>
      <a href="/api/cv/${cv.id}/download">Download</a>
      <button class="secondary" type="button" data-delete-cv-id="${cv.id}">Delete</button>
    </div>
  `).join('') || renderEmptyState('No CV library yet', 'Upload a baseline CV so each application can preserve the exact version used.', 'A latest CV is required for quick application entry and AI generation.');
}

export function renderJobBoards(els, jobBoards) {
  const activeBoards = jobBoards.filter((board) => board.is_active);
  const inactiveBoards = jobBoards.filter((board) => !board.is_active);

  els.jobBoardsList.innerHTML = [
    renderBoardSection('Active boards', 'Boards you are actively checking.', activeBoards),
    inactiveBoards.length ? renderBoardSection('Inactive boards', 'Boards paused for now but kept for reference.', inactiveBoards) : ''
  ].join('') || renderEmptyState('No job boards saved', 'Add sources you check regularly so your search routine stays visible and repeatable.', 'The app now seeds common boards automatically after migrations run.');
}

function renderBoardSection(title, description, boards) {
  if (!boards.length) return '';
  return `
    <section class="board-section">
      <div class="board-section-head">
        <div>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(description)}</p>
        </div>
        <span class="board-section-count">${boards.length}</span>
      </div>
      <div class="board-section-grid">
        ${boards.map((board) => `
          <article class="board-card ${board.is_active ? '' : 'is-inactive'} ${jobBoardFreshnessClass(board)}">
      <div class="board-card-top">
        <div>
          <strong>${escapeHtml(board.name)}</strong>
          <span>${board.url ? `<a href="${escapeAttribute(board.url)}" target="_blank" rel="noreferrer">Open board</a>` : 'No link saved'}</span>
        </div>
        <span class="state ${board.is_active ? 'active-state' : 'archived-state'}">${board.is_active ? 'Active' : 'Inactive'}</span>
      </div>
      <div class="board-status-row">
        <span class="board-freshness ${jobBoardFreshnessClass(board)}">${jobBoardFreshnessLabel(board)}</span>
      </div>
      <p>${escapeHtml(board.notes || 'No notes yet.')}</p>
      <div class="board-meta">
        <span>Last checked: ${board.last_checked_date ? formatDate(board.last_checked_date) : 'Never'}</span>
        <span>Updated: ${formatDateTime(board.updated_at)}</span>
      </div>
      <div class="row-actions">
        <button class="secondary" type="button" data-job-board-edit="${board.id}">Edit</button>
        <button class="secondary" type="button" data-job-board-toggle="${board.id}" data-job-board-active="${board.is_active ? 'true' : 'false'}">${board.is_active ? 'Mark inactive' : 'Activate'}</button>
        <button class="secondary" type="button" data-job-board-delete="${board.id}">Delete</button>
      </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

export function renderToolkit(els) {
  els.toolkitContent.innerHTML = [
    {
      title: 'Why Toolkit Exists',
      marker: '01',
      description: 'This is the operating manual for your search. Use it when you need a repeatable checklist, a message starter, or a research frame without opening another document.',
      items: ['Use it before applying to tighten the CV and notes', 'Use it before recruiter calls to prep smart questions', 'Use it after interviews to decide next actions fast']
    },
    {
      title: 'Application Readiness',
      marker: '02',
      description: 'Use this before hitting apply or before saving a role into the tracker.',
      items: ['Confirm job link or description is saved', 'Record 2 to 3 tags so the role is searchable later', 'Capture one sentence on why the role is worth pursuing', 'Choose the exact CV version you want tied to the application']
    },
    {
      title: 'Company Research Frame',
      marker: '03',
      description: 'Use these prompts to fill the Preparation research block with substance instead of generic notes.',
      items: ['What does the company sell and who pays for it?', 'What product or market change is most likely driving this hire?', 'What competitors or substitutes exist?', 'What part of your background is genuinely relevant here?']
    },
    {
      title: 'Recruiter Call Guide',
      marker: '04',
      description: 'Use this when adding recruiter questions in the Preparation section.',
      items: ['Ask how success is measured in the first 90 days', 'Ask what stage usually eliminates candidates', 'Ask which team problems need solving now', 'Ask what distinguishes strong candidates from average ones']
    },
    {
      title: 'Interview Story Checklist',
      marker: '05',
      description: 'Use this before interviews so your notes turn into usable examples.',
      items: ['Prepare one ownership story', 'Prepare one ambiguity or conflict story', 'Prepare one technical tradeoff story', 'Prepare one failure and recovery story']
    },
    {
      title: 'Follow-up Playbook',
      marker: '06',
      description: 'Use this after calls or interviews to avoid stale applications.',
      items: ['Send thank-you notes within 24 hours', 'If no reply, create a to-do for 5 to 7 business days later', 'Log every piece of recruiter or interviewer feedback', 'Archive low-signal roles instead of letting them clutter the active list']
    }
  ].map((section) => `
    <section class="toolkit-card">
      <div class="toolkit-marker">${escapeHtml(section.marker)}</div>
      <div class="panel-kicker">Playbook</div>
      <h3>${escapeHtml(section.title)}</h3>
      <p class="toolkit-copy">${escapeHtml(section.description)}</p>
      <ul class="toolkit-list">
        ${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </section>
  `).join('');
}

export function buildDetailContent() {
  return '';
}

export function renderApplicationPage(els, payload, statusLabels, viewState) {
  const {
    application,
    cvs,
    status_history: history,
    notes,
    activity,
    ai_documents: documents,
    ai_jobs: jobs,
    tags,
    preparation,
    recruiter_questions: recruiterQuestions,
    feedback_entries: feedbackEntries,
    todos,
    audit_events: auditEvents
  } = payload;

  const activeTab = viewState.activeTab || 'overview';
  const primaryCv = cvs[0] || null;
  const latestDocuments = summarizeLatestDocuments(documents);
  const queuedJobs = jobs.filter((item) => item.status !== 'completed' && item.status !== 'failed');
  const failedJobs = jobs.filter((item) => item.status === 'failed');

  const tabBodies = {
    overview: renderOverviewTab({ application, primaryCv, tags, documents: latestDocuments, jobs: queuedJobs, statusLabels, selectedProvider: viewState.selectedProvider, capabilities: viewState.capabilities }),
    workflow: renderWorkflowTab({ application, preparation, recruiterQuestions, feedbackEntries, todos }),
    content: renderContentSummaryTab({ application, documents: latestDocuments, queuedJobs, failedJobs, allDocuments: documents }),
    history: renderHistoryTab({ application, history, notes, activity, auditEvents, statusLabels })
  };

  els.applicationPageContent.innerHTML = `
    <div class="route-page-shell">
      ${renderPageHeader({
        backHref: '/',
        backLabel: 'Tracker',
        eyebrow: 'Application',
        title: application.role_title || 'Application Detail',
        subtitle: application.company_name,
        actions: [
          `<button class="secondary" type="button" data-edit-application="${application.id}">Edit Application</button>`,
          application.archived_at
            ? `<button class="secondary" type="button" data-restore-application="${application.id}">Restore</button>`
            : `<button class="secondary" type="button" data-archive-application="${application.id}">Archive</button>`,
          `<a class="button-link secondary" href="/applications/${application.id}/content">Content Library</a>`
        ].join('')
      })}
      <section class="application-hero-card">
        <div class="hero-copy-group">
          <div class="hero-badge-row">
            <span class="state ${application.archived_at ? 'archived-state' : 'active-state'}">${application.archived_at ? 'Archived' : statusLabels[application.status] || application.status}</span>
            ${application.interview_date ? `<span class="days-badge">${escapeHtml(formatDate(application.interview_date))}</span>` : `<span class="days-badge">No interview yet</span>`}
          </div>
          <h2>${escapeHtml(application.company_name)}</h2>
          <p class="page-subtitle">${escapeHtml(application.role_title || 'Role not specified')}</p>
          ${renderTags(tags)}
        </div>
        <div class="hero-meta-grid">
          ${renderHeroMeta('Applied', formatDate(application.applied_date) || 'Not set')}
          ${renderHeroMeta('Location', application.location || 'Not set')}
          ${renderHeroMeta('Recruiter', application.recruiter || 'Not set')}
          ${renderHeroMeta('Contact', application.contact_person || 'Not set')}
          ${renderHeroMeta('Salary', application.salary || 'Not set')}
          ${renderHeroMeta('Job Link', application.job_link ? `<a class="quiet-link" href="${escapeAttribute(application.job_link)}" target="_blank" rel="noreferrer">Open posting</a>` : 'No link')}
        </div>
      </section>
      <nav class="detail-tabbar" aria-label="Application sections">
        ${renderDetailTab(application.id, 'overview', 'Overview', activeTab)}
        ${renderDetailTab(application.id, 'workflow', 'Workflow', activeTab)}
        ${renderDetailTab(application.id, 'content', 'Content', activeTab)}
        ${renderDetailTab(application.id, 'history', 'History', activeTab)}
      </nav>
      <section class="detail-tab-panel">
        ${tabBodies[activeTab] || tabBodies.overview}
      </section>
    </div>
  `;
}

export function renderGeneratedContentPage(els, application, documents, jobs, viewState = {}) {
  const groupedDocuments = groupDocumentsByType(documents);
  const queuedJobs = jobs.filter((item) => item.status !== 'completed');

  els.contentPageContent.innerHTML = `
    <div class="route-page-shell">
      ${renderPageHeader({
        backHref: `/applications/${application.id}?tab=content`,
        backLabel: 'Application',
        eyebrow: 'Content Library',
        title: 'Generated Content',
        subtitle: `${application.company_name}${application.role_title ? ` · ${application.role_title}` : ''}`,
        actions: `<a class="button-link secondary" href="/applications/${application.id}">Overview</a>`
      })}
      ${queuedJobs.length ? `
        <section class="route-card queue-surface">
          <div class="section-heading">
            <div>
              <div class="panel-kicker">Queue</div>
              <h3>Pending And Failed Jobs</h3>
            </div>
          </div>
          <div class="queue-grid">
            ${queuedJobs.map((job) => `
              <article class="queue-card ${job.status === 'failed' ? 'is-failed' : ''}">
                <strong>${escapeHtml(job.title)}</strong>
                <p>${escapeHtml(formatAction(job.document_type))}</p>
                <div class="document-card-meta">
                  <span class="pill subtle">${escapeHtml(job.provider_requested)}</span>
                  <span class="pill ${job.status === 'failed' ? 'danger-pill' : 'info-pill'}">${escapeHtml(job.status)}</span>
                </div>
                ${job.error_message ? `<p class="form-error inline-error">${escapeHtml(job.error_message)}</p>` : ''}
              </article>
            `).join('')}
          </div>
        </section>
      ` : ''}
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Library</div>
            <h3>Documents By Type</h3>
          </div>
          ${renderSegmentedProviderControl({
            selectedProvider: viewState.selectedProvider || 'gemini',
            awsEnabled: viewState.capabilities?.awsEnabled,
            attrName: 'data-library-provider-select'
          })}
        </div>
        ${Object.entries(groupedDocuments).map(([type, items]) => `
          <section class="content-group">
            <div class="content-group-head">
              <h4>${escapeHtml(formatAction(type))}</h4>
              <span class="pill subtle">${items.length} versions</span>
            </div>
            <div class="document-grid">
              ${items.map((doc, index) => renderDocumentLibraryCard(application.id, doc, index === 0)).join('')}
            </div>
          </section>
        `).join('') || renderInlineEmpty('No generated content', 'Generate CVs, letters, ATS checks, or follow-ups from the application page.')}
      </section>
    </div>
  `;
}

export function renderGeneratedDocumentDetail(els, application, document, capabilities = {}, selectedProvider = 'gemini') {
  els.contentPageContent.innerHTML = `
    <div class="route-page-shell">
      ${renderPageHeader({
        backHref: `/applications/${application.id}/content`,
        backLabel: 'Content Library',
        eyebrow: formatAction(document.document_type),
        title: document.title,
        subtitle: application.company_name,
        actions: `<a class="button-link secondary" href="${escapeAttribute(document.download_url)}">Download DOCX</a>`
      })}
      <div class="document-detail-layout">
        <section class="route-card document-reader-card">
          <div class="section-heading">
            <div>
              <div class="panel-kicker">Document View</div>
              <h3>${escapeHtml(formatAction(document.document_type))}</h3>
            </div>
            <div class="document-card-meta">
              <span class="pill subtle">${escapeHtml(document.provider_name || document.provider_requested || 'unknown')}</span>
              <span class="pill info-pill">${escapeHtml(formatDateTime(document.created_at))}</span>
            </div>
          </div>
          <div class="document-rich-body">
            ${renderDocumentContent(document)}
          </div>
        </section>
        <aside class="document-sidebar">
          <section class="route-card">
            <div class="panel-kicker">Actions</div>
            <h3>Manage Document</h3>
            ${renderSegmentedProviderControl({
              selectedProvider,
              awsEnabled: capabilities.awsEnabled,
              attrName: 'data-regenerate-provider'
            })}
            <div class="document-action-stack">
              <button type="button" data-regenerate-document="${document.id}">Regenerate</button>
              <button class="secondary" type="button" data-copy-document="${document.id}">Copy Text</button>
              <button class="danger" type="button" data-delete-document="${document.id}">Delete</button>
            </div>
          </section>
          <section class="route-card">
            <div class="panel-kicker">Metadata</div>
            <h3>Generation Details</h3>
            <div class="metadata-list">
              ${renderMetadataItem('Provider', document.provider_name || document.provider_requested || 'Unknown')}
              ${renderMetadataItem('Model', document.model_name || 'Unknown')}
              ${renderMetadataItem('Created', formatDateTime(document.created_at))}
              ${renderMetadataItem('Status', document.generation_status || 'completed')}
            </div>
            <details class="metadata-details">
              <summary>Prompt and source metadata</summary>
              <div class="metadata-note">
                <strong>Prompt excerpt</strong>
                <p>${escapeHtml(document.prompt_excerpt || 'No prompt excerpt stored.')}</p>
              </div>
              <div class="metadata-note">
                <strong>Source context</strong>
                <p>${escapeHtml(document.source_context || 'No source context stored.')}</p>
              </div>
            </details>
          </section>
        </aside>
      </div>
    </div>
  `;
}

function renderOverviewTab({ application, primaryCv, tags, documents, jobs, statusLabels, selectedProvider, capabilities }) {
  return `
    <div class="tab-grid overview-grid">
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Role Context</div>
            <h3>Job Description</h3>
          </div>
        </div>
        <details class="job-description-panel" ${application.job_description ? '' : 'open'}>
          <summary>${application.job_description ? 'View role description' : 'No job description saved'}</summary>
          <p class="description">${escapeHtml(application.job_description || 'Add a job description to improve tailored output and role-fit analysis.')}</p>
        </details>
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">AI Workspace</div>
            <h3>Generate Content</h3>
          </div>
        </div>
        ${renderSegmentedProviderControl({
          selectedProvider,
          awsEnabled: capabilities.awsEnabled,
          attrName: 'data-ai-provider-select'
        })}
        <div class="document-card-meta toolbar-pills">
          <span class="pill subtle">Default: Gemini</span>
          <span class="pill ${capabilities.awsEnabled ? 'success-pill' : 'danger-pill'}">${capabilities.awsEnabled ? 'AWS available' : 'AWS disabled'}</span>
        </div>
        <div class="ai-action-grid">
          <button type="button" data-ai="cv" data-cv-id="${primaryCv?.id || ''}">Tailor CV</button>
          <button class="secondary" type="button" data-ai="letter" data-cv-id="${primaryCv?.id || ''}">Cover Letter</button>
          <button class="secondary" type="button" data-ai="fit" data-cv-id="${primaryCv?.id || ''}">Role Fit</button>
          <button class="secondary" type="button" data-ai="ats" data-cv-id="${primaryCv?.id || ''}">ATS Check</button>
          <button class="secondary" type="button" data-ai="followup" data-cv-id="${primaryCv?.id || ''}">Follow-up</button>
        </div>
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Resume Context</div>
            <h3>Linked CV</h3>
          </div>
        </div>
        ${primaryCv ? `
          <article class="document-summary-card">
            <strong>${escapeHtml(primaryCv.original_name)}</strong>
            <p>${escapeHtml(primaryCv.version_label || 'Unlabeled')} · ${escapeHtml(formatBytes(Number(primaryCv.file_size || 0)))}</p>
            <div class="document-card-meta">
              <span class="pill subtle">${primaryCv.storage_kind === 'dual' ? 'Local + S3' : 'Local only'}</span>
              <span class="pill info-pill">${primaryCv.extracted_text_length ? 'Text extracted' : 'No extracted text'}</span>
            </div>
            <div class="document-card-actions">
              <a class="button-link secondary" href="/api/cv/${primaryCv.id}/download">Download CV</a>
            </div>
          </article>
        ` : renderInlineEmpty('No CV linked', 'Link a CV to unlock tailored generation and consistent job-specific outputs.')}
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Latest Output</div>
            <h3>Recent Documents</h3>
          </div>
          <a class="button-link tertiary" href="/applications/${application.id}/content">Open library</a>
        </div>
        <div class="document-stack">
          ${documents.map((doc) => renderRecentDocumentItem(application.id, doc)).join('') || renderInlineEmpty('No generated content yet', 'Generate a CV, role-fit report, or follow-up message from this page.')}
        </div>
        ${jobs.length ? `
          <div class="queue-inline-list">
            ${jobs.map((job) => `<span class="pill info-pill">${escapeHtml(job.status)} · ${escapeHtml(job.title)}</span>`).join('')}
          </div>
        ` : ''}
      </section>
    </div>
  `;
}

function renderWorkflowTab({ application, preparation, recruiterQuestions, feedbackEntries, todos }) {
  return `
    <div class="tab-grid workflow-grid">
      <section class="route-card route-card-soft research-surface">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Research</div>
            <h3>Company Notes</h3>
            <p class="section-help">Keep research concise and focused on interview preparation and application strategy.</p>
          </div>
        </div>
        <form class="prep-form prep-research-form" data-preparation-form="${application.id}">
          <label>
            <span>About The Company</span>
            <textarea name="about_company" rows="4" placeholder="Products, market, competitors, roadmap, team shape">${escapeHtml(preparation?.about_company || '')}</textarea>
          </label>
          <label>
            <span>Company Values</span>
            <textarea name="company_values" rows="4" placeholder="Culture signals, values, leadership principles">${escapeHtml(preparation?.company_values || '')}</textarea>
          </label>
          <label>
            <span>Application Notes</span>
            <textarea name="application_notes" rows="4" placeholder="Fit summary, risks, strengths, stories to prepare">${escapeHtml(preparation?.application_notes || '')}</textarea>
          </label>
          <div class="inline-actions">
            <button type="submit">Save Research</button>
          </div>
        </form>
      </section>
      <section class="route-card route-card-soft ask-surface">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Questions</div>
            <h3>Recruiter Questions</h3>
          </div>
        </div>
        <form class="stack-form" data-question-form="${application.id}">
          <textarea name="question" rows="2" placeholder="Ask about interview stages, team goals, ownership, and success metrics"></textarea>
          <button type="submit">Add Question</button>
        </form>
        <div class="stack-list">
          ${recruiterQuestions.map((item, index) => `
            <article class="stack-item">
              <div>
                <strong>Q${index + 1}</strong>
                <p>${escapeHtml(item.question)}</p>
              </div>
              <div class="row-actions compact-actions">
                <button class="secondary" type="button" data-question-move="${item.id}" data-direction="up" ${index === 0 ? 'disabled' : ''}>Up</button>
                <button class="secondary" type="button" data-question-move="${item.id}" data-direction="down" ${index === recruiterQuestions.length - 1 ? 'disabled' : ''}>Down</button>
                <button class="secondary" type="button" data-question-edit="${item.id}">Edit</button>
                <button class="secondary" type="button" data-question-delete="${item.id}">Delete</button>
              </div>
            </article>
          `).join('') || '<p class="empty small">No recruiter questions yet.</p>'}
        </div>
      </section>
      <section class="route-card route-card-soft feedback-surface">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Feedback</div>
            <h3>Signals From The Hiring Team</h3>
          </div>
        </div>
        <form class="stack-form" data-feedback-form="${application.id}">
          <label>
            <span>Source</span>
            <select name="source_type">
              <option value="recruiter">Recruiter</option>
              <option value="interviewer">Interviewer</option>
              <option value="hiring_manager">Hiring Manager</option>
              <option value="self_note">Self Note</option>
            </select>
          </label>
          <textarea name="body" rows="3" placeholder="Capture feedback, concerns, praise, or follow-up signals"></textarea>
          <button type="submit">Add Feedback</button>
        </form>
        <div class="stack-list">
          ${feedbackEntries.map((item) => `
            <article class="stack-item">
              <div class="item-meta">
                <span class="tag">${escapeHtml(formatAction(item.source_type))}</span>
                <span>${formatDateTime(item.created_at)}</span>
              </div>
              <p>${escapeHtml(item.body)}</p>
              <div class="row-actions compact-actions">
                <button class="secondary" type="button" data-feedback-delete="${item.id}">Delete</button>
              </div>
            </article>
          `).join('') || '<p class="empty small">No feedback recorded.</p>'}
        </div>
      </section>
      <section class="route-card route-card-soft task-surface">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Tasks</div>
            <h3>Next Steps</h3>
          </div>
          <span class="pill subtle">${todos.filter((item) => !item.completed).length} open</span>
        </div>
        <form class="todo-form" data-todo-form="${application.id}">
          <textarea name="body" rows="2" placeholder="Research the team, prepare a story, send a follow-up note"></textarea>
          <label>
            <span>Due Date</span>
            <input name="due_date" type="text" inputmode="numeric" autocomplete="off" placeholder="DD-MM-YYYY" data-date-input>
          </label>
          <button type="submit">Add Task</button>
        </form>
        <div class="stack-list">
          ${todos.map((item) => `
            <article class="stack-item todo-item ${item.completed ? 'is-complete' : ''}">
              <div class="todo-main">
                <label class="todo-check">
                  <input type="checkbox" data-todo-toggle="${item.id}" ${item.completed ? 'checked' : ''}>
                  <span>${escapeHtml(item.body)}</span>
                </label>
                <div class="item-meta">
                  <span>${item.due_date ? `Due ${formatDate(item.due_date)}` : 'No due date'}</span>
                  <span>${formatDateTime(item.created_at)}</span>
                </div>
              </div>
              <div class="row-actions compact-actions">
                <button class="secondary" type="button" data-todo-edit="${item.id}">Edit</button>
                <button class="secondary" type="button" data-todo-delete="${item.id}">Delete</button>
              </div>
            </article>
          `).join('') || '<p class="empty small">No tasks yet.</p>'}
        </div>
      </section>
    </div>
  `;
}

function renderContentSummaryTab({ application, documents, queuedJobs, failedJobs, allDocuments }) {
  return `
    <div class="tab-grid content-summary-grid">
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Latest Documents</div>
            <h3>Recent Generated Content</h3>
          </div>
          <a class="button-link tertiary" href="/applications/${application.id}/content">Open full library</a>
        </div>
        <div class="document-grid compact-document-grid">
          ${documents.map((doc, index) => renderDocumentLibraryCard(application.id, doc, index === 0)).join('') || renderInlineEmpty('No generated content yet', 'Use the overview tab to generate tailored content.')}
        </div>
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Providers</div>
            <h3>Generation Summary</h3>
          </div>
        </div>
        <div class="provider-summary-grid">
          ${renderProviderSummaryCard('Gemini', allDocuments.filter((item) => isProvider(item, 'gemini')).length, 'Synchronous generation')}
          ${renderProviderSummaryCard('AWS', allDocuments.filter((item) => isProvider(item, 'aws')).length, 'Queued background generation')}
        </div>
        <div class="document-card-meta toolbar-pills">
          <span class="pill info-pill">${queuedJobs.length} queued</span>
          <span class="pill ${failedJobs.length ? 'danger-pill' : 'success-pill'}">${failedJobs.length} failed</span>
        </div>
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Queue</div>
            <h3>Background Jobs</h3>
          </div>
        </div>
        <div class="queue-grid">
          ${[...queuedJobs, ...failedJobs].map((job) => `
            <article class="queue-card ${job.status === 'failed' ? 'is-failed' : ''}">
              <strong>${escapeHtml(job.title)}</strong>
              <p>${escapeHtml(formatAction(job.document_type))}</p>
              <div class="document-card-meta">
                <span class="pill subtle">${escapeHtml(job.provider_requested)}</span>
                <span class="pill ${job.status === 'failed' ? 'danger-pill' : 'info-pill'}">${escapeHtml(job.status)}</span>
              </div>
              ${job.error_message ? `<p class="form-error inline-error">${escapeHtml(job.error_message)}</p>` : ''}
            </article>
          `).join('') || renderInlineEmpty('No background jobs', 'Queued AWS jobs will appear here until they complete or fail.')}
        </div>
      </section>
    </div>
  `;
}

function renderHistoryTab({ application, history, notes, activity, auditEvents, statusLabels }) {
  return `
    <div class="tab-grid history-grid">
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Notes</div>
            <h3>Working Notes</h3>
          </div>
        </div>
        <div class="notes-list">
          ${application.notes ? `<div class="note-item">${escapeHtml(application.notes)}</div>` : ''}
          ${notes.length ? notes.map((note) => `<div class="note-item">${escapeHtml(note.body)}</div>`).join('') : application.notes ? '' : '<p>No notes yet.</p>'}
        </div>
        <form class="note-form" data-note-form="${application.id}">
          <textarea name="body" rows="3" placeholder="Add note"></textarea>
          <button type="submit">Add Note</button>
        </form>
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Timeline</div>
            <h3>Activity</h3>
          </div>
        </div>
        <div class="history-list">
          ${activity.map((item) => `<div class="history-item">${escapeHtml(formatAction(item.action))}<br><small>${escapeHtml(item.details || '')} · ${formatDateTime(item.created_at)}</small></div>`).join('') || renderInlineEmpty('No activity yet', 'Actions on this application will appear here.')}
        </div>
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Status</div>
            <h3>Status History</h3>
          </div>
        </div>
        <div class="history-list">
          ${history.map((item) => `<div class="history-item">${item.from_status ? statusLabels[item.from_status] : 'Created'} to ${statusLabels[item.to_status]}<br><small>${formatDateTime(item.changed_at)}</small></div>`).join('') || renderInlineEmpty('No status changes yet', 'The first status transition will appear here.')}
        </div>
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Audit</div>
            <h3>Protected Actions</h3>
          </div>
        </div>
        <div class="history-list">
          ${auditEvents.map((item) => `<div class="history-item">${escapeHtml(formatAction(item.action))}<br><small>${escapeHtml(item.details || '')} · ${escapeHtml(item.actor_ip || 'local')} · ${formatDateTime(item.created_at)}</small></div>`).join('') || renderInlineEmpty('No audit events', 'Destructive or protected actions will appear here.')}
        </div>
      </section>
    </div>
  `;
}

function renderPageHeader({ backHref, backLabel, eyebrow, title, subtitle, actions = '' }) {
  return `
    <div class="page-header page-header-strong">
      <div class="page-header-copy">
        <a class="button-link tertiary back-pill" href="${escapeAttribute(backHref)}">${escapeHtml(backLabel)}</a>
        <span class="panel-kicker">${escapeHtml(eyebrow)}</span>
        <h1>${escapeHtml(title)}</h1>
        <p class="page-subtitle">${escapeHtml(subtitle || '')}</p>
      </div>
      <div class="page-header-actions">
        ${actions}
      </div>
    </div>
  `;
}

function renderHeroMeta(label, value) {
  return `
    <div class="hero-meta-card">
      <span>${escapeHtml(label)}</span>
      <strong>${typeof value === 'string' && value.includes('<a') ? value : escapeHtml(value)}</strong>
    </div>
  `;
}

function renderDetailTab(applicationId, key, label, activeTab) {
  return `<a class="detail-tab${activeTab === key ? ' is-active' : ''}" href="/applications/${applicationId}?tab=${key}">${escapeHtml(label)}</a>`;
}

function renderSegmentedProviderControl({ selectedProvider, awsEnabled, attrName }) {
  return `
    <div class="provider-segmented" role="tablist" aria-label="AI provider">
      <button class="${selectedProvider === 'gemini' ? 'is-active' : 'secondary'}" type="button" ${attrName}="gemini">Gemini</button>
      <button class="${selectedProvider === 'aws' ? 'is-active' : 'secondary'}" type="button" ${attrName}="aws" ${awsEnabled ? '' : 'disabled'}>AWS</button>
    </div>
  `;
}

function renderRecentDocumentItem(applicationId, doc) {
  return `
    <article class="document-list-item">
      <div>
        <strong>${escapeHtml(doc.title)}</strong>
        <p>${escapeHtml(formatAction(doc.document_type))}</p>
      </div>
      <div class="document-card-meta">
        <span class="pill subtle">${escapeHtml(doc.provider_name || doc.provider_requested || 'unknown')}</span>
        <a class="button-link tertiary" href="/applications/${applicationId}/content/${doc.id}">Open</a>
      </div>
    </article>
  `;
}

function renderDocumentLibraryCard(applicationId, doc, isLatest) {
  return `
    <article class="document-card">
      <div class="document-card-head">
        <div>
          <h4>${escapeHtml(doc.title)}</h4>
          <p>${escapeHtml(formatAction(doc.document_type))}</p>
        </div>
        ${isLatest ? '<span class="pill success-pill">Latest</span>' : ''}
      </div>
      <div class="document-card-meta">
        <span class="pill subtle">${escapeHtml(doc.provider_name || doc.provider_requested || 'unknown')}</span>
        <span class="pill info-pill">${escapeHtml(formatDateTime(doc.created_at))}</span>
      </div>
      <div class="document-card-actions">
        <a class="button-link secondary" href="/applications/${applicationId}/content/${doc.id}">Open</a>
        <a class="button-link tertiary" href="${escapeAttribute(doc.download_url)}">Download</a>
        <button class="secondary" type="button" data-regenerate-card="${doc.id}">Regenerate</button>
        <button class="secondary" type="button" data-delete-card="${doc.id}">Delete</button>
      </div>
    </article>
  `;
}

function renderProviderSummaryCard(label, count, detail) {
  return `
    <article class="provider-summary-card">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(detail)}</span>
      <b>${count}</b>
    </article>
  `;
}

function renderMetadataItem(label, value) {
  return `
    <div class="metadata-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || 'Not available')}</strong>
    </div>
  `;
}

function renderDocumentContent(document) {
  const sections = parseDocumentSections(document.content || '', document.document_type);
  return sections.map((section) => {
    if (section.type === 'email') {
      return `
        <section class="doc-section">
          ${section.subject ? `<div class="doc-field"><span>Subject</span><strong>${escapeHtml(section.subject)}</strong></div>` : ''}
          ${section.greeting ? `<p class="doc-paragraph"><strong>${escapeHtml(section.greeting)}</strong></p>` : ''}
          ${section.paragraphs.map((paragraph) => `<p class="doc-paragraph">${escapeHtml(paragraph)}</p>`).join('')}
          ${section.close ? `<p class="doc-paragraph doc-close">${escapeHtml(section.close)}</p>` : ''}
        </section>
      `;
    }

    return `
      <section class="doc-section">
        ${section.heading ? `<h4>${escapeHtml(section.heading)}</h4>` : ''}
        ${section.labels.map((item) => `<div class="doc-field"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('')}
        ${section.paragraphs.map((paragraph) => `<p class="doc-paragraph">${escapeHtml(paragraph)}</p>`).join('')}
        ${section.list.length ? `<ul class="doc-list">${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      </section>
    `;
  }).join('') || '<p class="doc-paragraph">No content stored.</p>';
}

function parseDocumentSections(content, documentType) {
  const lines = String(content || '').replace(/\r/g, '').split('\n');
  if (documentType === 'follow_up_email' || looksLikeEmail(lines)) {
    return [parseEmailDocument(lines)];
  }

  const sections = [];
  let current = createSection('');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = extractHeading(line);
    if (heading) {
      if (hasSectionContent(current)) sections.push(current);
      current = createSection(heading);
      continue;
    }

    const labelValue = extractLabelValue(line);
    if (labelValue) {
      current.labels.push(labelValue);
      continue;
    }

    const bullet = extractBullet(line);
    if (bullet) {
      current.list.push(bullet);
      continue;
    }

    current.paragraphs.push(stripInlineMarkers(line));
  }

  if (hasSectionContent(current)) sections.push(current);
  return sections.length ? sections : [createSectionFromParagraphs(lines.filter(Boolean).map((line) => stripInlineMarkers(line.trim())))];
}

function parseEmailDocument(lines) {
  const section = {
    type: 'email',
    subject: '',
    greeting: '',
    paragraphs: [],
    close: ''
  };

  const normalized = lines.map((line) => line.trim()).filter(Boolean);
  for (const line of normalized) {
    if (!section.subject && /^subject\s*:/i.test(line)) {
      section.subject = stripInlineMarkers(line.replace(/^subject\s*:/i, '').trim());
      continue;
    }
    if (!section.greeting && /^(dear|hello|hi)\b/i.test(line)) {
      section.greeting = stripInlineMarkers(line);
      continue;
    }
    if (/^(thanks|thank you|regards|best|sincerely)\b/i.test(line)) {
      section.close = stripInlineMarkers(line);
      continue;
    }
    section.paragraphs.push(stripInlineMarkers(line));
  }
  return section;
}

function createSection(heading) {
  return {
    type: 'section',
    heading,
    labels: [],
    paragraphs: [],
    list: []
  };
}

function createSectionFromParagraphs(paragraphs) {
  return {
    type: 'section',
    heading: '',
    labels: [],
    paragraphs,
    list: []
  };
}

function hasSectionContent(section) {
  return Boolean(section.heading || section.labels.length || section.paragraphs.length || section.list.length);
}

function extractHeading(line) {
  const boldHeading = line.match(/^\*{1,2}\s*([^*].*?)\s*\*{1,2}$/);
  if (boldHeading) return stripInlineMarkers(boldHeading[1]).replace(/:$/, '');
  if (/^[A-Z][A-Z\s&/-]{3,}:?$/.test(line)) return stripInlineMarkers(line).replace(/:$/, '');
  return '';
}

function extractLabelValue(line) {
  const match = line.match(/^([A-Za-z][A-Za-z\s/&-]{1,40}):\s+(.+)$/);
  if (!match) return null;
  return {
    label: stripInlineMarkers(match[1]),
    value: stripInlineMarkers(match[2])
  };
}

function extractBullet(line) {
  const match = line.match(/^(?:[-*•]\s+)(.+)$/);
  return match ? stripInlineMarkers(match[1]) : '';
}

function stripInlineMarkers(text) {
  return String(text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeEmail(lines) {
  return lines.some((line) => /^subject\s*:/i.test(line.trim()));
}

function summarizeLatestDocuments(documents) {
  const seen = new Set();
  const results = [];
  for (const document of documents) {
    const key = `${document.document_type}:${document.provider_name || document.provider_requested || 'unknown'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(document);
  }
  return results.slice(0, 6);
}

function groupDocumentsByType(documents) {
  const grouped = documents.reduce((groups, item) => {
    if (!groups[item.document_type]) groups[item.document_type] = [];
    groups[item.document_type].push(item);
    return groups;
  }, {});
  return Object.fromEntries(Object.entries(grouped).sort((left, right) => left[0].localeCompare(right[0])));
}

function isProvider(document, provider) {
  const name = String(document.provider_name || document.provider_requested || '').toLowerCase();
  if (provider === 'aws') return name.includes('aws');
  return name.includes(provider);
}

function jobBoardFreshnessLabel(board) {
  if (!board.is_active) return 'Inactive source';
  if (!board.last_checked_date) return 'Never checked';
  const diff = dayDiffFromToday(board.last_checked_date);
  if (diff <= 1) return 'Checked recently';
  if (diff <= 7) return 'Fresh this week';
  return 'Needs review';
}

function jobBoardFreshnessClass(board) {
  if (!board.is_active) return 'freshness-inactive';
  if (!board.last_checked_date) return 'freshness-stale';
  const diff = dayDiffFromToday(board.last_checked_date);
  if (diff <= 1) return 'freshness-fresh';
  if (diff <= 7) return 'freshness-warm';
  return 'freshness-stale';
}

function dayDiffFromToday(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  const target = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.abs(Math.round((today.getTime() - target.getTime()) / 86400000));
}

function renderEmptyState(title, body, hint) {
  return `
    <section class="empty-state">
      <div class="empty-state-marker" aria-hidden="true"></div>
      <div class="empty-state-copy">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(body)}</p>
        <span>${escapeHtml(hint)}</span>
      </div>
    </section>
  `;
}

function renderInlineEmpty(title, body) {
  return `
    <div class="empty-inline">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </div>
  `;
}

export function renderCalendar(els, calendarDate, reminders) {
  const month = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const firstDay = month.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstDay; index += 1) cells.push({ empty: true });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const iso = isoDate(date);
    cells.push({
      day,
      iso,
      today: iso === isoDate(new Date()),
      events: reminders.filter((item) => item.interview_date === iso)
    });
  }
  while (cells.length % 7) cells.push({ empty: true });

  els.remindersList.innerHTML = `
    <div class="calendar-header">
      <div>
        <h2>${formatMonthTitle(month)}</h2>
        <p>${reminders.length} scheduled interviews</p>
      </div>
      <div class="calendar-actions">
        <button class="secondary" type="button" data-calendar-action="prev">Prev</button>
        <button class="secondary" type="button" data-calendar-action="current">Current</button>
        <button class="secondary" type="button" data-calendar-action="next">Next</button>
      </div>
    </div>
    <div class="calendar-grid">
      ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => `<div class="calendar-weekday">${day}</div>`).join('')}
      ${cells.map((cell) => {
        if (cell.empty) return '<div class="calendar-day is-empty"></div>';
        return `
          <div class="calendar-day${cell.today ? ' is-today' : ''}">
            <span class="calendar-date">${cell.day}</span>
            <div class="calendar-events">
              ${cell.events.map((event) => `
                <article class="calendar-event ${daysClass(event.days_remaining).replace('days-badge', '').trim()}">
                  <strong>${escapeHtml(event.company_name)}</strong>
                  <span>${renderDays(event.days_remaining)}</span>
                  <button class="link-button" type="button" data-calendar-detail="${event.id}">Details</button>
                </article>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderActivityPagination(els, state) {
  const totalPages = Math.max(1, Math.ceil(state.activity.total / state.activity.limit));
  const page = Math.min(state.activity.page, totalPages);
  const start = state.activity.total ? (page - 1) * state.activity.limit + 1 : 0;
  const end = Math.min(state.activity.total, page * state.activity.limit);
  els.activityPagination.innerHTML = `
    <span>${start}-${end} of ${state.activity.total}</span>
    <button class="secondary" type="button" data-activity-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Prev</button>
    <button class="secondary" type="button" data-activity-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next</button>
  `;
}
