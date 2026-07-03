import { createReadStream } from 'node:fs';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { createAWSClients } from '../services/awsClients.js';

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
    this.aiJobsDir = join(this.baseDir, 'ai-jobs');
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

    const relativePath = join(config.uploadDir, 'cv', storedName).replace(/\\/g, '/');
    const metadata = {
      relativePath: join(config.uploadDir, 'cv', storedName).replace(/\\/g, '/'),
      originalName,
      mimeType: normalizeMimeType(file),
      fileSize: file.size,
      fileHash: createHash('sha256').update(file.buffer).digest('hex'),
      storageKind: 'local',
      s3Bucket: null,
      s3Key: null
    };

    await this.mirrorToS3({
      relativePath,
      body: file.buffer,
      contentType: metadata.mimeType,
      metadata
    });

    return metadata;
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
    const relativePath = join(config.uploadDir, 'ai', storedName).replace(/\\/g, '/');
    const metadata = {
      relativePath,
      storageKind: 'local',
      s3Bucket: null,
      s3Key: null
    };
    await this.mirrorToS3({
      relativePath,
      body: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      metadata
    });
    return metadata;
  }

  async saveJobManifest(manifest, filenameBase, subdir = 'requests') {
    await mkdir(join(this.aiJobsDir, subdir), { recursive: true });
    const safeBaseName = String(filenameBase || 'job')
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'job';
    const storedName = `${Date.now()}-${randomUUID()}-${safeBaseName}.json`;
    const absolutePath = join(this.aiJobsDir, subdir, storedName);
    const body = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    await writeFile(absolutePath, body, { flag: 'wx' });
    const relativePath = join(config.uploadDir, 'ai-jobs', subdir, storedName).replace(/\\/g, '/');
    const metadata = {
      relativePath,
      storageKind: 'local',
      s3Bucket: null,
      s3Key: null
    };
    await this.mirrorToS3({
      relativePath,
      body,
      contentType: 'application/json',
      metadata,
      force: true
    });
    return metadata;
  }

  async readText(relativePath) {
    const absolutePath = this.resolveSafe(relativePath);
    return readFile(absolutePath, 'utf8');
  }

  async remove(relativePath) {
    const absolutePath = this.resolveSafe(relativePath);
    await unlink(absolutePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  resolveSafe(relativePath) {
    const absolutePath = resolve(process.cwd(), relativePath);
    const allowedRoots = [this.baseDir, resolve(process.cwd(), 'sample-data')];
    const isAllowed = allowedRoots.some((root) =>
      absolutePath === root || absolutePath.startsWith(`${root}/`) || absolutePath.startsWith(`${root}\\`)
    );
    if (!isAllowed) {
      const error = new Error('Invalid file path');
      error.statusCode = 400;
      throw error;
    }
    return absolutePath;
  }

  async mirrorToS3({ relativePath, body, contentType, metadata, force = false }) {
    if (!force && config.fileStorageMode !== 'dual') return metadata;
    if (!config.awsS3Bucket) {
      if (config.awsStorageRequired) {
        const error = new Error('FILE_STORAGE_MODE is dual but AWS_S3_BUCKET is not configured.');
        error.statusCode = 500;
        throw error;
      }
      return metadata;
    }

    try {
      const { s3, PutObjectCommand } = await createAWSClients();
      const objectKey = buildS3Key(relativePath);
      await s3.send(new PutObjectCommand({
        Bucket: config.awsS3Bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType
      }));
      metadata.storageKind = 'dual';
      metadata.s3Bucket = config.awsS3Bucket;
      metadata.s3Key = objectKey;
      return metadata;
    } catch (error) {
      if (config.awsStorageRequired) throw error;
      console.error('S3 mirror failed. Continuing with local storage only.');
      console.error(error);
      return metadata;
    }
  }
}

function buildS3Key(relativePath) {
  const prefix = String(config.awsS3Prefix || '').replace(/^\/+|\/+$/g, '');
  const normalizedPath = String(relativePath || '').replace(/^\/+/, '').replace(/\\/g, '/');
  return prefix ? `${prefix}/${normalizedPath}` : normalizedPath;
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
