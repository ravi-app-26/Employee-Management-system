import { Column, Entity, ManyToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { Role } from './role.entity';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Relation<Role[]>;
}