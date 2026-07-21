import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { UserSkill } from './UserSkill';

@Entity('skill_endorsements')
@Index(['userSkillId', 'endorsedBy'], { unique: true })
export class SkillEndorsement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userSkillId!: string;

  @ManyToOne(() => UserSkill, us => us.endorsements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userSkillId' })
  userSkill?: UserSkill;

  @Column({ type: 'varchar' })
  endorsedBy!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
