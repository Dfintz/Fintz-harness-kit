import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Announcement } from './Announcement';

/**
 * AnnouncementReadReceipt Entity
 *
 * Tracks which users have read which announcements.
 * One row per user-announcement pair.
 */
@Entity('announcement_read_receipts')
@Unique(['announcementId', 'userId'])
@Index(['announcementId'])
@Index(['userId'])
export class AnnouncementReadReceipt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  announcementId!: string;

  @ManyToOne(() => Announcement, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'announcementId' })
  announcement!: Announcement;

  @Column({ type: 'varchar' })
  userId!: string;

  @CreateDateColumn()
  readAt!: Date;
}
