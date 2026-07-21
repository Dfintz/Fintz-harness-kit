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

import { Organization } from './Organization';
import { WorkflowExecution } from './WorkflowExecution';

export enum WorkflowStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export interface WorkflowAction {
  type: string;
  config?: Record<string, unknown>;
  order?: number;
}

/**
 * Automation workflow definition.
 * Org-scoped; stores trigger + actions config.
 */
@Entity('workflow_definitions')
export class WorkflowDefinition {
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

  @Column({ length: 64 })
  type!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'simple-json', nullable: true })
  trigger?: Record<string, unknown>;

  @Column({ type: 'simple-json' })
  actions!: WorkflowAction[];

  @Column({ default: true })
  enabled!: boolean;

  @Column({ type: 'varchar', default: WorkflowStatus.ACTIVE })
  status!: string;

  @Column()
  createdBy!: string;

  @OneToMany(() => WorkflowExecution, execution => execution.workflow)
  executions?: WorkflowExecution[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
