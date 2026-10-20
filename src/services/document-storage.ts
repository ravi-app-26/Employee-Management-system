import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmod, mkdir, unlink } from 'node:fs/promises';
import { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import path from 'node:path';
import { env } from '../config/env';
import { BadRequestError, NotFoundError } from '../errors/app-error';

const allowedTypes: Record<string, { extensions: string[]; signature: (file: Buffer) => boolean }> = {
  'application/pdf': { extensions: ['.pdf'], signature: (file) => file.subarray(0, 5).toString() === '%PDF-' },
  'image/png': { extensions: ['.png'], signature: (file) => file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/jpeg': { extensions: ['.jpg', '.jpeg'], signature: (file) => file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff },
};

export class LocalDocumentStorage {
  static readonly upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        const directory = path.resolve(env.UPLOAD_DIR);
        void mkdir(directory, { recursive: true, mode: 0o700 }).then(
          async () => {
            await chmod(directory, 0o700);
            callback(null, directory);
          },
          (error: Error) => callback(error, directory),
        );
      },
      filename: (_req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(null, `${randomUUID()}${extension}`);
      },
    }),
    limits: { fileSize: env.MAX_DOCUMENT_SIZE_BYTES, files: 1 },
    fileFilter: (_req, file, callback) => {
      const type = allowedTypes[file.mimetype];
      const extension = path.extname(file.originalname).toLowerCase();
      if (!type || !type.extensions.includes(extension)) {
        callback(new BadRequestError('Only matching PDF, PNG, and JPEG files are allowed'));
        return;
      }
      callback(null, true);
    },
  });

  static securePermissions: RequestHandler = (req, _res, next) => {
    if (!req.file) return next();
    void chmod(req.file.path, 0o600).then(() => next(), async (error: Error) => {
      await unlink(req.file!.path).catch(() => undefined);
      next(error);
    });
  };

  static filePath(key: string): string {
    if (path.basename(key) !== key) throw new NotFoundError('Document not found');
    return path.join(path.resolve(env.UPLOAD_DIR), key);
  }

  static validateContent(mimeType: string, file: Buffer): void {
    const type = allowedTypes[mimeType];
    if (!type || !type.signature(file)) {
      throw new BadRequestError('File content does not match its declared type');
    }
  }

  static createDownloadToken(documentId: string): string {
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const signature = this.sign(`${documentId}.${expiresAt}`);
    return `${expiresAt}.${signature}`;
  }

  static verifyDownloadToken(documentId: string, token: string): boolean {
    const [expires, signature, ...extra] = token.split('.');
    if (extra.length || !/^\d+$/.test(expires ?? '') || !signature) return false;
    const expiresAt = Number(expires);
    if (expiresAt <= Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.sign(`${documentId}.${expiresAt}`));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  static downloadUrl(documentId: string): string {
    const token = this.createDownloadToken(documentId);
    return `${env.PUBLIC_API_BASE_URL}/api/v1/documents/${documentId}/download?token=${encodeURIComponent(token)}`;
  }

  private static sign(value: string): string {
    return createHmac('sha256', env.JWT_ACCESS_SECRET).update(value).digest('base64url');
  }
}

export { MulterError };
