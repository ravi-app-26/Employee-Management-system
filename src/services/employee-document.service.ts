import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { ROLE } from '../common/constants';
import { AuditLog, Employee, EmployeeDocument, EmployeeDocumentStorage } from '../entities';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/app-error';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { sanitizeOriginalFilename, sha256, S3DocumentStorage, validateDocumentContent } from '../providers/aws';
import type { DocumentActor, DocumentObjectStorage } from '../interfaces';

export class EmployeeDocumentService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly documents: Repository<EmployeeDocument>,
    private readonly employees: Repository<Employee>,
    private readonly storage: DocumentObjectStorage = new S3DocumentStorage(),
  ) {}

  async upload(employeeId: string, file: Express.Multer.File | undefined, actor: DocumentActor, requestId: string) {
    if (!file) throw new BadRequestError('Upload file is required');
    await this.ensureEmployeeAccess(employeeId, actor, true);
    const validatedExtension = validateDocumentContent(file.mimetype, file.buffer);
    const originalName = sanitizeOriginalFilename(file.originalname);
    const sha256Hash = sha256(file.buffer);
    const prefix = env.DOCUMENTS_S3_PREFIX.replace(/^\/+|\/+$/g, '') || 'uploads';
    let outcome: { document: EmployeeDocument; objectKey: string }
      | { error: unknown }
      | { duplicate: true };
    try {
      outcome = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${employeeId}:${sha256Hash}`]);
      let tracking = await manager.findOne(EmployeeDocumentStorage, {
        where: { employeeId, sha256Hash },
        lock: { mode: 'pessimistic_write' },
      });
      let document: EmployeeDocument;

      if (tracking) {
        if (tracking.isAvailable && tracking.uploadStatus === 'available'
          && await this.storage.exists(tracking.s3ObjectKey)) {
          return { duplicate: true as const };
        }
        document = await manager.findOneByOrFail(EmployeeDocument, { id: tracking.documentId });
        document.deletedAt = null;
        document.originalName = originalName;
        document.mimeType = file.mimetype;
        document.sizeBytes = file.size;
        document.uploadedBy = actor.id;
      } else {
        const key = `${prefix}/${employeeId}/${Date.now()}_${randomUUID()}.${validatedExtension}`;
        document = await manager.save(EmployeeDocument, manager.create(EmployeeDocument, {
          employeeId,
          originalName,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          objectKey: key,
          uploadedBy: actor.id,
        }));
        tracking = manager.create(EmployeeDocumentStorage, {
          documentId: document.id,
          employeeId,
          sha256Hash,
          s3ObjectKey: key,
          isAvailable: false,
          uploadStatus: 'pending',
        });
      }

      tracking.uploadStatus = 'uploading';
      tracking.isAvailable = false;
      await manager.save(EmployeeDocumentStorage, tracking);

      try {
        if (!(await this.storage.exists(tracking.s3ObjectKey))) {
          await this.storage.put(tracking.s3ObjectKey, file.buffer, file.mimetype);
        }
        document = await manager.save(EmployeeDocument, document);
        await manager.save(AuditLog, manager.create(AuditLog, {
          actorUserId: actor.id,
          action: 'document.upload',
          resourceType: 'employee_document',
          resourceId: document.id,
          requestId,
        }));
        tracking.uploadStatus = 'available';
        tracking.isAvailable = true;
        await manager.save(EmployeeDocumentStorage, tracking);
        return { document, objectKey: tracking.s3ObjectKey };
      } catch (error) {
        tracking.uploadStatus = 'failed';
        tracking.isAvailable = false;
        await manager.save(EmployeeDocumentStorage, tracking);
        return { error };
      }
      });
    } catch (error) {
      await this.markTrackingUnavailable(employeeId, sha256Hash).catch((trackingError: unknown) => {
        logger.warn({ employeeId, sha256Hash, err: trackingError }, 'Failed to mark document storage unavailable after transaction failure');
      });
      throw error;
    }

    if ('error' in outcome) throw outcome.error;
    if ('duplicate' in outcome) throw new ConflictError('This document has already been uploaded');
    const downloadUrl = await this.storage.presignDownload(outcome.objectKey, originalName, file.mimetype);
    return {
      ...this.publicDocument(outcome.document),
      downloadUrl,
      expiresInSeconds: env.DOCUMENT_DOWNLOAD_URL_TTL_SECONDS,
    };
  }

  assertCanWrite(employeeId: string, actor: DocumentActor): Promise<void> {
    return this.ensureEmployeeAccess(employeeId, actor, true);
  }

  async list(employeeId: string, actor: DocumentActor) {
    await this.ensureEmployeeAccess(employeeId, actor, false);
    const documents = await this.documents.find({
      where: { employeeId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return documents.map((document) => this.publicDocument(document));
  }

  async createDownloadUrl(documentId: string, actor: DocumentActor, requestId: string) {
    const document = await this.findActiveDocument(documentId);
    await this.ensureEmployeeAccess(document.employeeId, actor, false);
    await this.dataSource.getRepository(AuditLog).save({
      actorUserId: actor.id,
      action: 'document.download_url',
      resourceType: 'employee_document',
      resourceId: document.id,
      requestId,
    });
    return {
      downloadUrl: await this.storage.presignDownload(document.objectKey, document.originalName, document.mimeType),
      expiresInSeconds: env.DOCUMENT_DOWNLOAD_URL_TTL_SECONDS,
    };
  }

  async remove(documentId: string, actor: DocumentActor, requestId: string): Promise<void> {
    const document = await this.findActiveDocument(documentId);
    await this.ensureEmployeeAccess(document.employeeId, actor, true);
    await this.dataSource.transaction(async (manager) => {
      document.deletedAt = new Date();
      await manager.save(document);
      await manager.save(AuditLog, manager.create(AuditLog, {
        actorUserId: actor.id,
        action: 'document.delete',
        resourceType: 'employee_document',
        resourceId: document.id,
        requestId,
      }));
    });
  }

  async cleanupStoredObjects(): Promise<void> {
    const documents = await this.documents.createQueryBuilder('document')
      .select(['document.id', 'document.objectKey', 'document.deletedAt'])
      .getMany();
    const retainedKeys = new Set(documents.map((document) => document.objectKey));
    const retentionCutoff = Date.now() - env.UPLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const document of documents) {
      if (document.deletedAt && document.deletedAt.getTime() < retentionCutoff) {
        await this.storage.delete(document.objectKey);
        await this.documents.delete({ id: document.id });
        retainedKeys.delete(document.objectKey);
      }
    }

    const orphanCutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const object of await this.storage.list(env.DOCUMENTS_S3_PREFIX)) {
      if (retainedKeys.has(object.key)) continue;
      if (object.lastModified && object.lastModified.getTime() < orphanCutoff) {
        await this.storage.delete(object.key);
      }
    }
  }

  private async findActiveDocument(id: string): Promise<EmployeeDocument> {
    const document = await this.documents.createQueryBuilder('document')
      .addSelect('document.objectKey')
      .where('document.id = :id', { id })
      .andWhere('document.deletedAt IS NULL')
      .getOne();
    if (!document) throw new NotFoundError('Document not found');
    return document;
  }

  private async markTrackingUnavailable(employeeId: string, sha256Hash: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${employeeId}:${sha256Hash}`]);
      const tracking = await manager.findOne(EmployeeDocumentStorage, {
        where: { employeeId, sha256Hash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tracking) return;
      if (tracking.isAvailable && tracking.uploadStatus === 'available'
        && await this.storage.exists(tracking.s3ObjectKey)) return;
      tracking.isAvailable = false;
      tracking.uploadStatus = 'failed';
      await manager.save(EmployeeDocumentStorage, tracking);
    });
  }

  private async ensureEmployeeAccess(employeeId: string, actor: DocumentActor, write: boolean): Promise<void> {
    const employee = await this.employees.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundError('Employee not found');
    if (actor.role === ROLE.ADMIN || actor.role === ROLE.HR || actor.employeeId === employeeId) return;
    if (!write && actor.role === ROLE.MANAGER && employee.managerId === actor.employeeId) return;
    throw new NotFoundError('Employee not found');
  }

  private publicDocument(document: EmployeeDocument) {
    return {
      id: document.id,
      employeeId: document.employeeId,
      originalName: document.originalName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      createdAt: document.createdAt,
    };
  }
}
