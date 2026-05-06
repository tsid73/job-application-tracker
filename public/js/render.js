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

export function buildDetailContent({ application, cvs, history, notes, activity, docs, tags, auditEvents, statusLabels, preparation, recruiterQuestions, feedbackEntries, todos }) {
  const primaryCv = cvs[0];
  const feedbackSourceLabels = {
    recruiter: 'Recruiter',
    interviewer: 'Interviewer',
    hiring_manager: 'Hiring Manager',
    self_note: 'Self Note'
  };
  const prepChecks = [
    Boolean(preparation?.about_company),
    Boolean(preparation?.company_values),
    Boolean(preparation?.application_notes),
    recruiterQuestions.length > 0,
    feedbackEntries.length > 0,
    todos.some((item) => !item.completed)
  ];
  const prepCompleted = prepChecks.filter(Boolean).length;
  const prepTotal = prepChecks.length;
  const activeTodos = todos.filter((item) => !item.completed);
  const nextTodo = activeTodos.find((item) => item.due_date) || activeTodos[0] || null;
  return `
    <div>
      <section class="detail-section">
        <div class="panel-kicker">Role Context</div>
        <h3>Job Description</h3>
        <p class="description">${escapeHtml(application.job_description || 'No job description saved.')}</p>
      </section>
      <section class="detail-section prep-section">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Workflow</div>
            <h3>Preparation</h3>
            <p class="section-help">Capture research, recruiter questions, feedback, and next steps for this role.</p>
          </div>
          <div class="prep-progress">
            <strong>${prepCompleted} of ${prepTotal}</strong>
            <span>prep blocks active</span>
            <div class="progress-bar"><i style="width:${Math.round((prepCompleted / prepTotal) * 100)}%"></i></div>
          </div>
        </div>
        <div class="prep-layout">
          <div class="prep-primary">
            <form class="prep-form prep-research-form" data-preparation-form="${application.id}">
              <div class="prep-card prep-card-research">
                <div class="section-heading">
                  <div>
                    <div class="panel-kicker">Research</div>
                    <h3>Company Research</h3>
                  </div>
                </div>
                <label>
                  <span>About The Company</span>
                  <textarea name="about_company" rows="4" placeholder="Products, market, history, competitors, customers, funding, leadership">${escapeHtml(preparation?.about_company || '')}</textarea>
                </label>
                <label>
                  <span>Company Values</span>
                  <textarea name="company_values" rows="4" placeholder="Document stated values, culture signals, and where your own work style aligns">${escapeHtml(preparation?.company_values || '')}</textarea>
                </label>
                <label>
                  <span>Application Notes</span>
                  <textarea name="application_notes" rows="4" placeholder="Interview strategy, risks, project stories, role-specific observations">${escapeHtml(preparation?.application_notes || '')}</textarea>
                </label>
                <div class="inline-actions">
                  <button type="submit">Save Preparation</button>
                </div>
              </div>
            </form>
            <div class="prep-grid">
              <section class="prep-card prep-card-questions">
            <div class="section-heading">
              <div>
                <div class="panel-kicker">Ask</div>
                <h3>Questions For Recruiter</h3>
                <p class="section-help">Keep short, direct questions ready before the next call.</p>
              </div>
            </div>
            <form class="stack-form" data-question-form="${application.id}">
              <textarea name="question" rows="2" placeholder="Ask about team structure, interview stages, success metrics, or expectations"></textarea>
              <button type="submit">Add Question</button>
            </form>
            <div class="stack-list">
              ${recruiterQuestions.map((item, index) => `
                <article class="stack-item">
                  <div>
                    <strong>Q${index + 1}</strong>
                    <p>${escapeHtml(item.question)}</p>
                  </div>
                  <div class="row-actions">
                    <button class="secondary" type="button" data-question-move="${item.id}" data-direction="up" ${index === 0 ? 'disabled' : ''}>Up</button>
                    <button class="secondary" type="button" data-question-move="${item.id}" data-direction="down" ${index === recruiterQuestions.length - 1 ? 'disabled' : ''}>Down</button>
                    <button class="secondary" type="button" data-question-edit="${item.id}">Edit</button>
                    <button class="secondary" type="button" data-question-delete="${item.id}">Delete</button>
                  </div>
                </article>
      `).join('') || '<p class="empty small">No recruiter questions yet.</p>'}
            </div>
          </section>
          <section class="prep-card prep-card-feedback">
            <div class="section-heading">
              <div>
                <div class="panel-kicker">Signal</div>
                <h3>Feedback From Hiring Team</h3>
                <p class="section-help">Log signal from recruiters, interviewers, and your own post-interview notes.</p>
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
              <textarea name="body" rows="3" placeholder="Write down feedback, concerns, strengths, or next signals from the hiring process"></textarea>
              <button type="submit">Add Feedback</button>
            </form>
            <div class="stack-list">
              ${feedbackEntries.map((item) => `
                <article class="stack-item">
                  <div class="item-meta">
                    <span class="tag">${escapeHtml(feedbackSourceLabels[item.source_type] || item.source_type)}</span>
                    <span>${formatDateTime(item.created_at)}</span>
                  </div>
                  <p>${escapeHtml(item.body)}</p>
                  <div class="row-actions">
                    <button class="secondary" type="button" data-feedback-delete="${item.id}">Delete</button>
                  </div>
                </article>
              `).join('') || '<p class="empty small">No feedback recorded.</p>'}
            </div>
          </section>
            </div>
          </div>
          <aside class="prep-sidebar">
            <section class="prep-card prep-card-todo">
            <div class="section-heading">
              <div>
                <div class="panel-kicker">Act</div>
                <h3>Next Steps</h3>
                <p class="section-help">Keep tasks visible so follow-ups do not disappear between applications.</p>
              </div>
            </div>
            <div class="signal-stack">
              <div class="signal-card">
                <span class="signal-label">Open tasks</span>
                <strong>${activeTodos.length}</strong>
              </div>
              <div class="signal-card">
                <span class="signal-label">Next due</span>
                <strong>${nextTodo?.due_date ? formatDate(nextTodo.due_date) : 'None'}</strong>
              </div>
            </div>
            <form class="todo-form" data-todo-form="${application.id}">
              <textarea name="body" rows="2" placeholder="Research the team, prepare story on incident response, send follow-up note"></textarea>
              <label>
                <span>Due Date</span>
                <input name="due_date" type="text" inputmode="numeric" autocomplete="off" placeholder="DD-MM-YYYY" data-date-input>
              </label>
              <button type="submit">Add To-do</button>
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
                  <div class="row-actions">
                    <button class="secondary" type="button" data-todo-edit="${item.id}">Edit</button>
                    <button class="secondary" type="button" data-todo-delete="${item.id}">Delete</button>
                  </div>
                </article>
              `).join('') || '<p class="empty small">No to-dos yet.</p>'}
            </div>
          </section>
          </aside>
        </div>
      </section>
      <section class="detail-section">
        <div class="panel-kicker">Journal</div>
        <h3>Notes</h3>
        <div class="notes-list">
          ${application.notes ? `<div class="note-item">${escapeHtml(application.notes)}</div>` : ''}
          ${notes.length ? notes.map((note) => `<div class="note-item">${escapeHtml(note.body)}</div>`).join('') : application.notes ? '' : '<p>No notes.</p>'}
        </div>
        <form class="note-form" data-note-form="${application.id}">
          <textarea name="body" rows="3" placeholder="Add note"></textarea>
          <button type="submit">Add Note</button>
        </form>
      </section>
      <section class="detail-section">
        <div class="panel-kicker">Timeline</div>
        <h3>Activity</h3>
        <div class="history-list">
          ${activity.map((item) => `<div class="history-item">${escapeHtml(formatAction(item.action))}<br><small>${escapeHtml(item.details || '')} · ${formatDateTime(item.created_at)}</small></div>`).join('') || renderInlineEmpty('No activity yet', 'Actions on this application will appear here.')}
        </div>
      </section>
    </div>
    <aside>
      <section class="detail-section details-hero">
        <div class="panel-kicker">Focus</div>
        <h3>${escapeHtml(application.role_title || statusLabels[application.status])}</h3>
        <p class="detail-hero-company">${escapeHtml(application.company_name)}</p>
        <p class="section-help">${application.archived_at ? 'This application is archived.' : 'This application is active and ready for follow-up work.'}</p>
        <div class="detail-highlight-row">
          <span class="state ${application.archived_at ? 'archived-state' : 'active-state'}">${application.archived_at ? 'Archived' : 'Active'}</span>
          <span class="detail-mini">${application.interview_date ? `Interview ${formatDate(application.interview_date)}` : 'No interview booked'}</span>
        </div>
      </section>
      <section class="detail-section">
        <h3>Details</h3>
        <form class="detail-edit-form" data-detail-edit-form="${application.id}">
          <label>
            <span>Company Name</span>
            <input name="company_name" value="${escapeAttribute(application.company_name)}" required>
          </label>
          <label>
            <span>Role</span>
            <input name="role_title" value="${escapeAttribute(application.role_title || '')}" placeholder="Frontend Developer">
          </label>
          <label>
            <span>Status</span>
            <select name="status">
              ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${application.status === value ? 'selected' : ''}>${escapeHtml(label)}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>Applied Date</span>
            <input name="applied_date" type="date" value="${escapeAttribute(application.applied_date || '')}">
          </label>
          <label>
            <span>Interview Date</span>
            <input name="interview_date" type="date" value="${escapeAttribute(application.interview_date || '')}">
          </label>
          <label>
            <span>Salary</span>
            <input name="salary" value="${escapeAttribute(application.salary || '')}" placeholder="$120k, 18 LPA">
          </label>
          <label>
            <span>Location</span>
            <input name="location" value="${escapeAttribute(application.location || '')}" placeholder="Remote, Bengaluru">
          </label>
          <label>
            <span>Recruiter</span>
            <input name="recruiter" value="${escapeAttribute(application.recruiter || '')}" placeholder="Recruiter name or email">
          </label>
          <label>
            <span>Contact</span>
            <input name="contact_person" value="${escapeAttribute(application.contact_person || '')}" placeholder="Hiring manager">
          </label>
          <label class="wide">
            <span>Job Link</span>
            <input name="job_link" type="url" value="${escapeAttribute(application.job_link || '')}" placeholder="https://company.com/job">
          </label>
          <div class="detail-edit-meta wide">
            <p>State: ${application.archived_at ? 'Archived' : 'Active'}</p>
            <p>Tags: ${tags.length ? tags.map(escapeHtml).join(', ') : 'None'}</p>
          </div>
          <div class="inline-actions wide">
            <button type="submit">Save Details</button>
            <button class="danger" type="button" data-delete-id="${application.id}">Delete Application</button>
          </div>
        </form>
      </section>
      <section class="detail-section">
        <div class="panel-kicker">Documents</div>
        <h3>CV Used</h3>
        ${cvs.map((cv) => `
          <div class="cv-item">
            <strong>${escapeHtml(cv.original_name)}</strong>
            <p>${escapeHtml(cv.version_label || 'Unlabeled')}</p>
            <a href="/api/cv/${cv.id}/download">Download</a>
          </div>
        `).join('') || renderInlineEmpty('No CV linked', 'Upload or select a CV to preserve the version used for this role.')}
      </section>
      <section class="detail-section">
        <div class="panel-kicker">Changes</div>
        <h3>Status History</h3>
        <div class="history-list">
          ${history.map((item) => `<div class="history-item">${item.from_status ? statusLabels[item.from_status] : 'Created'} to ${statusLabels[item.to_status]}<br><small>${formatDateTime(item.changed_at)}</small></div>`).join('') || renderInlineEmpty('No status changes yet', 'The first status transition will appear here.')}
        </div>
      </section>
      <section class="detail-section">
        <div class="panel-kicker">Protection</div>
        <h3>Audit</h3>
        <div class="history-list">
          ${auditEvents.map((item) => `<div class="history-item">${escapeHtml(formatAction(item.action))}<br><small>${escapeHtml(item.details || '')} · ${escapeHtml(item.actor_ip || 'local')} · ${formatDateTime(item.created_at)}</small></div>`).join('') || renderInlineEmpty('No audit events', 'Destructive or protected actions will appear here.')}
        </div>
      </section>
      <section class="detail-section">
        <div class="panel-kicker">Assistant</div>
        <h3>AI</h3>
        <div class="ai-actions">
          <button type="button" data-ai="cv" data-app-id="${application.id}" data-cv-id="${primaryCv?.id || ''}">Tailor CV</button>
          <button class="secondary" type="button" data-ai="letter" data-app-id="${application.id}" data-cv-id="${primaryCv?.id || ''}">Cover Letter</button>
          <button class="secondary" type="button" data-ai="fit" data-app-id="${application.id}" data-cv-id="${primaryCv?.id || ''}">Role Fit</button>
          <button class="secondary" type="button" data-ai="ats" data-app-id="${application.id}" data-cv-id="${primaryCv?.id || ''}">ATS Check</button>
          <button class="secondary" type="button" data-ai="followup" data-app-id="${application.id}" data-cv-id="${primaryCv?.id || ''}">Follow-up</button>
        </div>
        <textarea class="ai-output" readonly placeholder="Generated text"></textarea>
        <div class="doc-list">
          ${docs.map((doc) => `
            <div class="doc-item">
              <a href="/api/ai/documents/${doc.id}/download">${escapeHtml(doc.title)}</a>
              <span>${escapeHtml(formatAction(doc.document_type))} · ${escapeHtml(doc.provider_name || 'unknown provider')} · ${escapeHtml(doc.model_name || 'unknown model')}</span>
              <span>${escapeHtml(doc.source_context || 'No source context stored')}</span>
              <span>${escapeHtml(doc.prompt_excerpt || 'No prompt excerpt stored')}</span>
            </div>
          `).join('') || renderInlineEmpty('No generated documents', 'Run one of the AI actions above to save output for this application.')}
        </div>
      </section>
    </aside>
  `;
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
