import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from './User';

/**
 * LegalHold Entity
 *
 * Tracks legal holds on user accounts that prevent GDPR deletion.
 * Used for compliance with legal discovery, regulatory investigations,
 * or other situations requiring data preservation.
 */
@Entity('legal_holds')
export class LegalHold {
  @PrimaryColumn('uuid')
  id!: string;

  @Index()
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'timestamp', nullable: true })
  holdUntil?: Date;

  @Column({ nullable: true })
  createdBy?: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
