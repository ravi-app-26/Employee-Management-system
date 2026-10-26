import multer from 'multer';
import { BadRequestError } from '../../errors/app-error';
import { env } from '../../config/env';
import { getValidatedExtension } from './file-validation';

export const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_DOCUMENT_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    try {
      getValidatedExtension(file.originalname, file.mimetype);
      callback(null, true);
    } catch (error) {
      callback(error instanceof Error ? error : new BadRequestError('Invalid document file'));
    }
  },
});

export { MulterError } from 'multer';