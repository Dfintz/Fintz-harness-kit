import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Dashboard } from './Dashboard';

/**
 * Individual widget within a Dashboard.
 * Linked to parent dashboard; cascaded on delete.
 */
@Entity('dashboard_widgets')
export class DashboardWidget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index()
  dashboardId!: string;

  @ManyToOne(() => Dashboard, dashboard => dashboard.widgets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboardId' })
  dashboard?: Dashboard;

  @Column({ length: 64 })
  type!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'simple-json', nullable: true })
  config?: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  position?: { x: number; y: number; w: number; h: number };

  @Column({ default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
