const state = {
  applications: [],
  cvs: [],
  view: 'list',
  filters: {
    search: '',
    status: '',
    tag: '',
    archived: 'false'
  },
  calendarDate: new Date(),
  activity: {
    search: '',
    page: 1,
    limit: 12,
    total: 0
  }
};

const statusLabels = {
  applied: 'Applied',
  interview_scheduled: 'Interview Scheduled',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted'
};

const statusOptions = Object.entries(statusLabels)
  .map(([value, label]) => `<option value="${value}">${label}</option>`)
  .join('');

const els = {
  summary: document.querySelector('#summary'),
  table: document.querySelector('#applicationsTable'),
  empty: document.querySelector('#emptyState'),
  search: document.querySelector('#searchInput'),
  statusFilter: document.querySelector('#statusFilter'),
  tagFilter: document.querySelector('#tagFilter'),
  archiveFilter: document.querySelector('#archiveFilter'),
  listView: document.querySelector('#listView'),
  remindersView: document.querySelector('#remindersView'),
  kanbanView: document.querySelector('#kanbanView'),
  reportsView: document.querySelector('#reportsView'),
  activityView: document.querySelector('#activityView'),
  remindersList: document.querySelector('#remindersList'),
  kanbanBoard: document.querySelector('#kanbanBoard'),
  reportsContent: document.querySelector('#reportsContent'),
  activitySearch: document.querySelector('#activitySearchInput'),
  activityTable: document.querySelector('#activityTable'),
  activityEmpty: document.querySelector('#activityEmptyState'),
  activityPagination: document.querySelector('#activityPagination'),
  applicationDialog: document.querySelector('#applicationDialog'),
  applicationForm: document.querySelector('#applicationForm'),
  applicationError: document.querySelector('#applicationError'),
  applicationCvSelect: document.querySelector('#applicationCvSelect'),
  detailDialog: document.querySelector('#detailDialog'),
  detailTitle: document.querySelector('#detailTitle'),
  detailContent: document.querySelector('#detailContent'),
  cvDialog: document.querySelector('#cvDialog'),
  cvForm: document.querySelector('#cvForm'),
  cvError: document.querySelector('#cvError'),
  cvList: document.querySelector('#cvList'),
  importCsvInput: document.querySelector('#importCsvInput')
};

document.querySelector('#newApplicationButton').addEventListener('click', openApplicationDialog);
document.querySelector('#cvManagerButton').addEventListener('click', openCVDialog);
document.querySelector('#exportCsvButton').addEventListener('click', () => {
  window.location.href = '/api/export/applications.csv';
});
document.querySelector('#importCsvButton').addEventListener('click', () => els.importCsvInput.click());
els.importCsvInput.addEventListener('change', importCsv);

document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => switchView(button.dataset.view));
});

els.search.addEventListener('input', debounce(() => {
  state.filters.search = els.search.value.trim();
  loadApplications();
}, 250));

els.statusFilter.addEventListener('change', () => {
  state.filters.status = els.statusFilter.value;
  loadApplications();
});

els.tagFilter.addEventListener('input', debounce(() => {
  state.filters.tag = els.tagFilter.value.trim();
  loadApplications();
}, 250));

els.archiveFilter.addEventListener('change', () => {
  state.filters.archived = els.archiveFilter.value;
  loadApplications();
});

els.activitySearch.addEventListener('input', debounce(() => {
  state.activity.search = els.activitySearch.value.trim();
  state.activity.page = 1;
  loadActivity();
}, 250));

els.activityPagination.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-activity-page]');
  if (!button) return;
  state.activity.page = Number(button.dataset.activityPage);
  await loadActivity();
});

els.applicationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError(els.applicationError, '');

  const formData = new FormData(els.applicationForm);
  if (!formData.get('job_link') && !formData.get('job_description')) {
    setError(els.applicationError, 'Add a job link or job description.');
    return;
  }

  const status = formData.get('status');
  const interviewDate = formData.get('interview_date');
  if (status === 'interview_scheduled' && !interviewDate) {
    setError(els.applicationError, 'Interview date is required when status is Interview Scheduled.');
    return;
  }
  if (status !== 'interview_scheduled' && interviewDate) {
    setError(els.applicationError, 'Use Interview Scheduled status before adding an interview date.');
    return;
  }

  const file = formData.get('cv');
  if (!file?.size) formData.delete('cv');
  if (!formData.get('cv_id')) formData.delete('cv_id');

  try {
    await api('/api/applications', { method: 'POST', body: formData });
    els.applicationDialog.close();
    els.applicationForm.reset();
    await Promise.all([loadApplications(), loadCVs(), loadReminders()]);
  } catch (error) {
    setError(els.applicationError, error.message);
  }
});

els.cvForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setError(els.cvError, '');

  const formData = new FormData(els.cvForm);
  formData.set('is_latest', els.cvForm.elements.is_latest.checked ? 'true' : 'false');

  try {
    await api('/api/cv', { method: 'POST', body: formData });
    els.cvForm.reset();
    els.cvForm.elements.is_latest.checked = true;
    await loadCVs();
  } catch (error) {
    setError(els.cvError, error.message);
  }
});

els.table.addEventListener('change', async (event) => {
  const row = event.target.closest('tr[data-id]');
  if (!row || !event.target.matches('[data-field]')) return;

  const application = state.applications.find((item) => String(item.id) === row.dataset.id);
  if (!application) return;

  const status = row.querySelector('[data-field="status"]').value;
  let interviewDate = row.querySelector('[data-field="interview_date"]')?.value || '';

  if (event.target.dataset.field === 'status' && status === 'interview_scheduled' && !row.querySelector('[data-field="interview_date"]')) {
    row.querySelector('[data-interview-cell]').innerHTML = renderDateInput(application);
    row.querySelector('[data-field="interview_date"]').focus();
    return;
  }

  if (status === 'interview_scheduled' && !interviewDate) {
    alert('Set an interview date before saving Interview Scheduled.');
    await loadApplications();
    return;
  }

  try {
    await api(`/api/applications/${application.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status,
        interview_date: status === 'interview_scheduled' ? interviewDate : null
      })
    });
    await Promise.all([loadApplications(), loadReminders()]);
  } catch (error) {
    alert(error.message);
    await loadApplications();
  }
});

els.table.addEventListener('click', async (event) => {
  const openButton = event.target.closest('[data-detail-id]');
  const archiveButton = event.target.closest('[data-archive-row-id]');
  const restoreButton = event.target.closest('[data-restore-row-id]');

  if (openButton) await openDetail(Number(openButton.dataset.detailId));
  if (archiveButton) await archiveApplication(Number(archiveButton.dataset.archiveRowId));
  if (restoreButton) await restoreApplication(Number(restoreButton.dataset.restoreRowId));
});

els.remindersList.addEventListener('click', async (event) => {
  const action = event.target.closest('[data-calendar-action]');
  const detail = event.target.closest('[data-calendar-detail]');

  if (action) {
    shiftCalendar(action.dataset.calendarAction);
    await loadReminders();
  }

  if (detail) await openDetail(Number(detail.dataset.calendarDetail));
});

async function switchView(view) {
  state.view = view;
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === view);
  });

  els.listView.hidden = view !== 'list';
  els.remindersView.hidden = view !== 'reminders';
  els.kanbanView.hidden = view !== 'kanban';
  els.reportsView.hidden = view !== 'reports';
  els.activityView.hidden = view !== 'activity';

  if (view === 'reminders') await loadReminders();
  if (view === 'kanban') renderKanban();
  if (view === 'reports') await loadReports();
  if (view === 'activity') await loadActivity();
}

async function loadApplications() {
  const params = new URLSearchParams();
  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.tag) params.set('tag', state.filters.tag);
  params.set('archived', state.filters.archived);

  const payload = await api(`/api/applications?${params.toString()}`);
  state.applications = payload.applications;
  renderApplications();
  if (state.view === 'kanban') renderKanban();
}

async function loadCVs() {
  const payload = await api('/api/cv');
  state.cvs = payload.cvs;
  renderCVs();
  renderApplicationCVSelect();
}

async function loadReminders() {
  const payload = await api('/api/reminders');
  renderCalendar(payload.reminders);
}

async function loadReports() {
  const report = await api('/api/reports');
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

async function loadActivity() {
  const params = new URLSearchParams({
    page: String(state.activity.page),
    limit: String(state.activity.limit)
  });
  if (state.activity.search) params.set('search', state.activity.search);

  const payload = await api(`/api/activity?${params.toString()}`);
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
  renderActivityPagination();
}

function renderApplications() {
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

function renderKanban() {
  const groups = Object.keys(statusLabels).map((status) => ({
    status,
    items: state.applications.filter((application) => application.status === status && !application.archived_at)
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

function renderApplicationCVSelect() {
  const latest = state.cvs.find((cv) => cv.is_latest);
  els.applicationCvSelect.innerHTML = [
    '<option value="">Use latest CV</option>',
    ...state.cvs.map((cv) => `<option value="${cv.id}">${escapeHtml(cv.original_name)}${cv.version_label ? `, ${escapeHtml(cv.version_label)}` : ''}${cv.is_latest ? ' (latest)' : ''}</option>`)
  ].join('');
  if (latest) els.applicationCvSelect.value = latest.id;
}

function renderCVs() {
  els.cvList.innerHTML = state.cvs.map((cv) => `
    <div class="cv-item">
      <strong>${escapeHtml(cv.original_name)}</strong>
      ${cv.is_latest ? '<span class="tag">Latest</span>' : ''}
      <p>${escapeHtml(cv.version_label || 'Unlabeled')} · ${formatBytes(Number(cv.file_size))} · ${Number(cv.extracted_text_length || 0)} chars parsed</p>
      <a href="/api/cv/${cv.id}/download">Download</a>
      <button class="secondary" type="button" data-delete-cv-id="${cv.id}">Delete</button>
    </div>
  `).join('') || '<p class="empty">No CVs uploaded.</p>';

  els.cvList.querySelectorAll('[data-delete-cv-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this CV? Linked historical CVs cannot be deleted.')) return;
      try {
        await api(`/api/cv/${button.dataset.deleteCvId}`, { method: 'DELETE' });
        await loadCVs();
      } catch (error) {
        setError(els.cvError, error.message);
      }
    });
  });
}

async function openApplicationDialog() {
  await loadCVs();
  els.applicationForm.reset();
  els.applicationForm.elements.applied_date.value = localToday();
  renderApplicationCVSelect();
  setError(els.applicationError, '');
  els.applicationDialog.showModal();
}

async function openCVDialog() {
  await loadCVs();
  setError(els.cvError, '');
  els.cvDialog.showModal();
}

async function openDetail(id) {
  const payload = await api(`/api/applications/${id}`);
  const { application, cvs, status_history: history, notes, tags, activity, ai_documents: docs } = payload;
  const primaryCv = cvs[0];
  els.detailTitle.textContent = application.company_name;
  els.detailContent.innerHTML = `
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
        <h3>AI</h3>
        <div class="ai-actions">
          <button type="button" data-ai="cv" data-app-id="${application.id}" data-cv-id="${primaryCv?.id || ''}">Tailor CV</button>
          <button class="secondary" type="button" data-ai="letter" data-app-id="${application.id}" data-cv-id="${primaryCv?.id || ''}">Cover Letter</button>
          <button class="secondary" type="button" data-ai="fit" data-app-id="${application.id}" data-cv-id="${primaryCv?.id || ''}">Role Fit</button>
          <button class="secondary" type="button" data-ai="followup" data-app-id="${application.id}" data-cv-id="${primaryCv?.id || ''}">Follow-up</button>
        </div>
        <textarea class="ai-output" readonly placeholder="Generated text"></textarea>
        <div class="doc-list">
          ${docs.map((doc) => `<a href="/api/ai/documents/${doc.id}/download">${escapeHtml(doc.title)}</a>`).join('') || '<p>No generated documents.</p>'}
        </div>
      </section>
    </aside>
    <div class="wide split-actions">
      <div></div>
      <div><button class="danger" type="button" data-delete-id="${application.id}">Delete Permanently</button></div>
    </div>
  `;

  els.detailContent.querySelector('[data-note-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = event.target.elements.body.value.trim();
    if (!body) return;
    await api(`/api/applications/${application.id}/notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body })
    });
    await openDetail(application.id);
  });

  els.detailContent.querySelectorAll('[data-ai]').forEach((button) => {
    button.addEventListener('click', () => runAI(button, application));
  });

  els.detailContent.querySelector('[data-delete-id]').addEventListener('click', async (event) => {
    if (!confirm('Delete this application permanently? This cannot be undone.')) return;
    await api(`/api/applications/${event.target.dataset.deleteId}`, { method: 'DELETE' });
    els.detailDialog.close();
    await Promise.all([loadApplications(), loadReminders()]);
  });

  if (!els.detailDialog.open) els.detailDialog.showModal();
}

async function runAI(button, application) {
  const cvId = Number(button.dataset.cvId);
  if (!cvId) {
    alert('No CV is linked to this application.');
    return;
  }

  const endpoints = {
    cv: '/api/ai/generate-cv',
    letter: '/api/ai/generate-cover-letter',
    fit: '/api/ai/role-fit',
    followup: '/api/ai/follow-up-email'
  };

  const output = els.detailContent.querySelector('.ai-output');
  output.value = 'Generating...';

  try {
    const payload = await api(endpoints[button.dataset.ai], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ application_id: application.id, cv_id: cvId })
    });
    output.value = `${payload.content}\n\nDOCX: ${payload.document?.download_url || 'Not saved'}`;
    await openDetail(application.id);
  } catch (error) {
    output.value = error.message;
  }
}

async function archiveApplication(id) {
  await api(`/api/applications/${id}/archive`, { method: 'POST' });
  await Promise.all([loadApplications(), loadReminders()]);
}

async function restoreApplication(id) {
  await api(`/api/applications/${id}/restore`, { method: 'POST' });
  await Promise.all([loadApplications(), loadReminders()]);
}

async function importCsv() {
  const file = els.importCsvInput.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('csv', file);
  try {
    await api('/api/import/applications', { method: 'POST', body: formData });
    await loadApplications();
  } catch (error) {
    alert(error.message);
  } finally {
    els.importCsvInput.value = '';
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || `Request failed with HTTP ${response.status}`);
  return payload;
}

function renderTags(tags = []) {
  if (!tags.length) return '';
  return `<div class="tag-list">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`;
}

function daysClass(value) {
  if (value === null || value === undefined || value === '') return 'days-badge';
  const days = Number(value);
  if (days < 0) return 'days-badge overdue';
  if (days <= 1) return 'days-badge urgent';
  if (days <= 3) return 'days-badge warning';
  if (days <= 7) return 'days-badge soon';
  return 'days-badge';
}

function renderDays(value) {
  const text = formatDays(value);
  if (!text) return '<span class="muted-text">No interview</span>';
  return `<span class="${daysClass(value)}">${text}</span>`;
}

function renderInterviewControl(application) {
  if (application.status !== 'interview_scheduled') {
    return '<span class="muted-text">Not scheduled</span>';
  }
  return renderDateInput(application);
}

function renderDateInput(application) {
  return `<input data-field="interview_date" type="date" value="${application.interview_date || ''}" aria-label="Interview date for ${escapeHtml(application.company_name)}">`;
}

function formatDays(value) {
  if (value === null || value === undefined) return '';
  const days = Number(value);
  if (days === 0) return 'Today';
  if (days < 0) return `${Math.abs(days)} overdue`;
  return `${days} days`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function reportRow(label, value, max) {
  const percent = max ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return `
    <div class="report-row">
      <span>${escapeHtml(label)}</span>
      <div class="report-bar"><i style="width:${percent}%"></i></div>
      <strong>${value}</strong>
    </div>
  `;
}

function maxCount(rows) {
  return Math.max(1, ...rows.map((row) => Number(row.count || 0)));
}

function formatMonthLabel(value) {
  if (!value) return '';
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function activityApplicationName(item) {
  if (item.company_name) return item.company_name;
  const match = String(item.details || '').match(/for (.+)$/);
  if (match) return match[1];
  return item.application_id ? `Application ${item.application_id}` : 'Unknown application';
}

function renderActivityPagination() {
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

function renderCalendar(reminders) {
  const month = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), 1);
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
      today: iso === localToday(),
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

function shiftCalendar(action) {
  const current = state.calendarDate;
  if (action === 'current') {
    state.calendarDate = new Date();
    return;
  }
  const offset = action === 'next' ? 1 : -1;
  state.calendarDate = new Date(current.getFullYear(), current.getMonth() + offset, 1);
}

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthTitle(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function formatAction(action) {
  return String(action || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function setError(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

Promise.all([loadApplications(), loadCVs(), loadReminders()]).catch((error) => {
  els.summary.textContent = error.message;
});
