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

export function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'x-content-type-options': 'nosniff'
  });
  res.end(payload);
}

export function sendError(res, statusCode, message, details) {
  sendJson(res, statusCode, { error: message, details });
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
      'content-type': contentType,
      'content-length': fileStat.size,
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store'
    });
    createReadStream(absolutePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}
