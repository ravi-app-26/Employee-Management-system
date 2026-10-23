import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('employee_documents')
@Index('idx_employee_documents_employee_active', ['employeeId', 'deletedAt'])
export class EmployeeDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({
    name: 'size_bytes',
    type: 'bigint',
    transformer: { to: (value: number) => value, from: (value: string) => Number(value) },
  })
  sizeBytes!: number;

  @Column({ name: 'object_key', type: 'varchar', length: 512, unique: true, select: false })
  objectKey!: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
