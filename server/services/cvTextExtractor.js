import { extname } from 'node:path';
import { createRequire } from 'node:module';
import JSZip from 'jszip';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

export async function extractCVText(file) {
  const extension = extname(file.filename).toLowerCase();

  if (extension === '.docx') {
    return extractDocxText(file.buffer);
  }

  if (extension === '.pdf') {
    return extractPdfText(file.buffer);
  }

  return '';
}

async function extractPdfText(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    return normalizeText(parsed.text || '');
  } catch {
    return '';
  } finally {
    await parser?.destroy?.();
  }
}

async function extractDocxText(buffer) {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) return '';

    const text = documentXml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");

    return normalizeText(text);
  } catch {
    return '';
  }
}

function normalizeText(value) {
  return String(value)
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 80_000);
}
