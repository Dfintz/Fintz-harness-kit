import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { WorkflowDefinition } from './WorkflowDefinition';

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Record of a single workflow execution.
 */
@Entity('workflow_executions')
export class WorkflowExecution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  workflowId!: string;

  @ManyToOne(() => WorkflowDefinition, wf => wf.executions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflowId' })
  workflow?: WorkflowDefinition;

  @Column()
  @Index()
  organizationId!: string;

  @Column()
  executedBy!: string;

  @Column({ type: 'varchar', default: ExecutionStatus.PENDING })
  @Index()
  status!: string;

  @Column({ default: false })
  dryRun!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  parameters?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  result?: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  error?: string;

  @CreateDateColumn()
  startedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;
}
