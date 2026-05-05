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
    <section class="report-panel">
      <h3>Status</h3>
      ${report.status_counts.map((row) => reportRow(statusLabels[row.status] || row.status, Number(row.count), maxCount(report.status_counts))).join('') || '<p>No status data.</p>'}
    </section>
    <section class="report-panel">
      <h3>Lifecycle</h3>
      ${[
        { label: 'Active', count: Number(report.lifecycle_counts.active || 0) },
        { label: 'Archived', count: Number(report.lifecycle_counts.archived || 0) }
      ].map((row) => reportRow(row.label, row.count, Number(report.lifecycle_counts.total || 1))).join('')}
    </section>
    <section class="report-panel">
      <h3>Monthly Applications</h3>
      ${report.monthly_counts.map((row) => reportRow(formatMonthLabel(row.month), Number(row.count), maxCount(report.monthly_counts))).join('') || '<p>No monthly data.</p>'}
    </section>
    <section class="report-panel">
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
  renderActivityPagination(els, state);
}

export function renderApplications(els, state, statusOptions) {
  els.table.innerHTML = '';
  els.empty.hidden = state.applications.length !== 0;

  const interviews = state.applications.filter((item) => item.status === 'interview_scheduled').length;
  const archived = state.applications.filter((item) => item.archived_at).length;
  const viewName = state.filters.archived === 'true' ? 'archived' : state.filters.archived === 'all' ? 'total' : 'active';
  els.summary.textContent = `${state.applications.length} ${viewName}, ${interviews} interviews scheduled, ${archived} archived shown`;

  for (const application of state.applications) {
    const row = document.createElement('tr');
    row.dataset.id = application.id;
    row.className = application.archived_at ? 'archived' : '';
    row.innerHTML = `
      <td>
        <div class="company-cell">
          <strong>${escapeHtml(application.company_name)}</strong>
          <span>${escapeHtml([application.location, application.salary, application.recruiter].filter(Boolean).join(' · ') || application.cv_name || 'No CV')}</span>
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

export function renderNotifications(els, notifications) {
  els.notificationsPanel.hidden = notifications.length === 0;
  if (!notifications.length) {
    els.notificationsPanel.innerHTML = '';
    return;
  }

  els.notificationsPanel.innerHTML = `
    <div class="notifications-header">
      <div>
        <strong>Priority reminders</strong>
        <p>${notifications.length} items need attention</p>
      </div>
    </div>
    <div class="notifications-grid">
      ${notifications.map((item) => `
        <article class="notification-card ${item.type === 'follow_up' ? 'follow-up' : 'interview'}">
          <div>
            <strong>${escapeHtml(item.company_name)}</strong>
            <span>${escapeHtml(item.message)}</span>
          </div>
          <div class="notification-meta">
            <span>${item.due_date ? formatDate(item.due_date) : 'No due date'}</span>
            ${item.type === 'interview' ? renderDays(item.days_remaining) : `<span class="days-badge warning">${Number(item.days_remaining)} days since apply</span>`}
            <button class="secondary" type="button" data-notification-detail="${item.id}">Open</button>
          </div>
        </article>
      `).join('')}
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
      <h3>${statusLabels[group.status]} <span>${group.items.length}</span></h3>
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
      <p>${escapeHtml(cv.version_label || 'Unlabeled')} · ${formatBytes(Number(cv.file_size))} · ${Number(cv.extracted_text_length || 0)} chars parsed</p>
      <a href="/api/cv/${cv.id}/download">Download</a>
      <button class="secondary" type="button" data-delete-cv-id="${cv.id}">Delete</button>
    </div>
  `).join('') || '<p class="empty">No CVs uploaded.</p>';
}

export function buildDetailContent({ application, cvs, history, notes, activity, docs, tags, auditEvents, statusLabels }) {
  const primaryCv = cvs[0];
  return `
    <div>
      <section class="detail-section">
        <h3>Job Description</h3>
        <p class="description">${escapeHtml(application.job_description || 'No job description saved.')}</p>
      </section>
      <section class="detail-section">
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
        <h3>Activity</h3>
        <div class="history-list">
          ${activity.map((item) => `<div class="history-item">${escapeHtml(formatAction(item.action))}<br><small>${escapeHtml(item.details || '')} · ${formatDateTime(item.created_at)}</small></div>`).join('') || '<p>No activity.</p>'}
        </div>
      </section>
    </div>
    <aside>
      <section class="detail-section">
        <h3>Details</h3>
        <div class="meta-list">
          <p>Status: ${statusLabels[application.status]}</p>
          <p>State: ${application.archived_at ? 'Archived' : 'Active'}</p>
          <p>Applied: ${formatDate(application.applied_date)}</p>
          <p>Interview: ${application.interview_date ? formatDate(application.interview_date) : 'None'}</p>
          <p>Salary: ${escapeHtml(application.salary || 'None')}</p>
          <p>Location: ${escapeHtml(application.location || 'None')}</p>
          <p>Recruiter: ${escapeHtml(application.recruiter || 'None')}</p>
          <p>Contact: ${escapeHtml(application.contact_person || 'None')}</p>
          <p>Tags: ${tags.length ? tags.map(escapeHtml).join(', ') : 'None'}</p>
          <p>Link: ${application.job_link ? `<a href="${escapeAttribute(application.job_link)}" target="_blank" rel="noreferrer">Open posting</a>` : 'None'}</p>
        </div>
      </section>
      <section class="detail-section">
        <h3>CV Used</h3>
        ${cvs.map((cv) => `
          <div class="cv-item">
            <strong>${escapeHtml(cv.original_name)}</strong>
            <p>${escapeHtml(cv.version_label || 'Unlabeled')} · ${Number(cv.extracted_text_length || 0)} chars parsed</p>
            <a href="/api/cv/${cv.id}/download">Download</a>
          </div>
        `).join('')}
      </section>
      <section class="detail-section">
        <h3>Status History</h3>
        <div class="history-list">
          ${history.map((item) => `<div class="history-item">${item.from_status ? statusLabels[item.from_status] : 'Created'} to ${statusLabels[item.to_status]}<br><small>${formatDateTime(item.changed_at)}</small></div>`).join('')}
        </div>
      </section>
      <section class="detail-section">
        <h3>Audit</h3>
        <div class="history-list">
          ${auditEvents.map((item) => `<div class="history-item">${escapeHtml(formatAction(item.action))}<br><small>${escapeHtml(item.details || '')} · ${escapeHtml(item.actor_ip || 'local')} · ${formatDateTime(item.created_at)}</small></div>`).join('') || '<p>No audit events.</p>'}
        </div>
      </section>
      <section class="detail-section">
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
          `).join('') || '<p>No generated documents.</p>'}
        </div>
      </section>
    </aside>
    <div class="wide split-actions">
      <div></div>
      <div><button class="danger" type="button" data-delete-id="${application.id}">Delete Permanently</button></div>
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
