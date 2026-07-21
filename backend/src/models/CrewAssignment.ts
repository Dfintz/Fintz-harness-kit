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

import { Organization } from './Organization';

export enum CrewRole {
  CAPTAIN = 'captain',
  PILOT = 'pilot',
  ENGINEER = 'engineer',
  GUNNER = 'gunner',
  MEDIC = 'medic',
  CARGO = 'cargo',
  NAVIGATOR = 'navigator',
}

export enum AssignmentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  COMPLETED = 'completed',
}

export interface CrewMember {
  userId: string;
  role: CrewRole | string;
  assignedAt: Date;
  station?: string;
}

@Entity('crew_assignments')
@Index('idx_crew_assignment_org', ['organizationId'])
@Index('idx_crew_assignment_ship', ['shipId'])
export class CrewAssignment {
  @PrimaryColumn()
  id!: string;

  @Column()
  organizationId!: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @Column()
  shipId!: string;

  @Column({ nullable: true })
  missionId?: string;

  @Column()
  assignerId!: string;

  @Column('simple-json', { default: '[]' })
  crew!: CrewMember[];

  @Column({ nullable: true })
  startDate?: Date;

  @Column({ nullable: true })
  endDate?: Date;

  @Column({
    type: 'varchar',
    default: AssignmentStatus.ACTIVE,
  })
  status!: AssignmentStatus;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
