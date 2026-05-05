export const statuses = new Set([
  'applied',
  'interview_scheduled',
  'accepted',
  'rejected',
  'withdrawn',
  'offer',
  'ghosted'
]);

export function cleanString(value) {
  if (value === undefined || value === null) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

export function parseDate(value, fieldName) {
  const cleaned = cleanDateString(value);
  if (!cleaned) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned) || Number.isNaN(Date.parse(`${cleaned}T00:00:00Z`))) {
    const error = new Error(`${fieldName} must be a YYYY-MM-DD date`);
    error.statusCode = 400;
    throw error;
  }
  return cleaned;
}

function cleanDateString(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return cleanString(value);
}

export function validateStatus(value) {
  const status = cleanString(value) || 'applied';
  if (!statuses.has(status)) {
    const error = new Error(`Invalid status: ${status}`);
    error.statusCode = 400;
    throw error;
  }
  return status;
}

export function validateUrl(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  try {
    const url = new URL(cleaned);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
    return url.toString();
  } catch {
    const error = new Error('Job link must be a valid HTTP or HTTPS URL');
    error.statusCode = 400;
    throw error;
  }
}

export function parseTags(value) {
  if (!value) return [];
  const source = Array.isArray(value) ? value.join(',') : String(value);
  return [...new Set(source.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
}

export function parseInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    const error = new Error(`${fieldName} must be a non-negative integer`);
    error.statusCode = 400;
    throw error;
  }
  return parsed;
}

export function parseBoolean(value, fieldName) {
  if (typeof value === 'boolean') return value;
  const cleaned = cleanString(value);
  if (cleaned === null) return null;
  if (cleaned === 'true') return true;
  if (cleaned === 'false') return false;
  const error = new Error(`${fieldName} must be true or false`);
  error.statusCode = 400;
  throw error;
}

export function validateFeedbackSource(value) {
  const cleaned = cleanString(value) || 'self_note';
  const allowed = new Set(['recruiter', 'interviewer', 'hiring_manager', 'self_note']);
  if (!allowed.has(cleaned)) {
    const error = new Error(`Invalid feedback source: ${cleaned}`);
    error.statusCode = 400;
    throw error;
  }
  return cleaned;
}
