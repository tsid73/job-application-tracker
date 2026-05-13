import { els } from './dom.js';
import { state, statusLabels, statusOptions } from './state.js';
import { api, attachDateMask, debounce, formatIsoDateForDisplay, localToday, parseDisplayDateToIso, renderDateInput, setError } from './utils.js';
import {
  renderActivity,
  renderApplicationCVSelect,
  renderApplicationPage,
  renderApplications,
  renderCVs,
  renderCalendar,
  renderGeneratedContentPage,
  renderGeneratedDocumentDetail,
  renderJobBoards,
  renderKanban,
  renderNotifications,
  renderReports,
  renderSavedFilters,
  renderToolkit
} from './render.js';

const aiEndpoints = {
  cv: '/api/ai/generate-cv',
  letter: '/api/ai/generate-cover-letter',
  fit: '/api/ai/role-fit',
  ats: '/api/ai/ats-check',
  followup: '/api/ai/follow-up-email'
};

bindGlobalEvents();

Promise.all([loadApplications(), loadCVs(), loadSavedFilters(), loadReminders(), loadNotifications(), loadJobBoards()])
  .then(async () => {
    await loadAppConfig();
    renderToolkit(els);
    await renderCurrentRoute();
  })
  .catch((error) => {
    els.summary.textContent = error.message;
  });

function bindGlobalEvents() {
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
    button.addEventListener('click', () => {
      if (location.pathname !== '/') navigateTo('/');
      switchView(button.dataset.view);
    });
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
  els.applicationEditForm.addEventListener('submit', submitApplicationEditForm);
  els.cvForm.addEventListener('submit', submitCvForm);
  els.jobBoardForm.addEventListener('submit', submitJobBoardForm);
  els.jobBoardResetButton.addEventListener('click', resetJobBoardForm);
  els.jobBoardForm.querySelectorAll('[data-date-input]').forEach(attachDateMask);

  els.table.addEventListener('change', updateInlineStatus);
  els.table.addEventListener('click', async (event) => {
    const openButton = event.target.closest('[data-detail-id]');
    const archiveButton = event.target.closest('[data-archive-row-id]');
    const restoreButton = event.target.closest('[data-restore-row-id]');

    if (openButton) navigateTo(`/applications/${openButton.dataset.detailId}`);
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

    if (detail) navigateTo(`/applications/${detail.dataset.calendarDetail}`);
  });

  els.notificationsPanel.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-toggle-notifications]');
    const detail = event.target.closest('[data-notification-detail]');

    if (toggle) {
      state.notificationsExpanded = !state.notificationsExpanded;
      renderNotifications(els, state.notifications, state.notificationsExpanded);
      bindNotificationActions();
    }

    if (detail) navigateTo(`/applications/${detail.dataset.notificationDetail}`);
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="/applications/"], a[href="/"]');
    if (!link || link.target === '_blank' || event.defaultPrevented) return;
    event.preventDefault();
    navigateTo(link.getAttribute('href'));
  });

  window.addEventListener('popstate', () => {
    renderCurrentRoute().catch((error) => {
      alert(error.message);
    });
  });
}

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
  els.boardsView.hidden = view !== 'boards';
  els.toolkitView.hidden = view !== 'toolkit';

  if (view === 'reminders') await loadReminders();
  if (view === 'kanban') renderKanban(els, state.applications, statusLabels);
  if (view === 'reports') await loadReports();
  if (view === 'activity') await loadActivity();
  if (view === 'boards') await loadJobBoards();
  if (view === 'toolkit') renderToolkit(els);
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

async function loadAppConfig() {
  const payload = await api('/api/health');
  state.appConfig = {
    defaultProvider: payload.ai?.default_provider || 'gemini',
    awsEnabled: Boolean(payload.ai?.aws_enabled)
  };
  state.selectedAIProvider = state.appConfig.defaultProvider === 'aws' && state.appConfig.awsEnabled ? 'aws' : 'gemini';
  if (!state.appConfig.awsEnabled && state.selectedAIProvider === 'aws') {
    state.selectedAIProvider = 'gemini';
  }
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

async function loadJobBoards() {
  const payload = await api('/api/job-boards');
  state.jobBoards = payload.job_boards;
  renderJobBoards(els, state.jobBoards);
  bindJobBoardActions();
}

async function loadReminders() {
  const payload = await api('/api/reminders');
  renderCalendar(els, state.calendarDate, payload.reminders);
}

async function loadNotifications() {
  const payload = await api('/api/notifications');
  state.notifications = payload.notifications;
  renderNotifications(els, state.notifications, state.notificationsExpanded);
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
    const payload = await api('/api/applications', { method: 'POST', body: formData });
    els.applicationDialog.close();
    els.applicationForm.reset();
    await Promise.all([loadApplications(), loadCVs(), loadReminders(), loadNotifications()]);
    navigateTo(`/applications/${payload.application.id}`);
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

async function submitJobBoardForm(event) {
  event.preventDefault();
  setError(els.jobBoardError, '');
  const form = new FormData(els.jobBoardForm);
  const id = form.get('id');
  const payload = {
    name: form.get('name'),
    url: form.get('url'),
    notes: form.get('notes'),
    last_checked_date: parseDisplayDateToIso(form.get('last_checked_date')),
    is_active: els.jobBoardForm.elements.is_active.checked
  };

  try {
    await api(id ? `/api/job-boards/${id}` : '/api/job-boards', {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    resetJobBoardForm();
    await loadJobBoards();
  } catch (error) {
    setError(els.jobBoardError, error.message);
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
    button.addEventListener('click', () => navigateTo(`/applications/${button.dataset.notificationDetail}`));
  });
}

function bindJobBoardActions() {
  els.jobBoardsList.querySelectorAll('[data-job-board-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const board = state.jobBoards.find((item) => item.id === Number(button.dataset.jobBoardEdit));
      if (!board) return;
      els.jobBoardForm.elements.id.value = board.id;
      els.jobBoardForm.elements.name.value = board.name || '';
      els.jobBoardForm.elements.url.value = board.url || '';
      els.jobBoardForm.elements.notes.value = board.notes || '';
      els.jobBoardForm.elements.last_checked_date.value = formatIsoDateForDisplay(board.last_checked_date || '');
      els.jobBoardForm.elements.is_active.checked = Boolean(board.is_active);
      setError(els.jobBoardError, '');
      els.jobBoardForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  els.jobBoardsList.querySelectorAll('[data-job-board-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const board = state.jobBoards.find((item) => item.id === Number(button.dataset.jobBoardToggle));
      if (!board) return;
      button.disabled = true;
      try {
        await api(`/api/job-boards/${board.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...board, is_active: !board.is_active })
        });
        await loadJobBoards();
      } catch (error) {
        setError(els.jobBoardError, error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  els.jobBoardsList.querySelectorAll('[data-job-board-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this job board?')) return;
      button.disabled = true;
      try {
        await api(`/api/job-boards/${button.dataset.jobBoardDelete}`, { method: 'DELETE' });
        state.jobBoards = state.jobBoards.filter((item) => item.id !== Number(button.dataset.jobBoardDelete));
        renderJobBoards(els, state.jobBoards);
        bindJobBoardActions();
      } catch (error) {
        setError(els.jobBoardError, error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function resetJobBoardForm() {
  els.jobBoardForm.reset();
  els.jobBoardForm.elements.id.value = '';
  els.jobBoardForm.elements.is_active.checked = true;
  els.jobBoardForm.elements.last_checked_date.value = '';
  setError(els.jobBoardError, '');
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

async function renderCurrentRoute() {
  state.route = parseRoute(location.pathname, location.search);
  els.appHome.hidden = state.route.page !== 'home';
  els.applicationPage.hidden = state.route.page !== 'application';
  els.contentPage.hidden = state.route.page !== 'content' && state.route.page !== 'document';

  if (state.route.page === 'home') {
    await switchView(state.view);
    return;
  }

  if (state.route.page === 'application') {
    const payload = await api(`/api/applications/${state.route.applicationId}`).catch(() => null);
    if (!payload) {
      els.applicationPageContent.innerHTML = buildRouteErrorState('Application not found', 'This application route no longer points to an available record.');
      return;
    }
    state.currentApplication = payload;
    state.currentApplicationDocuments = payload.ai_documents;
    state.currentApplicationJobs = payload.ai_jobs;
    renderApplicationPage(els, payload, statusLabels, {
      activeTab: state.route.tab,
      selectedProvider: state.selectedAIProvider,
      capabilities: state.appConfig
    });
    bindApplicationPageActions(payload);
    return;
  }

  const application = state.currentApplication?.application?.id === state.route.applicationId
    ? state.currentApplication.application
    : (await api(`/api/applications/${state.route.applicationId}`).catch(() => null))?.application;
  if (!application) {
    els.contentPageContent.innerHTML = buildRouteErrorState('Application not found', 'This content route is linked to an application that is no longer available.');
    return;
  }
  state.currentApplication = {
    ...(state.currentApplication || {}),
    application
  };
  const library = await api(`/api/applications/${state.route.applicationId}/ai-documents`).catch(() => null);
  if (!library) {
    els.contentPageContent.innerHTML = buildRouteErrorState('Content library unavailable', 'Generated content could not be loaded for this application.');
    return;
  }
  state.currentApplicationDocuments = library.documents;
  state.currentApplicationJobs = library.jobs;

  if (state.route.page === 'content') {
    renderGeneratedContentPage(els, application, library.documents, library.jobs, {
      selectedProvider: state.selectedAIProvider,
      capabilities: state.appConfig
    });
    bindContentLibraryActions(application.id);
    return;
  }

  const payload = await api(`/api/ai/documents/${state.route.documentId}`).catch(() => null);
  if (!payload?.document) {
    els.contentPageContent.innerHTML = buildRouteErrorState('Document not found', 'This generated document may have been deleted or moved.');
    return;
  }
  if (Number(payload.document.application_id) !== Number(application.id)) {
    els.contentPageContent.innerHTML = buildRouteErrorState('Document not found', 'This document does not belong to the current application route.');
    return;
  }
  renderGeneratedDocumentDetail(els, application, payload.document, state.appConfig, state.selectedAIProvider);
  bindGeneratedDocumentActions(application.id, payload.document.id);
}

function bindApplicationPageActions(payload) {
  const { application, recruiter_questions: recruiterQuestions, todos, tags } = payload;
  const root = els.applicationPageContent;

  root.querySelectorAll('[data-ai-provider-select]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      state.selectedAIProvider = button.dataset.aiProviderSelect;
      renderCurrentRoute();
    });
  });

  root.querySelector('[data-edit-application]')?.addEventListener('click', () => {
    openApplicationEditDialog(application);
  });
  root.querySelector('[data-archive-application]')?.addEventListener('click', async () => {
    await archiveApplication(application.id);
    await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
  });
  root.querySelector('[data-restore-application]')?.addEventListener('click', async () => {
    await restoreApplication(application.id);
    await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
  });

  root.querySelectorAll('[data-ai]').forEach((button) => {
    button.addEventListener('click', () => runAI(button, application.id));
  });

  root.querySelector('[data-note-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = event.target.elements.body.value.trim();
    if (!body) return;
    await api(`/api/applications/${application.id}/notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body })
    });
    await Promise.all([loadNotifications(), renderCurrentRoute()]);
  });

  root.querySelector('[data-preparation-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    await api(`/api/applications/${application.id}/preparation`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        about_company: form.get('about_company'),
        company_values: form.get('company_values'),
        application_notes: form.get('application_notes')
      })
    });
    await renderCurrentRoute();
  });

  root.querySelector('[data-question-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = event.target.elements.question.value.trim();
    if (!question) return;
    await api(`/api/applications/${application.id}/recruiter-questions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question })
    });
    await renderCurrentRoute();
  });

  root.querySelector('[data-feedback-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = event.target.elements.body.value.trim();
    if (!body) return;
    await api(`/api/applications/${application.id}/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source_type: event.target.elements.source_type.value,
        body
      })
    });
    await renderCurrentRoute();
  });

  root.querySelector('[data-todo-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = event.target.elements.body.value.trim();
    if (!body) return;
    await api(`/api/applications/${application.id}/todos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        body,
        due_date: parseDisplayDateToIso(event.target.elements.due_date.value || '')
      })
    });
    await Promise.all([loadNotifications(), renderCurrentRoute()]);
  });

  root.querySelectorAll('[data-date-input]').forEach(attachDateMask);
  bindPreparationActions(application.id, recruiterQuestions, todos, root);
}

function bindPreparationActions(applicationId, recruiterQuestions, todos, root) {
  root.querySelectorAll('[data-question-edit]').forEach((button) => {
    button.addEventListener('click', async () => {
      const current = recruiterQuestions.find((item) => item.id === Number(button.dataset.questionEdit));
      if (!current) return;
      const next = prompt('Edit recruiter question', current.question);
      if (next === null) return;
      await api(`/api/recruiter-questions/${current.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: next })
      });
      await renderCurrentRoute();
    });
  });

  root.querySelectorAll('[data-question-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/api/recruiter-questions/${button.dataset.questionDelete}`, { method: 'DELETE' });
      await renderCurrentRoute();
    });
  });

  root.querySelectorAll('[data-question-move]').forEach((button) => {
    button.addEventListener('click', async () => {
      const currentIndex = recruiterQuestions.findIndex((item) => item.id === Number(button.dataset.questionMove));
      if (currentIndex === -1) return;
      const swapIndex = currentIndex + (button.dataset.direction === 'up' ? -1 : 1);
      if (swapIndex < 0 || swapIndex >= recruiterQuestions.length) return;
      const current = recruiterQuestions[currentIndex];
      const swapped = recruiterQuestions[swapIndex];
      await Promise.all([
        api(`/api/recruiter-questions/${current.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sort_order: swapped.sort_order, question: current.question })
        }),
        api(`/api/recruiter-questions/${swapped.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sort_order: current.sort_order, question: swapped.question })
        })
      ]);
      await renderCurrentRoute();
    });
  });

  root.querySelectorAll('[data-feedback-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/api/feedback/${button.dataset.feedbackDelete}`, { method: 'DELETE' });
      await renderCurrentRoute();
    });
  });

  root.querySelectorAll('[data-todo-toggle]').forEach((input) => {
    input.addEventListener('change', async () => {
      const todo = todos.find((item) => item.id === Number(input.dataset.todoToggle));
      if (!todo) return;
      await api(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: todo.body, due_date: todo.due_date, completed: input.checked })
      });
      await Promise.all([loadNotifications(), renderCurrentRoute()]);
    });
  });

  root.querySelectorAll('[data-todo-edit]').forEach((button) => {
    button.addEventListener('click', async () => {
      const todo = todos.find((item) => item.id === Number(button.dataset.todoEdit));
      if (!todo) return;
      const next = prompt('Edit to-do', todo.body);
      if (next === null) return;
      await api(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: next, due_date: todo.due_date, completed: todo.completed })
      });
      await renderCurrentRoute();
    });
  });

  root.querySelectorAll('[data-todo-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await api(`/api/todos/${button.dataset.todoDelete}`, { method: 'DELETE' });
      await Promise.all([loadNotifications(), renderCurrentRoute()]);
    });
  });
}

function bindContentLibraryActions(applicationId) {
  els.contentPageContent.querySelectorAll('[data-library-provider-select]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      state.selectedAIProvider = button.dataset.libraryProviderSelect;
      renderCurrentRoute();
    });
  });

  els.contentPageContent.querySelectorAll('[data-regenerate-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      const provider = state.selectedAIProvider === 'aws' && state.appConfig.awsEnabled ? 'aws' : 'gemini';
      const payload = await api(`/api/ai/documents/${button.dataset.regenerateCard}/regenerate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      if (payload.document?.id) {
        navigateTo(`/applications/${applicationId}/content/${payload.document.id}`);
        return;
      }
      navigateTo(`/applications/${applicationId}/content`);
    });
  });

  els.contentPageContent.querySelectorAll('[data-delete-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirm('Delete this generated document?')) return;
      await api(`/api/ai/documents/${button.dataset.deleteCard}`, { method: 'DELETE' });
      await renderCurrentRoute();
    });
  });

  const pendingJobs = els.contentPageContent.querySelectorAll('.queue-card');
  if (!pendingJobs.length) return;
  const shouldPoll = state.currentApplicationJobs.some((item) => item.status !== 'completed' && item.status !== 'failed');
  if (!shouldPoll) return;
  window.clearTimeout(bindContentLibraryActions.timerId);
  bindContentLibraryActions.timerId = window.setTimeout(async () => {
    if (location.pathname !== `/applications/${applicationId}/content`) return;
    const pendingJobIds = state.currentApplicationJobs
      .filter((item) => item.status !== 'completed' && item.status !== 'failed')
      .map((item) => item.id);
    await Promise.all(pendingJobIds.map((jobId) => api(`/api/ai/jobs/${jobId}`).catch(() => null)));
    const refreshed = await api(`/api/applications/${applicationId}/ai-documents`);
    state.currentApplicationDocuments = refreshed.documents;
    state.currentApplicationJobs = refreshed.jobs;
    renderGeneratedContentPage(els, state.currentApplication.application || { id: applicationId, company_name: 'Application' }, refreshed.documents, refreshed.jobs, {
      selectedProvider: state.selectedAIProvider,
      capabilities: state.appConfig
    });
    bindContentLibraryActions(applicationId);
  }, 5000);
}

async function runAI(button, applicationId) {
  const cvId = Number(button.dataset.cvId);
  if (!cvId) {
    alert('No CV is linked to this application.');
    return;
  }

  try {
    const payload = await api(aiEndpoints[button.dataset.ai], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        application_id: applicationId,
        cv_id: cvId,
        provider: state.selectedAIProvider
      })
    });
    await loadNotifications();
    if (payload.document?.id) {
      navigateTo(`/applications/${applicationId}/content/${payload.document.id}`);
      return;
    }
  } catch (error) {
    if (error.message.includes('HTTP 202')) {
      return;
    }
    alert(error.message);
    return;
  }

  alert('The request was queued for AWS generation. Open the generated content page to watch job status.');
  navigateTo(`/applications/${applicationId}/content`);
}

function bindGeneratedDocumentActions(applicationId, documentId) {
  els.contentPageContent.querySelectorAll('[data-regenerate-provider]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      els.contentPageContent.querySelectorAll('[data-regenerate-provider]').forEach((item) => {
        item.classList.toggle('is-active', item === button);
        item.classList.toggle('secondary', item !== button);
      });
      els.contentPageContent.dataset.regenerateProvider = button.dataset.regenerateProvider;
    });
  });
  els.contentPageContent.dataset.regenerateProvider = 'gemini';

  els.contentPageContent.querySelector('[data-regenerate-document]')?.addEventListener('click', async () => {
    const provider = els.contentPageContent.dataset.regenerateProvider || 'gemini';
    const payload = await api(`/api/ai/documents/${documentId}/regenerate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider })
    });
    if (payload.document?.id) {
      navigateTo(`/applications/${applicationId}/content/${payload.document.id}`);
      return;
    }
    alert('The document was queued for AWS regeneration.');
    navigateTo(`/applications/${applicationId}/content`);
  });

  els.contentPageContent.querySelector('[data-delete-document]')?.addEventListener('click', async () => {
    if (!confirm('Delete this generated document?')) return;
    await api(`/api/ai/documents/${documentId}`, { method: 'DELETE' });
    navigateTo(`/applications/${applicationId}/content`);
  });

  els.contentPageContent.querySelector('[data-copy-document]')?.addEventListener('click', async () => {
    const content = state.currentApplicationDocuments.find((item) => item.id === Number(documentId))?.content || '';
    if (!content) return;
    await navigator.clipboard.writeText(content).catch(() => null);
  });
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

function navigateTo(path) {
  window.history.pushState({}, '', path);
  renderCurrentRoute().catch((error) => {
    alert(error.message);
  });
}

function parseRoute(pathname, search) {
  const searchParams = new URLSearchParams(search || '');
  const contentMatch = pathname.match(/^\/applications\/(\d+)\/content\/(\d+)$/);
  if (contentMatch) {
    return {
      path: pathname,
      page: 'document',
      applicationId: Number(contentMatch[1]),
      documentId: Number(contentMatch[2]),
      tab: 'content'
    };
  }

  const libraryMatch = pathname.match(/^\/applications\/(\d+)\/content$/);
  if (libraryMatch) {
    return {
      path: pathname,
      page: 'content',
      applicationId: Number(libraryMatch[1]),
      documentId: null,
      tab: 'content'
    };
  }

  const appMatch = pathname.match(/^\/applications\/(\d+)$/);
  if (appMatch) {
    const requestedTab = searchParams.get('tab') || 'overview';
    return {
      path: pathname,
      page: 'application',
      applicationId: Number(appMatch[1]),
      documentId: null,
      tab: ['overview', 'workflow', 'content', 'history'].includes(requestedTab) ? requestedTab : 'overview'
    };
  }

  return {
    path: '/',
    page: 'home',
    applicationId: null,
    documentId: null,
    tab: 'overview'
  };
}

function openApplicationEditDialog(application) {
  els.applicationEditForm.reset();
  setError(els.applicationEditError, '');
  els.applicationEditForm.elements.id.value = application.id;
  els.applicationEditForm.elements.company_name.value = application.company_name || '';
  els.applicationEditForm.elements.role_title.value = application.role_title || '';
  els.applicationEditForm.elements.status.value = application.status || 'applied';
  els.applicationEditForm.elements.salary.value = application.salary || '';
  els.applicationEditForm.elements.location.value = application.location || '';
  els.applicationEditForm.elements.recruiter.value = application.recruiter || '';
  els.applicationEditForm.elements.contact_person.value = application.contact_person || '';
  els.applicationEditForm.elements.applied_date.value = application.applied_date || '';
  els.applicationEditForm.elements.interview_date.value = application.interview_date || '';
  els.applicationEditForm.elements.job_link.value = application.job_link || '';
  els.applicationEditForm.querySelector('[data-archive-action]').hidden = Boolean(application.archived_at);
  els.applicationEditForm.querySelector('[data-restore-action]').hidden = !application.archived_at;

  els.applicationEditForm.querySelector('[data-archive-action]').onclick = async () => {
    await archiveApplication(application.id);
    els.applicationEditDialog.close();
    await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
  };
  els.applicationEditForm.querySelector('[data-restore-action]').onclick = async () => {
    await restoreApplication(application.id);
    els.applicationEditDialog.close();
    await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
  };
  els.applicationEditForm.querySelector('[data-delete-action]').onclick = async () => {
    if (!confirm('Are you sure you want to delete this application?')) return;
    await api(`/api/applications/${application.id}`, { method: 'DELETE' });
    els.applicationEditDialog.close();
    await Promise.all([loadApplications(), loadReminders(), loadNotifications()]);
    navigateTo('/');
  };

  els.applicationEditDialog.showModal();
}

async function submitApplicationEditForm(event) {
  event.preventDefault();
  const current = state.currentApplication?.application;
  if (!current) return;
  setError(els.applicationEditError, '');
  const form = new FormData(els.applicationEditForm);

  try {
    await api(`/api/applications/${form.get('id')}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        company_name: form.get('company_name'),
        role_title: form.get('role_title'),
        status: form.get('status'),
        applied_date: form.get('applied_date'),
        interview_date: form.get('interview_date') || null,
        salary: form.get('salary'),
        location: form.get('location'),
        recruiter: form.get('recruiter'),
        contact_person: form.get('contact_person'),
        job_link: form.get('job_link'),
        job_description: current.job_description,
        notes: current.notes,
        tags: state.currentApplication.tags || []
      })
    });
    els.applicationEditDialog.close();
    await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
  } catch (error) {
    setError(els.applicationEditError, error.message);
  }
}

function buildRouteErrorState(title, body) {
  return `
    <div class="route-page-shell">
      <section class="route-card">
        ${renderErrorBlock(title, body)}
      </section>
    </div>
  `;
}

function renderErrorBlock(title, body) {
  return `
    <div class="empty-inline">
      <strong>${title}</strong>
      <p>${body}</p>
    </div>
  `;
}
