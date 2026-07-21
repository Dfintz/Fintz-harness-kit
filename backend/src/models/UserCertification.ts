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

import { Certification } from './Certification';

export enum CertificationStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

@Entity('user_certifications')
@Index(['organizationId', 'userId', 'certificationId'], { unique: true })
@Index(['organizationId', 'userId'])
@Index(['certificationId'])
export class UserCertification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'uuid' })
  certificationId!: string;

  @ManyToOne(() => Certification, c => c.holders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificationId' })
  certification?: Certification;

  @Column({ type: 'varchar', length: 20, default: CertificationStatus.ACTIVE })
  status!: CertificationStatus;

  @Column({ type: 'varchar' })
  awardedBy!: string;

  @Column({ type: 'timestamp' })
  awardedAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  revokedBy?: string;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt?: Date;

  @Column({ type: 'text', nullable: true })
  revokeReason?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
