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
import { UserSkill } from './UserSkill';

export enum SkillCategory {
  COMBAT = 'combat',
  MINING = 'mining',
  TRADING = 'trading',
  EXPLORATION = 'exploration',
  MEDICAL = 'medical',
  ENGINEERING = 'engineering',
  PILOTING = 'piloting',
  LEADERSHIP = 'leadership',
  LOGISTICS = 'logistics',
  OTHER = 'other',
}

@Entity('skills')
@Index(['organizationId', 'name'], { unique: true })
@Index(['organizationId', 'category'])
export class Skill extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 32, default: SkillCategory.OTHER })
  category!: SkillCategory;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @OneToMany(() => UserSkill, us => us.skill)
  userSkills?: UserSkill[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
