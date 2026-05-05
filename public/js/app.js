import { els } from './dom.js';
import { state, statusLabels, statusOptions } from './state.js';
import { api, debounce, localToday, renderDateInput, setError } from './utils.js';
import {
  buildDetailContent,
  renderActivity,
  renderApplicationCVSelect,
  renderApplications,
  renderCVs,
  renderCalendar,
  renderKanban,
  renderNotifications,
  renderReports,
  renderSavedFilters
} from './render.js';

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
  els.savedFilterSelect.value = '';
  loadApplications();
}, 250));

els.statusFilter.addEventListener('change', () => {
  state.filters.status = els.statusFilter.value;
  els.savedFilterSelect.value = '';
  loadApplications();
});

els.tagFilter.addEventListener('input', debounce(() => {
  state.filters.tag = els.tagFilter.value.trim();
  els.savedFilterSelect.value = '';
  loadApplications();
}, 250));

els.archiveFilter.addEventListener('change', () => {
  state.filters.archived = els.archiveFilter.value;
  els.savedFilterSelect.value = '';
  loadApplications();
});

els.savedFilterSelect.addEventListener('change', async () => {
  const id = Number(els.savedFilterSelect.value);
  const savedFilter = state.savedFilters.find((item) => item.id === id);
  if (!savedFilter) return;
  applySavedFilter(savedFilter);
  await loadApplications();
});

els.saveFilterButton.addEventListener('click', saveCurrentFilter);
els.deleteFilterButton.addEventListener('click', deleteCurrentSavedFilter);

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

els.applicationForm.addEventListener('submit', submitApplicationForm);
els.cvForm.addEventListener('submit', submitCvForm);

els.table.addEventListener('change', updateInlineStatus);
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
  if (view === 'kanban') renderKanban(els, state.applications, statusLabels);
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
  renderApplications(els, state, statusOptions);
  if (state.view === 'kanban') renderKanban(els, state.applications, statusLabels);
}

async function loadCVs() {
  const payload = await api('/api/cv');
  state.cvs = payload.cvs;
  renderCVs(els, state.cvs);
  renderApplicationCVSelect(els, state.cvs);
  bindCvActions();
}

async function loadSavedFilters() {
  const payload = await api('/api/saved-filters');
  state.savedFilters = payload.filters;
  renderSavedFilters(els, state.savedFilters);
}

async function loadReminders() {
  const payload = await api('/api/reminders');
  renderCalendar(els, state.calendarDate, payload.reminders);
}

async function loadNotifications() {
  const payload = await api('/api/notifications');
  state.notifications = payload.notifications;
  renderNotifications(els, state.notifications);
  bindNotificationActions();
}

async function loadReports() {
  const payload = await api('/api/reports');
  renderReports(els, payload, statusLabels);
}

async function loadActivity() {
  const params = new URLSearchParams({
    page: String(state.activity.page),
    limit: String(state.activity.limit)
  });
  if (state.activity.search) params.set('search', state.activity.search);

  const payload = await api(`/api/activity?${params.toString()}`);
  renderActivity(els, state, payload);
}

async function submitApplicationForm(event) {
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
    await Promise.all([loadApplications(), loadCVs(), loadReminders(), loadNotifications()]);
  } catch (error) {
    setError(els.applicationError, error.message);
  }
}

async function submitCvForm(event) {
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
}

async function updateInlineStatus(event) {
  const row = event.target.closest('tr[data-id]');
  if (!row || !event.target.matches('[data-field]')) return;

  const application = state.applications.find((item) => String(item.id) === row.dataset.id);
  if (!application) return;

  const status = row.querySelector('[data-field="status"]').value;
  const interviewDate = row.querySelector('[data-field="interview_date"]')?.value || '';

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
}

function bindCvActions() {
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

function bindNotificationActions() {
  els.notificationsPanel.querySelectorAll('[data-notification-detail]').forEach((button) => {
    button.addEventListener('click', () => openDetail(Number(button.dataset.notificationDetail)));
  });
}

async function openApplicationDialog() {
  await loadCVs();
  els.applicationForm.reset();
  els.applicationForm.elements.applied_date.value = localToday();
  renderApplicationCVSelect(els, state.cvs);
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
  const { application, cvs, status_history: history, notes, tags, activity, ai_documents: docs, audit_events: auditEvents } = payload;
  els.detailTitle.textContent = application.company_name;
  els.detailContent.innerHTML = buildDetailContent({
    application,
    cvs,
    history,
    notes,
    tags,
    activity,
    docs,
    auditEvents,
    statusLabels
  });

  els.detailContent.querySelector('[data-note-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = event.target.elements.body.value.trim();
    if (!body) return;
    await api(`/api/applications/${application.id}/notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body })
    });
    await loadNotifications();
    await openDetail(application.id);
  });

  els.detailContent.querySelectorAll('[data-ai]').forEach((button) => {
    button.addEventListener('click', () => runAI(button, application));
  });

  els.detailContent.querySelector('[data-delete-id]').addEventListener('click', async (event) => {
    if (!confirm('Delete this application permanently? This cannot be undone.')) return;
    await api(`/api/applications/${event.target.dataset.deleteId}`, { method: 'DELETE' });
    els.detailDialog.close();
    await Promise.all([loadApplications(), loadReminders(), loadNotifications()]);
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
    ats: '/api/ai/ats-check',
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
    await loadNotifications();
    await openDetail(application.id);
  } catch (error) {
    output.value = error.message;
  }
}

async function archiveApplication(id) {
  await api(`/api/applications/${id}/archive`, { method: 'POST' });
  await Promise.all([loadApplications(), loadReminders(), loadNotifications()]);
}

async function restoreApplication(id) {
  await api(`/api/applications/${id}/restore`, { method: 'POST' });
  await Promise.all([loadApplications(), loadReminders(), loadNotifications()]);
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

async function saveCurrentFilter() {
  const name = els.savedFilterName.value.trim();
  if (!name) {
    alert('Enter a filter name first.');
    return;
  }

  const payload = await api('/api/saved-filters', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, ...state.filters })
  });
  els.savedFilterName.value = '';
  await loadSavedFilters();
  els.savedFilterSelect.value = String(payload.filter.id);
}

async function deleteCurrentSavedFilter() {
  const id = Number(els.savedFilterSelect.value);
  if (!id) {
    alert('Select a saved filter first.');
    return;
  }
  if (!confirm('Delete this saved filter?')) return;

  await api(`/api/saved-filters/${id}`, { method: 'DELETE' });
  els.savedFilterSelect.value = '';
  await loadSavedFilters();
}

function applySavedFilter(savedFilter) {
  state.filters.search = savedFilter.search || '';
  state.filters.status = savedFilter.status || '';
  state.filters.tag = savedFilter.tag || '';
  state.filters.archived = savedFilter.archived || 'false';
  els.search.value = state.filters.search;
  els.statusFilter.value = state.filters.status;
  els.tagFilter.value = state.filters.tag;
  els.archiveFilter.value = state.filters.archived;
  els.savedFilterName.value = savedFilter.name || '';
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

Promise.all([loadApplications(), loadCVs(), loadSavedFilters(), loadReminders(), loadNotifications()]).catch((error) => {
  els.summary.textContent = error.message;
});
