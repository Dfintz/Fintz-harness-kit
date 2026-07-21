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

import { TenantEntity } from './base/TenantEntity';
import { CommentLike } from './CommentLike';

@Entity('comments')
@Index(['organizationId', 'resourceType', 'resourceId'])
@Index(['organizationId', 'createdAt'])
@Index(['parentId'])
@Index(['createdBy'])
export class Comment extends TenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 64 })
  resourceType!: string;

  @Column({ type: 'varchar', length: 255 })
  resourceId!: string;

  @Column({ type: 'varchar' })
  createdBy!: string;

  @Column({ length: 100, nullable: true })
  createdByName?: string;

  @Column({ type: 'uuid', nullable: true })
  parentId?: string;

  @ManyToOne(() => Comment, c => c.replies, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentId' })
  parent?: Comment;

  @OneToMany(() => Comment, c => c.parent)
  replies?: Comment[];

  @OneToMany(() => CommentLike, l => l.comment)
  likes?: CommentLike[];

  @Column({ type: 'boolean', default: false })
  isEdited!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  editedAt?: Date;

  @Column({ type: 'int', default: 0 })
  likeCount!: number;

  @Column({ type: 'int', default: 0 })
  replyCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
