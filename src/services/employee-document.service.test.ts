import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { AuditLog, Employee, EmployeeDocument, EmployeeDocumentStorage } from '../entities';
import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError } from '../errors/app-error';
import { EmployeeDocumentService } from './employee-document.service';
import { documentUpload, S3DocumentStorage, sha256 } from '../providers/aws';
import type { DocumentObjectStorage, StoredObject } from '../interfaces';

const employeeId = '5a92a7c2-61ac-4e03-8494-5eb119cd57f1';
const actorId = 'd9428888-122b-4b20-9e2a-63e4c4a99b7e';
const documentId = 'c1d6d2a7-cc58-4168-b53e-1e44254c2e90';
const pdf = Buffer.from('%PDF-1.7 test body');
const actor = { id: actorId, role: 'employee', employeeId };
const employee = { id: employeeId, managerId: null } as Employee;
const activeDocument = {
  id: documentId,
  employeeId,
  originalName: 'evidence.pdf',
  mimeType: 'application/pdf',
  sizeBytes: pdf.length,
  objectKey: 'uploads/server-generated.pdf',
  uploadedBy: actorId,
  createdAt: new Date('2026-10-19T00:00:00.000Z'),
  deletedAt: null,
} as EmployeeDocument;

function createHarness(options: {
  databaseFailure?: boolean;
  auditFailure?: boolean;
  uploadFailure?: boolean;
  existingTracking?: EmployeeDocumentStorage;
  documents?: EmployeeDocument[];
  objects?: StoredObject[];
  s3ObjectExists?: boolean;
} = {}) {
  const trackingRows = options.existingTracking ? [options.existingTracking] : [];
  const existingObjects = new Set<string>(options.s3ObjectExists && options.existingTracking
    ? [options.existingTracking.s3ObjectKey]
    : []);
  const storage: jest.Mocked<DocumentObjectStorage> = {
    put: jest.fn<DocumentObjectStorage['put']>().mockImplementation(async (key) => {
      if (options.uploadFailure) throw new ServiceUnavailableError('storage unavailable');
      existingObjects.add(key);
    }),
    exists: jest.fn<DocumentObjectStorage['exists']>().mockImplementation(async (key) => existingObjects.has(key)),
    presignDownload: jest.fn<DocumentObjectStorage['presignDownload']>()
      .mockResolvedValue('https://s3.example.test/signed-download'),
    delete: jest.fn<DocumentObjectStorage['delete']>().mockResolvedValue(undefined),
    list: jest.fn<DocumentObjectStorage['list']>().mockResolvedValue(options.objects ?? []),
  };
  const saved: Array<{ entity: unknown; value: Record<string, unknown> }> = [];
  const manager = {
    create: (_entity: unknown, value: Record<string, unknown>) => value,
    save: jest.fn(async (entity: unknown, value: Record<string, unknown>) => {
      if (options.databaseFailure && entity === EmployeeDocument) throw new Error('database unavailable');
      if (options.auditFailure && entity === AuditLog) throw new Error('database unavailable');
      saved.push({ entity, value });
      if (entity === EmployeeDocument) {
        return { ...value, id: documentId, createdAt: activeDocument.createdAt, deletedAt: null };
      }
      if (entity === EmployeeDocumentStorage) {
        const row = value as unknown as EmployeeDocumentStorage;
        const index = trackingRows.findIndex((existing) => existing.employeeId === row.employeeId
          && existing.sha256Hash === row.sha256Hash);
        if (index === -1) trackingRows.push(row);
        else trackingRows[index] = row;
      }
      return value;
    }),
    query: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue(undefined),
    findOne: jest.fn(async (_entity: unknown, options: { where: { employeeId: string; sha256Hash: string } }) => (
      trackingRows.find((row) => row.employeeId === options.where.employeeId
        && row.sha256Hash === options.where.sha256Hash) ?? null
    )),
    findOneByOrFail: jest.fn(async () => activeDocument),
  };
  const transaction = jest.fn(async (callback: (transactionManager: typeof manager) => unknown) => callback(manager));
  const documentQuery = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn<() => Promise<EmployeeDocument | null>>().mockResolvedValue(activeDocument),
    getMany: jest.fn<() => Promise<EmployeeDocument[]>>().mockResolvedValue(options.documents ?? []),
  };
  const documents = {
    createQueryBuilder: jest.fn(() => documentQuery),
    delete: jest.fn<(criteria: { id: string }) => Promise<unknown>>().mockResolvedValue(undefined),
  };
  const employees = { findOne: jest.fn<() => Promise<Employee | null>>().mockResolvedValue(employee) };
  const auditRepository = { save: jest.fn<(value: object) => Promise<unknown>>().mockResolvedValue(undefined) };
  const dataSource = {
    transaction,
    getRepository: jest.fn(() => auditRepository),
  };
  const service = new EmployeeDocumentService(
    dataSource as never,
    documents as never,
    employees as never,
    storage,
  );

  return { service, storage, saved, manager, transaction, documentQuery, documents, employees, auditRepository };
}

const validFile = (overrides: Partial<Express.Multer.File> = {}) => ({
  originalname: 'evidence.pdf',
  mimetype: 'application/pdf',
  size: pdf.length,
  buffer: pdf,
  ...overrides,
}) as Express.Multer.File;

describe('EmployeeDocumentService S3 storage', () => {
  beforeEach(() => {
    activeDocument.deletedAt = null;
  });

  it('rejects unsupported extensions and declared MIME types in multipart middleware', async () => {
    const app = express();
    app.post('/upload', documentUpload.single('file'), (_req, res) => res.sendStatus(204));
    app.use((error: { statusCode?: number }, _req: unknown, res: express.Response, _next: unknown) => {
      res.sendStatus(error.statusCode ?? 500);
    });

    await request(app)
      .post('/upload')
      .attach('file', pdf, { filename: 'evidence.txt', contentType: 'application/pdf' })
      .expect(400);
  });

  it('rejects files larger than the configured Multer limit', async () => {
    const app = express();
    app.post('/upload', documentUpload.single('file'), (_req, res) => res.sendStatus(204));
    app.use((error: { code?: string }, _req: unknown, res: express.Response, _next: unknown) => {
      res.sendStatus(error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    });

    await request(app)
      .post('/upload')
      .attach('file', Buffer.alloc(env.MAX_DOCUMENT_SIZE_BYTES + 1, 0), { filename: 'large.pdf', contentType: 'application/pdf' })
      .expect(413);
  });

  it('validates and uploads bytes before saving metadata and audit log', async () => {
    const harness = createHarness();

    const result = await harness.service.upload(employeeId, validFile(), actor, 'request-1');

    expect(harness.storage.put).toHaveBeenCalledWith(expect.stringMatching(/^uploads\/[0-9a-f-]+\/\d+_[0-9a-f-]+\.pdf$/), pdf, 'application/pdf');
    expect(harness.transaction).toHaveBeenCalledTimes(1);
    expect(harness.saved.some(({ entity }) => entity === AuditLog)).toBe(true);
    expect(result).toMatchObject({ id: documentId, employeeId, originalName: 'evidence.pdf' });
    expect(result).toHaveProperty('downloadUrl', 'https://s3.example.test/signed-download');
    expect(result).not.toHaveProperty('objectKey');
  });

  it('rejects content whose signature does not match the declared MIME type', async () => {
    const harness = createHarness();

    await expect(harness.service.upload(employeeId, validFile({ buffer: Buffer.from('not a PDF') }), actor, 'request-2'))
      .rejects.toBeInstanceOf(BadRequestError);
    expect(harness.storage.put).not.toHaveBeenCalled();
  });

  it('returns a conflict for repeated content when the tracked S3 object is available', async () => {
    const harness = createHarness();
    const first = await harness.service.upload(employeeId, validFile(), actor, 'request-duplicate-1');

    await expect(harness.service.upload(employeeId, validFile(), actor, 'request-duplicate-2'))
      .rejects.toBeInstanceOf(ConflictError);
    expect(harness.storage.put).toHaveBeenCalledTimes(1);
    expect(harness.storage.exists).toHaveBeenCalledTimes(2);
    expect(first.id).toBe(documentId);
    expect(harness.saved.some(({ entity, value }) => entity === EmployeeDocumentStorage
      && value.sha256Hash === sha256(pdf)
      && value.isAvailable === true
      && value.uploadStatus === 'available')).toBe(true);
  });

  it('uploads different content even when the original filename matches', async () => {
    const harness = createHarness();
    await harness.service.upload(employeeId, validFile(), actor, 'request-different-1');
    await harness.service.upload(employeeId, validFile({ buffer: Buffer.from('%PDF-1.7 other content') }), actor, 'request-different-2');

    expect(harness.storage.put).toHaveBeenCalledTimes(2);
    expect(harness.manager.query).toHaveBeenCalledTimes(2);
  });

  it('denies access to another employee before writing to S3', async () => {
    const harness = createHarness();

    await expect(harness.service.upload(employeeId, validFile(), { ...actor, employeeId: 'd9428888-122b-4b20-9e2a-63e4c4a99b7f' }, 'request-3'))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(harness.storage.put).not.toHaveBeenCalled();
  });

  it('returns a presigned URL only after verifying access and auditing the request', async () => {
    const harness = createHarness();

    const result = await harness.service.createDownloadUrl(documentId, actor, 'request-4');

    expect(harness.storage.presignDownload).toHaveBeenCalledWith(activeDocument.objectKey, activeDocument.originalName, activeDocument.mimeType);
    expect(harness.auditRepository.save).toHaveBeenCalledWith(expect.objectContaining({ action: 'document.download_url' }));
    expect(result.downloadUrl).toMatch(/^https:\/\//);
    expect(result.expiresInSeconds).toBeGreaterThan(0);
  });

  it('soft-deletes metadata and records the deletion without immediately deleting the retained object', async () => {
    const harness = createHarness();

    await harness.service.remove(documentId, actor, 'request-5');

    expect(activeDocument.deletedAt).toBeInstanceOf(Date);
    expect(harness.storage.delete).not.toHaveBeenCalled();
    expect(harness.saved.some(({ entity, value }) => entity === AuditLog && value.action === 'document.delete')).toBe(true);
  });

  it('attempts object cleanup when the S3 write fails', async () => {
    const harness = createHarness({ uploadFailure: true });

    await expect(harness.service.upload(employeeId, validFile(), actor, 'request-6'))
      .rejects.toBeInstanceOf(ServiceUnavailableError);
    expect(harness.storage.delete).not.toHaveBeenCalled();
    expect(harness.transaction).toHaveBeenCalledTimes(1);
  });

  it('maps AWS SDK errors to a safe storage-unavailable error', async () => {
    const client = {
      send: jest.fn().mockImplementation(async () => {
        throw new Error('AWS credentials or network details');
      }),
    } as unknown as S3Client;
    const storage = new S3DocumentStorage(client);

    await expect(storage.put('uploads/test.pdf', pdf, 'application/pdf'))
      .rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('uses HeadObject to detect a missing S3 object', async () => {
    const send = jest.fn<(command: unknown) => Promise<unknown>>()
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { name: 'NotFound' }))
      .mockResolvedValueOnce({});
    const storage = new S3DocumentStorage({ send } as unknown as S3Client);

    await expect(storage.exists('uploads/missing.pdf')).resolves.toBe(false);
    await expect(storage.exists('uploads/present.pdf')).resolves.toBe(true);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
  });

  it('keeps an uploaded object and marks tracking unavailable when audit persistence fails', async () => {
    const harness = createHarness({ auditFailure: true });

    await expect(harness.service.upload(employeeId, validFile(), actor, 'request-7')).rejects.toThrow('database unavailable');
    expect(harness.storage.put).toHaveBeenCalledTimes(1);
    expect(harness.storage.delete).not.toHaveBeenCalled();
    expect(harness.saved.some(({ entity, value }) => entity === EmployeeDocumentStorage
      && value.isAvailable === false && value.uploadStatus === 'failed')).toBe(true);
  });

  it('repairs an unavailable tracked object when HeadObject reports it missing', async () => {
    const existingTracking = {
      id: 'ea842f73-a3a2-4356-9388-41507dc75c55',
      documentId,
      employeeId,
      sha256Hash: sha256(pdf),
      s3ObjectKey: 'uploads/recoverable.pdf',
      isAvailable: false,
      uploadStatus: 'failed',
    } as EmployeeDocumentStorage;
    const harness = createHarness({ existingTracking });

    const result = await harness.service.upload(employeeId, validFile(), actor, 'request-repair');

    expect(harness.storage.exists).toHaveBeenCalledWith('uploads/recoverable.pdf');
    expect(harness.storage.put).toHaveBeenCalledWith('uploads/recoverable.pdf', pdf, 'application/pdf');
    expect(result.id).toBe(documentId);
    expect(harness.saved.some(({ entity, value }) => entity === EmployeeDocumentStorage
      && value.isAvailable === true && value.uploadStatus === 'available')).toBe(true);
  });

  it('purges expired soft-deleted objects and old S3 orphans during cleanup', async () => {
    const expiredDocument = {
      ...activeDocument,
      objectKey: 'uploads/expired.pdf',
      deletedAt: new Date('2020-01-01T00:00:00.000Z'),
    } as EmployeeDocument;
    const oldOrphan = {
      key: 'uploads/orphan.pdf',
      lastModified: new Date('2020-01-01T00:00:00.000Z'),
    };
    const harness = createHarness({ documents: [expiredDocument], objects: [oldOrphan] });

    await harness.service.cleanupStoredObjects();

    expect(harness.storage.delete).toHaveBeenCalledWith('uploads/expired.pdf');
    expect(harness.storage.delete).toHaveBeenCalledWith('uploads/orphan.pdf');
    expect(harness.documents.delete).toHaveBeenCalledWith({ id: documentId });
  });
});