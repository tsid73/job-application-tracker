export async function api(path, options = {}) {
  const response = await fetch(path, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.error || `Request failed with HTTP ${response.status}`);
  return payload;
}

export function renderTags(tags = []) {
  if (!tags.length) return '';
  return `<div class="tag-list">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`;
}

export function daysClass(value) {
  if (value === null || value === undefined || value === '') return 'days-badge';
  const days = Number(value);
  if (days < 0) return 'days-badge overdue';
  if (days <= 1) return 'days-badge urgent';
  if (days <= 3) return 'days-badge warning';
  if (days <= 7) return 'days-badge soon';
  return 'days-badge';
}

export function renderDays(value) {
  const text = formatDays(value);
  if (!text) return '<span class="muted-text">No interview</span>';
  return `<span class="${daysClass(value)}">${text}</span>`;
}

export function renderInterviewControl(application) {
  if (application.status !== 'interview_scheduled') {
    return '<span class="muted-text">Not scheduled</span>';
  }
  return renderDateInput(application);
}

export function renderDateInput(application) {
  return `<input data-field="interview_date" type="date" value="${application.interview_date || ''}" aria-label="Interview date for ${escapeHtml(application.company_name)}">`;
}

export function formatDays(value) {
  if (value === null || value === undefined) return '';
  const days = Number(value);
  if (days === 0) return 'Today';
  if (days < 0) return `${Math.abs(days)} overdue`;
  return `${days} days`;
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function reportRow(label, value, max) {
  const percent = max ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return `
    <div class="report-row">
      <span>${escapeHtml(label)}</span>
      <div class="report-bar"><i style="width:${percent}%"></i></div>
      <strong>${value}</strong>
    </div>
  `;
}

export function maxCount(rows) {
  return Math.max(1, ...rows.map((row) => Number(row.count || 0)));
}

export function formatMonthLabel(value) {
  if (!value) return '';
  const date = new Date(`${value}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export function activityApplicationName(item) {
  if (item.company_name) return item.company_name;
  const match = String(item.details || '').match(/for (.+)$/);
  if (match) return match[1];
  return item.application_id ? `Application ${item.application_id}` : 'Unknown application';
}

export function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMonthTitle(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatAction(action) {
  return String(action || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function setError(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

export function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

export function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
