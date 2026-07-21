import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Sync status for team Discord channel resources
 */
export type TeamChannelSyncStatus = 'synced' | 'pending' | 'error';

/**
 * TeamDiscordChannel
 * Maps a team to its Discord channel resources (category, text channel, voice channel, role).
 * Scoped by organizationId + guildId for multi-tenant isolation.
 */
@Entity('team_discord_channels')
@Index(['organizationId', 'teamId', 'guildId'], { unique: true })
@Index(['organizationId', 'guildId'])
@Index(['guildId'])
export class TeamDiscordChannel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  organizationId!: string;

  @Column()
  teamId!: string;

  @Column()
  guildId!: string;

  /** Discord category channel ID containing the text + voice channels */
  @Column()
  categoryId!: string;

  /** Discord text channel ID for the team */
  @Column()
  textChannelId!: string;

  /** Discord voice channel ID for the team */
  @Column()
  voiceChannelId!: string;

  /** Discord role ID created for this team's members */
  @Column()
  teamRoleId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  /** User who triggered channel creation */
  @Column()
  createdBy!: string;

  /** Last time permissions were synced with Discord */
  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt?: Date;

  @Column({ type: 'varchar', length: 20, default: 'synced' })
  syncStatus!: TeamChannelSyncStatus;

  @Column({ type: 'text', nullable: true })
  lastSyncError?: string;
}
