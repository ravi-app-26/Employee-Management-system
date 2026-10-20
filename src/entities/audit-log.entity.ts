import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @Column({ type: 'varchar', length: 80 })
  action: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 50 })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'varchar', length: 64, nullable: true })
  resourceId: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  timestamp: Date;

  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId: string | null;
}
