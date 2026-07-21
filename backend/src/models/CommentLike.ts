import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Comment } from './Comment';

@Entity('comment_likes')
@Index(['commentId', 'userId'], { unique: true })
@Index(['userId'])
export class CommentLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  commentId!: string;

  @ManyToOne(() => Comment, c => c.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commentId' })
  comment?: Comment;

  @Column({ type: 'varchar' })
  userId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
