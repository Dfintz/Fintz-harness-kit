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

export type TunnelBanType = 'ban' | 'mute';

/**
 * Tunnel moderation: bans and mutes for users within a tunnel
 */
@Entity('tunnel_bans')
@Index('IDX_tunnel_ban_user_tunnel', ['tunnelId', 'userId'], { unique: true })
export class TunnelBan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @Index('IDX_tunnel_ban_tunnel')
  tunnelId!: string;

  @ManyToOne(() => Tunnel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tunnelId' })
  tunnel?: Tunnel;

  /** The banned/muted user ID */
  @Column()
  @Index('IDX_tunnel_ban_user')
  userId!: string;

  @Column({ nullable: true })
  username?: string;

  /** 'ban' = cannot see/send messages, 'mute' = can see but cannot send */
  @Column({ type: 'varchar', length: 10 })
  type!: TunnelBanType;

  /** Reason for the moderation action */
  @Column({ nullable: true })
  reason?: string;

  /** The moderator who issued the action */
  @Column()
  issuedBy!: string;

  /** Expiry timestamp (null = permanent) */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
