import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('account_access_logs')
export class AccountAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  accountId!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  @Column({ type: 'varchar', length: 50 })
  action!: string; // 'view', 'password_reveal', 'update', 'delete'

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown>; // Additional context

  @Index()
  @CreateDateColumn()
  createdAt!: Date;
}
