import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('org_focus_preferences')
@Index(['orgId'], { unique: true })
export class OrgFocusPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  orgId!: string;

  @Column('simple-json')
  focuses!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
