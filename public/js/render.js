import {
  activityApplicationName,
  daysClass,
  escapeAttribute,
  escapeHtml,
  formatAction,
  formatBytes,
  formatDate,
  formatDateTime,
  formatDays,
  formatMonthLabel,
  formatMonthTitle,
  isoDate,
  maxCount,
  renderDays,
  renderInterviewControl,
  renderTags,
  reportRow
} from './utils.js';
import { isClosedStatus, statusLabels } from './state.js';

export function renderHomeWorkspace() {
  return `
    <section class="workspace-view workspace-view-home" data-workspace-view="home">
      <section id="notificationsPanel" class="notifications-panel" hidden></section>

      <section id="listView" class="surface-panel">
        <section class="toolbar" aria-label="Filters">
          <div class="toolbar-main-row">
            <label>
              <span>Search</span>
              <input id="searchInput" type="search" placeholder="Company">
            </label>
            <button id="filterToggle" class="icon-button" type="button" aria-label="Toggle filters" title="Filters">
              <i class="bi bi-filter"></i>
            </button>
          </div>
          <div id="filterPanel" class="filter-panel" hidden>
            <label>
              <span>Status</span>
              <select id="statusFilter">
                <option value="">All</option>
                <option value="applied">Applied</option>
                <option value="interview_scheduled">Interview Scheduled</option>
                <option value="offer">Offer</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="withdrawn">Withdrawn</option>
                <option value="ghosted">Ghosted</option>
              </select>
            </label>
            <label>
              <span>Tag</span>
              <input id="tagFilter" type="search" placeholder="Remote">
            </label>
            <label>
              <span>View</span>
              <select id="archiveFilter">
                <option value="false">Active</option>
                <option value="closed">Closed</option>
                <option value="true">Archived</option>
                <option value="all">All</option>
              </select>
            </label>
            <label>
              <span>From</span>
              <input id="dateFromFilter" type="date">
            </label>
            <label>
              <span>To</span>
              <input id="dateToFilter" type="date">
            </label>
            <button id="resetFiltersButton" class="icon-button" type="button" aria-label="Clear filters" title="Clear filters" style="align-self: flex-end; margin-bottom: 4px;">
              <i class="bi bi-x-circle"></i>
            </button>
            <label style="display: none !important;" hidden>
              <span>Saved Filter</span>
              <select id="savedFilterSelect">
                <option value="">Current filters</option>
              </select>
            </label>
            <div class="saved-filter-row" style="display: none !important;" hidden>
              <label>
                <span>Save As</span>
                <input id="savedFilterName" type="text" placeholder="Interview week">
              </label>
              <button id="saveFilterButton" class="secondary" type="button">Save Filter</button>
              <button id="deleteFilterButton" class="secondary" type="button">Delete Filter</button>
            </div>
            <div id="exportPanel" class="export-row">
              <button id="quickExportCsvButton" class="icon-button text-success" type="button" title="Export CSV"><i class="bi bi-filetype-csv"></i></button>
              <button id="quickExportIcsButton" class="icon-button text-primary" type="button" title="Calendar (.ics)"><i class="bi bi-calendar-event"></i></button>
            </div>
          </div>
        </section>
        <section class="table-shell" aria-live="polite">
          <table>
            <thead>
              <tr>
                <th class="select-col"><input type="checkbox" id="selectAllRows" aria-label="Select all applications"></th>
                <th>Company</th>
                <th>Applied</th>
                <th>Status</th>
                <th>Next</th>
                <th>Last Touched</th>
                <th>Interview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="applicationsTable"></tbody>
          </table>
          <div id="emptyState" class="empty" hidden>No applications match the current filters.</div>
        </section>
        <div id="bulkActionsBar" class="bulk-bar" hidden>
          <strong id="bulkCount">0 selected</strong>
          <div class="row-actions">
            <button id="bulkArchiveButton" class="icon-button" type="button" title="Archive Selected"><i class="bi bi-archive" style="color: var(--warn-line)"></i></button>
            <button id="bulkRestoreButton" class="icon-button" type="button" title="Restore Selected"><i class="bi bi-arrow-clockwise" style="color: var(--focus)"></i></button>
            <button id="bulkDeleteButton" class="icon-button" type="button" title="Delete Selected"><i class="bi bi-trash" style="color: var(--danger)"></i></button>
            <button id="bulkClearButton" class="icon-button" type="button" title="Clear Selection"><i class="bi bi-x-circle"></i></button>
          </div>
        </div>
      </section>

      <section id="remindersView" class="view-panel" hidden>
        <div id="remindersList" class="panel-grid"></div>
      </section>

      <section id="kanbanView" class="view-panel" hidden>
        <div id="kanbanBoard" class="kanban-board"></div>
      </section>

      <section id="insightsView" class="view-panel" hidden>
        <div id="insightsContent" class="reports-grid"></div>
      </section>

      <section id="activityView" class="surface-panel" hidden>
        <section class="toolbar" aria-label="Activity filters">
          <div class="toolbar-main-row">
            <label>
              <span>Activity Query</span>
              <input id="activitySearchInput" type="search" placeholder="Company, action, detail">
            </label>
            <button id="activityResetButton" class="icon-button" type="button" aria-label="Clear filters" title="Clear filters" style="align-self: flex-end; margin-bottom: 4px;">
              <i class="bi bi-x-circle"></i>
            </button>
            <button id="activityDeleteButton" class="secondary text-danger" type="button" disabled style="margin-left: auto;">
              <i class="bi bi-trash"></i> Delete Selected
            </button>
          </div>
        </section>
        <section class="table-shell" aria-live="polite">
          <table>
            <thead>
              <tr>
                <th class="select-col"><input type="checkbox" id="activitySelectAllCheckbox" aria-label="Select all activities"></th>
                <th>When</th>
                <th>Application</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="activityTable"></tbody>
          </table>
          <div id="activityEmptyState" class="empty" hidden>No activity found.</div>
        </section>
        <div class="pagination" id="activityPagination"></div>
      </section>

      <section id="boardsView" class="view-panel" hidden>
        <section class="detail-section boards-surface">
          <div class="section-heading boards-heading">
            <div>
              <h3>Job Boards</h3>
              <p class="section-help">Keep active sourcing channels visible, recent, and easy to maintain.</p>
            </div>
            <button id="jobBoardOpenButton" type="button">Add Job Board</button>
          </div>
          <div id="jobBoardsList" class="board-list"></div>
        </section>
      </section>

      <section id="companiesView" class="view-panel" hidden>
        <section class="detail-section boards-surface">
          <div class="section-heading boards-heading">
            <div>
              <h3>Company List</h3>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button id="targetCompanyFilterToggle" class="icon-button" type="button" aria-label="Toggle filters" title="Filters">
                <i class="bi bi-filter"></i>
              </button>
              <button id="targetCompanyOpenButton" type="button">Add Company</button>
            </div>
          </div>
          <section id="targetCompanyFilterPanel" class="target-company-toolbar filter-panel" aria-label="Company filters" hidden>
            <label>
              <span>Keyword</span>
              <input id="targetCompanySearchInput" type="search" placeholder="Company, stack, city">
            </label>
            <label>
              <span>Region</span>
              <select id="targetCompanyRegionFilter"></select>
            </label>
            <label>
              <span>Visa</span>
              <select id="targetCompanyVisaFilter"></select>
            </label>
            <label>
              <span>Work Mode</span>
              <select id="targetCompanyWorkModeFilter"></select>
            </label>
            <label>
              <span>Industry</span>
              <select id="targetCompanyIndustryFilter"></select>
            </label>
            <button id="targetCompanyResetButton" class="icon-button" type="button" aria-label="Clear filters" title="Clear filters" style="align-self: flex-end; margin-bottom: 4px;">
              <i class="bi bi-x-circle"></i>
            </button>
          </section>
          <p id="targetCompaniesSummary" class="section-help"></p>
          <div id="targetCompaniesList" class="board-list"></div>
          <div class="pagination" id="targetCompanyPagination"></div>
        </section>
      </section>

      <section id="settingsView" class="view-panel" hidden>
        <div id="settingsContent" class="settings-grid">
          ${renderSettingsPanel()}
          <div class="settings-section-divider">
            <h2 class="settings-section-title"><i class="bi bi-tools"></i> Toolkit</h2>
            <p class="settings-section-sub">Reference guides and checklists for your job search workflow.</p>
          </div>
          <div id="toolkitContent" class="toolkit-grid"></div>
        </div>
      </section>
    </section>
  `;
}

export function renderInsights(els, report, stats, statusLabels, mode = 'active') {
  const total = Number(stats.totals.total || 0);
  const funnelRows = [
    { label: 'Applied', count: total },
    { label: 'Interview', count: Number(stats.funnel.interviewed || 0) },
    { label: 'Offer', count: Number(stats.funnel.offers || 0) },
    { label: 'Accepted', count: Number(stats.funnel.accepted || 0) }
  ];
  const funnelMax = Math.max(1, ...funnelRows.map((row) => row.count));
  const rate = (part, whole) => {
    if (!whole) return '0%';
    const p = Math.round((Number(part || 0) / whole) * 100);
    return p > 0 ? `${p}%` : '0%';
  };
  const tagMax = Math.max(1, ...stats.tags.map((row) => Number(row.applications || 0)));
  const tagHtml = stats.tags.map((row) => {
    let toIntStr = '';
    const rateVal = Math.round((Number(row.interviewed || 0) / Number(row.applications || 1)) * 100);
    if (rateVal > 0) toIntStr = `${rateVal}% interview rate`;
    return reportRow(row.tag, Number(row.applications), tagMax, {}, toIntStr, '--focus');
  }).join('') || '<p>No tag data.</p>';

  const getW = (count) => total > 0 ? Math.max(15, (count / total) * 100) : 100;
  const w0 = getW(funnelRows[0].count);
  const w1 = getW(funnelRows[1].count);
  const w2 = getW(funnelRows[2].count);
  const w3 = getW(funnelRows[3].count);

  const poly = (topW, botW) => {
    const tl = (100 - topW) / 2, tr = 100 - tl;
    const bl = (100 - botW) / 2, br = 100 - bl;
    return `clip-path: polygon(${tl}% 0%, ${tr}% 0%, ${br}% 100%, ${bl}% 100%);`;
  };

  els.insightsContent.innerHTML = `
    <div class="insights-toolbar" style="grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 6px; margin-bottom: 4px;">
      <button class="${mode === 'active' ? '' : 'secondary'}" data-insights-mode="active" type="button">Active Pipeline</button>
      <button class="${mode === 'all' ? '' : 'secondary'}" data-insights-mode="all" type="button">All Time</button>
    </div>
    <!-- Top Row -->
    <section class="report-panel wide" style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px;">
      <div>
        <div class="panel-kicker">Funnel</div>
        <h3>Application Funnel</h3>
        <div class="true-funnel">
          <div class="funnel-stage">
            <div class="funnel-stage-label">Applied</div>
            <div class="funnel-shape-container">
              <div class="funnel-shape" style="${poly(w0, w1)} background: var(--accent); border-radius: 8px 8px 0 0;"></div>
            </div>
            <div class="funnel-stage-count">${funnelRows[0].count}</div>
          </div>
          <div class="funnel-conv"><span class="conv-pill">↓ ${rate(stats.funnel.interviewed, total)} to Interview</span></div>
          
          <div class="funnel-stage">
            <div class="funnel-stage-label">Interview</div>
            <div class="funnel-shape-container">
              <div class="funnel-shape" style="${poly(w1, w2)} background: var(--int);"></div>
            </div>
            <div class="funnel-stage-count">${funnelRows[1].count}</div>
          </div>
          <div class="funnel-conv"><span class="conv-pill">↓ ${rate(stats.funnel.offers, stats.funnel.interviewed)} to Offer</span></div>
          
          <div class="funnel-stage">
            <div class="funnel-stage-label">Offer</div>
            <div class="funnel-shape-container">
              <div class="funnel-shape" style="${poly(w2, w3)} background: var(--act);"></div>
            </div>
            <div class="funnel-stage-count">${funnelRows[2].count}</div>
          </div>
          <div class="funnel-conv"><span class="conv-pill">↓ ${rate(stats.funnel.accepted, stats.funnel.offers)} to Accept</span></div>
          
          <div class="funnel-stage">
            <div class="funnel-stage-label">Accepted</div>
            <div class="funnel-shape-container">
              <div class="funnel-shape" style="${poly(w3, w3)} background: var(--act); border-radius: 0 0 8px 8px;"></div>
            </div>
            <div class="funnel-stage-count">${funnelRows[3].count}</div>
          </div>
        </div>
      </div>
      <div>
        <div class="panel-kicker">Outcomes</div>
        <h3>Responses</h3>
        ${reportRow('Responded', Number(stats.funnel.responded || 0), Math.max(1, total), null, total, '--app')}
        ${reportRow('Rejected', Number(stats.funnel.rejected || 0), Math.max(1, total), null, total, '--cls')}
        ${reportRow('Ghosted', Number(stats.totals.ghosted || 0), Math.max(1, total), null, total, '--muted')}
        <p class="section-help">Response rate ${rate(stats.funnel.responded, total)}</p>
      </div>
    </section>

    <!-- Middle Row -->
    <section class="report-panel report-panel-lifecycle">
      <div class="panel-kicker">Portfolio</div>
      <h3>Lifecycle</h3>
      ${[
        { label: 'Active', count: Number(report.lifecycle_counts.active || 0), jump: { view: 'false' }, color: '--app' },
        { label: 'Closed', count: Number(report.lifecycle_counts.closed || 0), jump: { view: 'closed' }, color: '--cls' },
        { label: 'Archived', count: Number(report.lifecycle_counts.archived || 0), jump: { view: 'true' }, color: '--muted' }
      ].map((row) => reportRow(row.label, row.count, Number(report.lifecycle_counts.total || 1), row.jump, Number(report.lifecycle_counts.total || 0), row.color)).join('')}
    </section>
    
    <section class="report-panel report-panel-status">
      <div class="panel-kicker">Snapshot</div>
      <h3>Status Distribution</h3>
      ${(() => {
        const statusTotal = report.status_counts.reduce((sum, row) => sum + Number(row.count), 0);
        const getStatusColor = (status) => {
          if (['applied'].includes(status)) return '--app';
          if (['interview_scheduled', 'interviewing'].includes(status)) return '--int';
          if (['offer_received', 'accepted'].includes(status)) return '--act';
          if (['rejected', 'withdrawn'].includes(status)) return '--cls';
          if (['ghosted'].includes(status)) return '--muted';
          return '--accent';
        };
        return report.status_counts.map((row) => reportRow(statusLabels[row.status] || row.status, Number(row.count), maxCount(report.status_counts), { status: row.status }, statusTotal, getStatusColor(row.status))).join('') || '<p>No status data.</p>';
      })()}
    </section>

    <!-- Bottom Row -->
    <section class="report-panel">
      <div class="panel-kicker">Velocity</div>
      <h3>Time in Stage</h3>
      <div class="stat-figures">
        <article>
          <strong>${stats.timing.avg_days_to_interview ?? '—'}</strong>
          <span>avg days to interview</span>
        </article>
        <article>
          <strong>${stats.timing.avg_days_to_rejection ?? '—'}</strong>
          <span>avg days to rejection</span>
        </article>
      </div>
    </section>
    
    <section class="report-panel report-panel-monthly">
      <div class="panel-kicker">Velocity</div>
      <h3>Monthly Applications</h3>
      ${(() => {
        const monthlyTotal = report.monthly_counts.reduce((sum, row) => sum + Number(row.count), 0);
        return report.monthly_counts.map((row) => reportRow(formatMonthLabel(row.month), Number(row.count), maxCount(report.monthly_counts), { month: row.month }, monthlyTotal, '--focus')).join('') || '<p>No monthly data.</p>';
      })()}
    </section>

    <section class="report-panel report-panel-tags wide" style="grid-column: 1 / -1;">
      <div class="panel-kicker">Skills</div>
      <h3>Top Tags</h3>
      <div style="column-count: 2; column-gap: 24px;">
        ${tagHtml}
      </div>
    </section>
  `;
}

export function renderActivity(els, state, payload) {
  state.activity.total = payload.total;
  els.activityEmpty.hidden = payload.activity.length !== 0;
  els.activityTable.innerHTML = payload.activity.map((item) => {
    const isSelected = state.activity.selectedIds?.has(item.id) ? ' checked' : '';
    return `
      <tr data-activity-id="${item.id}">
        <td class="select-col"><input type="checkbox" data-select-activity-id="${item.id}" aria-label="Select activity entry"${isSelected}></td>
        <td>${formatDateTime(item.created_at)}</td>
        <td>
          <div class="company-cell truncate-col">
            <strong>${escapeHtml(activityApplicationName(item))}</strong>
            <span>${item.application_id ? `Application ${item.application_id}` : ''}</span>
          </div>
        </td>
        <td>${escapeHtml(activityLabel(item.action, item.details))}</td>
        <td>${escapeHtml(cleanActivityDetails(item.details || ''))}</td>
      </tr>
    `;
  }).join('');
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
  const viewName = { true: 'archived', all: 'total', closed: 'closed', false: 'active' }[state.filters.archived] || 'active';
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
    els.table.appendChild(buildApplicationRow(application, statusOptions, state.selectedIds?.has(application.id)));
  }
}

export function buildApplicationRow(application, statusOptions, selected = false) {
  const closed = !application.archived_at && isClosedStatus(application.status);
  const row = document.createElement('tr');
  row.dataset.id = application.id;
  row.className = application.archived_at ? 'archived' : closed ? 'closed' : '';
  
  const subtitle = [application.role_title, application.location].filter(Boolean).join(' · ') || application.cv_name || 'No CV';
  
  row.innerHTML = `
    <td class="select-col"><input type="checkbox" data-select-id="${application.id}" aria-label="Select ${escapeHtml(application.company_name)}"${selected ? ' checked' : ''}></td>
    <td>
      <div class="company-cell">
        <strong title="${escapeAttribute(application.company_name)}">${escapeHtml(application.company_name)}</strong>
        <span title="${escapeAttribute(subtitle)}">${escapeHtml(subtitle)}</span>
      </div>
    </td>
    <td>${formatDate(application.applied_date)}</td>
    <td>
      <div class="status-cell">
        <span class="state ${application.archived_at ? 'archived-state' : closed ? 'closed-state' : 'active-state'}">${application.archived_at ? 'Archived' : closed ? 'Closed' : 'Active'}</span>
        <select data-field="status" aria-label="Status for ${escapeHtml(application.company_name)}"${closed ? ' disabled' : ''}>
          ${statusOptions}
        </select>
      </div>
    </td>
    <td>${closed ? '' : renderNextAction(application)}</td>
    <td>${renderStaleSignal(application)}</td>
    <td data-interview-cell>${closed ? '' : renderInterviewControl(application)}</td>
    <td class="action-col">
      <div class="row-actions">
        <button class="icon-button row-open-btn" type="button" data-detail-id="${application.id}" aria-label="Open ${escapeHtml(application.company_name)}" title="Open">
          <i class="bi bi-box-arrow-up-right"></i>
        </button>
      </div>
    </td>
  `;

  row.querySelector('[data-field="status"]').value = application.status;
  return row;
}

function renderNextAction(application) {
  const action = application.next_action || recommendedNextAction(application);
  return `
    <div class="next-action-cell">
      <strong title="${escapeAttribute(action)}">${escapeHtml(action)}</strong>
      ${application.next_action_due_date ? `<span>${formatDate(application.next_action_due_date)}</span>` : ''}
    </div>
  `;
}

function renderFollowUpDue(application) {
  const dueDate = application.next_action_due_date || suggestedFollowUpDate(application);
  if (!dueDate) return '<span class="muted-text">Not set</span>';
  return `<span class="${dueDateBadgeClass(dueDate)}">${formatDate(dueDate)}</span>`;
}

function renderStaleSignal(application) {
  const days = Number(application.days_since_touched);
  if (!Number.isFinite(days)) return '<span class="muted-text">Unknown</span>';
  if (days >= 14) return `<span class="pill danger-pill">${days}d stale</span>`;
  if (days >= 7) return `<span class="pill warning-pill">${days}d idle</span>`;
  return `<span class="muted-text">${formatDate(application.last_touched_date)}</span>`;
}

function isUrgentNotification(item) {
  if (item.type === 'follow_up') return false;
  const d = Number(item.days_remaining);
  return d >= -3 && d <= 1;
}

export function renderNotifications(els, notifications, expanded = false) {
  els.notificationsPanel.hidden = notifications.length === 0;
  if (!notifications.length) {
    els.notificationsPanel.innerHTML = '';
    els.notificationsPanel.classList.remove('has-urgent');
    return;
  }

  const sorted = [...notifications].sort((a, b) => (isUrgentNotification(a) ? 0 : 1) - (isUrgentNotification(b) ? 0 : 1));
  const anyUrgent = sorted.some(isUrgentNotification);
  els.notificationsPanel.classList.toggle('has-urgent', anyUrgent);

  const nextNotification = sorted[0];
  const preview = nextNotification
    ? `${nextNotification.company_name}: ${nextNotification.message}${nextNotification.due_date ? ` (${formatDate(nextNotification.due_date)})` : ''}`
    : '';

  els.notificationsPanel.innerHTML = `
    <div class="notifications-shell ${expanded ? 'is-open' : 'is-closed'}">
      <div class="notifications-header">
        <button class="notifications-toggle" type="button" data-toggle-notifications aria-expanded="${expanded ? 'true' : 'false'}">
          <span class="notifications-toggle-copy">
            <strong>Priority reminders${anyUrgent ? ' ⚠' : ''}</strong>
            <span>${expanded ? 'Hide reminders' : escapeHtml(preview)}</span>
          </span>
          <span class="notifications-action">
            <span>${expanded ? 'Hide' : 'View'}</span>
            <span class="notifications-count">${notifications.length}</span>
          </span>
        </button>
      </div>
      <div class="notifications-grid" ${expanded ? '' : 'hidden'}>
        ${sorted.map((item) => {
          const urgent = isUrgentNotification(item);
          const typeClass = item.type === 'follow_up' ? 'follow-up' : item.type === 'todo' ? 'todo' : 'interview';
          return `
          <article class="notification-card ${typeClass}${urgent ? ' urgent-card' : ''}">
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
                  : item.type === 'next_action'
                    ? `<span class="${daysClass(item.days_remaining)}">${formatDays(item.days_remaining)}</span>`
                  : `<span class="days-badge warning">${Number(item.days_remaining)} days since apply</span>`}
              <button class="secondary" type="button" data-notification-detail="${item.id}">Open</button>
            </div>
          </article>
        `}).join('')}
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
      <div class="kanban-cards-container">
        ${group.items.map((item) => {
          const daysSinceTouched = typeof item.days_since_touched === 'number' ? item.days_since_touched : 0;
          return `
            <article class="kanban-card">
              <strong>${escapeHtml(item.company_name)}</strong>
              <span class="role-title">${escapeHtml(item.role_title || 'N/A')}</span>
              <div class="kanban-card-meta">
                <span>${formatDate(item.applied_date)}</span>
                ${daysSinceTouched > 7
                  ? `<span class="days-in-stage stale-alert" title="Stuck in this stage for ${daysSinceTouched} days">${daysSinceTouched}d in stage</span>`
                  : `<span class="days-in-stage" title="In this stage for ${daysSinceTouched} days">${daysSinceTouched}d in stage</span>`
                }
              </div>
              ${item.interview_date ? renderDays(item.days_remaining) : ''}
            </article>
          `;
        }).join('') || '<p class="empty small">No entries.</p>'}
      </div>
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
    <div class="cv-item" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px;">
      <div class="cv-item-info">
        <strong>${escapeHtml(cv.original_name)}</strong>
        ${cv.is_latest ? '<span class="pill info-pill" style="margin-left: 6px;">Latest</span>' : ''}
        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--muted);">
          <span class="cv-version-label" data-cv-id="${cv.id}" style="cursor: pointer; font-weight: 500; color: var(--accent);" title="Click to edit label">${escapeHtml(cv.version_label || 'Add label')}</span> · ${formatBytes(Number(cv.file_size))}
        </p>
      </div>
      <div class="cv-item-actions" style="display: flex; gap: 4px;">
        <a class="icon-button" href="/api/cv/${cv.id}/view" target="_blank" title="View"><i class="bi bi-eye"></i></a>
        <a class="icon-button" href="/api/cv/${cv.id}/download" download title="Download"><i class="bi bi-download"></i></a>
        <button class="icon-button text-danger" type="button" data-delete-cv-id="${cv.id}" title="Delete"><i class="bi bi-trash"></i></button>
      </div>
    </div>
  `).join('') || renderEmptyState('No CV library yet', 'Upload a baseline CV so each application can preserve the exact version used.', 'A latest CV is required for quick application entry and AI generation.');
}

export function renderJobBoards(els, jobBoards) {
  const activeBoards = jobBoards.filter((board) => board.is_active);
  const inactiveBoards = jobBoards.filter((board) => !board.is_active);

  els.jobBoardsList.innerHTML = [
    renderBoardSection('Active boards', 'Boards you are actively checking.', activeBoards, { fullWidth: true }),
    inactiveBoards.length ? renderBoardSection('Inactive boards', 'Boards paused for now but kept for reference.', inactiveBoards) : ''
  ].join('') || renderEmptyState('No job boards saved', 'Add sources you check regularly so your search routine stays visible and repeatable.', 'The app now seeds common boards automatically after migrations run.');
}

export function renderTargetCompanyFilters(els, companies, filters) {
  renderSelectFilter(els.targetCompanyRegionFilter, companies, 'region', filters.region, 'All regions');
  renderSelectFilter(els.targetCompanyVisaFilter, companies, 'visa_signal', filters.visa, 'All visa signals');
  renderSelectFilter(els.targetCompanyWorkModeFilter, companies, 'work_mode', filters.workMode, 'All work modes');
  renderSelectFilter(els.targetCompanyIndustryFilter, companies, 'industry', filters.industry, 'All industries');
}

export function renderTargetCompanies(els, companies, filters) {
  const filtered = filterTargetCompanies(companies, filters);
  const limit = filters.limit || 20;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(filters.page || 1, totalPages);
  const start = total ? (page - 1) * limit : 0;
  const end = Math.min(total, page * limit);

  const pageCompanies = filtered.slice(start, end);
  const activeCompanies = pageCompanies.filter((company) => company.is_active);
  const inactiveCompanies = pageCompanies.filter((company) => !company.is_active);

  if (els.targetCompaniesSummary) {
    els.targetCompaniesSummary.textContent = total
      ? `Showing ${start + 1}-${end} of ${total} target companies.`
      : '';
  }

  els.targetCompaniesList.innerHTML = [
    renderTargetCompanySection('Active companies', '', activeCompanies, { fullWidth: true }),
    inactiveCompanies.length ? renderTargetCompanySection('Inactive companies', '', inactiveCompanies) : ''
  ].join('') || renderEmptyState('No companies found', 'No target companies match the current filters.', 'Clear filters or add a company manually.');

  if (els.targetCompanyPagination) {
    if (total <= limit) {
      els.targetCompanyPagination.innerHTML = '';
      els.targetCompanyPagination.hidden = true;
    } else {
      els.targetCompanyPagination.hidden = false;
      els.targetCompanyPagination.innerHTML = `
        <span>Showing ${start + 1}-${end} of ${total}</span>
        <button class="secondary" type="button" data-target-company-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Prev</button>
        <button class="secondary" type="button" data-target-company-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next</button>
      `;
    }
  }
}

function renderSelectFilter(select, companies, key, value, label) {
  if (!select) return;
  const values = [...new Set(companies.map((company) => company[key]).filter(Boolean))]
    .sort((left, right) => String(left).localeCompare(String(right)));
  select.innerHTML = [
    `<option value="">${escapeHtml(label)}</option>`,
    ...values.map((item) => `<option value="${escapeAttribute(item)}">${escapeHtml(item)}</option>`)
  ].join('');
  select.value = value || '';
}

function filterTargetCompanies(companies, filters) {
  const query = String(filters.search || '').toLowerCase();
  return companies.filter((company) => {
    const haystack = [
      company.name,
      company.region,
      company.primary_location,
      company.germany_offices,
      company.additional_offices,
      company.industry,
      company.company_type,
      company.description,
      company.work_mode,
      company.visa_signal,
      company.relocation_signal,
      company.fit_notes,
      company.source
    ].filter(Boolean).join(' ').toLowerCase();

    return (!query || haystack.includes(query))
      && (!filters.region || company.region === filters.region)
      && (!filters.visa || company.visa_signal === filters.visa)
      && (!filters.workMode || company.work_mode === filters.workMode)
      && (!filters.industry || company.industry === filters.industry);
  });
}

function renderTargetCompanySection(title, description, companies, options = {}) {
  if (!companies.length) return '';
  return `
    <section class="board-section${options.fullWidth ? ' board-section-wide' : ''}">
      <h3>${title}</h3>
      <div class="table-container">
        <table class="companies-table">
          <thead>
            <tr>
              <th style="width: 220px;">Company</th>
              <th>Location</th>
              <th style="width: 120px;">Work Mode</th>
              <th style="width: 100px;">Links</th>
              <th style="width: 60px;"></th>
            </tr>
          </thead>
          <tbody>
            ${companies.map((company) => {
              const workModeBadge = company.work_mode
                ? `<span class="work-mode-badge">${escapeHtml(company.work_mode)}</span>`
                : '';
              const linksHtml = [
                company.career_url ? `<button class="icon-button" type="button" data-target-company-open="${company.id}" data-target-company-url="career" aria-label="Careers" title="Careers"><i class="bi bi-briefcase"></i></button>` : '',
                company.linkedin_url ? `<button class="icon-button" type="button" data-target-company-open="${company.id}" data-target-company-url="linkedin" aria-label="LinkedIn" title="LinkedIn"><i class="bi bi-link-45deg"></i></button>` : '',
                company.company_url ? `<button class="icon-button" type="button" data-target-company-open="${company.id}" data-target-company-url="company" aria-label="Website" title="Website"><i class="bi bi-globe"></i></button>` : ''
              ].filter(Boolean).join('');

              return `
                <tr class="company-row ${company.is_active ? '' : 'is-inactive'}">
                  <td>
                    <div class="company-name-cell">
                      <strong>${escapeHtml(company.name)}</strong>
                      <span class="muted-text font-xs">${escapeHtml(company.industry || 'No industry info')}</span>
                    </div>
                  </td>
                  <td>${escapeHtml(company.primary_location || '—')}</td>
                  <td>${workModeBadge}</td>
                  <td><div class="company-links-cell">${linksHtml}</div></td>
                  <td class="action-col">
                    <div class="dropdown-container">
                      <button class="icon-button dropdown-toggle" type="button" aria-label="Actions" title="Actions">
                        <i class="bi bi-three-dots"></i>
                      </button>
                      <div class="dropdown-menu">
                        <button type="button" class="dropdown-item" data-target-company-edit="${company.id}"><i class="bi bi-pencil"></i> Edit</button>
                        <button type="button" class="dropdown-item text-warning" data-target-company-toggle="${company.id}" data-target-company-active="${company.is_active ? 'true' : 'false'}"><i class="bi bi-power"></i> ${company.is_active ? 'Deactivate' : 'Activate'}</button>
                        <button type="button" class="dropdown-item text-danger" data-target-company-delete="${company.id}"><i class="bi bi-trash"></i> Delete</button>
                      </div>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCompanySignal(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || 'Unclear')}</dd>
    </div>
  `;
}

function renderBoardSection(title, description, boards, options = {}) {
  if (!boards.length) return '';
  return `
    <section class="board-section${options.fullWidth ? ' board-section-wide' : ''}">
      <div class="board-section-grid${options.fullWidth ? ' board-section-grid-wide' : ''}">
        ${boards.map((board) => `
          <article class="board-card ${board.is_active ? '' : 'is-inactive'} ${jobBoardFreshnessClass(board)}">
            <div class="board-card-top">
              <strong>${escapeHtml(board.name)}</strong>
              <div class="board-actions-grid">
                ${board.url ? `<button class="icon-button text-primary board-open-link" type="button" data-job-board-open="${board.id}" title="Open board"><i class="bi bi-box-arrow-up-right"></i></button>` : `<div class="placeholder-icon-button"></div>`}
                <button class="icon-button text-primary" type="button" data-job-board-edit="${board.id}" title="Edit"><i class="bi bi-pencil"></i></button>
                <button class="icon-button text-warning" type="button" data-job-board-toggle="${board.id}" data-job-board-active="${board.is_active ? 'true' : 'false'}" title="${board.is_active ? 'Mark inactive' : 'Activate'}"><i class="bi bi-power"></i></button>
                <button class="icon-button text-danger" type="button" data-job-board-delete="${board.id}" title="Delete"><i class="bi bi-trash"></i></button>
              </div>
            </div>
            ${board.last_checked_date ? `
            <div class="board-status-row">
              <span class="board-freshness ${jobBoardFreshnessClass(board)}">${jobBoardFreshnessLabel(board)}</span>
            </div>
            ` : ''}
            <p>${escapeHtml(board.notes || 'No notes yet.')}</p>
            <div class="board-meta" style="margin-top: auto; padding-top: 1rem;">
              <span>Last checked: ${board.last_checked_date ? formatDate(board.last_checked_date) : 'Never'}</span>
              <span>Updated: ${formatDateTime(board.updated_at)}</span>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderSettingsPanel() {
  return `
    <section class="route-card settings-card">
      <div style="margin-bottom: 20px;">
        <p class="section-help" style="margin: 0; font-size: 14px; color: var(--muted);">Keep import, export, backup, and restore in one operational workspace.</p>
      </div>
      <div class="settings-action-grid">
        <article class="document-summary-card settings-action-card">
          <strong>Export CSV</strong>
          <p>Download application rows for spreadsheet work or manual review.</p>
          <button id="settingsExportCsvButton" class="secondary" type="button"><i class="bi bi-download"></i> Export CSV</button>
        </article>
        <article class="document-summary-card settings-action-card">
          <strong>Import CSV</strong>
          <p>Load application rows into the tracker using the latest linked CV.</p>
          <button id="settingsImportCsvButton" class="secondary" type="button"><i class="bi bi-upload"></i> Import CSV</button>
        </article>
        <article class="document-summary-card settings-action-card">
          <strong>Create Backup</strong>
          <p>Export applications, AI data, uploads, and workspace settings into one backup file.</p>
          <button id="settingsBackupButton" type="button"><i class="bi bi-cloud-download"></i> Create Backup</button>
        </article>
        <article class="document-summary-card settings-action-card">
          <strong>Restore Backup</strong>
          <p>Replace the current local workspace with a validated backup state.</p>
          <button id="settingsRestoreButton" class="secondary" type="button"><i class="bi bi-folder2-open"></i> Choose Backup</button>
          <div id="restoreBackupSelection" class="backup-file-selection" hidden>
            <div>
              <span>Selected backup</span>
              <strong id="restoreBackupFileName"></strong>
              <p id="restoreBackupStatus">Ready to restore.</p>
            </div>
            <div class="split-actions">
              <button id="settingsRestoreSelectedButton" class="danger" type="button"><i class="bi bi-arrow-clockwise"></i> Restore Selected</button>
              <button id="settingsReplaceBackupButton" class="secondary icon-button" type="button" title="Choose Another"><i class="bi bi-arrow-left-right"></i></button>
              <button id="settingsClearBackupButton" class="secondary icon-button" type="button" title="Remove"><i class="bi bi-trash" style="color: var(--danger)"></i></button>
            </div>
          </div>
        </article>
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
    todos
  } = payload;

  const activeTab = viewState.activeTab && viewState.activeTab !== 'overview' ? viewState.activeTab : 'workflow';
  const primaryCv = cvs[0] || null;
  const latestDocuments = summarizeLatestDocuments(documents);
  const queuedJobs = jobs.filter((item) => item.status !== 'completed' && item.status !== 'failed');
  const failedJobs = jobs.filter((item) => item.status === 'failed');

  const tabBodies = {
    workflow: renderWorkflowTab({ application, preparation, recruiterQuestions, feedbackEntries, todos }),
    content: renderContentSummaryTab({ application, primaryCv, queuedJobs, failedJobs, allDocuments: documents, allJobs: jobs, selectedProvider: viewState.selectedProvider, capabilities: viewState.capabilities, workspace: viewState.contentWorkspace }),
    history: renderHistoryTab({ application, history, notes, activity, statusLabels })
  };

  const closed = !application.archived_at && isClosedStatus(application.status);
  const locationLine = application.location || 'Not set';
  const peopleLine = [application.recruiter, application.contact_person].filter(Boolean).join(' • ') || 'Not set';
  const nextStep = application.next_action || recommendedNextAction(application);
  const nextStepLine = [nextStep, formatDate(application.next_action_due_date)].filter(Boolean).join(' • ');

  els.workspaceRoot.innerHTML = `
    <section class="workspace-view workspace-view-application${closed ? ' is-closed' : ''}" data-workspace-view="application">
    <div id="applicationPageContent" class="route-page-shell">
      <section class="application-hero-card application-hero-compact">
        <div class="hero-main-row">
          <div class="hero-copy-group">
            <div class="hero-badge-row">
              <span class="state ${application.archived_at ? 'archived-state' : closed ? 'closed-state' : 'active-state'}">${application.archived_at ? 'Archived' : statusLabels[application.status] || application.status}</span>
              ${closed ? '<span class="state closed-state">Closed</span>' : ''}
              ${application.interview_date && !closed ? `<span class="days-badge">${escapeHtml(formatDate(application.interview_date))}</span>` : ''}
            </div>
            <h1>${escapeHtml(application.role_title || 'Application Detail')}</h1>
            <p class="hero-company-line">${escapeHtml(application.company_name)}</p>
            <p class="hero-support-line">${escapeHtml(locationLine)}</p>
            ${renderTags(tags)}
          </div>
          <div class="page-header-actions application-hero-actions">
            <div class="hero-action-row">
              ${closed ? '' : `<button type="button" data-edit-application="${application.id}" class="icon-button" aria-label="Edit application" title="Edit">
                <i class="bi bi-pencil" style="color: var(--focus)"></i>
              </button>`}
              ${application.archived_at ? `<button type="button" data-restore-application="${application.id}" class="secondary" style="font-size:12px;padding:5px 10px">Restore</button>` : ''}
              ${application.job_link ? `<a class="icon-button" href="${escapeAttribute(application.job_link)}" target="_blank" rel="noreferrer" aria-label="Open posting" title="Open Posting">
                <i class="bi bi-box-arrow-up-right"></i>
              </a>` : ''}
              <button class="icon-button" type="button" data-view-job-description="${application.id}" aria-label="View job description" title="View JD">
                <i class="bi bi-file-text"></i>
              </button>
            </div>
          </div>
        </div>
        <div class="hero-inline-meta">
          ${renderInlineMeta('Applied', formatDate(application.applied_date) || 'Not set')}
          ${renderInlineMeta('Salary', application.salary || 'Not set', !application.salary)}
          ${renderInlineMeta('People', peopleLine, peopleLine === 'Not set')}
          ${renderInlineMeta('Next Step', nextStepLine, !application.next_action && !application.next_action_due_date)}
        </div>
      </section>
      <nav class="detail-tabbar" aria-label="Application sections">
        ${renderDetailTab(application.id, 'workflow', 'Workflow', activeTab, 'signpost-split')}
        ${renderDetailTab(application.id, 'content', 'Content', activeTab, 'file-earmark-text')}
        ${renderDetailTab(application.id, 'history', 'History', activeTab, 'clock-history')}
      </nav>
      <section class="detail-tab-panel">
        ${tabBodies[activeTab] || tabBodies.workflow}
      </section>
    </div>
    </section>
  `;
}

const documentTypeDefinitions = [
  {
    type: 'tailored_cv',
    action: 'cv',
    title: 'Tailored CV',
    description: 'Create a resume variant tuned to this application.'
  },
  {
    type: 'cover_letter',
    action: 'letter',
    title: 'Cover Letter',
    description: 'Generate a tailored cover letter based on the role and your CV.'
  },
  {
    type: 'role_fit',
    action: 'fit',
    title: 'Role Fit',
    description: 'Summarize strengths, gaps, and improvement suggestions.'
  },
  {
    type: 'ats_check',
    action: 'ats',
    title: 'ATS Check',
    description: 'Review keyword alignment and applicant tracking compatibility.'
  },
  {
    type: 'follow_up_email',
    action: 'followup',
    title: 'Follow-up Email',
    description: 'Draft a polished follow-up message for recruiters or interviewers.'
  }
];

function renderOverviewTab({ application, primaryCv, tags, documents, jobs, statusLabels, selectedProvider, capabilities, preparation, recruiterQuestions, feedbackEntries, todos }) {
  const documentSlots = buildDocumentSlots(documents, jobs);
  return `
    <div class="tab-grid overview-grid">
      <section class="route-card workflow-snapshot-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Next Action</div>
            <h3>Workflow Snapshot</h3>
            <p class="section-help">Keep the current job-search action visible before generated assets.</p>
          </div>
          <a class="button-link tertiary" href="/applications/${application.id}?tab=workflow">Open workflow</a>
        </div>
        ${renderWorkflowSnapshot({ application, preparation, recruiterQuestions, feedbackEntries, todos, statusLabels })}
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">AI Workspace</div>
            <h3>Generated Content</h3>
            <p class="section-help">Treat generated documents as saved assets. Generate only when a document does not exist, then open and manage it from the content workspace.</p>
          </div>
        </div>
        ${renderSegmentedProviderControl({
          selectedProvider,
          awsEnabled: capabilities.awsEnabled,
          attrName: 'data-ai-provider-select'
        })}
        <div class="document-card-meta toolbar-pills">
          <span class="pill subtle">Default: Gemini</span>
          <span class="pill ${capabilities.awsEnabled ? 'success-pill' : 'danger-pill'}">${capabilities.awsEnabled ? 'AWS available' : 'AWS disabled in settings'}</span>
        </div>
        ${renderAiRecommendation(application)}
        <div class="artifact-grid">
          ${documentSlots.map((slot) => renderOverviewDocumentSlot(application.id, slot, primaryCv?.id || '')).join('')}
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
          <article class="document-summary-card attachment-card">
            <strong>${escapeHtml(primaryCv.original_name)}</strong>
            <p>${escapeHtml(primaryCv.version_label || 'Unlabeled')} · ${escapeHtml(formatBytes(Number(primaryCv.file_size || 0)))}</p>
            <div class="document-card-meta">
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
          <a class="button-link tertiary" href="/applications/${application.id}?tab=content">Open content</a>
        </div>
        <div class="document-stack">
          ${summarizeLatestDocuments(documents).map((doc) => renderRecentDocumentItem(application.id, doc)).join('') || renderInlineEmpty('No generated content yet', 'Generate a document from the workspace above to create your first saved asset.')}
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

function renderWorkflowSnapshot({ application, preparation, recruiterQuestions, feedbackEntries, todos, statusLabels }) {
  const openTodos = todos.filter((item) => !item.completed);
  const hasPreparation = Boolean(
    preparation?.about_company ||
    preparation?.company_values ||
    preparation?.application_notes ||
    recruiterQuestions.length ||
    feedbackEntries.length
  );
  const nextStep = application.next_action || (application.interview_date
    ? `Prepare for interview on ${formatDate(application.interview_date)}`
    : openTodos[0]?.body || (hasPreparation ? 'Review preparation notes' : 'Add preparation notes'));

  return `
    <div class="workflow-snapshot">
      <article>
        <span>Status</span>
        <strong>${escapeHtml(statusLabels[application.status] || application.status)}</strong>
      </article>
      <article>
        <span>Next</span>
        <strong>${escapeHtml(nextStep)}</strong>
      </article>
      <article>
        <span>Prep</span>
        <strong>${hasPreparation ? 'Started' : 'Not started'}</strong>
      </article>
      <article>
        <span>Open Todos</span>
        <strong>${openTodos.length}</strong>
      </article>
    </div>
  `;
}

function recommendedNextAction(application) {
  if (application.status === 'interview_scheduled') return 'Prepare interview';
  if (application.status === 'offer') return 'Review offer';
  if (application.status === 'rejected') return 'Record learning';
  if (application.status === 'withdrawn') return 'Archive when done';
  if (application.status === 'ghosted') return 'Send final follow-up';
  return 'Follow up';
}

function suggestedFollowUpDate(application) {
  if (application.status === 'interview_scheduled') return application.interview_date;
  if (!application.applied_date || !['applied', 'ghosted'].includes(application.status)) return '';
  const date = new Date(`${application.applied_date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + 7);
  return isoDate(date);
}

function daysUntil(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date(`${isoDate(new Date())}T00:00:00`);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function dueDateBadgeClass(value) {
  const days = daysUntil(value);
  if (days < 0) return 'pill danger-pill';
  if (days <= 1) return 'pill warning-pill';
  return 'pill info-pill';
}

function renderAiRecommendation(application) {
  const recommendation = recommendedAiDocument(application);
  return `
    <div class="ai-recommendation">
      <span class="pill info-pill">Recommended next: ${escapeHtml(recommendation)}</span>
      <span>${escapeHtml(aiRecommendationReason(application))}</span>
    </div>
  `;
}

function recommendedAiDocument(application) {
  if (application.status === 'interview_scheduled') return 'Role Fit';
  if (application.status === 'ghosted') return 'Follow-up Email';
  if (application.status === 'applied') return 'ATS Check';
  if (application.status === 'offer') return 'Role Fit';
  return 'Cover Letter';
}

function aiRecommendationReason(application) {
  if (application.status === 'interview_scheduled') return 'Use the role-fit view to prepare strengths, gaps, and examples before the interview.';
  if (application.status === 'ghosted') return 'A follow-up email is the most useful generated asset for this stage.';
  if (application.status === 'applied') return 'An ATS check can catch missing keywords while the application is still active.';
  return 'Generate only the document that helps the current application stage.';
}

function renderResearchField(name, label, placeholder, value) {
  const hasContent = Boolean(value);
  return `
    <label class="research-field">
      <span>${escapeHtml(label)}</span>
      ${hasContent ? `
        <div class="research-preview" data-research-preview="${name}">
          <p class="research-preview-text">${escapeHtml(value)}</p>
          <div class="research-field-actions">
            <button type="button" class="secondary" data-research-view="${name}" data-research-label="${escapeAttribute(label)}">View</button>
            <button type="button" class="secondary" data-research-edit="${name}">Edit</button>
          </div>
        </div>
      ` : ''}
      <textarea name="${name}" rows="4" placeholder="${escapeAttribute(placeholder)}"${hasContent ? ' hidden' : ''}>${escapeHtml(value)}</textarea>
    </label>
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
          ${renderResearchField('about_company', 'About The Company', 'Products, market, competitors, roadmap, team shape', preparation?.about_company || '')}
          ${renderResearchField('company_values', 'Company Values', 'Culture signals, values, leadership principles', preparation?.company_values || '')}
          ${renderResearchField('application_notes', 'Application Notes', 'Fit summary, risks, strengths, stories to prepare', preparation?.application_notes || '')}
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
                <button class="icon-button text-muted" type="button" data-question-move="${item.id}" data-direction="up" ${index === 0 ? 'disabled' : ''} title="Move Up"><i class="bi bi-arrow-up"></i></button>
                <button class="icon-button text-muted" type="button" data-question-move="${item.id}" data-direction="down" ${index === recruiterQuestions.length - 1 ? 'disabled' : ''} title="Move Down"><i class="bi bi-arrow-down"></i></button>
                <button class="icon-button text-primary" type="button" data-question-edit="${item.id}" title="Edit"><i class="bi bi-pencil"></i></button>
                <button class="icon-button text-danger" type="button" data-question-delete="${item.id}" title="Delete"><i class="bi bi-trash"></i></button>
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

function renderContentSummaryTab({ application, primaryCv, queuedJobs, failedJobs, allDocuments, allJobs, selectedProvider, capabilities, workspace }) {
  const primaryCvId = primaryCv?.id || '';
  const documentSlots = filterDocumentSlots(buildDocumentSlots(allDocuments, allJobs), workspace);
  const documentTypes = [...new Set(buildDocumentSlots(allDocuments, allJobs).map((item) => item.type))];
  const recentDocumentId = Number(workspace.recentDocumentId) || null;
  const missingSlots = documentSlots.filter((slot) => slot.status === 'missing' || slot.status === 'failed');
  return `
    <div class="tab-grid content-summary-grid">
      <section class="route-card content-workspace-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Content Workspace</div>
            <h3>Generated Documents</h3>
            <p class="section-help">This is the canonical document workspace. Open existing assets directly. Generate only when a document type does not exist yet.</p>
          </div>
          <div class="content-toolbar-meta">
            ${renderSegmentedProviderControl({
              selectedProvider: selectedProvider || 'gemini',
              awsEnabled: capabilities?.awsEnabled,
              attrName: 'data-library-provider-select'
            })}
            ${missingSlots.length ? `<button class="secondary" type="button" data-generate-missing data-cv-id="${escapeAttribute(primaryCvId || '')}">Generate Missing (${missingSlots.length})</button>` : ''}
            ${allDocuments.length ? `<a class="button-link secondary" href="/api/applications/${application.id}/artifacts.zip">Export Artifacts</a>` : ''}
          </div>
        </div>
        ${recentDocumentId ? '<div class="document-card-meta"><span class="pill info-pill">Recent update available in the list below.</span></div>' : ''}
        <div class="content-filter-bar" hidden style="display: none !important;">
          <label>
            <span>Search</span>
            <input type="search" value="${escapeAttribute(workspace.search || '')}" placeholder="Title or provider" data-content-search>
          </label>
          <label>
            <span>Type</span>
            <select data-content-type>
              <option value="all">All types</option>
              ${documentTypes.map((type) => `<option value="${escapeAttribute(type)}"${workspace.type === type ? ' selected' : ''}>${escapeHtml(formatAction(type))}</option>`).join('')}
            </select>
          </label>
          <label>
            <span>Provider</span>
            <select data-content-provider>
              <option value="all"${workspace.provider === 'all' ? ' selected' : ''}>All providers</option>
              <option value="gemini"${workspace.provider === 'gemini' ? ' selected' : ''}>Gemini</option>
              <option value="aws"${workspace.provider === 'aws' ? ' selected' : ''}>AWS</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select data-content-sort>
              <option value="newest"${workspace.sort === 'newest' ? ' selected' : ''}>Newest first</option>
              <option value="oldest"${workspace.sort === 'oldest' ? ' selected' : ''}>Oldest first</option>
            </select>
          </label>
          <label class="checkbox inline-checkbox content-filter-toggle">
            <input type="checkbox" data-content-latest-only ${workspace.latestOnly ? 'checked' : ''}>
            <span>Latest only</span>
          </label>
        </div>
        <div class="content-asset-list">
          ${documentSlots.map((slot) => renderContentDocumentSlot(application.id, slot, primaryCvId, recentDocumentId)).join('') || (allDocuments.length || allJobs.length
            ? renderInlineEmpty('No documents match these filters', 'Clear or relax the active filters to see more generated content.')
            : renderInlineEmpty('No generated content yet', 'Generate a document from the workspace above to create your first saved asset.'))}
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
          <article class="document-summary-card attachment-card">
            <strong>${escapeHtml(primaryCv.original_name)}</strong>
            <p>${escapeHtml(primaryCv.version_label || 'Unlabeled')} · ${escapeHtml(formatBytes(Number(primaryCv.file_size || 0)))}</p>
            <div class="document-card-meta">
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

function renderHistoryTab({ application, history, notes, activity, statusLabels }) {
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
          ${notes.length ? notes.map((note) => `<div class="note-item"><span>${escapeHtml(note.body)}</span><button type="button" class="icon-button" data-note-delete="${note.id}" title="Delete note">&times;</button></div>`).join('') : application.notes ? '' : '<p>No notes yet.</p>'}
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
        <div class="history-list history-timeline">
          ${renderTimeline(activity)}
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

function renderInlineMeta(label, value, muted = false) {
  return `
    <div class="hero-inline-meta-item${muted ? ' is-empty' : ''}">
      <span>${escapeHtml(label)}</span>
      <strong>${typeof value === 'string' && value.includes('<a') ? value : escapeHtml(value)}</strong>
    </div>
  `;
}

function renderDetailTab(applicationId, key, label, activeTab, iconName) {
  const isActive = activeTab === key;
  return `
    <a class="detail-tab${isActive ? ' is-active' : ''}" href="/applications/${applicationId}?tab=${key}" ${isActive ? 'aria-current="page"' : ''}>
      <i class="bi bi-${escapeAttribute(iconName)}" aria-hidden="true"></i>
      <span>${escapeHtml(label)}</span>
    </a>
  `;
}

function renderSegmentedProviderControl({ selectedProvider, awsEnabled, attrName }) {
  return `
    <div class="provider-segmented" role="tablist" aria-label="AI provider">
      <button class="${selectedProvider === 'gemini' ? 'is-active' : 'secondary'}" type="button" ${attrName}="gemini" role="tab" aria-selected="${selectedProvider === 'gemini' ? 'true' : 'false'}">Gemini</button>
      <button class="${selectedProvider === 'aws' ? 'is-active' : 'secondary'}" type="button" ${attrName}="aws" role="tab" aria-selected="${selectedProvider === 'aws' ? 'true' : 'false'}" ${awsEnabled ? '' : 'disabled title="AWS provider is disabled in settings"'}>AWS</button>
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
        <span class="pill subtle">${escapeHtml(readProviderLabel(doc))}</span>
        <a class="button-link tertiary" href="/applications/${applicationId}?tab=content&document=${doc.id}">Open</a>
      </div>
    </article>
  `;
}

function renderTimeline(activity) {
  if (!activity.length) return renderInlineEmpty('No activity yet', 'Actions on this application will appear here.');
  const groups = new Map();
  for (const item of activity) {
    const key = new Date(item.created_at).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()].map(([label, items]) => `
    <section class="timeline-group">
      <div class="timeline-date">${escapeHtml(label)}</div>
      <div class="timeline-items">
        ${items.map((item) => `
          <article class="timeline-item">
            <span class="timeline-icon">${escapeHtml(activityIcon(item.action))}</span>
            <div>
              <strong>${escapeHtml(activityLabel(item.action, item.details))}</strong>
              <small>${escapeHtml(activityMeta(item))}</small>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `).join('');
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

export function renderDocumentContent(document) {
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

function buildDocumentSlots(documents, jobs) {
  const definitions = new Map(documentTypeDefinitions.map((item) => [item.type, item]));
  const types = new Set([
    ...documentTypeDefinitions.map((item) => item.type),
    ...documents.map((item) => item.document_type),
    ...jobs.map((item) => item.document_type)
  ]);

  return [...types].map((type) => {
    const config = definitions.get(type) || {
      type,
      action: '',
      title: formatAction(type),
      description: 'Generated document'
    };
    const typeDocuments = documents.filter((item) => item.document_type === type)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    const typeJobs = jobs.filter((item) => item.document_type === type)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    const activeJob = typeJobs.find((item) => item.status !== 'completed' && item.status !== 'failed') || null;
    const failedJob = typeJobs.find((item) => item.status === 'failed') || null;
    const latestDocument = typeDocuments[0] || null;
    let status = 'missing';
    if (latestDocument && activeJob) status = 'updating';
    else if (latestDocument) status = 'ready';
    else if (activeJob) status = 'generating';
    else if (failedJob) status = 'failed';

    return {
      ...config,
      status,
      latestDocument,
      documents: typeDocuments,
      activeJob,
      failedJob
    };
  }).sort((left, right) => left.title.localeCompare(right.title));
}

function filterDocumentSlots(slots, workspace = {}) {
  const search = String(workspace.search || '').trim().toLowerCase();
  let filtered = [...slots];
  if (workspace.type && workspace.type !== 'all') {
    filtered = filtered.filter((item) => item.type === workspace.type);
  }
  if (workspace.provider && workspace.provider !== 'all') {
    filtered = filtered.filter((item) => item.latestDocument ? isProvider(item.latestDocument, workspace.provider) : item.activeJob ? String(item.activeJob.provider_requested || '').toLowerCase().includes(workspace.provider) : false);
  }
  if (search) {
    filtered = filtered.filter((item) => {
      const text = [
        item.title,
        item.description,
        item.latestDocument?.title,
        item.latestDocument?.provider_name,
        item.latestDocument?.provider_requested,
        item.activeJob?.provider_requested
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(search);
    });
  }
  return filtered.sort((left, right) => {
    const leftTime = new Date(left.latestDocument?.created_at || left.activeJob?.created_at || left.failedJob?.created_at || 0).getTime();
    const rightTime = new Date(right.latestDocument?.created_at || right.activeJob?.created_at || right.failedJob?.created_at || 0).getTime();
    return workspace.sort === 'oldest' ? leftTime - rightTime : rightTime - leftTime;
  }).map((slot) => ({
    ...slot,
    documents: workspace.latestOnly ? slot.documents.slice(0, 1) : slot.documents
  }));
}

function renderOverviewDocumentSlot(applicationId, slot, cvId) {
  const primary = renderSlotPrimaryAction(slot, applicationId, cvId);
  return `
    <article class="artifact-card artifact-card-${slot.status}">
      <div class="artifact-card-head">
        <div class="document-type-line">
          <span class="document-type-icon" aria-hidden="true">${renderDocumentTypeIcon(slot.type)}</span>
          <div>
            <div class="panel-kicker">${escapeHtml(slot.status === 'ready' || slot.status === 'updating' ? 'Generated Asset' : slot.status === 'generating' ? 'Generating' : slot.status === 'failed' ? 'Needs Attention' : 'Not Generated')}</div>
            <h4>${escapeHtml(slot.title)}</h4>
          </div>
        </div>
        ${renderSlotStatusBadge(slot)}
      </div>
      <p>${escapeHtml(slot.description)}</p>
      ${renderSlotMetadata(slot)}
      <div class="document-card-actions artifact-actions">
        ${primary}
        ${(slot.status === 'ready' || slot.status === 'updating') ? `<a class="button-link tertiary" href="/applications/${applicationId}?tab=content">Manage</a>` : ''}
      </div>
    </article>
  `;
}

function renderContentDocumentSlot(applicationId, slot, cvId, recentDocumentId = null) {
  const isRecent = slot.latestDocument && Number(slot.latestDocument.id) === Number(recentDocumentId);
  return `
    <section class="document-slot-card${isRecent ? ' is-recent' : ''}">
      <div class="document-slot-head">
        <div class="document-type-line">
          <span class="document-type-icon" aria-hidden="true">${renderDocumentTypeIcon(slot.type)}</span>
          <div class="document-slot-copy">
            <h4>${escapeHtml(slot.title)}</h4>
            ${isRecent ? '<span class="pill info-pill">Latest changed</span>' : ''}
          </div>
        </div>
        ${renderSlotStatusBadge(slot)}
      </div>
      ${renderSlotMetadata(slot)}
      <div class="document-card-actions document-slot-actions">
        ${renderSlotPrimaryAction(slot, applicationId, cvId)}
      </div>
      ${slot.latestDocument ? `
        <details class="document-version-list">
          <summary>${slot.documents.length > 1 ? `Versions (${slot.documents.length})` : 'Current document'}</summary>
          <div class="document-version-items">
            ${slot.documents.map((doc, index) => renderDocumentVersionRow(applicationId, doc, index === 0, slot.documents[0]?.id)).join('')}
          </div>
        </details>
      ` : ''}
      ${slot.failedJob && !slot.latestDocument ? `<p class="form-error inline-error">${escapeHtml(slot.failedJob.error_message || 'Generation failed. Retry to create this document.')}</p>` : ''}
    </section>
  `;
}

function renderDocumentVersionRow(applicationId, doc, isLatest, latestDocumentId) {
  return `
    <article class="document-version-row">
      <div>
        <strong>${escapeHtml(documentVersionLabel(doc.version_number || 1, isLatest))}</strong>
        <p>${escapeHtml(formatDateTime(doc.created_at))}</p>
      </div>
      <div class="document-card-actions">
        ${isLatest ? '<span class="pill success-pill">Latest</span>' : ''}
        <a class="button-link secondary" href="/applications/${applicationId}?tab=content&document=${doc.id}">Open Version</a>
        <details class="inline-menu">
          <summary class="button-link tertiary" aria-label="More actions for ${escapeAttribute(doc.title)}">More</summary>
          <div class="inline-menu-list">
            <a class="button-link tertiary" href="${escapeAttribute(doc.download_url)}">Download</a>
            <button class="secondary" type="button" data-copy-document="${doc.id}">Copy</button>
            ${!isLatest && latestDocumentId ? `<button class="secondary" type="button" data-compare-card="${doc.id}" data-compare-latest="${latestDocumentId}">Compare</button>` : ''}
            ${!isLatest ? `<button class="secondary" type="button" data-restore-card="${doc.id}">Restore as Latest</button>` : ''}
            <button class="secondary" type="button" data-regenerate-card="${doc.id}">Regenerate</button>
            <button class="danger" type="button" data-delete-card="${doc.id}">Delete</button>
          </div>
        </details>
      </div>
    </article>
  `;
}

function renderSlotPrimaryAction(slot, applicationId, cvId = '') {
  if (slot.status === 'ready' || slot.status === 'updating') {
    return `<a class="button-link secondary" href="/applications/${applicationId}?tab=content&document=${slot.latestDocument.id}">Open ${escapeHtml(slot.title)}</a>`;
  }
  if (slot.status === 'generating') {
    return `<button type="button" disabled data-loading-label="Generating">Generating</button>`;
  }
  if (slot.status === 'failed') {
    return `<button type="button" data-ai="${escapeAttribute(slot.action)}" data-doc-type="${escapeAttribute(slot.type)}" data-cv-id="${escapeAttribute(cvId)}">Retry Generation</button>`;
  }
  return `<button type="button" data-ai="${escapeAttribute(slot.action)}" data-doc-type="${escapeAttribute(slot.type)}" data-cv-id="${escapeAttribute(cvId)}">Generate</button>`;
}

function renderSlotStatusBadge(slot) {
  if (slot.status === 'ready') return '<span class="pill success-pill">Ready</span>';
  if (slot.status === 'updating') return '<span class="pill info-pill">Regenerating</span>';
  if (slot.status === 'generating') return '<span class="pill info-pill">Generating</span>';
  if (slot.status === 'failed') return '<span class="pill danger-pill">Failed</span>';
  return '<span class="pill subtle">Not Generated</span>';
}

function renderSlotMetadata(slot) {
  if (slot.latestDocument) {
    return `
      <div class="document-card-meta artifact-meta">
        <span class="pill info-pill">Last generated ${escapeHtml(formatDateTime(slot.latestDocument.created_at))}</span>
        ${slot.documents.length > 1 ? `<span class="pill subtle">${slot.documents.length} versions</span>` : ''}
        ${slot.activeJob ? '<span class="pill info-pill">New version in progress</span>' : ''}
        ${slot.failedJob ? `<span class="pill danger-pill">${escapeHtml(truncateText(slot.failedJob.error_message || 'Latest regeneration failed', 60))}</span>` : ''}
      </div>
    `;
  }
  if (slot.activeJob) {
    return `
      <div class="document-card-meta artifact-meta">
        <span class="pill info-pill">Started ${escapeHtml(formatDateTime(slot.activeJob.created_at))}</span>
      </div>
    `;
  }
  if (slot.failedJob) {
    return `
      <div class="artifact-meta-copy">
        <p>${escapeHtml(slot.failedJob.error_message || 'Generation failed. Review the job description or linked CV, then retry.')}</p>
        <small>Last attempt ${escapeHtml(formatDateTime(slot.failedJob.created_at))}</small>
      </div>
    `;
  }
  return '<p class="artifact-meta-copy">No saved document yet.</p>';
}

function renderDocumentTypeIcon(type) {
  const icons = {
    tailored_cv: '<i class="bi bi-file-earmark-person"></i>',
    cover_letter: '<i class="bi bi-envelope"></i>',
    role_fit: '<i class="bi bi-shield-check"></i>',
    ats_check: '<i class="bi bi-patch-check"></i>',
    follow_up_email: '<i class="bi bi-send-check"></i>'
  };
  return icons[type] || '<i class="bi bi-file-earmark"></i>';
}

function truncateText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function documentVersionLabel(versionNumber, isLatest) {
  return isLatest ? `Version ${versionNumber} • Latest` : `Version ${versionNumber}`;
}

function readProviderLabel(document) {
  const requested = String(document.provider_requested || '').trim().toLowerCase();
  const provider = String(document.provider_name || '').trim().toLowerCase();
  if (requested === 'gemini') return 'Gemini';
  if (requested === 'aws') return 'AWS';
  if (requested === 'mock') return 'Mock';
  if (provider === 'openai-compatible') return 'AI Provider';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'aws') return 'AWS';
  if (provider === 'mock') return 'Mock';
  return document.provider_name || document.provider_requested || 'unknown';
}

function groupDocumentsByType(documents, sort = 'newest') {
  const grouped = documents.reduce((groups, item) => {
    if (!groups[item.document_type]) groups[item.document_type] = [];
    groups[item.document_type].push(item);
    return groups;
  }, {});
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((left, right) => {
      const delta = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      return sort === 'oldest' ? delta : -delta;
    });
  }
  return Object.fromEntries(Object.entries(grouped).sort((left, right) => left[0].localeCompare(right[0])));
}

function isProvider(document, provider) {
  const name = String(document.provider_name || document.provider_requested || '').toLowerCase();
  if (provider === 'aws') return name.includes('aws');
  return name.includes(provider);
}

function activityIcon(action) {
  const value = String(action || '');
  if (value.includes('ai_')) return 'DOC';
  if (value.includes('status') || value.includes('interview')) return 'APP';
  if (value.includes('todo')) return 'TASK';
  if (value.includes('note') || value.includes('preparation')) return 'NOTE';
  if (value.includes('question')) return 'ASK';
  if (value.includes('feedback')) return 'FDBK';
  return 'ACT';
}

function activityLabel(action, details) {
  const value = String(action || '');
  if (value === 'created') return 'Application created';
  if (value === 'archived') return 'Application archived';
  if (value === 'restored') return 'Application restored';
  if (value === 'status_changed') return 'Status changed';
  if (value === 'interview_date_changed') return 'Interview updated';
  if (value === 'todo_completed') return 'Task completed';
  if (value === 'todo_added') return 'Task added';
  if (value === 'recruiter_question_added') return 'Recruiter question added';
  if (value === 'feedback_added') return 'Feedback added';
  if (value === 'note_added') return 'Note added';
  if (value === 'preparation_updated') return 'Research notes updated';
  if (value === 'ai_document_deleted') return 'Document deleted';
  if (value.includes('queued')) return 'Generation queued';
  if (value.includes('ai_')) return 'Document generated';
  return formatAction(details ? action : action || 'updated');
}

function activityMeta(item) {
  const details = cleanActivityDetails(item.details);
  const provider = activityProviderLabel(item);
  return [details, provider, formatDateTime(item.created_at)].filter(Boolean).join(' • ');
}

function cleanActivityDetails(details) {
  return String(details || '').replace(/^[^:]+:\s*/, '').trim();
}

function activityProviderLabel(item) {
  const details = String(item.details || '');
  if (/aws/i.test(details)) return 'AWS';
  if (/gemini/i.test(details)) return 'Gemini';
  return '';
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

export function renderRouteLoadingState(title, subtitle = 'Loading workspace') {
  return `
    <div class="route-page-shell">
      <section class="route-card loading-shell">
        <div class="loading-header">
          <span class="loading-chip">${escapeHtml(subtitle)}</span>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="loading-grid">
          <div class="loading-block loading-block-wide"></div>
          <div class="loading-block"></div>
          <div class="loading-block"></div>
          <div class="loading-block"></div>
        </div>
      </section>
    </div>
  `;
}

export function renderCalendar(els, calendarDate, reminders) {
  const getBadgeDetails = (type) => {
    if (type === 'applied') return { css: 'badge-app', label: 'APP' };
    if (type === 'interview') return { css: 'badge-int', label: 'INT' };
    if (type === 'next_action') return { css: 'badge-act', label: 'ACT' };
    if (type.startsWith('status_change_')) {
      const status = type.replace('status_change_', '');
      if (['rejected', 'withdrawn', 'ghosted'].includes(status)) {
        return { css: 'badge-cls', label: 'CLS' };
      }
      return { css: 'badge-default', label: 'UPD' };
    }
    return { css: 'badge-default', label: 'EVT' };
  };

  const getTimelineLabel = (event) => {
    let label = event.company_name;
    if (event.type.startsWith('status_change_')) {
      const newStatus = event.type.replace('status_change_', '');
      if (!['rejected', 'withdrawn', 'ghosted'].includes(newStatus)) {
        const displayStatus = statusLabels[newStatus] || newStatus;
        label += ` (${displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)})`;
      }
    } else if (event.type === 'next_action' && event.details) {
       label += `: ${event.details}`;
    }
    return label;
  };

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
      events: reminders.filter((item) => String(item.event_date).slice(0, 10) === iso)
    });
  }
  while (cells.length % 7) cells.push({ empty: true });

  const currentMonthEvents = reminders.filter((item) => {
    const itemDate = new Date(`${String(item.event_date).slice(0, 10)}T00:00:00`);
    const nextMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    return itemDate >= month && itemDate < nextMonth;
  });

  els.remindersList.innerHTML = `
    <div class="timeline-layout">
      <div class="timeline-main">
        <div class="calendar-header">
          <div>
            <h2>${formatMonthTitle(month)}</h2>
            <p>${currentMonthEvents.length} events</p>
          </div>
          <div class="calendar-actions">
            <button class="secondary" type="button" data-calendar-action="prev"><i class="bi bi-chevron-left"></i></button>
            <button class="secondary" type="button" data-calendar-action="current">Today</button>
            <button class="secondary" type="button" data-calendar-action="next"><i class="bi bi-chevron-right"></i></button>
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
                  ${cell.events.map((event) => {
                    const badge = getBadgeDetails(event.type);
                    return `
                    <article class="calendar-event ${badge.css}" title="${escapeAttribute(getTimelineLabel(event))}" data-calendar-detail="${event.id}">
                      ${escapeHtml(getTimelineLabel(event))}
                    </article>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      <div class="timeline-sidebar">
        <h3>Legend</h3>
        <div class="legend-item">
          <span class="badge badge-app">APP</span> Applied date
        </div>
        <div class="legend-item">
          <span class="badge badge-int">INT</span> Interview
        </div>
        <div class="legend-item">
          <span class="badge badge-act">ACT</span> Next action due
        </div>
        <div class="legend-item">
          <span class="badge badge-cls">CLS</span> Rejected / Withdrawn
        </div>
      </div>
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
