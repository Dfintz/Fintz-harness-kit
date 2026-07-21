import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { encryptionTransformer } from '../utils/encryptionTransformer';

import { ContactRequest } from './ContactRequest';
import { User } from './User';

/**
 * ContactRequestReply entity
 *
 * Stores replies in a contact request conversation thread.
 * Enables two-way messaging between contact request senders and org admins.
 * Message content is encrypted at rest via AES-256-GCM.
 */
@Entity('contact_request_replies')
@Index(['contactRequestId', 'createdAt'])
export class ContactRequestReply {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Parent contact request this reply belongs to
   */
  @Column()
  @Index()
  contactRequestId!: string;

  @ManyToOne(() => ContactRequest, contactRequest => contactRequest.replies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'contactRequestId' })
  contactRequest?: ContactRequest;

  /**
   * User who sent this reply
   */
  @Column()
  @Index()
  senderUserId!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'senderUserId' })
  senderUser?: User;

  /**
   * Reply message content
   * Encrypted at rest via AES-256-GCM
   */
  @Column({ type: 'text', transformer: encryptionTransformer })
  message!: string;

  /**
   * Whether this reply is from an org admin/handler (vs. the original sender)
   */
  @Column({ type: 'boolean', default: false })
  isOrgReply!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
