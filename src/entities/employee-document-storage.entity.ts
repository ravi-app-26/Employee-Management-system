import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DocumentStorageUploadStatus = 'pending' | 'uploading' | 'available' | 'failed';

@Entity('employee_document_storage')
@Index('uq_employee_document_storage_employee_sha256', ['employeeId', 'sha256Hash'], { unique: true })
@Index('uq_employee_document_storage_document_id', ['documentId'], { unique: true })
export class EmployeeDocumentStorage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'sha256_hash', type: 'char', length: 64 })
  sha256Hash!: string;

  @Column({ name: 's3_object_key', type: 'varchar', length: 512, unique: true })
  s3ObjectKey!: string;

  @Column({ name: 'is_available', type: 'boolean', default: false })
  isAvailable!: boolean;

  @Column({ name: 'upload_status', type: 'varchar', length: 20, default: 'pending' })
  uploadStatus!: DocumentStorageUploadStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}