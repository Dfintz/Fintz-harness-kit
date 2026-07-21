import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * MemberEngagement entity
 * Tracks daily Discord engagement metrics per member per guild.
 * Used for leaderboards, stat roles, and analytics.
 * One row per guild+user+date for efficient aggregation.
 */
@Entity('member_engagements')
@Index(['guildId', 'userId', 'date'], { unique: true })
@Index(['guildId', 'date'])
@Index(['userId'])
export class MemberEngagement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  guildId!: string;

  @Column()
  userId!: string;

  @Column({ type: 'date' })
  date!: string; // YYYY-MM-DD

  @Column({ type: 'int', default: 0 })
  messageCount!: number;

  @Column({ type: 'int', default: 0 })
  voiceMinutes!: number;

  @Column({ type: 'int', default: 0 })
  reactionsGiven!: number;

  @Column({ type: 'int', default: 0 })
  threadsCreated!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * StatRole entity
 * Defines an activity-based role that is automatically assigned/removed
 * based on member engagement metrics over a rolling window.
 */
@Entity('stat_roles')
@Index(['guildId'])
@Index(['guildId', 'roleId'], { unique: true })
export class StatRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  guildId!: string;

  @Column()
  roleId!: string; // Discord role ID

  @Column()
  roleName!: string;

  /** Minimum messages in the window to qualify */
  @Column({ type: 'int', default: 0 })
  minMessages!: number;

  /** Minimum voice minutes in the window to qualify */
  @Column({ type: 'int', default: 0 })
  minVoiceMinutes!: number;

  /** Rolling window in days (e.g., 30 = last 30 days) */
  @Column({ type: 'int', default: 30 })
  windowDays!: number;

  /** Whether to remove the role when the user no longer qualifies */
  @Column({ default: true })
  autoRemove!: boolean;

  @Column({ default: true })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * ChannelCounter entity
 * Stores a mapping between a Discord channel and a stat counter type.
 * The channel's name is updated periodically to reflect the stat value.
 */
@Entity('channel_counters')
@Index(['guildId'])
@Index(['guildId', 'channelId'], { unique: true })
export class ChannelCounter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  guildId!: string;

  @Column()
  channelId!: string; // Discord voice/text channel used as counter display

  @Column()
  counterType!: string; // 'member_count' | 'online_count' | 'voice_count' | 'message_count' | 'custom'

  /** Template for the channel name. Use {value} as placeholder. E.g., "Members: {value}" */
  @Column({ default: '{value}' })
  nameTemplate!: string;

  @Column({ default: true })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * InviteTracking entity
 * Records which invite code a member used when joining.
 * Enables "who invited whom" analytics.
 */
@Entity('invite_tracking')
@Index(['guildId'])
@Index(['guildId', 'invitedUserId'], { unique: true })
@Index(['inviterUserId'])
export class InviteTracking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  guildId!: string;

  @Column()
  invitedUserId!: string; // The user who joined

  @Column({ nullable: true })
  inviterUserId?: string; // The user who created the invite

  @Column({ nullable: true })
  inviteCode?: string;

  @Column()
  joinedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
