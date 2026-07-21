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

import { Skill } from './Skill';
import { SkillEndorsement } from './SkillEndorsement';

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

@Entity('user_skills')
@Index(['organizationId', 'userId', 'skillId'], { unique: true })
@Index(['organizationId', 'userId'])
@Index(['skillId'])
export class UserSkill {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @Column({ type: 'uuid' })
  skillId!: string;

  @ManyToOne(() => Skill, s => s.userSkills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'skillId' })
  skill?: Skill;

  @Column({ type: 'varchar', length: 20, default: SkillLevel.BEGINNER })
  level!: SkillLevel;

  @Column({ type: 'int', default: 0 })
  endorsementCount!: number;

  @OneToMany(() => SkillEndorsement, e => e.userSkill)
  endorsements?: SkillEndorsement[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
