import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ name: 'department_id', type: 'uuid' })
  departmentId!: string;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId!: string | null;

  @Column({ name: 'job_title', type: 'varchar', length: 100 })
  jobTitle!: string;

  @Column({ name: 'joining_date', type: 'date' })
  joiningDate!: string;

  @Column({ name: 'employment_status', type: 'varchar', length: 20, default: 'active' })
  employmentStatus!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}