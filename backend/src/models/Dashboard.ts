import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { DashboardWidget } from './DashboardWidget';
import { Organization } from './Organization';
import { User } from './User';

export enum DashboardType {
  CUSTOM = 'custom',
  FLEET = 'fleet',
  ANALYTICS = 'analytics',
  OPERATIONS = 'operations',
}

export enum DashboardLayout {
  GRID = 'grid',
  LIST = 'list',
  FREEFORM = 'freeform',
}

/**
 * User-configurable dashboard with widget support.
 * Org-scoped; supports sharing between users.
 */
@Entity('dashboards')
export class Dashboard {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', default: DashboardType.CUSTOM })
  type!: string;

  @Column({ type: 'varchar', default: DashboardLayout.GRID })
  layout!: string;

  @Column()
  @Index()
  createdBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdBy' })
  creator?: User;

  @Column({ default: false })
  isDefault!: boolean;

  @Column('simple-array', { nullable: true, default: '' })
  sharedWithUsers?: string[];

  @OneToMany(() => DashboardWidget, widget => widget.dashboard, { cascade: true, eager: true })
  widgets?: DashboardWidget[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
