import { createReadStream } from 'node:fs';
import { access, chmod, mkdir, readFile, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { Employee } from '../entities/employee.entity';
import { EmployeeDocument } from '../entities/employee-document.entity';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../errors/app-error';
import { env } from '../config/env';
import { LocalDocumentStorage } from './document-storage';

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
  ) {}

  async upload(employeeId: string, file: Express.Multer.File | undefined, actor: DocumentActor, requestId: string) {
    if (!file) throw new BadRequestError('Upload file is required');
    try {
      await this.ensureEmployeeAccess(employeeId, actor, true);
      const content = await readFile(file.path);
      LocalDocumentStorage.validateContent(file.mimetype, content);
      const key = path.basename(file.filename);

      return await this.dataSource.transaction(async (manager) => {
        const document = await manager.save(EmployeeDocument, manager.create(EmployeeDocument, {
          employeeId,
          originalName: path.basename(file.originalname).slice(0, 255),
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
        return this.publicDocument(document);
      });
    } catch (error) {
      await unlink(file.path).catch(() => undefined);
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
    return { downloadUrl: LocalDocumentStorage.downloadUrl(document.id), expiresInSeconds: 300 };
  }

  async download(documentId: string, token: string | undefined) {
    if (!token || !LocalDocumentStorage.verifyDownloadToken(documentId, token)) {
      throw new UnauthorizedError('Download link is invalid or expired');
    }
    const document = await this.findActiveDocument(documentId);
    const filePath = LocalDocumentStorage.filePath(document.objectKey);
    await access(filePath).catch(() => { throw new NotFoundError('Document file not found'); });
    return {
      stream: createReadStream(filePath),
      mimeType: document.mimeType,
      originalName: document.originalName,
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

  async cleanupLocalFiles(): Promise<void> {
    const directory = path.resolve(env.UPLOAD_DIR);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const documents = await this.documents.createQueryBuilder('document')
      .select(['document.id', 'document.objectKey', 'document.deletedAt'])
      .getMany();
    const retainedKeys = new Set(documents.map((document) => document.objectKey));
    const retentionCutoff = Date.now() - env.UPLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const document of documents) {
      if (document.deletedAt && document.deletedAt.getTime() < retentionCutoff) {
        await unlink(LocalDocumentStorage.filePath(document.objectKey)).catch(() => undefined);
        await this.documents.delete({ id: document.id });
        retainedKeys.delete(document.objectKey);
      }
    }

    const orphanCutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const fileName of await readdir(directory)) {
      if (retainedKeys.has(fileName)) continue;
      const filePath = LocalDocumentStorage.filePath(fileName);
      const fileInfo = await stat(filePath).catch(() => null);
      if (fileInfo?.isFile() && fileInfo.mtimeMs < orphanCutoff) {
        await unlink(filePath).catch(() => undefined);
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
