import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { TenantEntity } from './base/TenantEntity';
import { TagAssignment } from './TagAssignment';

@Entity('tags')
@Index(['organizationId', 'name'], { unique: true })
@Index(['organizationId', 'createdAt'])
export class Tag extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 7, default: '#6366f1' })
  color!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @OneToMany(() => TagAssignment, a => a.tag)
  assignments?: TagAssignment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
