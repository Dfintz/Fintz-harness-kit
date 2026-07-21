import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Tunnel } from './Tunnel';

/**
 * Attachment metadata for tunnel messages
 */
export interface TunnelAttachment {
  url: string;
  filename: string;
  contentType?: string;
  size?: number;
}

/**
 * Persisted tunnel message for history and relay
 * Supports rich content: text, attachments, embeds, GIFs, replies, stickers
 */
@Entity('tunnel_messages')
@Index('IDX_tunnel_message_tunnel_timestamp', ['tunnelId', 'createdAt'])
export class TunnelMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_tunnel_message_tunnel')
  tunnelId!: string;

  @ManyToOne(() => Tunnel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tunnelId' })
  tunnel?: Tunnel;

  /** Discord user ID or web user ID */
  @Column()
  authorId!: string;

  @Column()
  authorName!: string;

  @Column({ nullable: true })
  authorAvatar?: string;

  /** Source guild ID (null for web-originated messages) */
  @Column({ nullable: true })
  sourceGuildId?: string;

  /** Source channel ID */
  @Column({ nullable: true })
  sourceChannelId?: string;

  /** Original Discord message ID (for edit/delete tracking) */
  @Column({ nullable: true })
  @Index('IDX_tunnel_message_discord_id')
  discordMessageId?: string;

  /** Text content */
  @Column('text', { nullable: true })
  content?: string;

  /** Attachments (images, files) */
  @Column('simple-json', { nullable: true })
  attachments?: TunnelAttachment[];

  /** Embed data (rich embeds from Discord) */
  @Column('simple-json', { nullable: true })
  embeds?: Record<string, unknown>[];

  /** Sticker IDs */
  @Column('simple-json', { nullable: true })
  stickerIds?: string[];

  /** Reply to message ID (for threading) */
  @Column({ nullable: true })
  replyToMessageId?: string;

  /** Whether this message is from a bot */
  @Column({ default: false })
  isBot!: boolean;

  /** Whether the message was blocked by content filter (stored for audit) */
  @Column({ default: false })
  wasBlocked!: boolean;

  @Column({ nullable: true })
  blockReason?: string;

  /** Whether the message has been edited */
  @Column({ default: false })
  isEdited!: boolean;

  /** When the message was last edited */
  @Column({ type: 'timestamp', nullable: true })
  editedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
