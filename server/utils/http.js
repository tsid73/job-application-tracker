import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const textTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon']
]);

export const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net data:; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY'
};

export function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    ...securityHeaders,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

export function sendError(res, statusCode, message, details) {
  sendJson(res, statusCode, { error: message, details });
}

export function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    ...securityHeaders,
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(html),
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'cache-control': 'no-store'
  });
  res.end(html);
}

export function sendHtmlError(res, statusCode, title, message, hint = '') {
  sendHtml(
    res,
    statusCode,
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow, noarchive">
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3efe6;
        --panel: rgba(255,255,255,0.92);
        --text: #13212d;
        --muted: #61707c;
        --line: rgba(79,98,118,0.16);
        --accent: #164e67;
        --shadow: 0 24px 60px rgba(19,33,45,0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 20px;
        background: radial-gradient(circle at top left, rgba(255,255,255,0.66), transparent 30%), linear-gradient(180deg, #f7f3ea 0%, var(--bg) 38%, #ece5d5 100%);
        color: var(--text);
        font: 14px/1.5 "Aptos", "Segoe UI", sans-serif;
      }
      .card {
        width: min(720px, 100%);
        padding: 28px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }
      .kicker {
        display: inline-flex;
        margin-bottom: 10px;
        color: var(--accent);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 { margin: 0 0 10px; font-size: 28px; line-height: 1.05; }
      p { margin: 0; color: var(--muted); }
      p + p { margin-top: 12px; }
      a { color: var(--accent); font-weight: 700; }
      code {
        padding: 2px 6px;
        border-radius: 8px;
        background: rgba(22,78,103,0.08);
        color: var(--text);
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="kicker">Application Error</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${hint ? `<p>${escapeHtml(hint)}</p>` : ''}
      <p><a href="/">Return to the app</a></p>
    </main>
  </body>
</html>`
  );
}

export async function readBody(req, maxBytes) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const error = new Error('Request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function readJson(req, maxBytes) {
  const body = await readBody(req, maxBytes);
  if (!body.length) return {};

  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON body');
    error.statusCode = 400;
    throw error;
  }
}

export async function readMultipart(req, maxBytes) {
  const contentType = req.headers['content-type'] || '';
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) {
    const error = new Error('Missing multipart boundary');
    error.statusCode = 400;
    throw error;
  }

  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const body = await readBody(req, maxBytes);
  const parts = splitBuffer(body, boundary).slice(1, -1);
  const fields = {};
  const files = {};

  for (const rawPart of parts) {
    const part = stripMultipartCrlf(rawPart);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const rawHeaders = part.subarray(0, headerEnd).toString('utf8');
    const content = part.subarray(headerEnd + 4);
    const disposition = rawHeaders.match(/content-disposition:\s*form-data;([^\r\n]+)/i);
    if (!disposition) continue;

    const name = readDispositionValue(disposition[1], 'name');
    const filename = readDispositionValue(disposition[1], 'filename');
    const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';

    if (filename) {
      files[name] = { filename, mimeType, buffer: content, size: content.length };
    } else {
      fields[name] = content.toString('utf8');
    }
  }

  return { fields, files };
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  parts.push(buffer.subarray(start));
  return parts;
}

function stripMultipartCrlf(buffer) {
  let start = 0;
  let end = buffer.length;
  if (buffer[0] === 13 && buffer[1] === 10) start = 2;
  if (buffer[end - 2] === 13 && buffer[end - 1] === 10) end -= 2;
  return buffer.subarray(start, end);
}

function readDispositionValue(disposition, key) {
  const match = disposition.match(new RegExp(`${key}="([^"]*)"`, 'i'));
  return match?.[1] || '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function serveStatic(req, res, publicDir) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  const absolutePath = resolve(join(publicDir, safePath));

  if (!absolutePath.startsWith(resolve(publicDir))) {
    sendError(res, 403, 'Forbidden');
    return true;
  }

  try {
    const fileStat = statSync(absolutePath);
    if (!fileStat.isFile()) return false;

    const contentType = textTypes.get(extname(absolutePath)) || 'application/octet-stream';
    res.writeHead(200, {
      ...securityHeaders,
      'content-type': contentType,
      'content-length': fileStat.size,
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'cache-control': 'no-store'
    });
    createReadStream(absolutePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}
