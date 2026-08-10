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
import { isClosedStatus, state, statusLabels, statusOptions } from './state.js';

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
              <span>Category</span>
              <select id="categoryFilter">
                <option value="">All Categories</option>
                <option value="Early-Stage Startup (Pre-Seed/Seed)">Early-Stage Startup (Pre-Seed/Seed)</option>
                <option value="Mid-Stage Startup (Series A/B)">Mid-Stage Startup (Series A/B)</option>
                <option value="Late-Stage Scale-up (Series C+)">Late-Stage Scale-up (Series C+)</option>
                <option value="Big Tech / FAANG+">Big Tech / FAANG+</option>
                <option value="Established Public Tech">Established Public Tech</option>
                <option value="Enterprise / Non-Tech Core">Enterprise / Non-Tech Core</option>
                <option value="Government / Defense / Aerospace">Government / Defense / Aerospace</option>
                <option value="Global IT Services / GSIs">Global IT Services / GSIs</option>
                <option value="Boutique Agencies / Dev Shops">Boutique Agencies / Dev Shops</option>
                <option value="FinTech / Quant / HFT">FinTech / Quant / HFT</option>
                <option value="Web3 / Crypto">Web3 / Crypto</option>
                <option value="Gaming / Entertainment">Gaming / Entertainment</option>
                <option value="HealthTech / BioTech">HealthTech / BioTech</option>
                <option value="Other / Uncategorized">Other / Uncategorized</option>
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
          <div id="applicationPagination" class="pagination"></div>
        </section>
        <div id="bulkActionsBar" class="bulk-bar" hidden>
          <strong id="bulkCount">0 selected</strong>
          <div class="row-actions">
            <select id="bulkStatusSelect" class="bulk-status-select" aria-label="Set status for selected applications">
              <option value="">Set status…</option>
              ${statusOptions}
            </select>
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

export function renderInsights(els, report, stats, statusLabels, mode = 'active', categoryStats = stats, categoryPeriod = 'all', selectedCategory = '', selectedTagStats = { totals: { total: 0 }, tags: [] }, tagPeriod = 'all', selectedChartTagStats = { tags: [] }, chartTagPeriod = 'all', processInsights = null) {
  const total = Number(stats.totals.total || 0);
  const categoryTotal = Number(categoryStats.totals?.total || 0);
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
    return reportRow(row.tag, Number(row.applications), tagMax, { tag: row.tag }, toIntStr, '--focus');
  }).join('') || '<p>No tag data.</p>';

  const categoryMax = Math.max(1, ...(stats.categories || []).map((row) => Number(row.applications || 0)));
  const categoryHtml = (stats.categories || []).map((row) => {
    let toIntStr = '';
    const rateVal = Math.round((Number(row.interviewed || 0) / Number(row.applications || 1)) * 100);
    if (rateVal > 0) toIntStr = `${rateVal}% interview rate`;
    return reportRow(row.category, Number(row.applications), categoryMax, { category: row.category }, toIntStr, '--app');
  }).join('') || '<p>No category data.</p>';
  const categoryPerformanceHtml = renderCategoryPerformanceSection(categoryStats.categories || [], categoryTotal, categoryPeriod, selectedCategory);
  const selectedTagPerformanceHtml = renderSelectedTagPerformanceSection(selectedTagStats.tags || [], Number(selectedTagStats.totals?.total || 0), tagPeriod);
  const selectedTagComparisonHtml = renderSelectedTagComparisonSection(selectedChartTagStats.tags || [], chartTagPeriod);
  const processHtml = renderProcessInsightsSection(processInsights);

  const dropoffs = [
    { stage: 'App -> Interview', drop: total > 0 ? 100 - Math.round((funnelRows[1].count / total) * 100) : 0 },
    { stage: 'Interview -> Offer', drop: funnelRows[1].count > 0 ? 100 - Math.round((funnelRows[2].count / funnelRows[1].count) * 100) : 0 },
    { stage: 'Offer -> Accepted', drop: funnelRows[2].count > 0 ? 100 - Math.round((funnelRows[3].count / funnelRows[2].count) * 100) : 0 }
  ];
  let biggestDrop = dropoffs[0];
  for (const d of dropoffs) { if (d.drop > biggestDrop.drop) biggestDrop = d; }

  els.insightsContent.innerHTML = `
    <div class="insights-toolbar" style="grid-column: 1 / -1;">
      <button class="${mode === 'active' ? '' : 'secondary'}" data-insights-mode="active" type="button">Active Pipeline</button>
      <button class="${mode === 'all' ? '' : 'secondary'}" data-insights-mode="all" type="button">All Time</button>
    </div>
    
    <!-- Top KPIs -->
    <div class="kpi-cards" style="grid-column: 1 / -1;">
      <div class="kpi-card">
        <div class="kpi-card-val total">${total}</div>
        <div class="kpi-card-label">Total Apps</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 8px; font-weight: 600;">
          <span style="color: var(--app)">${Number(report.lifecycle_counts?.active || 0)} Active</span> | 
          <span style="color: var(--cls)">${Number(report.lifecycle_counts?.closed || 0)} Closed</span>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-val int">${funnelRows[1].count}</div>
        <div class="kpi-card-label">Interviews</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-val act">${funnelRows[2].count}</div>
        <div class="kpi-card-label">Offers</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-val rate">${rate(stats.funnel.responded, total)}</div>
        <div class="kpi-card-label">Response Rate</div>
      </div>
    </div>

    <!-- Top Row -->
    <section class="report-panel wide" style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; padding: 32px; margin-bottom: 24px;">
      <div>
        <div class="panel-kicker">Funnel</div>
        <h3>Application Funnel</h3>
        <div class="funnel-bars">
          <div class="funnel-bar-row">
            <span class="funnel-bar-label">Applied</span>
            <div class="funnel-bar-track"><div class="funnel-bar-fill" style="width: 100%; background: var(--accent);"></div></div>
            <span class="funnel-bar-count">${total}</span>
          </div>
          <div class="funnel-bar-row">
            <span class="funnel-bar-label">Interview</span>
            <div class="funnel-bar-track"><div class="funnel-bar-fill" style="width: ${total > 0 ? Math.max(2, (funnelRows[1].count / total) * 100) : 0}%; background: var(--int);"></div></div>
            <span class="funnel-bar-count">${funnelRows[1].count} <span class="funnel-conv-rate">${rate(stats.funnel.interviewed, total)}</span></span>
          </div>
          <div class="funnel-bar-row">
            <span class="funnel-bar-label">Offer</span>
            <div class="funnel-bar-track"><div class="funnel-bar-fill" style="width: ${total > 0 ? Math.max(2, (funnelRows[2].count / total) * 100) : 0}%; background: var(--act);"></div></div>
            <span class="funnel-bar-count">${funnelRows[2].count} <span class="funnel-conv-rate">${rate(stats.funnel.offers, stats.funnel.interviewed)}</span></span>
          </div>
          <div class="funnel-bar-row">
            <span class="funnel-bar-label">Accepted</span>
            <div class="funnel-bar-track"><div class="funnel-bar-fill" style="width: ${total > 0 ? Math.max(2, (funnelRows[3].count / total) * 100) : 0}%; background: var(--act);"></div></div>
            <span class="funnel-bar-count">${funnelRows[3].count} <span class="funnel-conv-rate">${rate(stats.funnel.accepted, stats.funnel.offers)}</span></span>
          </div>
        </div>
        <div class="drop-off-alert">
          <i class="bi bi-exclamation-triangle-fill" style="color: var(--cls); font-size: 16px;"></i>
          <div>
            <strong>Biggest Drop-off:</strong> ${biggestDrop.stage} (${biggestDrop.drop}%)
          </div>
        </div>
      </div>
      <div>
        <div class="panel-kicker">Velocity</div>
        <h3>Time in Stage</h3>
        <div class="stat-figures" style="margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <article style="background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
            <strong style="font-size: 32px; color: var(--int); display: block; margin-bottom: 8px;">${stats.timing.avg_days_to_interview ?? '—'}</strong>
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--muted);">avg days to interview</span>
          </article>
          <article style="background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
            <strong style="font-size: 32px; color: var(--act); display: block; margin-bottom: 8px;">${stats.timing.avg_days_to_close ?? '—'}</strong>
            <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--muted);">avg days to close</span>
          </article>
        </div>
      </div>
    </section>

    <!-- Outcomes & Lifecycle Row -->
    <section class="report-panel wide" style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; padding: 32px; margin-bottom: 24px;">
      <div>
        <div class="panel-kicker">Outcomes</div>
        <h3 style="margin-bottom: 16px;">Responses</h3>
        <p class="response-rate-display" style="font-size: 24px; font-weight: 800; color: var(--accent-dark); margin-bottom: 24px;">
          ${rate(stats.funnel.responded, total)} <span style="font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">response rate</span>
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${reportRow('Responded', Number(stats.funnel.responded || 0), Math.max(1, total), null, total, '--app')}
          ${reportRow('Rejected', Number(stats.funnel.rejected || 0), Math.max(1, total), null, total, '--cls')}
          ${reportRow('Ghosted', Number(stats.totals.ghosted || 0), Math.max(1, total), null, total, '--muted')}
        </div>
      </div>
      <div style="display: flex; flex-direction: column;">
        <div class="panel-kicker">Portfolio</div>
        <h3 style="margin-bottom: 24px;">Lifecycle</h3>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${[
            { label: 'Active', count: Number(report.lifecycle_counts?.active || 0), jump: { view: 'false' }, color: '--app' },
            { label: 'Closed', count: Number(report.lifecycle_counts?.closed || 0), jump: { view: 'closed' }, color: '--cls' },
            { label: 'Archived', count: Number(report.lifecycle_counts?.archived || 0), jump: { view: 'true' }, color: '--muted' }
          ].map((row) => reportRow(row.label, row.count, Number(report.lifecycle_counts?.total || 1), row.jump, Number(report.lifecycle_counts?.total || 0), row.color)).join('')}
        </div>
      </div>
    </section>

    <!-- Charts Row -->
    <section class="report-panel wide" style="grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; padding: 32px;">
      <div style="min-height: 280px; display: flex; flex-direction: column;">
        <div class="panel-kicker">Trends</div>
        <h3 style="margin-bottom: 0;">Monthly Applications</h3>
        <div class="chart-container" style="flex: 1;">
          <canvas id="monthlyChart"></canvas>
        </div>
      </div>
      <div style="min-height: 280px; display: flex; flex-direction: column;">
        <div class="panel-kicker">Snapshot</div>
        <h3 style="margin-bottom: 0;">Pipeline Status</h3>
        <div class="chart-container" style="flex: 1;">
          <canvas id="statusChart"></canvas>
        </div>
      </div>
    </section>

    ${/*
    <section id="company-category-performance" class="report-panel report-panel-tags wide" style="grid-column: 1 / -1;">
      <div class="panel-kicker">Companies</div>
      <h3>Company Categories</h3>
      <div class="tags-grid">
        ${categoryHtml}
      </div>
    </section>
    */ ''}

    <section id="selected-tag-performance" class="report-panel report-panel-tags wide" style="grid-column: 1 / -1;">
      <div class="panel-kicker">Companies</div>
      <h3>Company Category Performance</h3>
      ${categoryPerformanceHtml}
    </section>

    ${/*
    <section id="selected-tag-comparison" class="report-panel report-panel-tags wide" style="grid-column: 1 / -1;">
      <div class="panel-kicker">Skills</div>
      <h3>Top Tags</h3>
      <div class="tags-grid">
        ${tagHtml}
      </div>
    </section>
    */ ''}

    <section class="report-panel report-panel-tags wide" style="grid-column: 1 / -1;">
      <div class="panel-kicker">Skills</div>
      <h3>Selected Tag Performance</h3>
      ${selectedTagPerformanceHtml}
    </section>

    <section class="report-panel report-panel-tags wide" style="grid-column: 1 / -1;">
      <div class="panel-kicker">Skills</div>
      <h3>Selected Tag Comparison</h3>
      ${selectedTagComparisonHtml}
    </section>

    ${processHtml}
  `;

  // Render Charts
  setTimeout(() => {
    if (typeof Chart === 'undefined') return;

    // Destroy existing charts if they exist
    if (window.monthlyChartInst) window.monthlyChartInst.destroy();
    if (window.statusChartInst) window.statusChartInst.destroy();

    const monthlyCtx = document.getElementById('monthlyChart');
    if (monthlyCtx && report.monthly_counts.length > 0) {
      const reversedMonthly = [...report.monthly_counts].reverse();
      const labels = reversedMonthly.map(r => formatMonthLabel(r.month));
      const data = reversedMonthly.map(r => Number(r.count));
      
      const primaryColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#3b82f6';
      
      window.monthlyChartInst = new Chart(monthlyCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Applications',
            data,
            borderColor: primaryColor,
            backgroundColor: primaryColor + '20',
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }

    const statusCtx = document.getElementById('statusChart');
    if (statusCtx && report.status_counts.length > 0) {
      const getStatusColorHex = (status) => {
        if (['applied'].includes(status)) return '#3b82f6';
        if (['interview_scheduled', 'interviewing'].includes(status)) return '#f59e0b';
        if (['offer_received', 'accepted'].includes(status)) return '#10b981';
        if (['rejected', 'withdrawn'].includes(status)) return '#ef4444';
        if (['ghosted'].includes(status)) return '#9ca3af';
        return '#8b5cf6';
      };

      const labels = report.status_counts.map(r => statusLabels[r.status] || r.status);
      const data = report.status_counts.map(r => Number(r.count));
      const backgroundColor = report.status_counts.map(r => getStatusColorHex(r.status));

      window.statusChartInst = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor, borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { position: 'right', labels: { color: '#6b7280' } }
          }
        }
      });
    }
  }, 0);
}

function renderCategoryPerformanceTable(categories, totalApplications, selectedCategory = '', period = 'all') {
  if (!categories.length) return '<p>No category data.</p>';
  const jumpDates = getCategoryPerformanceJumpDates(period);

  return `
    <div class="table-container insights-scroll-panel">
      <table class="companies-table" data-category-performance>
        <thead>
          <tr>
            <th>Company category</th>
            <th>Applied</th>
            <th>Applied %</th>
            <th>Interviewed</th>
            <th>Interview %</th>
            <th>Rejected</th>
            <th>Ghosted</th>
            <th>Closed</th>
            <th>Closed %</th>
          </tr>
        </thead>
        <tbody>
          ${categories.map((row) => {
            const applied = countCategoryMetric(row.applications);
            const interviewed = countCategoryMetric(row.interviewed);
            const rejected = countCategoryMetric(row.rejected);
            const ghosted = countCategoryMetric(row.ghosted);
            const closed = row.closed === undefined || row.closed === null
              ? rejected + ghosted + countCategoryMetric(row.withdrawn)
              : countCategoryMetric(row.closed);
            const jumpAttrs = ` data-jump-category="${escapeAttribute(row.category || '')}" data-jump-source-section="company-category-performance" data-jump-source-period="${escapeAttribute(period)}"${jumpDates.dateFrom ? ` data-jump-date-from="${escapeAttribute(jumpDates.dateFrom)}"` : ''}${jumpDates.dateTo ? ` data-jump-date-to="${escapeAttribute(jumpDates.dateTo)}"` : ''}`;
            return `
              <tr data-category-performance-row="${escapeAttribute(row.category || '')}" data-applications="${applied}" data-interviewed="${interviewed}" data-closed="${closed}"${jumpAttrs}${selectedCategory && row.category !== selectedCategory ? ' hidden' : ''}>
                <td><button class="button-link report-row-jump" type="button"${jumpAttrs}>${escapeHtml(row.category || '')}</button></td>
                <td>${applied}</td>
                <td>${formatCategoryPercent(applied, totalApplications)}</td>
                <td>${interviewed}</td>
                <td>${renderCategoryPercentBadge(interviewed, applied, applied, 'interview')}</td>
                <td>${rejected}</td>
                <td>${ghosted}</td>
                <td>${closed}</td>
                <td>${renderCategoryPercentBadge(closed, applied, applied, 'closed')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderProcessInsightsSection(processInsights) {
  const totals = processInsights?.totals || {};
  const paths = processInsights?.paths || {};
  const timing = processInsights?.timing || {};
  const groups = processInsights?.groups || {};
  const groupRows = Object.entries(groups);
  const maxCompleted = Math.max(1, ...groupRows.map(([, row]) => Number(row.completed || 0)));
  return `
    <section class="report-panel report-panel-tags wide process-insights-panel" style="grid-column: 1 / -1;">
      <div class="panel-kicker">Hiring Process</div>
      <h3>Screening and Interview Flow</h3>
      <div class="tags-grid process-summary-grid">
        ${reportRow('Screening calls', Number(totals.completed_screening_calls || 0), 1, null, `${Number(totals.screened_applications || 0)} applications screened`, '--app')}
        ${reportRow('Awaiting response', Number(totals.awaiting_response_steps || 0), 1, null, `${Number(totals.on_hold_steps || 0)} on hold`, '--focus')}
        ${reportRow('No response closures', Number(totals.no_response_closures || 0), 1, null, 'closed on your side', '--cls')}
        ${reportRow('Feedback received', Number(totals.feedback_received || 0), 1, null, `${Number(totals.feedback_unknown || 0)} unknown`, '--act')}
        <div class="report-row" style="--row-fill:3%;--row-color:var(--muted);">
          <span>Median response days</span>
          <strong>${escapeHtml(timing.median_response_days === null || timing.median_response_days === undefined ? '—' : String(timing.median_response_days))}</strong>
        </div>
      </div>
      <div class="report-columns">
        <div>
          <h4>Step Types</h4>
          ${(groupRows.length ? groupRows : [['screening', {}], ['assessment', {}], ['interview', {}], ['discussion', {}], ['other', {}]]).map(([group, row]) => reportRow(
            formatAction(group),
            Number(row.completed || 0),
            maxCompleted,
            null,
            `${Number(row.scheduled || 0)} scheduled, ${Math.round(Number(row.progression_rate || 0) * 100)}% progressed`,
            '--focus'
          )).join('')}
        </div>
        <div>
          <h4>Paths</h4>
          ${reportRow('Screening to assessment', Number(paths.screening_to_assessment || 0), 1)}
          ${reportRow('Screening to interview', Number(paths.screening_to_interview || 0), 1)}
          ${reportRow('Direct to assessment', Number(paths.direct_to_assessment || 0), 1)}
          ${reportRow('Direct to interview', Number(paths.direct_to_interview || 0), 1)}
          ${reportRow('Assessment to interview', Number(paths.assessment_to_interview || 0), 1)}
        </div>
      </div>
    </section>
  `;
}

export function renderCategoryPerformanceSection(categories, totalApplications, period = 'all', selectedCategory = '') {
  const rows = categories.map(normalizeCategoryPerformanceRow);
  const selectedRows = selectedCategory ? rows.filter((row) => row.category === selectedCategory) : rows;
  const allSummary = summarizeCategoryPerformanceRows(selectedRows, totalApplications);
  const categoryOptions = rows.map((row) =>
    `<option value="${escapeAttribute(row.category)}"${row.category === selectedCategory ? ' selected' : ''}>${escapeHtml(row.category)}</option>`
  ).join('');

  return `
    <div data-category-performance-section data-category-performance-total="${countCategoryMetric(totalApplications)}">
      <div class="toolbar" aria-label="Company category performance controls" style="margin-bottom: 16px;">
        <div class="filter-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; align-items: end;">
          <label>
            <span>Period</span>
            <select data-category-performance-period aria-label="Period">
              <option value="all"${period === 'all' ? ' selected' : ''}>All time</option>
              <option value="30"${period === '30' ? ' selected' : ''}>Last 30 days</option>
              <option value="60"${period === '60' ? ' selected' : ''}>Last 60 days</option>
              <option value="90"${period === '90' ? ' selected' : ''}>Last 90 days</option>
            </select>
          </label>
          <label>
            <span>Company category</span>
            <select data-category-performance-filter aria-label="Company category">
              <option value="">All categories</option>
              ${categoryOptions}
            </select>
          </label>
        </div>
      </div>
      ${/* renderCategoryPerformanceSummary(allSummary, selectedCategory) */ ''}
      ${renderCategoryPerformanceTable(rows, totalApplications, selectedCategory, period)}
    </div>
  `;
}

export function renderSelectedTagPerformanceSection(tags, totalApplications, period = 'all') {
  const rows = tags.map(normalizeTagPerformanceRow);
  const jumpDates = getCategoryPerformanceJumpDates(period);
  const tableHtml = rows.length ? `
    <div class="table-container insights-scroll-panel">
      <table class="companies-table" data-selected-tag-performance>
        <thead>
          <tr>
            <th>Tag</th>
            <th>Applied</th>
            <th>Applied %</th>
            <th>Interviewed</th>
            <th>Interview %</th>
            <th>Rejected</th>
            <th>Ghosted</th>
            <th>Closed</th>
            <th>Closed %</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const jumpAttrs = ` data-jump-tag="${escapeAttribute(row.tag)}" data-jump-source-section="selected-tag-performance" data-jump-source-period="${escapeAttribute(period)}"${jumpDates.dateFrom ? ` data-jump-date-from="${escapeAttribute(jumpDates.dateFrom)}"` : ''}${jumpDates.dateTo ? ` data-jump-date-to="${escapeAttribute(jumpDates.dateTo)}"` : ''}`;
            return `
            <tr data-selected-tag-performance-row="${escapeAttribute(row.tag)}"${jumpAttrs}>
              <td><button class="button-link report-row-jump" type="button"${jumpAttrs}><span class="selected-tag-table-pill">${escapeHtml(row.tag)}</span></button></td>
              <td>${row.applications}</td>
              <td>${formatCategoryPercent(row.applications, totalApplications)}</td>
              <td>${row.interviewed}</td>
              <td>${renderCategoryPercentBadge(row.interviewed, row.applications, row.applications, 'interview')}</td>
              <td>${row.rejected}</td>
              <td>${row.ghosted}</td>
              <td>${row.closed}</td>
              <td>${renderCategoryPercentBadge(row.closed, row.applications, row.applications, 'closed')}</td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>
  ` : '<p>No selected tags. Add tags in Settings to populate this report.</p>';

  return `
    <div data-selected-tag-performance-section data-selected-tag-performance-total="${countCategoryMetric(totalApplications)}">
      <div class="toolbar" aria-label="Selected tag performance controls" style="margin-bottom: 16px;">
        <div class="filter-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; align-items: end;">
          <label>
            <span>Period</span>
            <select data-selected-tag-performance-period aria-label="Selected tag period">
              <option value="all"${period === 'all' ? ' selected' : ''}>All time</option>
              <option value="30"${period === '30' ? ' selected' : ''}>Last 30 days</option>
              <option value="60"${period === '60' ? ' selected' : ''}>Last 60 days</option>
              <option value="90"${period === '90' ? ' selected' : ''}>Last 90 days</option>
            </select>
          </label>
        </div>
      </div>
      <p class="section-help" style="margin-top: 0;">Rows are tag-attributed. The same application can appear under multiple selected tags.</p>
      ${tableHtml}
    </div>
  `;
}

export function renderSelectedTagComparisonSection(tags, period = 'all') {
  const rows = tags.map(normalizeTagPerformanceRow);
  const jumpDates = getCategoryPerformanceJumpDates(period);
  const chartHtml = rows.length ? `
    <div class="selected-tag-comparison-list insights-scroll-panel">
      ${rows.map((row) => {
        const active = Math.max(0, row.applications - row.closed);
        const barWidth = (part) => row.applications ? Math.max(2, Math.round((part / row.applications) * 100)) : 0;
        const activePercent = formatCategoryPercent(active, row.applications);
        const interviewPercent = formatCategoryPercent(row.interviewed, row.applications);
        const closedPercent = formatCategoryPercent(row.closed, row.applications);
        const jumpAttrs = ` data-jump-tag="${escapeAttribute(row.tag)}" data-jump-source-section="selected-tag-comparison" data-jump-source-period="${escapeAttribute(period)}"${jumpDates.dateFrom ? ` data-jump-date-from="${escapeAttribute(jumpDates.dateFrom)}"` : ''}${jumpDates.dateTo ? ` data-jump-date-to="${escapeAttribute(jumpDates.dateTo)}"` : ''}`;
        return `
          <article class="selected-tag-comparison-group"${jumpAttrs}>
            <div class="selected-tag-comparison-heading">
              <button class="button-link selected-tag-comparison-title" type="button"${jumpAttrs}>${escapeHtml(row.tag)}</button>
              <span class="selected-tag-comparison-applied">${row.applications} applied</span>
            </div>
            <div class="selected-tag-comparison-bars">
              ${renderSelectedTagComparisonBar('Active', active, activePercent, barWidth(active), 'neutral')}
              ${renderSelectedTagComparisonBar('Interviewed', row.interviewed, interviewPercent, barWidth(row.interviewed), 'green')}
              ${renderSelectedTagComparisonBar('Closed', row.closed, closedPercent, barWidth(row.closed), 'red')}
            </div>
          </article>
        `;
      }).join('')}
    </div>
  ` : '<p>No chart tags. Add chart tags in Settings to populate this comparison.</p>';

  return `
    <div data-selected-chart-tag-comparison-section>
      <div class="toolbar" aria-label="Selected tag comparison controls" style="margin-bottom: 16px;">
        <div class="filter-panel" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; align-items: end;">
          <label>
            <span>Period</span>
            <select data-selected-chart-tag-comparison-period aria-label="Selected tag comparison period">
              <option value="all"${period === 'all' ? ' selected' : ''}>All time</option>
              <option value="30"${period === '30' ? ' selected' : ''}>Last 30 days</option>
              <option value="60"${period === '60' ? ' selected' : ''}>Last 60 days</option>
              <option value="90"${period === '90' ? ' selected' : ''}>Last 90 days</option>
            </select>
          </label>
        </div>
      </div>
      ${chartHtml}
    </div>
  `;
}

function renderSelectedTagComparisonBar(label, count, percentText, width, tone) {
  const numericWidth = Number(width);
  const safeWidth = Math.max(0, Math.min(100, Number.isFinite(numericWidth) ? numericWidth : 0));
  return `
    <div class="selected-tag-comparison-row">
      <span class="selected-tag-comparison-label">${escapeHtml(label)}</span>
      <div class="selected-tag-comparison-track">
        <div class="selected-tag-comparison-fill selected-tag-comparison-fill-${tone}" style="width: ${safeWidth}%;"></div>
      </div>
      <span class="selected-tag-comparison-count">${count}${percentText ? ` <span>${escapeHtml(percentText)}</span>` : ''}</span>
    </div>
  `;
}

function renderCategoryPerformanceSummary(summary, selectedCategory = '') {
  return `
    <div class="kpi-cards" data-category-performance-summary="${escapeAttribute(selectedCategory)}" style="grid-column: 1 / -1; margin-bottom: 16px;">
      <div class="kpi-card">
        <div class="kpi-card-val total" data-category-summary-applications>${summary.applied}</div>
        <div class="kpi-card-label">Applications</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 8px; font-weight: 600;"><span data-category-summary-applied-percent>${summary.appliedPercent}</span> of selected period</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-val int" data-category-summary-interview-percent>${summary.interviewPercent}</div>
        <div class="kpi-card-label">Interview rate</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 8px; font-weight: 600;"><span data-category-summary-interviewed>${summary.interviewed}</span> interviewed</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-val rate" data-category-summary-closed-percent>${summary.closedPercent}</div>
        <div class="kpi-card-label">Closed</div>
        <div style="font-size: 11px; color: var(--muted); margin-top: 8px; font-weight: 600;"><span data-category-summary-closed>${summary.closed}</span> closed</div>
      </div>
    </div>
  `;
}

function summarizeCategoryPerformanceRows(rows, totalApplications) {
  const totals = rows.reduce((acc, row) => ({
    applied: acc.applied + row.applications,
    interviewed: acc.interviewed + row.interviewed,
    closed: acc.closed + row.closed
  }), { applied: 0, interviewed: 0, closed: 0 });
  return {
    ...totals,
    appliedPercent: formatCategoryPercent(totals.applied, totalApplications),
    interviewPercent: formatCategoryPercent(totals.interviewed, totals.applied),
    closedPercent: formatCategoryPercent(totals.closed, totals.applied)
  };
}

function normalizeCategoryPerformanceRow(row) {
  const rejected = countCategoryMetric(row.rejected);
  const ghosted = countCategoryMetric(row.ghosted);
  const withdrawn = countCategoryMetric(row.withdrawn);
  return {
    ...row,
    category: row.category || '',
    applications: countCategoryMetric(row.applications),
    interviewed: countCategoryMetric(row.interviewed),
    rejected,
    ghosted,
    withdrawn,
    closed: row.closed === undefined || row.closed === null ? rejected + ghosted + withdrawn : countCategoryMetric(row.closed)
  };
}

function normalizeTagPerformanceRow(row) {
  const rejected = countCategoryMetric(row.rejected);
  const ghosted = countCategoryMetric(row.ghosted);
  const withdrawn = countCategoryMetric(row.withdrawn);
  return {
    tag: row.tag || '',
    applications: countCategoryMetric(row.applications),
    interviewed: countCategoryMetric(row.interviewed),
    rejected,
    ghosted,
    withdrawn,
    closed: row.closed === undefined || row.closed === null ? rejected + ghosted + withdrawn : countCategoryMetric(row.closed)
  };
}

function countCategoryMetric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatCategoryPercent(part, whole) {
  const denominator = countCategoryMetric(whole);
  if (!denominator) return '0%';
  return `${Math.round((countCategoryMetric(part) / denominator) * 100)}%`;
}

function renderCategoryPercentBadge(part, whole, applied, kind) {
  const denominator = countCategoryMetric(whole);
  const percentValue = denominator ? Math.round((countCategoryMetric(part) / denominator) * 100) : 0;
  const appliedCount = countCategoryMetric(applied);
  let tone = 'neutral';

  if (appliedCount >= 10) {
    if (kind === 'interview') {
      if (percentValue >= 20) tone = 'green';
      else if (percentValue >= 10) tone = 'blue';
    } else if (kind === 'closed') {
      if (percentValue >= 50) tone = 'red';
      else if (percentValue >= 25) tone = 'amber';
    }
  }

  return `<span class="category-percent-badge category-percent-badge-${tone}">${percentValue}%</span>`;
}

function getCategoryPerformanceJumpDates(period) {
  const days = Number(period);
  if (![30, 60, 90].includes(days)) return {};
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    dateFrom: isoDate(start),
    dateTo: isoDate(end)
  };
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

function buildStatChips(counts) {
  const chips = [
    counts.active    && `<span class="stat-chip stat-active"><span class="stat-dot"></span>${counts.active} Active</span>`,
    counts.interview && `<span class="stat-chip stat-interview"><span class="stat-dot"></span>${counts.interview} Interviews</span>`,
    counts.offer     && `<span class="stat-chip stat-offer"><span class="stat-dot"></span>${counts.offer} Offers</span>`,
    counts.accepted  && `<span class="stat-chip stat-accepted"><span class="stat-dot"></span>${counts.accepted} Accepted</span>`,
  ].filter(Boolean);
  return chips.length ? chips.join('') : '';
}

function getListSummaryCounts(state) {
  const statusCounts = state.applicationStatusCounts || null;
  if (statusCounts) {
    return {
      active: Number(statusCounts.active || 0),
      interview: Number(statusCounts.interview_scheduled || 0),
      offer: Number(statusCounts.offer || 0),
      accepted: Number(statusCounts.accepted || 0),
    };
  }
  const applications = state.applications || [];
  return {
    active: applications.filter((item) => !['rejected', 'withdrawn', 'ghosted'].includes(item.status)).length,
    interview: applications.filter((item) => item.status === 'interview_scheduled').length,
    offer: applications.filter((item) => item.status === 'offer').length,
    accepted: applications.filter((item) => item.status === 'accepted').length,
  };
}

export function renderApplications(els, state, statusOptions) {
  renderInsightsReturnBar(els, state);
  els.table.innerHTML = '';
  els.empty.hidden = state.applications.length !== 0;
  const summaryCounts = getListSummaryCounts(state);
  els.summary.innerHTML = buildStatChips(summaryCounts);
  if (els.applicationPagination) renderApplicationPagination(els, state);
  if (!state.applications.length) {
    const isFiltered = state.filters.search || state.filters.status || state.filters.tag || state.filters.archived !== 'false';
    els.empty.innerHTML = renderEmptyState(
      isFiltered ? 'No matches found' : 'Start your tracker',
      isFiltered
        ? 'No applications match the current filters.'
        : 'Create your first application to unlock reminders, preparation tracking, AI outputs, and reporting.',
      isFiltered
        ? 'Adjust the filters or switch the view to include archived records.'
        : 'Use New Application in the top bar to add your first role.'
    ) + (isFiltered ? '' : '<div class="empty-state-action"><button id="emptyStateNewApp" class="primary-btn" type="button"><i class="bi bi-plus-lg"></i> New Application</button></div>');
  }

  for (const application of state.applications) {
    els.table.appendChild(buildApplicationRow(application, statusOptions, state.selectedIds?.has(application.id), state.processSummaries?.get(Number(application.id))));
  }
}

function renderInsightsReturnBar(els, state) {
  const existing = els.listView?.querySelector('[data-insights-return-bar]');
  if (existing) existing.remove();
  if (!state.insightsReturn?.section || !els.listView) return;
  const labels = {
    'company-category-performance': 'Company Category Performance',
    'selected-tag-performance': 'Selected Tag Performance',
    'selected-tag-comparison': 'Selected Tag Comparison'
  };
  const label = labels[state.insightsReturn.section] || 'Insights';
  const bar = document.createElement('div');
  bar.className = 'insights-return-bar';
  bar.dataset.insightsReturnBar = 'true';
  bar.innerHTML = `<button class="button-link" type="button" data-insights-return="${escapeAttribute(state.insightsReturn.section)}" data-insights-period="${escapeAttribute(state.insightsReturn.period || '')}">Back to Insights: ${escapeHtml(label)}</button>`;
  els.listView.prepend(bar);
}

export function buildApplicationRow(application, statusOptions, selected = false, processSummary = null) {
  const closed = !application.archived_at && isClosedStatus(application.status);
  const row = document.createElement('tr');
  row.dataset.id = application.id;
  row.className = application.archived_at ? 'archived' : closed ? 'closed' : '';
  
  const subtitle = [application.role_title, application.location].filter(Boolean).join(' · ') || application.cv_name || 'No CV';
  
  row.tabIndex = 0;
  row.innerHTML = `
    <td class="select-col"><input type="checkbox" data-select-id="${application.id}" aria-label="Select ${escapeHtml(application.company_name)}"${selected ? ' checked' : ''}></td>
    <td>
      <div class="company-cell">
        <strong title="${escapeAttribute(application.company_name)}"><a class="company-link" href="/applications/${application.id}">${escapeHtml(application.company_name)}</a>${Number(application.company_count) > 1 ? `<button class="company-count-badge" type="button" data-filter-company="${escapeAttribute(application.company_name)}" title="Show all ${application.company_count} applications for ${escapeAttribute(application.company_name)}">×${application.company_count}</button>` : ''}</strong>
        <span title="${escapeAttribute(subtitle)}">${escapeHtml(subtitle)}</span>
        ${renderProcessRowSummary(processSummary)}
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
    <td>${closed ? '' : renderNextAction(application, processSummary)}</td>
    <td>${renderStaleSignal(application)}</td>
    <td data-interview-cell>${closed ? '' : renderInterviewControl(application, processSummary)}</td>
    <td class="action-col">
      <div class="row-actions">
        <a class="icon-button row-open-btn" href="/applications/${application.id}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(application.company_name)} in new tab" title="Open in new tab">
          <i class="bi bi-box-arrow-up-right"></i>
        </a>
      </div>
    </td>
  `;

  row.querySelector('[data-field="status"]').value = application.status;
  return row;
}

function renderProcessRowSummary(summary) {
  if (!summary || !Number(summary.total_steps || 0)) return '';
  const total = Number(summary.total_steps);
  const next = summary.next_scheduled_name
    ? `${summary.next_scheduled_name}${summary.next_scheduled_date ? `, ${formatDate(summary.next_scheduled_date)}` : ''}`
    : 'No open process step';
  return `<span class="process-row-summary process-row-count" title="${escapeAttribute(next)}">${total} ${total === 1 ? 'step' : 'steps'}</span>`;
}

function renderNextAction(application, processSummary = null) {
  const processStep = processSummary?.next_scheduled_name
    ? `${processSummary.next_scheduled_name}`
    : '';
  const action = processStep || application.next_action || recommendedNextAction(application);
  const dueDate = processStep ? processSummary.next_scheduled_date : application.next_action_due_date;
  return `
    <div class="next-action-cell">
      <strong title="${escapeAttribute(action)}">${escapeHtml(action)}</strong>
      ${dueDate ? `<span>${formatDate(dueDate)}</span>` : ''}
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
  // document.documentElement.style.setProperty('--banner-h', notifications.length === 0 ? '0px' : '52px');
  document.documentElement.style.setProperty('--banner-h', notifications.length === 0 ? '0px' : '36px');
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
              ${item.type === 'interview' || item.type === 'process_step'
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
              <strong><a class="company-link" href="/applications/${item.id}">${escapeHtml(item.company_name)}</a></strong>
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
  if (!jobBoards.length) {
    els.jobBoardsList.innerHTML = renderEmptyState('No job boards saved', 'Add sources you check regularly so your search routine stays visible and repeatable.', 'The app now seeds common boards automatically after migrations run.');
    return;
  }

  const sorted = [...jobBoards].sort((a, b) => (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0));

  els.jobBoardsList.innerHTML = `
    <div class="table-shell">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Last Checked</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((board) => `
            <tr class="${board.is_active ? '' : 'board-inactive-row'}">
              <td>
                <strong>${escapeHtml(board.name)}</strong>
                ${!board.is_active ? '<span class="board-inactive-badge">Inactive</span>' : ''}
              </td>
              <td>
                <span class="board-description" title="${escapeAttribute(board.notes || '')}">${board.notes ? escapeHtml(board.notes.length > 80 ? board.notes.slice(0, 80) + '…' : board.notes) : '<span class="muted-text">—</span>'}</span>
              </td>
              <td>${board.last_checked_date
                  ? `<span class="muted-text">${escapeHtml(formatDate(board.last_checked_date))}</span> <span class="freshness-badge ${jobBoardFreshnessClass(board)}">${escapeHtml(jobBoardFreshnessLabel(board))}</span>`
                  : '<span class="freshness-badge freshness-stale">Never checked</span>'}</td>
              <td>
                <div class="board-actions-row">
                  ${board.url ? `<button class="icon-button text-primary" type="button" data-job-board-open="${board.id}" title="Visit"><i class="bi bi-box-arrow-up-right"></i></button>` : ''}
                  <button class="icon-button text-primary" type="button" data-job-board-edit="${board.id}" title="Edit"><i class="bi bi-pencil"></i></button>
                  <button class="icon-button text-warning" type="button" data-job-board-toggle="${board.id}" data-job-board-active="${board.is_active ? 'true' : 'false'}" title="${board.is_active ? 'Mark inactive' : 'Activate'}"><i class="bi bi-power"></i></button>
                  <button class="icon-button text-danger" type="button" data-job-board-delete="${board.id}" title="Delete"><i class="bi bi-trash"></i></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
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
      <section class="detail-section" style="margin-top: 24px;">
        <div class="section-heading">
          <div>
            <h3>Selected Tag Performance</h3>
            <p class="section-help">Choose the application tags that should appear in the Insights selected-tag report. <span id="selectedTagSettingsStatus">Loading selected tags...</span></p>
          </div>
        </div>
        <div class="toolbar" aria-label="Selected tag report settings">
          <div class="toolbar-main-row">
            <label style="min-width: 260px;">
              <span>Search tags</span>
              <input id="selectedTagInput" type="search" placeholder="Search current tags">
            </label>
            <button id="selectedTagAddSaveButton" type="button" disabled>Add selected and save</button>
          </div>
          <div id="selectedTagOptions" class="selected-tag-option-list" aria-label="Available selected tag report tags"></div>
        </div>
        <div id="selectedTagList" class="tag-row" style="margin-top: 12px;"></div>
      </section>
      <section class="detail-section" style="margin-top: 24px;">
        <div class="section-heading">
          <div>
            <h3>Chart Tag Selection</h3>
            <p class="section-help">Choose the application tags that should appear in the Insights selected-tag comparison chart. <span id="selectedChartTagSettingsStatus">Loading chart tags...</span></p>
          </div>
        </div>
        <div class="toolbar" aria-label="Selected chart tag settings">
          <div class="toolbar-main-row">
            <label style="min-width: 260px;">
              <span>Search tags</span>
              <input id="selectedChartTagInput" type="search" placeholder="Search current tags">
            </label>
            <button id="selectedChartTagAddSaveButton" type="button" disabled>Add selected and save</button>
          </div>
          <div id="selectedChartTagOptions" class="selected-tag-option-list" aria-label="Available chart tags"></div>
        </div>
        <div id="selectedChartTagList" class="tag-row" style="margin-top: 12px;"></div>
      </section>
    </section>
  `;
}

export function renderSelectedTagsSettings(els, availableTags = [], selectedTags = [], pendingTags = []) {
  const selectedSet = new Set(selectedTags);
  const pendingSet = new Set(pendingTags);
  const optionRows = availableTags
    .filter((tag) => !selectedSet.has(tag))
    .map((tag) => `
      <label class="selected-tag-option-row" data-selected-tag-option-row>
        <input type="checkbox" data-selected-tag-option value="${escapeAttribute(tag)}"${pendingSet.has(tag) ? ' checked' : ''}>
        <span>${escapeHtml(tag)}</span>
      </label>
    `)
    .join('');
  const options = `${optionRows}<div class="selected-tag-options-empty" data-selected-tag-options-empty>${optionRows ? 'Search to find tags.' : 'No available tags.'}</div>`;
  const tray = selectedTags.map((tag) => `
    <span class="selected-tag-chip selected-tag-chip-removable">
      ${escapeHtml(tag)}
      <button class="selected-tag-chip-remove" type="button" data-selected-tag-remove="${escapeAttribute(tag)}" aria-label="Remove ${escapeAttribute(tag)}">x</button>
    </span>
  `).join('');
  const list = selectedTags.length
    ? `
      <div class="selected-tag-settings-summary">
        <details class="selected-tag-manage">
          <summary>Manage selected tags</summary>
          <div class="selected-tag-tray">${tray}</div>
        </details>
      </div>
    `
    : '<span class="muted-text">No tags selected for the report.</span>';

  const optionsEl = els.settingsContent?.querySelector('#selectedTagOptions');
  const listEl = els.settingsContent?.querySelector('#selectedTagList');
  const statusEl = els.settingsContent?.querySelector('#selectedTagSettingsStatus');
  const addButton = els.settingsContent?.querySelector('#selectedTagAddSaveButton');
  if (optionsEl) optionsEl.innerHTML = options;
  if (listEl) listEl.innerHTML = list;
  if (statusEl) statusEl.textContent = `${selectedTags.length} selected. ${pendingTags.length} pending. Available current tags: ${availableTags.length}.`;
  if (addButton) {
    addButton.disabled = pendingTags.length === 0;
    addButton.textContent = pendingTags.length ? `Add ${pendingTags.length} selected and save` : 'Add selected and save';
  }
}

export function renderSelectedChartTagsSettings(els, availableTags = [], selectedTags = [], pendingTags = []) {
  const selectedSet = new Set(selectedTags);
  const pendingSet = new Set(pendingTags);
  const optionRows = availableTags
    .filter((tag) => !selectedSet.has(tag))
    .map((tag) => `
      <label class="selected-tag-option-row" data-selected-chart-tag-option-row>
        <input type="checkbox" data-selected-chart-tag-option value="${escapeAttribute(tag)}"${pendingSet.has(tag) ? ' checked' : ''}>
        <span>${escapeHtml(tag)}</span>
      </label>
    `)
    .join('');
  const options = `${optionRows}<div class="selected-tag-options-empty" data-selected-chart-tag-options-empty>${optionRows ? 'Search to find tags.' : 'No available tags.'}</div>`;
  const tray = selectedTags.map((tag) => `
    <span class="selected-tag-chip selected-tag-chip-removable">
      ${escapeHtml(tag)}
      <button class="selected-tag-chip-remove" type="button" data-selected-chart-tag-remove="${escapeAttribute(tag)}" aria-label="Remove ${escapeAttribute(tag)}">x</button>
    </span>
  `).join('');
  const list = selectedTags.length
    ? `
      <div class="selected-tag-settings-summary">
        <details class="selected-tag-manage">
          <summary>Manage chart tags</summary>
          <div class="selected-tag-tray">${tray}</div>
        </details>
      </div>
    `
    : '<span class="muted-text">No chart tags selected.</span>';

  const optionsEl = els.settingsContent?.querySelector('#selectedChartTagOptions');
  const listEl = els.settingsContent?.querySelector('#selectedChartTagList');
  const statusEl = els.settingsContent?.querySelector('#selectedChartTagSettingsStatus');
  const addButton = els.settingsContent?.querySelector('#selectedChartTagAddSaveButton');
  if (optionsEl) optionsEl.innerHTML = options;
  if (listEl) listEl.innerHTML = list;
  if (statusEl) statusEl.textContent = `${selectedTags.length} selected. ${pendingTags.length} pending. Available current tags: ${availableTags.length}.`;
  if (addButton) {
    addButton.disabled = pendingTags.length === 0;
    addButton.textContent = pendingTags.length ? `Add ${pendingTags.length} selected and save` : 'Add selected and save';
  }
}

export function renderToolkit(els) {
  els.toolkitContent.innerHTML = [
    {
      marker: '01',
      title: 'Application Readiness',
      description: 'Run before submitting. Confirm job link is saved, add 2–3 relevant tags, and write one sentence on why this role fits your target.',
      items: ['Confirm job link or description is saved', 'Record 2–3 tags so the role is searchable later', 'Capture one sentence on why the role is a fit', 'Note salary range if visible']
    },
    {
      marker: '02',
      title: 'Company Research Frame',
      description: 'Use to fill Company Notes before applying or before a call. Focus on what the interviewer already knows you should know.',
      items: ['What does the company sell and who pays for it?', 'What product or market change is driving this hire?', 'What competitors or substitutes exist?', 'What part of your background is genuinely relevant here?']
    },
    {
      marker: '03',
      title: 'Recruiter Call Guide',
      description: 'Use during a recruiter screen. Ask these to learn what actually matters, not what the JD says.',
      items: ['Ask how success is measured in the first 90 days', 'Ask what stage usually eliminates candidates', 'Ask which team problems need solving now', 'Ask what distinguishes strong candidates from average ones']
    },
    {
      marker: '04',
      title: 'Interview Story Bank',
      description: 'Build before interviews. Map your strongest STAR stories to the competencies this role requires so you are not improvising.',
      items: ['List 5–7 specific situations you can describe in detail', 'Map each story to: impact, challenge, decision, collaboration', 'Identify which stories answer "tell me about a time..." questions', 'Prepare a short version (60s) and a long version (2–3 min) of each']
    },
    {
      marker: '05',
      title: 'Follow-up Playbook',
      description: 'Use after every call or interview. Sets the rule for when to follow up, what to say, and when to stop.',
      items: ['Send a thank-you within 24 hours — specific, not generic', 'If no response after 5 days, one follow-up only', 'After 2 follow-ups with no response, mark as ghosted and move on', 'Keep follow-ups under 4 sentences']
    },
    {
      marker: '06',
      title: 'Offer Evaluation',
      description: 'Run when an offer arrives. Evaluate the full package before negotiating or accepting.',
      items: ['Base salary vs. your target and market rate', 'Equity: amount, vesting schedule, cliff, strike price', 'Role scope: team size, reporting line, what you own', 'Growth path: promotion criteria, budget for learning', 'Team signals: who you would work with daily']
    },
    {
      marker: '07',
      title: 'Interview Day Checklist',
      description: 'Run the morning of. Covers logistics, mindset, and the questions you will ask the panel.',
      items: ['Confirm time zone, link or location, and interviewer names', 'Re-read your STAR stories and the job description once', 'Prepare 3 questions for the panel — at least one specific to their work', 'Know your ask: next steps, timeline, decision criteria']
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
    todos,
    process_steps: processSteps = []
  } = payload;

  const activeTab = viewState.activeTab && viewState.activeTab !== 'overview' ? viewState.activeTab : 'workflow';
  const primaryCv = cvs[0] || null;
  const latestDocuments = summarizeLatestDocuments(documents);
  const queuedJobs = jobs.filter((item) => item.status !== 'completed' && item.status !== 'failed');
  const failedJobs = jobs.filter((item) => item.status === 'failed');

  const tabBodies = {
    workflow: renderWorkflowTab({ application, preparation, recruiterQuestions, feedbackEntries, todos }),
    'hiring-process': renderHiringProcessTab({ application, processSteps }),
    content: renderContentSummaryTab({ application, primaryCv, queuedJobs, failedJobs, allDocuments: documents, allJobs: jobs, selectedProvider: viewState.selectedProvider, capabilities: viewState.capabilities, workspace: viewState.contentWorkspace }),
    history: renderHistoryTab({ application, history, notes, activity, statusLabels })
  };

  const closed = !application.archived_at && isClosedStatus(application.status);
  const locationLine = application.location || 'Not set';
  const peopleLine = [application.recruiter, application.contact_person].filter(Boolean).join(' • ') || 'Not set';
  const nextProcessStep = nextScheduledProcessStep(processSteps);
  const nextStep = nextProcessStep?.step_name || application.next_action || recommendedNextAction(application);
  const nextStepDate = nextProcessStep?.event_date || application.next_action_due_date;
  const nextStepLine = [nextStep, formatDate(nextStepDate)].filter(Boolean).join(' • ');
  const displayDate = nextProcessStep?.event_date || application.interview_date;

  els.workspaceRoot.innerHTML = `
    <section class="workspace-view workspace-view-application${closed ? ' is-closed' : ''}" data-workspace-view="application">
    <div id="applicationPageContent" class="route-page-shell">
      <section class="application-hero-card application-hero-compact">
        <div class="hero-main-row">
          <div class="hero-copy-group">
            <div class="hero-badge-row">
              <span class="state ${application.archived_at ? 'archived-state' : closed ? 'closed-state' : 'active-state'}">${application.archived_at ? 'Archived' : statusLabels[application.status] || application.status}</span>
              ${closed ? '<span class="state closed-state">Closed</span>' : ''}
              ${displayDate && !closed ? `<span class="days-badge">${escapeHtml(formatDate(displayDate))}</span>` : ''}
            </div>
            <h1>${escapeHtml(application.role_title || 'Application Detail')}</h1>
            <p class="hero-company-line">
              ${escapeHtml(application.company_name)}
              ${application.company_category ? `<span class="state" style="margin-left: 8px; font-size: 0.85em; opacity: 0.9">${escapeHtml(application.company_category)}</span>` : ''}
            </p>
            <p class="hero-support-line">${escapeHtml(locationLine)}</p>
            ${renderTags(tags)}
          </div>
          <div class="page-header-actions application-hero-actions">
            <div class="hero-action-row">
              <a class="back-link hero-back-link" href="${state.view === 'list' ? '/' : `/?view=${state.view}`}"><i class="bi bi-arrow-left"></i> Back</a>
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
          ${renderInlineMeta('Next Step', nextStepLine, !nextProcessStep && !application.next_action && !application.next_action_due_date)}
        </div>
      </section>
      <nav class="detail-tabbar" aria-label="Application sections">
        ${renderDetailTab(application.id, 'workflow', 'Workflow', activeTab, 'signpost-split')}
        ${renderDetailTab(application.id, 'hiring-process', 'Hiring Process', activeTab, 'diagram-3')}
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

function nextScheduledProcessStep(processSteps = []) {
  return [...processSteps]
    .filter((step) => step.step_state === 'scheduled' && step.tracking_state === 'open')
    .sort((left, right) => {
      const dateComparison = String(left.event_date || '').localeCompare(String(right.event_date || ''));
      if (dateComparison) return dateComparison;
      return Number(left.position || 0) - Number(right.position || 0) || Number(left.id || 0) - Number(right.id || 0);
    })[0] || null;
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

function renderResearchPreviewRow(label, value) {
  return `<div class="research-row">
    <span class="research-row-label">${escapeHtml(label)}</span>
    <span class="research-row-value${value ? '' : ' muted-text'}">${value ? escapeHtml(value.length > 80 ? value.slice(0, 80) + '…' : value) : 'Not set'}</span>
  </div>`;
}

function renderWorkflowTab({ application, preparation, recruiterQuestions, feedbackEntries, todos }) {
  return `
    <div class="tab-grid workflow-grid">
      <section class="route-card route-card-soft research-surface">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Research</div>
            <h3>Company Notes</h3>
          </div>
          <button type="button" class="secondary icon-button" data-research-edit-all="${application.id}"
            data-about="${escapeAttribute(preparation?.about_company || '')}"
            data-values="${escapeAttribute(preparation?.company_values || '')}"
            data-notes="${escapeAttribute(preparation?.application_notes || '')}"
            title="Edit notes"><i class="bi bi-pencil"></i></button>
        </div>
        <div class="research-rows">
          ${renderResearchPreviewRow('About', preparation?.about_company || '')}
          ${renderResearchPreviewRow('Values', preparation?.company_values || '')}
          ${renderResearchPreviewRow('Notes', preparation?.application_notes || '')}
        </div>
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

const processStepGroups = [
  ['screening', 'Screening Call'],
  ['assessment', 'Assessment'],
  ['interview', 'Interview'],
  ['discussion', 'Discussion'],
  ['other', 'Other']
];

const processStepStates = [
  ['scheduled', 'Scheduled'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled']
];

const processResponseStates = [
  ['not_applicable', 'Not Applicable'],
  ['awaiting_response', 'Awaiting Response'],
  ['advanced', 'Advanced'],
  ['not_advanced', 'Not Advanced'],
  ['on_hold', 'On Hold'],
  ['no_response', 'No Response'],
  ['other', 'Other']
];

const processClosureReasons = [
  ['advanced', 'Advanced'],
  ['not_advanced', 'Not Advanced'],
  ['no_response', 'No Response'],
  ['cancelled', 'Cancelled'],
  ['withdrew', 'Withdrew'],
  ['other', 'Other']
];

function renderHiringProcessTab({ application, processSteps }) {
  const openCount = processSteps.filter((step) => step.tracking_state === 'open').length;
  const completedCount = processSteps.filter((step) => step.step_state === 'completed').length;
  const waitingCount = processSteps.filter((step) => step.response_state === 'awaiting_response').length;
  const hasLegacyStep = processSteps.some((step) => step.source === 'legacy_interview_date');
  return `
    <div class="tab-grid hiring-process-grid">
      <section class="route-card process-list-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Hiring Process</div>
            <h3>Steps</h3>
          </div>
          <div class="toolbar-pills">
            <span class="pill subtle">${processSteps.length} total</span>
            <span class="pill info-pill">${openCount} open</span>
            <span class="pill success-pill">${completedCount} completed</span>
            <span class="pill warning-pill">${waitingCount} awaiting response</span>
            <button type="button" data-process-add="${application.id}">Add Step</button>
          </div>
        </div>
        <div class="process-step-list">
          ${processSteps.map((step, index) => renderProcessStepCard(step, index, processSteps.length, hasLegacyStep)).join('') || renderInlineEmpty('No process steps yet', 'Add screening calls, assessments, interviews, or discussions in the order they happen.')}
        </div>
      </section>
    </div>
  `;
}

function renderProcessStepCard(step, index, total, hasLegacyStep = false) {
  const isLegacy = step.source === 'legacy_interview_date';
  const responseText = step.step_state === 'scheduled' ? 'Pending' : formatAction(step.response_state);
  const feedbackText = step.feedback_received === true ? 'Feedback received' : step.feedback_received === false ? 'No feedback' : '';
  const followUpText = step.follow_up_due_date ? `Follow up ${formatDate(step.follow_up_due_date)}` : '';
  return `
    <article class="process-step-card ${step.tracking_state === 'closed' ? 'is-closed' : ''}" data-process-step-id="${step.id}">
      <div class="process-step-header">
        <div class="process-step-main">
          <span class="process-position">#${Number(step.position || index + 1)}</span>
          <div>
            <strong>${escapeHtml(step.step_name)}</strong>
            <div class="item-meta">
              <span>${escapeHtml(formatAction(step.step_group))}</span>
              <span>${escapeHtml(formatDate(step.event_date))}</span>
              <span>${escapeHtml(formatAction(step.step_state))}</span>
              <span>${escapeHtml(responseText)}</span>
              ${feedbackText ? `<span>${escapeHtml(feedbackText)}</span>` : ''}
              ${followUpText ? `<span>${escapeHtml(followUpText)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="row-actions compact-actions">
          <button class="icon-button text-muted" type="button" data-process-move="${step.id}" data-direction="up" ${index === 0 || hasLegacyStep ? 'disabled' : ''} title="Move up"><i class="bi bi-arrow-up"></i></button>
          <button class="icon-button text-muted" type="button" data-process-move="${step.id}" data-direction="down" ${index === total - 1 || hasLegacyStep ? 'disabled' : ''} title="Move down"><i class="bi bi-arrow-down"></i></button>
          <button class="secondary" type="button" data-process-edit="${step.id}">${isLegacy ? 'Edit as Step' : 'Edit'}</button>
          ${!isLegacy && step.tracking_state === 'open'
            ? `<button class="secondary" type="button" data-process-close="${step.id}">Close No Response</button>`
            : !isLegacy ? `<button class="secondary" type="button" data-process-reopen="${step.id}">Reopen</button>` : '<span class="pill subtle">From interview date</span>'}
          ${!isLegacy ? `<button class="secondary" type="button" data-process-delete="${step.id}">Delete</button>` : ''}
        </div>
      </div>
      ${step.notes ? `<p class="process-step-note">${escapeHtml(step.notes)}</p>` : ''}
      ${isLegacy ? '<p class="muted-text">This came from the old interview date. Edit it to turn it into a normal process step.</p>' : ''}
    </article>
  `;
}

function renderSelectOptions(options, selectedValue) {
  return options.map(([value, label]) => `<option value="${escapeAttribute(value)}"${value === selectedValue ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('');
}

function renderContentSummaryTab({ application, primaryCv, queuedJobs, failedJobs, allDocuments, allJobs, selectedProvider, capabilities, workspace }) {
  const primaryCvId = primaryCv?.id || '';
  const isClosed = isClosedStatus(application.status) && !application.archived_at;
  const allSlots = buildDocumentSlots(allDocuments, allJobs);
  const documentSlots = filterDocumentSlots(allSlots, workspace);
  const recentDocumentId = Number(workspace.recentDocumentId) || null;
  const missingSlots = documentSlots.filter((slot) => slot.status === 'missing' || slot.status === 'failed');
  return `
    <div class="tab-grid content-summary-grid">
      <section class="route-card content-workspace-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Content Workspace</div>
            <h3>Generated Documents</h3>
          </div>
          <div class="content-toolbar-meta">
            ${!isClosed ? renderSegmentedProviderControl({
              selectedProvider: selectedProvider || 'gemini',
              awsEnabled: capabilities?.awsEnabled,
              attrName: 'data-library-provider-select'
            }) : ''}
            ${!isClosed && missingSlots.length ? `<button class="secondary" type="button" data-generate-missing data-cv-id="${escapeAttribute(primaryCvId || '')}">Generate Missing (${missingSlots.length})</button>` : ''}
            ${allDocuments.length ? `<a class="button-link secondary" href="/api/applications/${application.id}/artifacts.zip">Export Artifacts</a>` : ''}
          </div>
        </div>
        ${recentDocumentId ? '<div class="document-card-meta"><span class="pill info-pill">Recent update available in the list below.</span></div>' : ''}
        <div class="content-slot-grid">
          ${documentSlots.map((slot) => renderContentDocumentSlot(application.id, slot, primaryCvId, recentDocumentId, isClosed)).join('') || (allDocuments.length || allJobs.length
            ? renderInlineEmpty('No documents match these filters', 'Clear or relax the active filters to see more generated content.')
            : renderInlineEmpty('No generated content yet', isClosed ? 'This application is closed — view-only.' : 'Generate a document from the workspace above to create your first saved asset.'))}
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
      ${allDocuments.length > 0 ? `<section class="route-card">
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
      </section>` : ''}
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
  const processActivity = activity.filter((item) => String(item.action || '').startsWith('process_step_'));
  const generalActivity = activity.filter((item) => !String(item.action || '').startsWith('process_step_'));
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
          ${renderTimeline(generalActivity)}
        </div>
      </section>
      <section class="route-card">
        <div class="section-heading">
          <div>
            <div class="panel-kicker">Hiring Process</div>
            <h3>Process Activity</h3>
          </div>
        </div>
        <div class="history-list history-timeline">
          ${renderTimeline(processActivity)}
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

function renderContentDocumentSlot(applicationId, slot, cvId, recentDocumentId = null, isClosed = false) {
  const isRecent = slot.latestDocument && Number(slot.latestDocument.id) === Number(recentDocumentId);
  const hasDoc = slot.status === 'ready' || slot.status === 'updating';
  const meta = slot.latestDocument
    ? `${formatDateTime(slot.latestDocument.created_at)}${slot.documents.length > 1 ? ` · ${slot.documents.length} versions` : ''}`
    : slot.activeJob ? `Started ${formatDateTime(slot.activeJob.created_at)}` : '';

  let action = '';
  if (hasDoc) {
    action = `<a class="button-link secondary" href="/applications/${applicationId}?tab=content&document=${slot.latestDocument.id}">Open</a>`;
  } else if (!isClosed) {
    if (slot.status === 'generating') {
      action = `<button type="button" disabled>Generating…</button>`;
    } else if (slot.status === 'failed') {
      action = `<button type="button" class="secondary" data-ai="${escapeAttribute(slot.action)}" data-doc-type="${escapeAttribute(slot.type)}" data-cv-id="${escapeAttribute(cvId)}">Retry</button>`;
    } else {
      action = `<button type="button" class="secondary" data-ai="${escapeAttribute(slot.action)}" data-doc-type="${escapeAttribute(slot.type)}" data-cv-id="${escapeAttribute(cvId)}">Generate</button>`;
    }
  }

  return `
    <article class="content-slot-item content-slot-${slot.status}${isRecent ? ' is-recent' : ''}">
      <div class="content-slot-head">
        <span class="document-type-icon" aria-hidden="true">${renderDocumentTypeIcon(slot.type)}</span>
        <strong class="content-slot-title">${escapeHtml(slot.title)}</strong>
        ${renderSlotStatusBadge(slot)}
      </div>
      ${meta ? `<p class="content-slot-meta muted-text">${escapeHtml(meta)}</p>` : (!hasDoc && !isClosed ? '' : '<p class="content-slot-meta muted-text">—</p>')}
      ${action ? `<div class="content-slot-actions">${action}</div>` : ''}
    </article>
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
  return '';
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
    if (type === 'process_step') return { css: 'badge-proc', label: 'HP' };
    if (type === 'process_follow_up') return { css: 'badge-act', label: 'FUP' };
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
    } else if ((event.type === 'next_action' || event.type === 'process_step' || event.type === 'process_follow_up') && event.details) {
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
                  ${(() => {
                    if (cell.events.length > 1) {
                      const grouped = {};
                      cell.events.forEach((event) => {
                        const badge = getBadgeDetails(event.type);
                        if (!grouped[badge.css]) grouped[badge.css] = { badge, events: [] };
                        grouped[badge.css].events.push(event);
                      });
                      return Object.values(grouped).map((group) => `
                        <div class="calendar-event-group">
                          <article class="calendar-event ${group.badge.css} summary-pill" data-calendar-expand="true" style="cursor: pointer; justify-content: center; font-weight: 600;">
                            ${group.badge.label} - ${group.events.length}
                          </article>
                          <div class="calendar-event-list" hidden>
                            ${group.events.map((event) => `
                              <article class="calendar-event ${group.badge.css}" title="${escapeAttribute(getTimelineLabel(event))}" data-calendar-detail="${event.id}" style="margin-top: 4px;">
                                ${escapeHtml(getTimelineLabel(event))}
                              </article>
                            `).join('')}
                          </div>
                        </div>
                      `).join('');
                    }
                    return cell.events.map((event) => {
                      const badge = getBadgeDetails(event.type);
                      return `
                      <article class="calendar-event ${badge.css}" title="${escapeAttribute(getTimelineLabel(event))}" data-calendar-detail="${event.id}">
                        ${escapeHtml(getTimelineLabel(event))}
                      </article>
                      `;
                    }).join('');
                  })()}
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
          <span class="badge badge-proc">HP</span> Hiring
        </div>
        <div class="legend-item">
          <span class="badge badge-act">ACT</span> Action
        </div>
        <div class="legend-item">
          <span class="badge badge-cls">CLS</span> Closed
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

export function renderApplicationPagination(els, state) {
  if (!els.applicationPagination) return;
  const totalFromState = Number(state.applicationTotal);
  const total = Number.isFinite(totalFromState) ? totalFromState : 0;
  const pageSize = Number.isInteger(state.applicationPageSize) && state.applicationPageSize > 0
    ? state.applicationPageSize
    : 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, state.filters.page || 1), totalPages);
  if (totalPages <= 1) {
    els.applicationPagination.innerHTML = '';
    return;
  }
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  els.applicationPagination.innerHTML = `
    <span>${start}–${end} of ${total}</span>
    <button class="secondary" type="button" data-app-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Prev</button>
    <button class="secondary" type="button" data-app-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next</button>
  `;
}
