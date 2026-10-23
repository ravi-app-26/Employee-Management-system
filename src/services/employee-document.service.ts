import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuditLog, Employee, EmployeeDocument } from '../entities';
import { BadRequestError, NotFoundError } from '../errors/app-error';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { sanitizeOriginalFilename, S3DocumentStorage, validateDocumentContent } from '../storage';
import type { DocumentObjectStorage } from '../storage';

export interface DocumentActor {
  id: string;
  role: string;
  employeeId: string;
}

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
    const prefix = env.DOCUMENTS_S3_PREFIX.replace(/^\/+|\/+$/g, '') || 'uploads';
    const key = `${prefix}/${employeeId}/${Date.now()}_${randomUUID()}.${validatedExtension}`;
    try {
      await this.storage.put(key, file.buffer, file.mimetype);
      const downloadUrl = await this.storage.presignDownload(key, originalName, file.mimetype);
      return await this.dataSource.transaction(async (manager) => {
        const document = await manager.save(EmployeeDocument, manager.create(EmployeeDocument, {
          employeeId,
          originalName,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          objectKey: key,
          uploadedBy: actor.id,
        }));
        await manager.save(AuditLog, manager.create(AuditLog, {
          actorUserId: actor.id,
          action: 'document.upload',
          resourceType: 'employee_document',
          resourceId: document.id,
          requestId,
        }));
        return {
          ...this.publicDocument(document),
          downloadUrl,
          expiresInSeconds: env.DOCUMENT_DOWNLOAD_URL_TTL_SECONDS,
        };
      });
    } catch (error) {
      await this.storage.delete(key).catch((cleanupError: unknown) => {
        logger.warn({ objectKey: key, err: cleanupError }, 'Failed to clean up uploaded document object');
      });
      throw error;
    }
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

  private async ensureEmployeeAccess(employeeId: string, actor: DocumentActor, write: boolean): Promise<void> {
    const employee = await this.employees.findOne({ where: { id: employeeId } });
    if (!employee) throw new NotFoundError('Employee not found');
    if (actor.role === 'admin' || actor.role === 'hr' || actor.employeeId === employeeId) return;
    if (!write && actor.role === 'manager' && employee.managerId === actor.employeeId) return;
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
