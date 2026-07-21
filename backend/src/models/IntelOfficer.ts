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

import { IntelAccessLevel } from './IntelEntry';
import { Organization } from './Organization';
import { User } from './User';

/**
 * Intel Officer rank
 */
export enum IntelOfficerRank {
  JUNIOR = 'junior', // Rank 1 - Basic access
  OFFICER = 'officer', // Rank 2 - Standard officer
  SENIOR = 'senior', // Rank 3 - Senior officer
  LEAD = 'lead', // Rank 4 - Lead officer
  CHIEF = 'chief', // Rank 5 - Chief Intel officer (highest)
}

/**
 * Intel Officer entity - manages who has access to Intel vault
 */
@Entity('intel_officers')
@Index(['organizationId', 'userId'], { unique: true })
@Index(['organizationId', 'rank'])
export class IntelOfficer {
  @PrimaryColumn()
  id!: string;

  @Column()
  @Index()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column()
  @Index()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({
    type: 'varchar',
    enum: IntelOfficerRank,
    default: IntelOfficerRank.JUNIOR,
  })
  rank!: IntelOfficerRank;

  @Column({
    type: 'varchar',
    enum: IntelAccessLevel,
    default: IntelAccessLevel.READ,
  })
  accessLevel!: IntelAccessLevel;

  @Column({ default: true })
  @Index()
  isActive!: boolean;

  @Column({ nullable: true })
  specializations?: string; // Comma-separated categories they specialize in

  @Column()
  @Index()
  appointedBy!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointedBy' })
  appointer?: User;

  @Column({ nullable: true })
  @Index()
  revokedBy?: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'revokedBy' })
  revoker?: User;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  appointedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
