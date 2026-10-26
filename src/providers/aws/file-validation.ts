import path from 'node:path';
import { BadRequestError } from '../../errors/app-error';

const allowedTypes: Record<string, { extensions: string[]; validatedExtension: string; signature: (file: Buffer) => boolean }> = {
  'application/pdf': {
    extensions: ['.pdf'],
    validatedExtension: 'pdf',
    signature: (file) => file.subarray(0, 5).toString() === '%PDF-',
  },
  'image/png': {
    extensions: ['.png'],
    validatedExtension: 'png',
    signature: (file) => file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    validatedExtension: 'jpg',
    signature: (file) => file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff,
  },
};

export function getValidatedExtension(originalName: string, mimeType: string): string {
  const type = allowedTypes[mimeType];
  const extension = path.extname(originalName).toLowerCase();
  if (!type || !type.extensions.includes(extension)) {
    throw new BadRequestError('Only matching PDF, PNG, and JPEG files are allowed');
  }
  return type.validatedExtension;
}

export function validateDocumentContent(mimeType: string, file: Buffer): string {
  const type = allowedTypes[mimeType];
  if (!type || !type.signature(file)) {
    throw new BadRequestError('File content does not match its declared type');
  }
  return type.validatedExtension;
}

export function sanitizeOriginalFilename(originalName: string): string {
  const filename = path.basename(originalName.replace(/\\/g, '/'))
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .trim();
  const truncated = Array.from(filename).slice(0, 255).join('');
  if (!truncated || truncated === '.' || truncated === '..') {
    throw new BadRequestError('A valid filename is required');
  }
  return truncated;
}

export function contentDispositionFilename(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}