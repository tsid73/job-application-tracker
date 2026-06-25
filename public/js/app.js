import { bindWorkspaceElements, els } from './dom.js';
import { state, statusLabels, statusOptions, isClosedStatus } from './state.js';
import { api, attachDateMask, debounce, escapeAttribute, escapeHtml, formatDateTime, formatIsoDateForDisplay, localToday, parseDisplayDateToIso, renderDateInput, setError } from './utils.js';
import {
  buildApplicationRow,
  renderActivity,
  renderApplicationCVSelect,
  renderDocumentContent,
  renderApplicationPage,
  renderApplications,
  renderCVs,
  renderCalendar,
  renderHomeWorkspace,
  renderJobBoards,
  renderKanban,
  renderNotifications,
  renderRouteLoadingState,
  renderReports,
  renderStats,
  renderSavedFilters,
  renderTargetCompanies,
  renderTargetCompanyFilters,
  renderToolkit
} from './render.js';

const SIDEBAR_COLLAPSED_KEY = 'jat:sidebar-collapsed';

const aiEndpoints = {
  cv: '/api/ai/generate-cv',
  letter: '/api/ai/generate-cover-letter',
  fit: '/api/ai/role-fit',
  ats: '/api/ai/ats-check',
  followup: '/api/ai/follow-up-email'
};

bindGlobalEvents();

Promise.all([loadApplications(), loadCVs(), loadSavedFilters(), loadReminders(), loadNotifications(), loadJobBoards(), loadTargetCompanies()])
  .then(async () => {
    await loadAppConfig();
    await renderCurrentRoute();
  })
  .catch((error) => {
    els.summary.textContent = error.message;
  });

function initSidebarControls() {
  const layout = document.querySelector('.app-layout');
  const toggle = document.getElementById('sidebarToggle');
  const openButton = document.getElementById('sidebarOpen');
  if (!layout) return;

  if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1') {
    layout.classList.add('is-collapsed');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  toggle?.addEventListener('click', () => {
    const collapsed = layout.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  });

  openButton?.addEventListener('click', () => {
    layout.classList.toggle('sidebar-open');
  });

  document.addEventListener('click', (event) => {
    if (!layout.classList.contains('sidebar-open')) return;
    if (event.target.closest('.sidebar') || event.target.closest('#sidebarOpen')) return;
    layout.classList.remove('sidebar-open');
  });
}

function closeMobileSidebar() {
  document.querySelector('.app-layout')?.classList.remove('sidebar-open');
}

function currentHomeViewTitle(view = state.view) {
  return {
    list: 'Applications',
    reminders: 'Reminders',
    kanban: 'Kanban',
    reports: 'Reports',
    stats: 'Stats',
    activity: 'Activity',
    boards: 'Job Boards',
    companies: 'Company List',
    toolkit: 'Toolkit',
    settings: 'Settings'
  }[view] || 'Applications';
}

function syncContentHeader() {
  const contentHeader = document.querySelector('.content-header');
  if (!contentHeader) return;
  contentHeader.hidden = state.route.page !== 'home';
  const heading = contentHeader.querySelector('h1');
  if (heading && state.route.page === 'home') heading.textContent = currentHomeViewTitle();
}

function bindGlobalEvents() {
  document.querySelector('#newApplicationButton').addEventListener('click', openApplicationDialog);
  document.querySelector('#cvManagerButton').addEventListener('click', openCVDialog);
  els.importCsvInput.addEventListener('change', importCsv);
  els.restoreBackupInput.addEventListener('change', handleRestoreBackupSelection);

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = button.closest('dialog');
      dialog?.close();
      resetDialogState(dialog);
    });
  });

  document.querySelectorAll('.sidebar [data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      if (location.pathname !== '/') navigateTo('/');
      switchView(button.dataset.view);
    });
  });

  initSidebarControls();

  els.search?.addEventListener('input', debounce(() => {
    state.filters.search = els.search.value.trim();
    els.savedFilterSelect.value = '';
    loadApplications();
  }, 250));

  els.statusFilter?.addEventListener('change', () => {
    state.filters.status = els.statusFilter.value;
    els.savedFilterSelect.value = '';
    loadApplications();
  });

  els.tagFilter?.addEventListener('input', debounce(() => {
    state.filters.tag = els.tagFilter.value.trim();
    els.savedFilterSelect.value = '';
    loadApplications();
  }, 250));

  els.archiveFilter?.addEventListener('change', () => {
    state.filters.archived = els.archiveFilter.value;
    els.savedFilterSelect.value = '';
    loadApplications();
  });

  els.savedFilterSelect?.addEventListener('change', async () => {
    const id = Number(els.savedFilterSelect.value);
    const savedFilter = state.savedFilters.find((item) => item.id === id);
    if (!savedFilter) return;
    applySavedFilter(savedFilter);
    await loadApplications();
  });

  els.saveFilterButton?.addEventListener('click', saveCurrentFilter);
  els.deleteFilterButton?.addEventListener('click', deleteCurrentSavedFilter);
  els.quickExportCsvButton?.addEventListener('click', () => {
    downloadApplicationsCsv();
  });

  els.activitySearch?.addEventListener('input', debounce(() => {
    state.activity.search = els.activitySearch.value.trim();
    state.activity.page = 1;
    loadActivity();
  }, 250));

  els.activityPagination?.addEventListener('click', async (event) => {
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
  els.targetCompanyForm.addEventListener('submit', submitTargetCompanyForm);
  els.targetCompanyResetButton.addEventListener('click', resetTargetCompanyForm);
  els.targetCompanyForm.querySelectorAll('[data-date-input]').forEach(attachDateMask);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="/applications/"], a[href="/"]');
    if (!link || link.target === '_blank' || event.defaultPrevented) return;
    event.preventDefault();
    navigateTo(link.getAttribute('href'));
  });

  window.addEventListener('popstate', () => {
    renderCurrentRoute().catch((error) => {
      showToast(error.message, 'error');
    });
  });
}

function bindHomeWorkspaceEvents() {
  els.filterToggle?.addEventListener('click', () => {
    if (els.filterPanel) {
      els.filterPanel.hidden = !els.filterPanel.hidden;
      try { localStorage.setItem('filterPanelOpen', String(!els.filterPanel.hidden)); } catch (e) {}
    }
  });
  els.jobBoardOpenButton?.addEventListener('click', () => openJobBoardDialog());
  els.targetCompanyOpenButton?.addEventListener('click', () => openTargetCompanyDialog());
  els.search?.addEventListener('input', debounce(() => {
    state.filters.search = els.search.value.trim();
    els.savedFilterSelect.value = '';
    loadApplications();
  }, 250));
  els.statusFilter?.addEventListener('change', () => {
    state.filters.status = els.statusFilter.value;
    els.savedFilterSelect.value = '';
    loadApplications();
  });
  els.tagFilter?.addEventListener('input', debounce(() => {
    state.filters.tag = els.tagFilter.value.trim();
    els.savedFilterSelect.value = '';
    loadApplications();
  }, 250));
  els.archiveFilter?.addEventListener('change', () => {
    state.filters.archived = els.archiveFilter.value;
    els.savedFilterSelect.value = '';
    loadApplications();
  });
  els.savedFilterSelect?.addEventListener('change', async () => {
    const id = Number(els.savedFilterSelect.value);
    const savedFilter = state.savedFilters.find((item) => item.id === id);
    if (!savedFilter) return;
    applySavedFilter(savedFilter);
    await loadApplications();
  });
  els.saveFilterButton?.addEventListener('click', saveCurrentFilter);
  els.deleteFilterButton?.addEventListener('click', deleteCurrentSavedFilter);
  els.quickExportCsvButton?.addEventListener('click', downloadApplicationsCsv);
  els.quickExportIcsButton?.addEventListener('click', downloadCalendarIcs);
  els.selectAllRows?.addEventListener('change', () => {
    if (els.selectAllRows.checked) {
      state.applications.forEach((item) => state.selectedIds.add(item.id));
    } else {
      state.selectedIds.clear();
    }
    syncSelectionCheckboxes();
    updateSelectionUI();
  });
  els.bulkArchiveButton?.addEventListener('click', () => runBulkAction('archive'));
  els.bulkRestoreButton?.addEventListener('click', () => runBulkAction('restore'));
  els.bulkDeleteButton?.addEventListener('click', () => runBulkAction('delete'));
  els.bulkClearButton?.addEventListener('click', () => {
    state.selectedIds.clear();
    syncSelectionCheckboxes();
    updateSelectionUI();
  });
  els.table?.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-select-id]');
    if (!checkbox) return;
    const id = Number(checkbox.dataset.selectId);
    if (checkbox.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    updateSelectionUI();
  });
  els.activitySearch?.addEventListener('input', debounce(() => {
    state.activity.search = els.activitySearch.value.trim();
    state.activity.page = 1;
    loadActivity();
  }, 250));
  els.activityPagination?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-activity-page]');
    if (!button) return;
    state.activity.page = Number(button.dataset.activityPage);
    await loadActivity();
  });
  els.targetCompanySearch?.addEventListener('input', debounce(() => {
    state.targetCompanyFilters.search = els.targetCompanySearch.value.trim();
    renderTargetCompanies(els, state.targetCompanies, state.targetCompanyFilters);
    bindTargetCompanyActions();
  }, 250));
  [
    ['region', els.targetCompanyRegionFilter],
    ['visa', els.targetCompanyVisaFilter],
    ['workMode', els.targetCompanyWorkModeFilter],
    ['industry', els.targetCompanyIndustryFilter]
  ].forEach(([key, element]) => {
    element?.addEventListener('change', () => {
      state.targetCompanyFilters[key] = element.value;
      renderTargetCompanies(els, state.targetCompanies, state.targetCompanyFilters);
      bindTargetCompanyActions();
    });
  });
  els.targetCompanyFilterToggle?.addEventListener('click', () => {
    if (els.targetCompanyFilterPanel) {
      els.targetCompanyFilterPanel.hidden = !els.targetCompanyFilterPanel.hidden;
      try { localStorage.setItem('targetCompanyFilterPanelOpen', String(!els.targetCompanyFilterPanel.hidden)); } catch (e) {}
    }
  });
  els.table?.addEventListener('change', updateInlineStatus);
  els.table?.addEventListener('click', async (event) => {
    const openButton = event.target.closest('[data-detail-id]');
    const archiveButton = event.target.closest('[data-archive-row-id]');
    const restoreButton = event.target.closest('[data-restore-row-id]');
    const inlineMenu = event.target.closest('details.inline-menu');
    if (openButton) {
      inlineMenu?.removeAttribute('open');
      navigateTo(`/applications/${openButton.dataset.detailId}`);
    }
    if (archiveButton) {
      inlineMenu?.removeAttribute('open');
      const application = state.applications.find((item) => item.id === Number(archiveButton.dataset.archiveRowId));
      if (!application) return;
      await runConfirmedAction({
        title: 'Archive application',
        body: `Archive ${application.company_name}?`,
        acceptLabel: 'Archive',
        triggerButton: archiveButton,
        successMessage: 'Application archived.',
        onConfirm: async () => {
          await archiveApplication(application.id);
        }
      });
    }
    if (restoreButton) {
      inlineMenu?.removeAttribute('open');
      await withAsyncButton(restoreButton, async () => {
        await restoreApplication(Number(restoreButton.dataset.restoreRowId));
        showToast('Restore completed.', 'info');
      });
    }
  });
  els.remindersList?.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-calendar-action]');
    const detail = event.target.closest('[data-calendar-detail]');
    if (action) {
      shiftCalendar(action.dataset.calendarAction);
      await loadReminders();
    }
    if (detail) navigateTo(`/applications/${detail.dataset.calendarDetail}`);
  });
  [els.reportsContent, els.statsContent].forEach((container) => {
    container?.addEventListener('click', (event) => {
      const row = event.target.closest('[data-jump-status], [data-jump-view]');
      if (!row) return;
      jumpToFilteredList({ status: row.dataset.jumpStatus, view: row.dataset.jumpView });
    });
  });
  els.notificationsPanel?.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-toggle-notifications]');
    const detail = event.target.closest('[data-notification-detail]');
    if (toggle) {
      state.notificationsExpanded = !state.notificationsExpanded;
      renderNotifications(els, state.notifications, state.notificationsExpanded);
      bindNotificationActions();
    }
    if (detail) navigateTo(`/applications/${detail.dataset.notificationDetail}`);
  });
  bindSettingsActions();
}

function bindSettingsActions() {
  if (els.settingsExportCsvButton && els.settingsExportCsvButton.dataset.bound !== 'true') {
    els.settingsExportCsvButton.dataset.bound = 'true';
    els.settingsExportCsvButton.addEventListener('click', () => {
      downloadApplicationsCsv();
    });
  }
  if (els.settingsImportCsvButton && els.settingsImportCsvButton.dataset.bound !== 'true') {
    els.settingsImportCsvButton.dataset.bound = 'true';
    els.settingsImportCsvButton.addEventListener('click', () => els.importCsvInput.click());
  }
  if (els.settingsBackupButton && els.settingsBackupButton.dataset.bound !== 'true') {
    els.settingsBackupButton.dataset.bound = 'true';
    els.settingsBackupButton.addEventListener('click', async (event) => {
      await withAsyncButton(event.currentTarget, async () => {
        window.location.href = '/api/export/backup';
        showToast('Backup download started.', 'info');
      });
    });
  }
  if (els.settingsRestoreButton && els.settingsRestoreButton.dataset.bound !== 'true') {
    els.settingsRestoreButton.dataset.bound = 'true';
    els.settingsRestoreButton.addEventListener('click', () => {
      els.restoreBackupInput.click();
    });
  }
  if (els.settingsReplaceBackupButton && els.settingsReplaceBackupButton.dataset.bound !== 'true') {
    els.settingsReplaceBackupButton.dataset.bound = 'true';
    els.settingsReplaceBackupButton.addEventListener('click', () => {
      els.restoreBackupInput.click();
    });
  }
  if (els.settingsClearBackupButton && els.settingsClearBackupButton.dataset.bound !== 'true') {
    els.settingsClearBackupButton.dataset.bound = 'true';
    els.settingsClearBackupButton.addEventListener('click', clearSelectedBackup);
  }
  if (els.settingsRestoreSelectedButton && els.settingsRestoreSelectedButton.dataset.bound !== 'true') {
    els.settingsRestoreSelectedButton.dataset.bound = 'true';
    els.settingsRestoreSelectedButton.addEventListener('click', async (event) => {
      await withAsyncButton(event.currentTarget, restoreBackup);
    });
  }
  updateRestoreBackupSelection();
}

function downloadApplicationsCsv() {
  const link = document.createElement('a');
  link.href = '/api/export/applications.csv';
  link.download = 'job-applications.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadCalendarIcs() {
  const link = document.createElement('a');
  link.href = '/api/export/calendar.ics';
  link.download = 'job-tracker.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function syncSelectionCheckboxes() {
  els.table?.querySelectorAll('[data-select-id]').forEach((checkbox) => {
    checkbox.checked = state.selectedIds.has(Number(checkbox.dataset.selectId));
  });
}

function updateSelectionUI() {
  const visible = new Set(state.applications.map((item) => item.id));
  for (const id of [...state.selectedIds]) {
    if (!visible.has(id)) state.selectedIds.delete(id);
  }
  const count = state.selectedIds.size;
  if (els.bulkActionsBar) {
    els.bulkActionsBar.hidden = count === 0;
    if (els.bulkCount) els.bulkCount.textContent = `${count} selected`;
  }
  if (els.selectAllRows) {
    els.selectAllRows.checked = count > 0 && count === state.applications.length;
    els.selectAllRows.indeterminate = count > 0 && count < state.applications.length;
  }
}

async function runBulkAction(action) {
  const ids = [...state.selectedIds];
  if (!ids.length) return;

  const perform = async () => {
    for (const id of ids) {
      if (action === 'archive') await api(`/api/applications/${id}/archive`, { method: 'POST' });
      if (action === 'restore') await api(`/api/applications/${id}/restore`, { method: 'POST' });
      if (action === 'delete') await api(`/api/applications/${id}`, { method: 'DELETE' });
    }
    state.selectedIds.clear();
    await Promise.all([loadApplications(), loadReminders(), loadNotifications()]);
  };

  if (action === 'delete') {
    await runConfirmedAction({
      title: 'Delete applications',
      body: `Permanently delete ${ids.length} application${ids.length === 1 ? '' : 's'}? This cannot be undone.`,
      acceptLabel: 'Delete',
      triggerButton: els.bulkDeleteButton,
      successMessage: 'Applications deleted.',
      onConfirm: perform
    });
    return;
  }

  try {
    await withAsyncButton(action === 'archive' ? els.bulkArchiveButton : els.bulkRestoreButton, async () => {
      await perform();
      showToast(action === 'archive' ? 'Applications archived.' : 'Applications restored.', 'info');
    });
  } catch (error) {
    showToast(error.message, 'error');
    await loadApplications();
  }
}

async function switchView(view) {
  state.view = view;
  syncContentHeader();
  document.querySelectorAll('.sidebar [data-view]').forEach((button) => {
    const isActive = button.dataset.view === view;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  closeMobileSidebar();

  if (!els.listView) return;
  els.listView.hidden = view !== 'list';
  els.remindersView.hidden = view !== 'reminders';
  els.kanbanView.hidden = view !== 'kanban';
  els.reportsView.hidden = view !== 'reports';
  if (els.statsView) els.statsView.hidden = view !== 'stats';
  els.activityView.hidden = view !== 'activity';
  els.boardsView.hidden = view !== 'boards';
  els.companiesView.hidden = view !== 'companies';
  els.toolkitView.hidden = view !== 'toolkit';
  els.settingsView.hidden = view !== 'settings';

  unmountInactiveHomeViews(view);

  if (view === 'reminders') {
    renderSectionLoading(els.remindersList, 'Loading reminders');
    await loadReminders();
  }
  if (view === 'kanban') renderKanban(els, state.applications, statusLabels);
  if (view === 'reports') {
    renderSectionLoading(els.reportsContent, 'Loading reports');
    await loadReports();
  }
  if (view === 'stats') {
    renderSectionLoading(els.statsContent, 'Loading stats');
    await loadStats();
  }
  if (view === 'activity') {
    renderSectionLoading(els.activityTable, 'Loading activity');
    await loadActivity();
  }
  if (view === 'boards') {
    renderSectionLoading(els.jobBoardsList, 'Loading job boards');
    await loadJobBoards();
  }
  if (view === 'companies') {
    renderSectionLoading(els.targetCompaniesList, 'Loading companies');
    await loadTargetCompanies();
  }
  if (view === 'toolkit') renderToolkit(els);
  if (view === 'settings') bindSettingsActions();
}

async function jumpToFilteredList({ status = '', view = '' } = {}) {
  // Status counts reflect current status across every lifecycle, so widen the
  // archive view to 'all' to guarantee the filtered list matches the count.
  state.filters.status = status || '';
  state.filters.archived = view || (status ? 'all' : 'false');
  state.filters.search = '';
  state.filters.tag = '';
  if (els.statusFilter) els.statusFilter.value = state.filters.status;
  if (els.archiveFilter) els.archiveFilter.value = state.filters.archived;
  if (els.search) els.search.value = '';
  if (els.tagFilter) els.tagFilter.value = '';
  if (els.savedFilterSelect) els.savedFilterSelect.value = '';
  await switchView('list');
  await loadApplications();
}

function applicationQueryParams() {
  const params = new URLSearchParams();
  if (state.filters.search) params.set('search', state.filters.search);
  if (state.filters.status) params.set('status', state.filters.status);
  if (state.filters.tag) params.set('tag', state.filters.tag);
  params.set('archived', state.filters.archived);
  return params;
}

async function loadApplications() {
  const payload = await api(`/api/applications?${applicationQueryParams().toString()}`);
  state.applications = payload.applications;
  if (els.table) renderApplications(els, state, statusOptions);
  updateSelectionUI();
  if (state.view === 'kanban' && els.kanbanBoard) renderKanban(els, state.applications, statusLabels);
}

async function refreshApplicationRow(id) {
  const payload = await api(`/api/applications?${applicationQueryParams().toString()}`);
  state.applications = payload.applications;
  const row = els.table?.querySelector(`tr[data-id="${id}"]`);
  const application = state.applications.find((item) => item.id === id);
  if (!row || !application) {
    if (els.table) renderApplications(els, state, statusOptions);
    updateSelectionUI();
    return;
  }
  row.replaceWith(buildApplicationRow(application, statusOptions, state.selectedIds.has(id)));
  updateSelectionUI();
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
  if (els.cvList) {
    renderCVs(els, state.cvs);
    bindCvActions();
  }
  if (els.applicationCvSelect) renderApplicationCVSelect(els, state.cvs);
}

async function loadSavedFilters() {
  const payload = await api('/api/saved-filters');
  state.savedFilters = payload.filters;
  if (els.savedFilterSelect) renderSavedFilters(els, state.savedFilters);
}

async function loadJobBoards() {
  const payload = await api('/api/job-boards');
  state.jobBoards = payload.job_boards;
  if (els.jobBoardsList) {
    renderJobBoards(els, state.jobBoards);
    bindJobBoardActions();
  }
}

async function loadTargetCompanies() {
  const payload = await api('/api/target-companies');
  state.targetCompanies = payload.target_companies;
  if (els.targetCompaniesList) {
    if (els.targetCompanyFilterPanel) {
      els.targetCompanyFilterPanel.hidden = localStorage.getItem('targetCompanyFilterPanelOpen') !== 'true';
    }
    renderTargetCompanyFilters(els, state.targetCompanies, state.targetCompanyFilters);
    renderTargetCompanies(els, state.targetCompanies, state.targetCompanyFilters);
    bindTargetCompanyActions();
  }
}

async function loadReminders() {
  const payload = await api('/api/reminders');
  if (els.remindersList) renderCalendar(els, state.calendarDate, payload.reminders);
}

async function loadNotifications() {
  const payload = await api('/api/notifications');
  state.notifications = payload.notifications;
  if (els.notificationsPanel) {
    renderNotifications(els, state.notifications, state.notificationsExpanded);
    bindNotificationActions();
  }
}

async function loadReports() {
  const payload = await api('/api/reports');
  if (els.reportsContent) renderReports(els, payload, statusLabels);
}

async function loadStats() {
  const payload = await api('/api/stats');
  if (els.statsContent) renderStats(els, payload);
}

async function loadActivity() {
  const params = new URLSearchParams({
    page: String(state.activity.page),
    limit: String(state.activity.limit)
  });
  if (state.activity.search) params.set('search', state.activity.search);

  const payload = await api(`/api/activity?${params.toString()}`);
  if (els.activityTable) renderActivity(els, state, payload);
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

  await withAsyncForm(els.applicationForm, async () => {
    const payload = await api('/api/applications', { method: 'POST', body: formData });
    els.applicationDialog.close();
    els.applicationForm.reset();
    showToast('Application saved.');
    await Promise.all([loadApplications(), loadCVs(), loadReminders(), loadNotifications()]);
    navigateTo(`/applications/${payload.application.id}`);
  }, (error) => {
    setError(els.applicationError, error.message);
  });
}

async function submitCvForm(event) {
  event.preventDefault();
  setError(els.cvError, '');

  const formData = new FormData(els.cvForm);
  formData.set('is_latest', els.cvForm.elements.is_latest.checked ? 'true' : 'false');

  await withAsyncForm(els.cvForm, async () => {
    await api('/api/cv', { method: 'POST', body: formData });
    els.cvForm.reset();
    els.cvForm.elements.is_latest.checked = true;
    showToast('CV saved.');
    await loadCVs();
  }, (error) => {
    setError(els.cvError, error.message);
  });
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

  await withAsyncForm(els.jobBoardForm, async () => {
    await api(id ? `/api/job-boards/${id}` : '/api/job-boards', {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    els.jobBoardDialog.close();
    resetJobBoardForm();
    await loadJobBoards();
    showToast(id ? 'Job board updated.' : 'Job board saved.');
  }, (error) => {
    setError(els.jobBoardError, error.message);
  });
}

async function submitTargetCompanyForm(event) {
  event.preventDefault();
  setError(els.targetCompanyError, '');
  const form = new FormData(els.targetCompanyForm);
  const id = form.get('id');
  const payload = {
    name: form.get('name'),
    company_url: form.get('company_url'),
    career_url: form.get('career_url'),
    linkedin_url: form.get('linkedin_url'),
    region: form.get('region'),
    primary_location: form.get('primary_location'),
    germany_offices: form.get('germany_offices'),
    additional_offices: form.get('additional_offices'),
    industry: form.get('industry'),
    company_type: form.get('company_type'),
    description: form.get('description'),
    work_mode: form.get('work_mode'),
    employee_count: form.get('employee_count'),
    visa_signal: form.get('visa_signal'),
    relocation_signal: form.get('relocation_signal'),
    fit_notes: form.get('fit_notes'),
    source: form.get('source'),
    source_notes: form.get('source_notes'),
    last_checked_date: parseDisplayDateToIso(form.get('last_checked_date')),
    is_active: els.targetCompanyForm.elements.is_active.checked
  };

  await withAsyncForm(els.targetCompanyForm, async () => {
    await api(id ? `/api/target-companies/${id}` : '/api/target-companies', {
      method: id ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    els.targetCompanyDialog.close();
    resetTargetCompanyForm();
    await loadTargetCompanies();
    showToast(id ? 'Company updated.' : 'Company saved.');
  }, (error) => {
    setError(els.targetCompanyError, error.message);
  });
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
    showToast('Set an interview date before saving Interview Scheduled.', 'warning');
    await loadApplications();
    return;
  }

  let notes = application.notes || '';
  if (event.target.dataset.field === 'status' && isClosedStatus(status)) {
    const reason = await promptForOptionalText({
      title: `${statusLabels[status]} — add a note`,
      label: 'Reason (optional)',
      submitLabel: 'Save'
    });
    if (reason === false) {
      await loadApplications();
      return;
    }
    if (reason) {
      notes = [notes, `${statusLabels[status]}: ${reason.trim()}`].filter(Boolean).join('\n');
    }
  }

  const closingApplication = event.target.dataset.field === 'status' && isClosedStatus(status);

  try {
    event.target.disabled = true;
    await api(`/api/applications/${application.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status,
        interview_date: status === 'interview_scheduled' ? interviewDate : null,
        next_action: closingApplication ? '' : application.next_action,
        next_action_due_date: closingApplication ? null : application.next_action_due_date,
        notes
      })
    });
    showToast('Save successful.');
    await Promise.all([refreshApplicationRow(application.id), loadReminders()]);
  } catch (error) {
    showToast(error.message, 'error');
    await loadApplications();
  } finally {
    event.target.disabled = false;
  }
}

function bindCvActions() {
  els.cvList.querySelectorAll('[data-delete-cv-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await runConfirmedAction({
        title: 'Delete CV',
        body: 'Delete this CV? Linked historical CVs cannot be deleted.',
        acceptLabel: 'Delete',
        triggerButton: button,
        successMessage: 'CV deleted.',
        onConfirm: async () => {
          await api(`/api/cv/${button.dataset.deleteCvId}`, { method: 'DELETE' });
          await loadCVs();
        },
        onError: (error) => {
          setError(els.cvError, error.message);
        }
      });
    });
  });
}

function bindNotificationActions() {
  els.notificationsPanel.querySelectorAll('[data-notification-detail]').forEach((button) => {
    button.addEventListener('click', () => navigateTo(`/applications/${button.dataset.notificationDetail}`));
  });
}

function bindJobBoardActions() {
  els.jobBoardsList.querySelectorAll('[data-job-board-open]').forEach((button) => {
    button.addEventListener('click', async () => {
      const board = state.jobBoards.find((item) => item.id === Number(button.dataset.jobBoardOpen));
      if (!board?.url) return;
      const openedTab = window.open(board.url, '_blank', 'noopener,noreferrer');
      button.disabled = true;
      try {
        await api(`/api/job-boards/${board.id}/check`, { method: 'POST' });
        await loadJobBoards();
      } catch (error) {
        setError(els.jobBoardError, error.message);
        if (!openedTab) window.open(board.url, '_blank', 'noopener,noreferrer');
      } finally {
        button.disabled = false;
      }
    });
  });

  els.jobBoardsList.querySelectorAll('[data-job-board-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const board = state.jobBoards.find((item) => item.id === Number(button.dataset.jobBoardEdit));
      if (!board) return;
      openJobBoardDialog(board);
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
        showToast(board.is_active ? 'Board marked inactive.' : 'Board activated.');
      } catch (error) {
        setError(els.jobBoardError, error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  els.jobBoardsList.querySelectorAll('[data-job-board-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await runConfirmedAction({
        title: 'Delete job board',
        body: 'Delete this job board?',
        acceptLabel: 'Delete',
        triggerButton: button,
        successMessage: 'Job board deleted.',
        onConfirm: async () => {
          await api(`/api/job-boards/${button.dataset.jobBoardDelete}`, { method: 'DELETE' });
          state.jobBoards = state.jobBoards.filter((item) => item.id !== Number(button.dataset.jobBoardDelete));
          renderJobBoards(els, state.jobBoards);
          bindJobBoardActions();
        },
        onError: (error) => {
          setError(els.jobBoardError, error.message);
        }
      });
    });
  });
}

function bindTargetCompanyActions() {
  els.targetCompaniesList?.querySelectorAll('[data-target-company-open]').forEach((button) => {
    button.addEventListener('click', async () => {
      const company = state.targetCompanies.find((item) => item.id === Number(button.dataset.targetCompanyOpen));
      if (!company) return;
      const url = button.dataset.targetCompanyUrl === 'linkedin'
        ? company.linkedin_url
        : button.dataset.targetCompanyUrl === 'company'
          ? company.company_url
          : company.career_url;
      if (!url) return;
      const openedTab = window.open(url, '_blank', 'noopener,noreferrer');
      button.disabled = true;
      try {
        await api(`/api/target-companies/${company.id}/check`, { method: 'POST' });
        await loadTargetCompanies();
      } catch (error) {
        setError(els.targetCompanyError, error.message);
        if (!openedTab) window.open(url, '_blank', 'noopener,noreferrer');
      } finally {
        button.disabled = false;
      }
    });
  });

  els.targetCompaniesList?.querySelectorAll('[data-target-company-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const company = state.targetCompanies.find((item) => item.id === Number(button.dataset.targetCompanyEdit));
      if (!company) return;
      openTargetCompanyDialog(company);
    });
  });

  els.targetCompaniesList?.querySelectorAll('[data-target-company-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const company = state.targetCompanies.find((item) => item.id === Number(button.dataset.targetCompanyToggle));
      if (!company) return;
      button.disabled = true;
      try {
        await api(`/api/target-companies/${company.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...company, is_active: !company.is_active })
        });
        await loadTargetCompanies();
        showToast(company.is_active ? 'Company marked inactive.' : 'Company activated.');
      } catch (error) {
        setError(els.targetCompanyError, error.message);
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
  if (els.jobBoardDialogTitle) els.jobBoardDialogTitle.textContent = 'Add Job Board';
  setError(els.jobBoardError, '');
}

function resetTargetCompanyForm() {
  els.targetCompanyForm.reset();
  els.targetCompanyForm.elements.id.value = '';
  els.targetCompanyForm.elements.is_active.checked = true;
  els.targetCompanyForm.elements.last_checked_date.value = '';
  if (els.targetCompanyDialogTitle) els.targetCompanyDialogTitle.textContent = 'Add Company';
  setError(els.targetCompanyError, '');
}

function openTargetCompanyDialog(company = null) {
  resetTargetCompanyForm();
  if (company) {
    els.targetCompanyDialogTitle.textContent = 'Edit Target Company';
    for (const field of [
      'id',
      'name',
      'company_url',
      'career_url',
      'linkedin_url',
      'region',
      'primary_location',
      'germany_offices',
      'additional_offices',
      'industry',
      'company_type',
      'description',
      'work_mode',
      'employee_count',
      'visa_signal',
      'relocation_signal',
      'fit_notes',
      'source',
      'source_notes'
    ]) {
      els.targetCompanyForm.elements[field].value = company[field] || '';
    }
    els.targetCompanyForm.elements.last_checked_date.value = formatIsoDateForDisplay(company.last_checked_date || '');
    els.targetCompanyForm.elements.is_active.checked = Boolean(company.is_active);
  }
  els.targetCompanyDialog.showModal();
}

function openJobBoardDialog(board = null) {
  resetJobBoardForm();
  if (board) {
    els.jobBoardDialogTitle.textContent = 'Edit Job Board';
    els.jobBoardForm.elements.id.value = board.id;
    els.jobBoardForm.elements.name.value = board.name || '';
    els.jobBoardForm.elements.url.value = board.url || '';
    els.jobBoardForm.elements.notes.value = board.notes || '';
    els.jobBoardForm.elements.last_checked_date.value = formatIsoDateForDisplay(board.last_checked_date || '');
    els.jobBoardForm.elements.is_active.checked = Boolean(board.is_active);
  }
  els.jobBoardDialog.showModal();
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
  clearContentPolling();
  resetTransientUiState();
  state.route = parseRoute(location.pathname, location.search);
  window.scrollTo({ top: 0, behavior: 'auto' });
  syncContentHeader();

  if (state.route.page === 'home') {
    mountWorkspace(renderHomeWorkspace(), 'home');
    bindHomeWorkspaceElements();
    await switchView(state.view);
    return;
  }

  if (state.route.page === 'application') {
    mountWorkspace(renderRouteLoadingState('Loading application', 'Fetching application'), 'loading');
    const payload = await api(`/api/applications/${state.route.applicationId}`).catch(() => null);
    if (!payload) {
      mountWorkspace(buildRouteErrorState('Application not found', 'This application route no longer points to an available record.'), 'error');
      return;
    }
    state.currentApplication = payload;
    state.currentApplicationDocuments = payload.ai_documents;
    state.currentApplicationJobs = payload.ai_jobs;
    renderApplicationPage(els, payload, statusLabels, {
      activeTab: state.route.tab,
      selectedProvider: state.selectedAIProvider,
      capabilities: state.appConfig,
      contentWorkspace: state.contentWorkspace
    });
    bindWorkspaceElements();
    assertSingleWorkspaceView('application');
    bindApplicationPageActions(payload);
    if (state.route.tab === 'content' && state.route.documentId) {
      const document = payload.ai_documents.find((item) => Number(item.id) === Number(state.route.documentId));
      if (document) {
        openDocumentPreview(payload.application, document, payload.ai_documents.filter((item) => item.document_type === document.document_type));
      }
    }
    return;
  }
}

function mountWorkspace(markup, viewName) {
  els.workspaceRoot.innerHTML = markup;
  bindWorkspaceElements();
  els.workspaceMounted = viewName;
  assertSingleWorkspaceView(viewName);
}

function bindHomeWorkspaceElements() {
  bindWorkspaceElements();
  if (els.filterPanel) {
    els.filterPanel.hidden = localStorage.getItem('filterPanelOpen') !== 'true';
  }
  syncContentHeader();
  if (els.summary) {
    const interviews = state.applications.filter((item) => item.status === 'interview_scheduled').length;
    const archived = state.applications.filter((item) => item.archived_at).length;
    const viewName = { true: 'archived', all: 'total', closed: 'closed', false: 'active' }[state.filters.archived] || 'active';
    els.summary.textContent = `${state.applications.length} ${viewName}, ${interviews} interviews scheduled, ${archived} archived shown`;
  }
  if (els.search) els.search.value = state.filters.search;
  if (els.statusFilter) els.statusFilter.value = state.filters.status;
  if (els.tagFilter) els.tagFilter.value = state.filters.tag;
  if (els.archiveFilter) els.archiveFilter.value = state.filters.archived;
  if (els.savedFilterName) els.savedFilterName.value = '';
  renderApplications(els, state, statusOptions);
  renderSavedFilters(els, state.savedFilters);
  renderNotifications(els, state.notifications, state.notificationsExpanded);
  renderJobBoards(els, state.jobBoards);
  renderToolkit(els);
  bindHomeWorkspaceEvents();
  bindNotificationActions();
  bindJobBoardActions();
  if (state.view === 'kanban') renderKanban(els, state.applications, statusLabels);
  if (state.view === 'reports') loadReports();
  if (state.view === 'stats') loadStats();
  if (state.view === 'activity') loadActivity();
  if (state.view === 'reminders') loadReminders();
}

function assertSingleWorkspaceView(viewName) {
  const mounted = els.workspaceRoot.querySelectorAll('[data-workspace-view]');
  if (mounted.length > 1) {
    console.warn(`Multiple workspace views mounted for ${viewName}`, mounted.length);
  }
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
    await runConfirmedAction({
      title: 'Archive application',
      body: `Archive ${application.company_name}?`,
      acceptLabel: 'Archive',
      triggerButton: root.querySelector('[data-archive-application]'),
      successMessage: 'Application archived.',
      onConfirm: async () => {
        await archiveApplication(application.id);
        await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
      }
    });
  });
  root.querySelector('[data-restore-application]')?.addEventListener('click', async () => {
    const button = root.querySelector('[data-restore-application]');
    await withAsyncButton(button, async () => {
      await restoreApplication(application.id);
      showToast('Application restored.', 'info');
      await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
    });
  });
  root.querySelector('[data-view-job-description]')?.addEventListener('click', () => {
    openDetailDialog(application.job_description ? 'Job Description' : 'Job Description Missing', `
      <section class="route-card detail-dialog-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Role Context</div>
            <h3>${escapeHtml(application.company_name)}</h3>
          </div>
        </div>
        <p class="description">${escapeHtml(application.job_description || 'Add a job description to improve tailored output, ATS checks, and role-fit analysis.')}</p>
        <div class="document-card-actions modal-quick-actions">
          <button type="button" data-ai="fit" data-cv-id="${payload.cvs[0]?.id || ''}">Role Fit Summary</button>
          <button class="secondary" type="button" data-ai="ats" data-cv-id="${payload.cvs[0]?.id || ''}">ATS Check</button>
          <button class="secondary" type="button" data-ai="cv" data-cv-id="${payload.cvs[0]?.id || ''}">Tailored CV</button>
          <button class="secondary" type="button" data-ai="letter" data-cv-id="${payload.cvs[0]?.id || ''}">Cover Letter</button>
        </div>
      </section>
    `);
    els.detailContent.querySelectorAll('[data-ai]').forEach((button) => {
      button.addEventListener('click', () => {
        els.detailDialog.close();
        runAI(button, application.id);
      });
    });
  });

  root.querySelectorAll('[data-ai]').forEach((button) => {
    button.addEventListener('click', () => runAI(button, application.id));
  });

  root.querySelector('[data-note-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = readRequiredText(event.target, 'body', 'Add a note before saving.');
    if (!body) return;
    await withAsyncForm(event.target, async () => {
      await api(`/api/applications/${application.id}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body })
      });
      showToast('Note saved.');
      await Promise.all([loadNotifications(), renderCurrentRoute()]);
    });
  });

  root.querySelectorAll('[data-note-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await runConfirmedAction({
        title: 'Delete note',
        body: 'Remove this note?',
        acceptLabel: 'Delete',
        triggerButton: button,
        successMessage: 'Note deleted.',
        onConfirm: async () => {
          await api(`/api/notes/${button.dataset.noteDelete}`, { method: 'DELETE' });
          await renderCurrentRoute();
        }
      });
    });
  });

  root.querySelector('[data-preparation-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const values = ['about_company', 'company_values', 'application_notes'].map((key) => String(form.get(key) || '').trim());
    if (!values.some(Boolean)) {
      setFormError(event.target, 'Add at least one note before saving.');
      showToast('Validation error.', 'warning');
      return;
    }
    await withAsyncForm(event.target, async () => {
      await api(`/api/applications/${application.id}/preparation`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          about_company: String(form.get('about_company') || '').trim(),
          company_values: String(form.get('company_values') || '').trim(),
          application_notes: String(form.get('application_notes') || '').trim()
        })
      });
      showToast('Research notes saved.');
      await renderCurrentRoute();
    });
  });

  root.querySelectorAll('[data-research-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.closest('.research-field');
      const preview = field?.querySelector('[data-research-preview]');
      const textarea = field?.querySelector('textarea');
      if (!textarea) return;
      if (preview) preview.hidden = true;
      textarea.hidden = false;
      textarea.focus();
    });
  });

  root.querySelectorAll('[data-research-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.closest('.research-field');
      const textarea = field?.querySelector('textarea');
      if (!textarea) return;
      openDetailDialog(button.dataset.researchLabel || 'Notes', `
        <section class="route-card detail-dialog-card">
          <p class="description research-view-body">${escapeHtml(textarea.value)}</p>
        </section>
      `);
    });
  });

  root.querySelector('[data-question-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = readRequiredText(event.target, 'question', 'Add a question before saving.');
    if (!question) return;
    await withAsyncForm(event.target, async () => {
      await api(`/api/applications/${application.id}/recruiter-questions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question })
      });
      showToast('Recruiter question added.');
      await renderCurrentRoute();
    });
  });

  root.querySelector('[data-feedback-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = readRequiredText(event.target, 'body', 'Add feedback before saving.');
    if (!body) return;
    await withAsyncForm(event.target, async () => {
      await api(`/api/applications/${application.id}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source_type: event.target.elements.source_type.value,
          body
        })
      });
      showToast('Feedback added.');
      await renderCurrentRoute();
    });
  });

  root.querySelector('[data-todo-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = readRequiredText(event.target, 'body', 'Add a task before saving.');
    if (!body) return;
    const dueDate = normalizeOptionalDisplayDate(event.target, 'due_date');
    if (dueDate === null) return;
    await withAsyncForm(event.target, async () => {
      await api(`/api/applications/${application.id}/todos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          body,
          due_date: dueDate
        })
      });
      showToast('Task added.');
      await Promise.all([loadNotifications(), renderCurrentRoute()]);
    });
  });

  bindValidatedForms(root);
  bindContentWorkspaceActions(application.id, payload);
  root.querySelectorAll('[data-date-input]').forEach(attachDateMask);
  bindPreparationActions(application.id, recruiterQuestions, todos, root);
}

function bindPreparationActions(applicationId, recruiterQuestions, todos, root) {
  root.querySelectorAll('[data-question-edit]').forEach((button) => {
    button.addEventListener('click', async () => {
      const current = recruiterQuestions.find((item) => item.id === Number(button.dataset.questionEdit));
      if (!current) return;
      const next = await promptForText({
        title: 'Edit recruiter question',
        label: 'Question',
        value: current.question,
        submitLabel: 'Save question'
      });
      if (next === null) return;
      await withAsyncButton(button, async () => {
        await api(`/api/recruiter-questions/${current.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: next })
        });
        showToast('Recruiter question updated.');
        await renderCurrentRoute();
      });
    });
  });

  root.querySelectorAll('[data-question-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await runConfirmedAction({
        title: 'Delete recruiter question',
        body: 'Remove this recruiter question?',
        acceptLabel: 'Delete',
        triggerButton: button,
        successMessage: 'Recruiter question deleted.',
        onConfirm: async () => {
          await api(`/api/recruiter-questions/${button.dataset.questionDelete}`, { method: 'DELETE' });
          await renderCurrentRoute();
        }
      });
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
      showToast('Question order updated.');
      await renderCurrentRoute();
    });
  });

  root.querySelectorAll('[data-feedback-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await runConfirmedAction({
        title: 'Delete feedback',
        body: 'Remove this feedback entry?',
        acceptLabel: 'Delete',
        triggerButton: button,
        successMessage: 'Feedback deleted.',
        onConfirm: async () => {
          await api(`/api/feedback/${button.dataset.feedbackDelete}`, { method: 'DELETE' });
          await renderCurrentRoute();
        }
      });
    });
  });

  root.querySelectorAll('[data-todo-toggle]').forEach((input) => {
    input.addEventListener('change', async () => {
      const todo = todos.find((item) => item.id === Number(input.dataset.todoToggle));
      if (!todo) return;
      input.disabled = true;
      try {
        await api(`/api/todos/${todo.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: todo.body, due_date: todo.due_date, completed: input.checked })
        });
        showToast(input.checked ? 'Task completed.' : 'Task reopened.', 'info');
        await Promise.all([loadNotifications(), renderCurrentRoute()]);
      } finally {
        input.disabled = false;
      }
    });
  });

  root.querySelectorAll('[data-todo-edit]').forEach((button) => {
    button.addEventListener('click', async () => {
      const todo = todos.find((item) => item.id === Number(button.dataset.todoEdit));
      if (!todo) return;
      const next = await promptForText({
        title: 'Edit task',
        label: 'Task',
        value: todo.body,
        submitLabel: 'Save task'
      });
      if (next === null) return;
      await withAsyncButton(button, async () => {
        await api(`/api/todos/${todo.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: next, due_date: todo.due_date, completed: todo.completed })
        });
        showToast('Task updated.');
        await renderCurrentRoute();
      });
    });
  });

  root.querySelectorAll('[data-todo-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      await runConfirmedAction({
        title: 'Delete task',
        body: 'Remove this task?',
        acceptLabel: 'Delete',
        triggerButton: button,
        successMessage: 'Task deleted.',
        onConfirm: async () => {
          await api(`/api/todos/${button.dataset.todoDelete}`, { method: 'DELETE' });
          await Promise.all([loadNotifications(), renderCurrentRoute()]);
        }
      });
    });
  });
}

function bindContentWorkspaceActions(applicationId, payload) {
  const root = els.applicationPageContent;
  root.querySelectorAll('[data-library-provider-select]').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      state.selectedAIProvider = button.dataset.libraryProviderSelect;
      renderCurrentRoute();
    });
  });

  root.querySelector('[data-content-search]')?.addEventListener('input', debounce((event) => {
    state.contentWorkspace.search = event.target.value.trim();
    renderCurrentRoute();
  }, 180));
  root.querySelector('[data-content-type]')?.addEventListener('change', (event) => {
    state.contentWorkspace.type = event.target.value;
    renderCurrentRoute();
  });
  root.querySelector('[data-content-provider]')?.addEventListener('change', (event) => {
    state.contentWorkspace.provider = event.target.value;
    renderCurrentRoute();
  });
  root.querySelector('[data-content-sort]')?.addEventListener('change', (event) => {
    state.contentWorkspace.sort = event.target.value;
    renderCurrentRoute();
  });
  root.querySelector('[data-content-latest-only]')?.addEventListener('change', (event) => {
    state.contentWorkspace.latestOnly = event.target.checked;
    renderCurrentRoute();
  });
  root.querySelector('[data-generate-missing]')?.addEventListener('click', async (event) => {
    const missingButtons = [...root.querySelectorAll('.document-slot-card [data-ai]')];
    if (!missingButtons.length) return;
    await withAsyncButton(event.currentTarget, async () => {
      for (const button of missingButtons) {
        await runAI(button, applicationId, { silentQueued: true, suppressNavigate: true });
      }
      showToast('Missing document generation started.', 'info');
      await renderCurrentRoute();
    });
  });

  root.querySelectorAll('[data-regenerate-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      const provider = state.selectedAIProvider === 'aws' && state.appConfig.awsEnabled ? 'aws' : 'gemini';
      await runConfirmedAction({
        title: 'Regenerate document',
        body: 'Create a new version from this document. The latest version will stay available until the new result is ready.',
        acceptLabel: 'Regenerate',
        triggerButton: button,
        successMessage: null,
        onConfirm: async () => {
          const nextPayload = await api(`/api/ai/documents/${button.dataset.regenerateCard}/regenerate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider })
          });
          if (nextPayload.document?.id) state.contentWorkspace.recentDocumentId = nextPayload.document.id;
          showToast(nextPayload.document?.id ? 'Document regenerated.' : 'Regeneration queued.');
          navigateTo(nextPayload.document?.id ? `/applications/${applicationId}?tab=content&document=${nextPayload.document.id}` : `/applications/${applicationId}?tab=content`);
        }
      });
    });
  });

  root.querySelectorAll('[data-restore-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      const provider = state.selectedAIProvider === 'aws' && state.appConfig.awsEnabled ? 'aws' : 'gemini';
      await runConfirmedAction({
        title: 'Restore version',
        body: 'Restore this version as the new latest document. This creates a fresh version instead of overwriting the older draft.',
        acceptLabel: 'Restore',
        triggerButton: button,
        successMessage: null,
        onConfirm: async () => {
          const nextPayload = await api(`/api/ai/documents/${button.dataset.restoreCard}/regenerate`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ provider })
          });
          if (nextPayload.document?.id) state.contentWorkspace.recentDocumentId = nextPayload.document.id;
          showToast(nextPayload.document?.id ? 'Version restored as latest.' : 'Restore queued.');
          navigateTo(nextPayload.document?.id ? `/applications/${applicationId}?tab=content&document=${nextPayload.document.id}` : `/applications/${applicationId}?tab=content`);
        }
      });
    });
  });

  root.querySelectorAll('[data-compare-card]').forEach((button) => {
    button.addEventListener('click', () => {
      const left = payload.ai_documents.find((item) => Number(item.id) === Number(button.dataset.compareCard));
      const right = payload.ai_documents.find((item) => Number(item.id) === Number(button.dataset.compareLatest));
      if (!left || !right) return;
      openDetailDialog('Compare versions', buildDocumentComparisonBody(left, right));
    });
  });

  root.querySelectorAll('[data-copy-document]').forEach((button) => {
    button.addEventListener('click', async () => {
      const document = payload.ai_documents.find((item) => Number(item.id) === Number(button.dataset.copyDocument));
      if (!document) return;
      await navigator.clipboard.writeText(document.content || '').catch(() => null);
      showToast('Copy successful.');
    });
  });

  root.querySelectorAll('[data-delete-card]').forEach((button) => {
    button.addEventListener('click', async () => {
      await runConfirmedAction({
        title: 'Delete document',
        body: 'Delete this generated document?',
        acceptLabel: 'Delete',
        triggerButton: button,
        successMessage: 'Document deleted.',
        onConfirm: async () => {
          await api(`/api/ai/documents/${button.dataset.deleteCard}`, { method: 'DELETE' });
          await renderCurrentRoute();
        }
      });
    });
  });

  const shouldPoll = payload.ai_jobs.some((item) => item.status !== 'completed' && item.status !== 'failed');
  if (!shouldPoll) return;
  window.clearTimeout(state.contentPollTimerId);
  state.contentPollTimerId = window.setTimeout(async () => {
    if (location.pathname !== `/applications/${applicationId}` && !location.pathname.startsWith(`/applications/${applicationId}/content`)) return;
    const pendingJobIds = payload.ai_jobs.filter((item) => item.status !== 'completed' && item.status !== 'failed').map((item) => item.id);
    await Promise.all(pendingJobIds.map((jobId) => api(`/api/ai/jobs/${jobId}`).catch(() => null)));
    await renderCurrentRoute();
  }, 5000);
}

async function runAI(button, applicationId, options = {}) {
  const cvId = Number(button.dataset.cvId);
  if (!cvId) {
    showToast('Link or upload a CV before generating documents.', 'warning');
    return;
  }

  const provider = state.selectedAIProvider === 'aws' && state.appConfig.awsEnabled ? 'aws' : 'gemini';

  setButtonBusy(button, true);
  try {
    const payload = await api(aiEndpoints[button.dataset.ai], {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        application_id: applicationId,
        cv_id: cvId,
        provider
      })
    });
    await loadNotifications();
    if (payload.document?.id) {
      state.contentWorkspace.recentDocumentId = payload.document.id;
      showToast('Document generated.');
      if (!options.suppressNavigate) navigateTo(`/applications/${applicationId}?tab=content&document=${payload.document.id}`);
      return;
    }
  } catch (error) {
    const message = error.message.includes('job description')
      ? 'Add a job description or posting link before generating this document.'
      : error.message;
    showToast(message, 'error');
    return;
  } finally {
    setButtonBusy(button, false);
  }

  if (!options.silentQueued) showToast('Generation queued.');
  if (!options.suppressNavigate) navigateTo(`/applications/${applicationId}?tab=content`);
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
    showToast('Import completed.');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    els.importCsvInput.value = '';
  }
}

function handleRestoreBackupSelection() {
  updateRestoreBackupSelection();
  const file = els.restoreBackupInput.files[0];
  if (file) showToast(`Backup selected: ${file.name}`, 'info');
}

function clearSelectedBackup() {
  els.restoreBackupInput.value = '';
  updateRestoreBackupSelection();
  showToast('Backup selection cleared.', 'info');
}

function updateRestoreBackupSelection(message = 'Ready to restore.') {
  const file = els.restoreBackupInput.files[0];
  const hasFile = Boolean(file);
  if (els.restoreBackupSelection) els.restoreBackupSelection.hidden = !hasFile;
  if (els.restoreBackupFileName) els.restoreBackupFileName.textContent = file?.name || '';
  if (els.restoreBackupStatus) els.restoreBackupStatus.textContent = hasFile ? message : '';
  if (els.settingsRestoreSelectedButton) els.settingsRestoreSelectedButton.disabled = !hasFile;
  if (els.settingsClearBackupButton) els.settingsClearBackupButton.disabled = !hasFile;
}

async function restoreBackup() {
  const file = els.restoreBackupInput.files[0];
  if (!file) {
    updateRestoreBackupSelection();
    showToast('Choose a backup file first.', 'warning');
    return;
  }
  const confirmed = await confirmAction(
    'Restore backup',
    `Restore will replace the current local data, uploads, AI documents, jobs, and settings with "${file.name}".`,
    'Restore Backup'
  );
  if (!confirmed) return;
  const formData = new FormData();
  formData.append('backup', file);
  try {
    updateRestoreBackupSelection('Restoring selected backup...');
    await api('/api/import/backup', { method: 'POST', body: formData });
    state.contentWorkspace.recentDocumentId = null;
    await Promise.all([loadApplications(), loadCVs(), loadSavedFilters(), loadReminders(), loadNotifications(), loadJobBoards()]);
    showToast('Backup restored.', 'info');
    els.restoreBackupInput.value = '';
    updateRestoreBackupSelection();
    navigateTo('/');
  } catch (error) {
    updateRestoreBackupSelection('Restore failed. You can retry or choose another file.');
    showToast(error.message, 'error');
  }
}

async function saveCurrentFilter() {
  const name = els.savedFilterName.value.trim();
  if (!name) {
    showToast('Enter a filter name first.', 'warning');
    return;
  }

  await withAsyncButton(els.saveFilterButton, async () => {
    const payload = await api('/api/saved-filters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, ...state.filters })
    });
    els.savedFilterName.value = '';
    await loadSavedFilters();
    els.savedFilterSelect.value = String(payload.filter.id);
    showToast('Filter saved.');
  });
}

async function deleteCurrentSavedFilter() {
  const id = Number(els.savedFilterSelect.value);
  if (!id) {
    showToast('Select a saved filter first.', 'warning');
    return;
  }
  await runConfirmedAction({
    title: 'Delete saved filter',
    body: 'Delete this saved filter?',
    acceptLabel: 'Delete',
    triggerButton: els.deleteFilterButton,
    successMessage: 'Saved filter deleted.',
    onConfirm: async () => {
      await api(`/api/saved-filters/${id}`, { method: 'DELETE' });
      els.savedFilterSelect.value = '';
      await loadSavedFilters();
    }
  });
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
    showToast(error.message, 'error');
  });
}

function parseRoute(pathname, search) {
  const searchParams = new URLSearchParams(search || '');
  const contentMatch = pathname.match(/^\/applications\/(\d+)\/content\/(\d+)$/);
  if (contentMatch) {
    return {
      path: pathname,
      page: 'application',
      applicationId: Number(contentMatch[1]),
      documentId: Number(contentMatch[2]),
      tab: 'content'
    };
  }

  const libraryMatch = pathname.match(/^\/applications\/(\d+)\/content$/);
  if (libraryMatch) {
    return {
      path: pathname,
      page: 'application',
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
      documentId: searchParams.get('document') ? Number(searchParams.get('document')) : null,
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
  els.applicationEditForm.elements.next_action.value = application.next_action || '';
  els.applicationEditForm.elements.next_action_due_date.value = application.next_action_due_date || '';
  els.applicationEditForm.elements.job_link.value = application.job_link || '';
  els.applicationEditForm.elements.notes.value = application.notes || '';
  const archiveBtn = els.applicationEditForm.querySelector('[data-archive-action]');
  const restoreBtn = els.applicationEditForm.querySelector('[data-restore-action]');
  const deleteBtn = els.applicationEditForm.querySelector('[data-delete-action]');

  if (archiveBtn) archiveBtn.hidden = Boolean(application.archived_at);
  if (restoreBtn) restoreBtn.hidden = !application.archived_at;

  if (archiveBtn) {
    archiveBtn.onclick = async () => {
      await runConfirmedAction({
        title: 'Archive application',
        body: `Archive ${application.company_name}?`,
        acceptLabel: 'Archive',
        triggerButton: archiveBtn,
        successMessage: 'Application archived.',
        onConfirm: async () => {
          await archiveApplication(application.id);
          els.applicationEditDialog.close();
          await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
        }
      });
    };
  }
  if (restoreBtn) {
    restoreBtn.onclick = async () => {
      await withAsyncButton(restoreBtn, async () => {
        await restoreApplication(application.id);
        els.applicationEditDialog.close();
        showToast('Application restored.', 'info');
        await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
      });
    };
  }
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      await runConfirmedAction({
        title: 'Delete application',
        body: `Delete ${application.company_name}? This cannot be undone.`,
        acceptLabel: 'Delete',
        triggerButton: deleteBtn,
        successMessage: 'Application deleted.',
        onConfirm: async () => {
          await api(`/api/applications/${application.id}`, { method: 'DELETE' });
          els.applicationEditDialog.close();
          await Promise.all([loadApplications(), loadReminders(), loadNotifications()]);
          navigateTo('/');
        }
      });
    };
  }

  els.applicationEditDialog.showModal();
}

async function submitApplicationEditForm(event) {
  event.preventDefault();
  const current = state.currentApplication?.application;
  if (!current) return;
  setError(els.applicationEditError, '');
  const form = new FormData(els.applicationEditForm);
  const status = form.get('status');
  const interviewDate = form.get('interview_date');
  if (status === 'interview_scheduled' && !interviewDate) {
    setError(els.applicationEditError, 'Set an interview date before saving Interview Scheduled.');
    return;
  }
  if (status !== 'interview_scheduled' && interviewDate) {
    setError(els.applicationEditError, 'Clear the interview date or use Interview Scheduled status.');
    return;
  }

  await withAsyncForm(els.applicationEditForm, async () => {
    await api(`/api/applications/${form.get('id')}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        company_name: form.get('company_name'),
        role_title: form.get('role_title'),
        status,
        applied_date: form.get('applied_date'),
        interview_date: interviewDate || null,
        next_action: form.get('next_action'),
        next_action_due_date: form.get('next_action_due_date') || null,
        salary: form.get('salary'),
        location: form.get('location'),
        recruiter: form.get('recruiter'),
        contact_person: form.get('contact_person'),
        job_link: form.get('job_link'),
        job_description: current.job_description,
        notes: form.get('notes'),
        tags: state.currentApplication.tags || []
      })
    });
    els.applicationEditDialog.close();
    showToast('Save successful.');
    await Promise.all([loadApplications(), loadReminders(), loadNotifications(), renderCurrentRoute()]);
  }, (error) => {
    setError(els.applicationEditError, error.message);
  });
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

function clearContentPolling() {
  if (state.contentPollTimerId) {
    window.clearTimeout(state.contentPollTimerId);
    state.contentPollTimerId = null;
  }
}

function setButtonBusy(button, isBusy) {
  if (!button) return;
  if (isBusy) {
    button.dataset.originalLabel = button.dataset.originalLabel || button.textContent;
    button.dataset.busyLabel = button.dataset.loadingLabel || 'Working';
    button.style.width = `${Math.ceil(button.getBoundingClientRect().width)}px`;
    button.classList.add('is-busy');
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    return;
  }
  button.disabled = false;
  button.classList.remove('is-busy');
  button.removeAttribute('aria-busy');
  button.style.width = '';
}

function showToast(message, type = 'success') {
  if (!els.appToast) return;
  const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  state.toasts = [...state.toasts, { id, message, type }];
  renderToasts();
  window.setTimeout(() => dismissToast(id), type === 'error' ? 4400 : 2600);
}

function dismissToast(id) {
  state.toasts = state.toasts.filter((item) => item.id !== id);
  renderToasts();
}

function renderToasts() {
  if (!els.appToast) return;
  els.appToast.innerHTML = state.toasts.map((toast) => `
    <article class="app-toast" data-type="${escapeAttribute(toast.type)}">
      <div>
        <strong>${escapeHtml(toastTypeLabel(toast.type))}</strong>
        <p>${escapeHtml(toast.message)}</p>
      </div>
      <button class="icon-button" type="button" data-toast-dismiss="${toast.id}" aria-label="Dismiss notification">Close</button>
    </article>
  `).join('');
  els.appToast.querySelectorAll('[data-toast-dismiss]').forEach((button) => {
    button.addEventListener('click', () => dismissToast(button.dataset.toastDismiss));
  });
}

function toastTypeLabel(type) {
  if (type === 'error') return 'Error';
  if (type === 'warning') return 'Warning';
  if (type === 'info') return 'Info';
  return 'Success';
}

function openDetailDialog(title, body) {
  els.detailTitle.textContent = title;
  els.detailContent.innerHTML = body;
  els.detailDialog.showModal();
}

function bindValidatedForms(root) {
  root.querySelectorAll('form[data-note-form], form[data-question-form], form[data-feedback-form], form[data-todo-form], form[data-preparation-form]').forEach((form) => {
    const submitButton = form.querySelector('button[type="submit"]');
    if (!submitButton) return;
    const validate = () => {
      clearFormError(form);
      const textareas = [...form.querySelectorAll('textarea')];
      const valid = textareas.length ? textareas.some((field) => String(field.value || '').trim()) : true;
      const dueDateInput = form.elements?.due_date;
      const dueDateValid = !dueDateInput || !dueDateInput.value.trim() || /^\d{4}-\d{2}-\d{2}$/.test(parseDisplayDateToIso(dueDateInput.value));
      submitButton.disabled = !valid || !dueDateValid || form.dataset.submitting === 'true';
    };
    form.addEventListener('input', validate);
    form.addEventListener('submit', () => {
      if (form.dataset.submitting === 'true') return false;
      return true;
    });
    validate();
  });
}

async function confirmAction(title, body, acceptLabel = 'Confirm') {
  return new Promise((resolve) => {
    let result = false;
    els.confirmDialogTitle.textContent = title;
    els.confirmDialogBody.textContent = body;
    els.confirmDialogAccept.textContent = acceptLabel;
    setError(els.confirmDialogError, '');
    setButtonBusy(els.confirmDialogAccept, false);
    els.confirmDialogCancel.onclick = () => {
      result = false;
      els.confirmDialog.close();
    };
    els.confirmDialogAccept.onclick = () => {
      result = true;
      els.confirmDialog.close();
    };
    els.confirmDialog.addEventListener('close', () => resolve(result), { once: true });
    els.confirmDialog.showModal();
  });
}

async function runConfirmedAction({ title, body, acceptLabel = 'Confirm', triggerButton = null, successMessage = null, onConfirm, onError = null }) {
  if (!(await confirmAction(title, body, acceptLabel))) return false;
  try {
    await withAsyncButton(triggerButton, onConfirm);
    if (successMessage) showToast(successMessage);
    return true;
  } catch (error) {
    if (onError) onError(error);
    else showToast(error.message, 'error');
    return false;
  }
}

async function withAsyncButton(button, task) {
  setButtonBusy(button, true);
  try {
    return await task();
  } finally {
    setButtonBusy(button, false);
  }
}

async function withAsyncForm(form, task, onError = null) {
  if (!form || form.dataset.submitting === 'true') return null;
  const submitButton = form.querySelector('button[type="submit"]');
  form.dataset.submitting = 'true';
  clearFormError(form);
  setButtonBusy(submitButton, true);
  try {
    return await task();
  } catch (error) {
    if (onError) onError(error);
    else {
      setFormError(form, error.message);
      showToast(error.message, 'error');
    }
    return null;
  } finally {
    form.dataset.submitting = 'false';
    setButtonBusy(submitButton, false);
  }
}

function readRequiredText(form, fieldName, message) {
  const field = form?.elements?.[fieldName];
  const value = String(field?.value || '').trim();
  if (!value) {
    setFormError(form, message);
    showToast('Validation error.', 'warning');
    return '';
  }
  field.value = value;
  clearFormError(form);
  return value;
}

function normalizeOptionalDisplayDate(form, fieldName) {
  const field = form?.elements?.[fieldName];
  const value = String(field?.value || '').trim();
  if (!value) return '';
  const normalized = parseDisplayDateToIso(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    setFormError(form, 'Enter a valid due date in DD-MM-YYYY format.');
    showToast('Validation error.', 'warning');
    return null;
  }
  clearFormError(form);
  return normalized;
}

function setFormError(form, message) {
  const element = ensureFormError(form);
  setError(element, message);
}

function clearFormError(form) {
  const element = form?.querySelector('[data-form-error]');
  if (element) setError(element, '');
}

function ensureFormError(form) {
  let element = form.querySelector('[data-form-error]');
  if (element) return element;
  element = document.createElement('p');
  element.className = 'form-error inline-form-error';
  element.dataset.formError = 'true';
  element.hidden = true;
  form.appendChild(element);
  return element;
}

function resetDialogState(dialog) {
  if (!dialog) return;
  if (dialog === els.confirmDialog) {
    setError(els.confirmDialogError, '');
    setButtonBusy(els.confirmDialogAccept, false);
  }
  if (dialog === els.editorDialog) {
    setError(els.editorDialogError, '');
  }
  if (dialog === els.detailDialog) {
    els.detailContent.innerHTML = '';
  }
  if (dialog === els.targetCompanyDialog) {
    resetTargetCompanyForm();
  }
}

function resetTransientUiState() {
  [els.detailDialog, els.confirmDialog, els.editorDialog].forEach((dialog) => {
    if (dialog?.open) {
      dialog.close();
      resetDialogState(dialog);
    }
  });
}

function unmountInactiveHomeViews(activeView) {
  const clear = (element) => {
    if (element) element.innerHTML = '';
  };
  if (activeView !== 'reminders') clear(els.remindersList);
  if (activeView !== 'kanban') clear(els.kanbanBoard);
  if (activeView !== 'reports') clear(els.reportsContent);
  if (activeView !== 'stats') clear(els.statsContent);
  if (activeView !== 'activity') {
    clear(els.activityTable);
    if (els.activityPagination) els.activityPagination.innerHTML = '';
  }
  if (activeView !== 'boards') clear(els.jobBoardsList);
  if (activeView !== 'companies') clear(els.targetCompaniesList);
}

function renderSectionLoading(element, title) {
  if (!element) return;
  if (element.tagName === 'TBODY') {
    element.innerHTML = `<tr><td colspan="4"><div class="section-loading">${escapeHtml(title)}...</div></td></tr>`;
    return;
  }
  element.innerHTML = `<div class="section-loading">${escapeHtml(title)}...</div>`;
}

async function promptForText({ title, label, value = '', submitLabel = 'Save' }) {
  return new Promise((resolve) => {
    let result = null;
    els.editorDialogTitle.textContent = title;
    els.editorDialogLabel.textContent = label;
    els.editorDialogInput.value = value;
    els.editorDialogSubmit.textContent = submitLabel;
    setError(els.editorDialogError, '');
    els.editorDialogForm.onsubmit = (event) => {
      event.preventDefault();
      const next = els.editorDialogInput.value.trim();
      if (!next) {
        setError(els.editorDialogError, `${label} is required.`);
        return;
      }
      result = next;
      els.editorDialog.close();
    };
    els.editorDialog.addEventListener('close', () => resolve(result), { once: true });
    els.editorDialog.showModal();
    els.editorDialogInput.focus();
  });
}

async function promptForOptionalText({ title, label, submitLabel = 'Save' }) {
  return new Promise((resolve) => {
    let submitted = false;
    els.editorDialogTitle.textContent = title;
    els.editorDialogLabel.textContent = label;
    els.editorDialogInput.value = '';
    els.editorDialogSubmit.textContent = submitLabel;
    setError(els.editorDialogError, '');
    els.editorDialogForm.onsubmit = (event) => {
      event.preventDefault();
      submitted = true;
      els.editorDialog.close();
    };
    els.editorDialog.addEventListener('close', () => {
      resolve(submitted ? els.editorDialogInput.value.trim() : false);
    }, { once: true });
    els.editorDialog.showModal();
    els.editorDialogInput.focus();
  });
}

function bindDocumentPreviewActions(application, document, relatedDocuments = []) {
  els.detailContent.querySelector('[data-preview-copy]')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(document.content || '').catch(() => null);
    showToast('Copy successful.');
  });
  els.detailContent.querySelector('[data-preview-regenerate]')?.addEventListener('click', async (event) => {
    const provider = state.selectedAIProvider === 'aws' && state.appConfig.awsEnabled ? 'aws' : 'gemini';
    await runConfirmedAction({
      title: 'Regenerate document',
      body: 'Create a new version from this document. The current latest version stays available until regeneration completes.',
      acceptLabel: 'Regenerate',
      triggerButton: event.currentTarget,
      successMessage: null,
      onConfirm: async () => {
        const payload = await api(`/api/ai/documents/${document.id}/regenerate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider })
        });
        els.detailDialog.close();
        if (payload.document?.id) state.contentWorkspace.recentDocumentId = payload.document.id;
        showToast(payload.document?.id ? 'Document regenerated.' : 'Regeneration queued.');
        navigateTo(payload.document?.id ? `/applications/${application.id}?tab=content&document=${payload.document.id}` : `/applications/${application.id}?tab=content`);
      }
    });
  });
  els.detailContent.querySelector('[data-preview-delete]')?.addEventListener('click', async (event) => {
    await runConfirmedAction({
      title: 'Delete document',
      body: 'Delete this generated document?',
      acceptLabel: 'Delete',
      triggerButton: event.currentTarget,
      successMessage: 'Document deleted.',
      onConfirm: async () => {
        await api(`/api/ai/documents/${document.id}`, { method: 'DELETE' });
        els.detailDialog.close();
        await renderCurrentRoute();
      }
    });
  });
  els.detailContent.querySelectorAll('[data-view-version]').forEach((button) => {
    button.addEventListener('click', () => {
      navigateTo(`/applications/${application.id}?tab=content&document=${button.dataset.viewVersion}`);
    });
  });
  els.detailContent.querySelector('[data-view-compare]')?.addEventListener('click', () => {
    const latest = relatedDocuments[0];
    if (!latest || Number(latest.id) === Number(document.id)) return;
    openDetailDialog('Compare versions', buildDocumentComparisonBody(document, latest));
  });
  els.detailContent.querySelector('[data-view-restore]')?.addEventListener('click', async (event) => {
    const provider = state.selectedAIProvider === 'aws' && state.appConfig.awsEnabled ? 'aws' : 'gemini';
    await runConfirmedAction({
      title: 'Restore version',
      body: 'Restore this version as the new latest document. This creates a fresh version instead of overwriting the older draft.',
      acceptLabel: 'Restore',
      triggerButton: event.currentTarget,
      successMessage: null,
      onConfirm: async () => {
        const payload = await api(`/api/ai/documents/${document.id}/regenerate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider })
        });
        els.detailDialog.close();
        if (payload.document?.id) state.contentWorkspace.recentDocumentId = payload.document.id;
        showToast(payload.document?.id ? 'Version restored as latest.' : 'Restore queued.');
        navigateTo(payload.document?.id ? `/applications/${application.id}?tab=content&document=${payload.document.id}` : `/applications/${application.id}?tab=content`);
      }
    });
  });
}

function buildDocumentComparisonBody(left, right) {
  const diff = buildDocumentDiff(left.content || '', right.content || '');
  return `
    <section class="route-card detail-dialog-card">
      <div class="section-heading">
        <div>
          <div class="panel-kicker">Version Compare</div>
          <h3>${escapeHtml(left.title)}</h3>
        </div>
      </div>
      <div class="document-card-meta">
        <span class="pill subtle">${diff.added} added</span>
        <span class="pill subtle">${diff.removed} removed</span>
        <span class="pill info-pill">${diff.changed} changed blocks</span>
      </div>
      <div class="document-compare-grid">
        <article class="document-compare-card">
          <div class="document-card-head">
            <div>
              <strong>Selected version</strong>
              <p>${escapeHtml(formatDateTime(left.created_at))}</p>
            </div>
            <span class="pill subtle">${escapeHtml(friendlyProviderLabel(left))}</span>
          </div>
          <pre class="document-preview-body">${escapeHtml(left.content || '')}</pre>
        </article>
        <article class="document-compare-card">
          <div class="document-card-head">
            <div>
              <strong>Latest version</strong>
              <p>${escapeHtml(formatDateTime(right.created_at))}</p>
            </div>
            <span class="pill success-pill">Latest</span>
          </div>
          <pre class="document-preview-body">${escapeHtml(right.content || '')}</pre>
        </article>
      </div>
      ${diff.rows.length ? `
        <div class="document-diff-list">
          ${diff.rows.map((row) => `
            <article class="document-diff-row diff-${escapeAttribute(row.kind)}">
              <strong>${escapeHtml(row.label)}</strong>
              <p>${escapeHtml(row.text)}</p>
            </article>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

function buildDocumentDiff(leftContent, rightContent) {
  const leftLines = String(leftContent || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const rightLines = String(rightContent || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const rowCount = Math.max(leftLines.length, rightLines.length);
  const rows = [];
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (let index = 0; index < rowCount; index += 1) {
    const left = leftLines[index] || '';
    const right = rightLines[index] || '';
    if (left && !right) {
      removed += 1;
      rows.push({ kind: 'removed', label: 'Removed', text: left });
      continue;
    }
    if (!left && right) {
      added += 1;
      rows.push({ kind: 'added', label: 'Added', text: right });
      continue;
    }
    if (left !== right) {
      changed += 1;
      rows.push({ kind: 'changed', label: 'Changed from', text: left });
      rows.push({ kind: 'added', label: 'Changed to', text: right });
    }
  }

  return { added, removed, changed, rows };
}

function openDocumentPreview(application, document, relatedDocuments = []) {
  openDetailDialog(document.title, renderRouteLoadingState(`Opening ${formatDocType(document.document_type)}`, 'Preparing document viewer'));
  window.requestAnimationFrame(() => {
    const orderedDocuments = [...relatedDocuments].sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    const currentIndex = orderedDocuments.findIndex((item) => Number(item.id) === Number(document.id));
    const versionNumber = currentIndex === -1 ? 1 : orderedDocuments.length - currentIndex;
    const latestDocument = orderedDocuments[0] || document;
    els.detailContent.innerHTML = `
      <section class="document-viewer-shell">
        <header class="document-viewer-header">
          <div class="document-viewer-header-copy">
            <div class="panel-kicker">${escapeHtml(formatDocType(document.document_type))}</div>
            <h3>${escapeHtml(document.title)}</h3>
            <div class="document-card-meta">
              <span class="pill subtle">${escapeHtml(friendlyProviderLabel(document))}</span>
              <span class="pill info-pill">Version ${versionNumber}${currentIndex === 0 ? ' • Latest' : ''}</span>
              <span class="pill subtle">${escapeHtml(formatDateTime(document.created_at))}</span>
              ${document.model_name ? `<span class="pill subtle">${escapeHtml(document.model_name)}</span>` : ''}
            </div>
          </div>
          <div class="document-card-actions document-viewer-actions">
            <a class="button-link secondary" href="${escapeAttribute(document.download_url)}">Download</a>
            <button type="button" data-preview-copy="${document.id}">Copy Text</button>
            <button class="secondary" type="button" data-preview-regenerate="${document.id}">Regenerate</button>
            <button class="danger" type="button" data-preview-delete="${document.id}">Delete</button>
          </div>
        </header>
        <div class="document-viewer-layout">
          <article class="document-viewer-main">
            <div class="document-viewer-content">
              ${renderDocumentContent(document)}
            </div>
          </article>
          <aside class="document-viewer-sidebar">
            <section class="route-card document-viewer-sidecard">
              <div class="panel-kicker">Document Details</div>
              <div class="metadata-list">
                <div class="metadata-row">
                  <span>Status</span>
                  <strong>${escapeHtml(document.generation_status || 'completed')}</strong>
                </div>
                <div class="metadata-row">
                  <span>Saved Versions</span>
                  <strong>${escapeHtml(String(orderedDocuments.length))}</strong>
                </div>
                <div class="metadata-row">
                  <span>Format</span>
                  <strong>DOCX + Text</strong>
                </div>
              </div>
            </section>
            <section class="route-card document-viewer-sidecard">
              <div class="section-heading">
                <div>
                  <div class="panel-kicker">Versions</div>
                  <h4>${orderedDocuments.length} saved</h4>
                </div>
                ${currentIndex !== 0 ? '<button class="secondary" type="button" data-view-restore>Restore</button>' : ''}
              </div>
              <div class="document-viewer-version-list">
                ${orderedDocuments.map((item, index) => `
                  <article class="document-viewer-version-item ${Number(item.id) === Number(document.id) ? 'is-current' : ''}">
                    <div>
                      <strong>Version ${orderedDocuments.length - index}${index === 0 ? ' • Latest' : ''}</strong>
                      <p>${escapeHtml(formatDateTime(item.created_at))}</p>
                    </div>
                    <div class="document-card-actions">
                      ${Number(item.id) === Number(document.id)
                        ? '<span class="pill success-pill">Open</span>'
                        : `<button class="secondary" type="button" data-view-version="${item.id}">Open</button>`}
                    </div>
                  </article>
                `).join('')}
              </div>
              ${currentIndex !== 0 && latestDocument ? '<button class="secondary" type="button" data-view-compare>Compare with latest</button>' : ''}
            </section>
          </aside>
        </div>
      </section>
    `;
    const scroller = els.detailContent.querySelector('.document-viewer-main');
    const shell = els.detailContent.querySelector('.document-viewer-shell');
    scroller?.addEventListener('scroll', () => {
      shell?.classList.toggle('is-scrolled', scroller.scrollTop > 6);
    });
    bindDocumentPreviewActions(application, document, orderedDocuments);
  });
  els.detailDialog.addEventListener('close', () => {
    const current = parseRoute(location.pathname, location.search);
    if (current.page === 'application' && current.tab === 'content' && Number(current.documentId) === Number(document.id)) {
      window.history.replaceState({}, '', `/applications/${application.id}?tab=content`);
    }
  }, { once: true });
}

function formatDocType(type) {
  return String(type || '').replaceAll('_', ' ');
}

function friendlyProviderLabel(document) {
  const requested = String(document?.provider_requested || '').trim().toLowerCase();
  const provider = String(document?.provider_name || '').trim().toLowerCase();
  if (requested === 'gemini') return 'Gemini';
  if (requested === 'aws') return 'AWS';
  if (requested === 'mock') return 'Mock';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'aws') return 'AWS';
  if (provider === 'mock') return 'Mock';
  if (provider === 'openai-compatible') return 'AI Provider';
  return document?.provider_name || document?.provider_requested || 'unknown';
}
