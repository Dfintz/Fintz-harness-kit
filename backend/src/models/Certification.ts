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
import { UserCertification } from './UserCertification';

@Entity('certifications')
@Index(['organizationId', 'name'], { unique: true })
@Index(['organizationId', 'createdAt'])
export class Certification extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  requirements?: string;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @OneToMany(() => UserCertification, uc => uc.certification)
  holders?: UserCertification[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
