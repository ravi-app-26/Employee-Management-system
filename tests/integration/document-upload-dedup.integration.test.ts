import { describe, expect, it } from '@jest/globals';
import { AppDataSource } from '../../src/config/database';
import { Employee, EmployeeDocument, EmployeeDocumentStorage } from '../../src/entities';
import { ConflictError } from '../../src/errors/app-error';
import { EmployeeDocumentService } from '../../src/services/employee-document.service';
import type { DocumentObjectStorage } from '../../src/storage';
import { createUserByRole } from './helpers';

const pdf = Buffer.from('%PDF-1.7 concurrent upload test');

describe('employee document upload deduplication', () => {
  it('serializes concurrent identical uploads into one tracked S3 object', async () => {
    const actor = await createUserByRole('employee');
    const documentActor = { ...actor, role: 'employee' };
    const objects = new Set<string>();
    const storage: DocumentObjectStorage = {
      put: jest.fn(async (key: string) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        objects.add(key);
      }),
      exists: jest.fn(async (key: string) => objects.has(key)),
      presignDownload: jest.fn(async (key: string) => `https://s3.example.test/${key}`),
      delete: jest.fn(async (key: string) => { objects.delete(key); }),
      list: jest.fn(async () => []),
    };
    const service = new EmployeeDocumentService(
      AppDataSource,
      AppDataSource.getRepository(EmployeeDocument),
      AppDataSource.getRepository(Employee),
      storage,
    );
    const file = {
      originalname: 'concurrent.pdf',
      mimetype: 'application/pdf',
      size: pdf.length,
      buffer: pdf,
    } as Express.Multer.File;

    const results = await Promise.allSettled([
      service.upload(actor.employeeId, file, documentActor, 'concurrent-upload-1'),
      service.upload(actor.employeeId, file, documentActor, 'concurrent-upload-2'),
    ]);
    const tracking = await AppDataSource.getRepository(EmployeeDocumentStorage).find({
      where: { employeeId: actor.employeeId },
    });
    const documents = await AppDataSource.getRepository(EmployeeDocument).find({
      where: { employeeId: actor.employeeId },
    });

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    expect(storage.put).toHaveBeenCalledTimes(1);
    expect(tracking).toHaveLength(1);
    expect(tracking[0]).toMatchObject({ isAvailable: true, uploadStatus: 'available' });
    expect(documents).toHaveLength(1);
  });
});