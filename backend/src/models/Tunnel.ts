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

/**
 * Rate limit configuration for tunnels
 */
export interface TunnelRateLimitConfig {
  maxMessages: number;
  windowMs: number;
  blockDurationMs: number;
}

/**
 * Tunnel connection representing a Discord channel connected to a tunnel
 */
export interface TunnelConnection {
  guildId: string;
  channelId: string;
  guildName?: string;
  channelName?: string;
  webhookUrl?: string;
  webhookId?: string;
  connectedAt: Date;
}

/**
 * Tunnel entity for cross-server Discord chat
 * Inspired by tunnels.gg — bridging Discord channels across servers
 */
@Entity('tunnels')
export class Tunnel {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  /** Unique invite code for code-based linking (e.g. /tunnel link ABC123) */
  @Column({ unique: true, nullable: true })
  @Index('IDX_tunnel_invite_code', { unique: true })
  inviteCode?: string;

  @Column()
  creatorGuildId!: string;

  @Column()
  creatorChannelId!: string;

  @Column({ default: true })
  isPublic!: boolean;

  @Column({ nullable: true, select: false })
  password?: string;

  @Column('simple-json')
  connectedChannels!: TunnelConnection[];

  @Column('simple-json', { nullable: true })
  rateLimitConfig?: TunnelRateLimitConfig;

  @Column({ default: true })
  contentFilterEnabled!: boolean;

  /** Allow bot messages to be relayed through the tunnel (default: true — free for all) */
  @Column({ default: true })
  allowBotMessages!: boolean;

  /** Max servers that can connect to this tunnel (admin-configurable, 0 = unlimited) */
  @Column({ default: 0 })
  maxConnectedServers!: number;

  @Column({ nullable: true })
  organizationId?: string;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organizationId' })
  organization?: Organization;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
