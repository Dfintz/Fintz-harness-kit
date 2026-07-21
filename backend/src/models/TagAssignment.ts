import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Tag } from './Tag';

@Entity('tag_assignments')
@Index(['tagId', 'resourceType', 'resourceId'], { unique: true })
@Index(['resourceType', 'resourceId'])
@Index(['tagId'])
export class TagAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tagId!: string;

  @ManyToOne(() => Tag, t => t.assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tagId' })
  tag?: Tag;

  @Column({ type: 'varchar', length: 64 })
  resourceType!: string;

  @Column({ type: 'varchar', length: 255 })
  resourceId!: string;

  @Column({ type: 'varchar' })
  assignedBy!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
