import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { config } from '../config.js';

const allowedExtensions = new Set(['.pdf', '.docx']);
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
]);

export class LocalFileStorage {
  constructor(baseDir = config.uploadDir) {
    this.configUploadDir = config.uploadDir;
    this.baseDir = resolve(process.cwd(), baseDir);
    this.cvDir = join(this.baseDir, 'cv');
    this.aiDir = join(this.baseDir, 'ai');
  }

  async saveCV(file) {
    validateCVFile(file);
    await mkdir(this.cvDir, { recursive: true });

    const originalName = sanitizeOriginalName(file.filename);
    const extension = extname(originalName).toLowerCase();
    const safeBaseName = basename(originalName, extension)
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'cv';
    const storedName = `${Date.now()}-${randomUUID()}-${safeBaseName}${extension}`;
    const absolutePath = join(this.cvDir, storedName);
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });

    return {
      relativePath: join(config.uploadDir, 'cv', storedName).replace(/\\/g, '/'),
      originalName,
      mimeType: normalizeMimeType(file),
      fileSize: file.size,
      fileHash: createHash('sha256').update(file.buffer).digest('hex')
    };
  }

  open(relativePath) {
    const absolutePath = this.resolveSafe(relativePath);
    return createReadStream(absolutePath);
  }

  async saveGeneratedDocx(buffer, filenameBase) {
    await mkdir(this.aiDir, { recursive: true });
    const safeBaseName = String(filenameBase || 'document')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'document';
    const storedName = `${Date.now()}-${randomUUID()}-${safeBaseName}.docx`;
    const absolutePath = join(this.aiDir, storedName);
    await writeFile(absolutePath, buffer, { flag: 'wx' });
    return join(config.uploadDir, 'ai', storedName).replace(/\\/g, '/');
  }

  async remove(relativePath) {
    const absolutePath = this.resolveSafe(relativePath);
    await unlink(absolutePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  resolveSafe(relativePath) {
    const absolutePath = resolve(process.cwd(), relativePath);
    const allowedRoot = this.baseDir;
    if (absolutePath !== allowedRoot && !absolutePath.startsWith(`${allowedRoot}/`) && !absolutePath.startsWith(`${allowedRoot}\\`)) {
      const error = new Error('Invalid file path');
      error.statusCode = 400;
      throw error;
    }
    return absolutePath;
  }
}

function validateCVFile(file) {
  if (!file || !file.size) {
    const error = new Error('CV file is required');
    error.statusCode = 400;
    throw error;
  }

  if (file.size > config.maxUploadBytes) {
    const error = new Error('CV file is too large');
    error.statusCode = 413;
    throw error;
  }

  const originalName = sanitizeOriginalName(file.filename);
  const extension = extname(originalName).toLowerCase();
  if (!allowedExtensions.has(extension) || !allowedMimeTypes.has(file.mimeType)) {
    const error = new Error('CV must be a PDF or DOCX file');
    error.statusCode = 400;
    throw error;
  }

  const isPdf = extension === '.pdf' && file.buffer.subarray(0, 4).toString('utf8') === '%PDF';
  const isDocx = extension === '.docx' && file.buffer.subarray(0, 2).toString('utf8') === 'PK';
  if (!isPdf && !isDocx) {
    const error = new Error('CV file content does not match PDF or DOCX format');
    error.statusCode = 400;
    throw error;
  }
}

function normalizeMimeType(file) {
  const extension = extname(sanitizeOriginalName(file.filename)).toLowerCase();
  if (extension === '.pdf') return 'application/pdf';
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function sanitizeOriginalName(filename) {
  const cleaned = basename(String(filename || ''))
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned === '.' || cleaned === '..') {
    const error = new Error('Invalid CV filename');
    error.statusCode = 400;
    throw error;
  }

  return cleaned.slice(0, 160);
}
