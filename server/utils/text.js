export function csvEscape(value) {
  const text = neutralizeSpreadsheetFormula(value === null || value === undefined ? '' : String(value));
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function neutralizeSpreadsheetFormula(text) {
  if (!text) return text;
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function truncateText(text, limit) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

export function normalizedForLog(value) {
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function dateForLog(value) {
  return normalizedForLog(value) || 'none';
}

export function changedApplicationFields(previous, next) {
  const fields = [
    ['company_name', 'company'],
    ['role_title', 'role'],
    ['job_link', 'job link'],
    ['job_description', 'job description'],
    ['salary', 'salary'],
    ['location', 'location'],
    ['recruiter', 'recruiter'],
    ['contact_person', 'contact person'],
    ['applied_date', 'applied date'],
    ['notes', 'notes']
  ];

  return fields
    .filter(([key]) => normalizedForLog(previous[key]) !== normalizedForLog(next[key]))
    .map(([, label]) => label);
}

export function buildPromptExcerpt(jobDescription, cv) {
  return truncateText([
    `Job description:\n${jobDescription || ''}`,
    '',
    `CV: ${cv.original_name}`,
    `CV excerpt:\n${truncateText(cv.extracted_text || '', 1200)}`
  ].join('\n'), 2000);
}

export function buildSourceContext(application, cv) {
  return truncateText([
    application?.id ? `application_id=${application.id}` : null,
    application?.company_name ? `company=${application.company_name}` : null,
    `cv_id=${cv.id}`,
    `cv_name=${cv.original_name}`
  ].filter(Boolean).join(', '), 500);
}

export function extractJobSignals(jobDescription) {
  const lines = splitMeaningfulLines(jobDescription);
  const normalized = truncateText(lines.join(' '), 2200);
  const responsibilities = lines.filter((line) => looksLikeBullet(line) || /(responsib|build|develop|design|lead|maintain|own|deliver|support|collaborate)/i.test(line)).slice(0, 8);
  const requirements = lines.filter((line) => /(require|must|should|experience|skill|qualif|proficient|familiar)/i.test(line)).slice(0, 8);
  const keywords = extractKeywords(normalized);
  return {
    summary: truncateText(normalized, 900),
    responsibilities,
    requirements,
    keywords: keywords.slice(0, 16)
  };
}

export function extractCandidateSignals(cvText) {
  const lines = splitMeaningfulLines(cvText);
  const experienceLines = lines.filter((line) => /\d+%|\d+\+|led|built|improved|reduced|scaled|designed|implemented|launched|delivered/i.test(line)).slice(0, 8);
  const technologyKeywords = extractKeywords(lines.join(' '));
  return {
    summary: truncateText(lines.join(' '), 900),
    evidence: experienceLines,
    technologies: technologyKeywords.slice(0, 16)
  };
}

function splitMeaningfulLines(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => line.length > 2);
}

function extractKeywords(text) {
  const matches = String(text || '').match(/[A-Za-z][A-Za-z0-9.+#/-]{2,}/g) || [];
  const seen = new Set();
  const keywords = [];
  for (const value of matches) {
    const normalized = value.toLowerCase();
    if (seen.has(normalized) || stopWords.has(normalized)) continue;
    seen.add(normalized);
    keywords.push(value);
  }
  return keywords;
}

function looksLikeBullet(line) {
  return /^[-*•]/.test(line);
}

const stopWords = new Set([
  'with', 'from', 'that', 'this', 'their', 'have', 'will', 'your', 'about', 'role',
  'team', 'work', 'years', 'year', 'using', 'build', 'develop', 'support', 'strong',
  'experience', 'required', 'preferred', 'skills', 'skill', 'job', 'description'
]);

export function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
