import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Organization } from './Organization';

/**
 * Primary focus areas for organizations
 */
export enum OrgPrimaryFocus {
  COMBAT = 'combat',
  MINING = 'mining',
  TRADING = 'trading',
  EXPLORATION = 'exploration',
  BOUNTY_HUNTING = 'bounty_hunting',
  MEDICAL = 'medical',
  TRANSPORT = 'transport',
  SALVAGE = 'salvage',
  SECURITY = 'security',
  SOCIAL = 'social',
  PIRACY = 'piracy',
  RACING = 'racing',
  MIXED = 'mixed',
}

/**
 * Activity level classifications
 */
export enum ActivityLevel {
  INACTIVE = 'inactive',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  VERY_HIGH = 'very_high',
}

/**
 * Public Organization Profile entity
 *
 * Stores public-facing information for organizations that opt-in
 * to being listed in the public organization directory.
 */
@Entity('public_org_profiles')
@Index(['isPublic'])
@Index(['primaryFocus'])
@Index(['activityLevel'])
@Index(['isRecruiting'])
@Index(['isVerified'])
@Index(['memberCount'])
export class PublicOrgProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  organizationId!: string;

  @OneToOne(() => Organization)
  @JoinColumn({ name: 'organizationId' })
  organization!: Organization;

  /**
   * URL-friendly slug derived from the organization name.
   * Used for SEO-friendly public directory URLs.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  @Index()
  slug?: string;

  /**
   * Whether this profile is publicly visible in the directory
   */
  @Column({ default: false })
  isPublic!: boolean;

  /**
   * Short tagline/motto for the organization (max 200 chars)
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  tagline?: string;

  /**
   * Primary focus area of the organization
   */
  @Column({
    type: 'enum',
    enum: OrgPrimaryFocus,
    default: OrgPrimaryFocus.MIXED,
  })
  primaryFocus!: OrgPrimaryFocus;

  /**
   * Secondary focus areas (JSON array of OrgPrimaryFocus values)
   */
  @Column({ type: 'jsonb', nullable: true })
  secondaryFocus?: OrgPrimaryFocus[];

  /**
   * Number of members (denormalized for efficient querying)
   */
  @Column({ default: 0 })
  memberCount!: number;

  /**
   * Activity level of the organization
   */
  @Column({
    type: 'enum',
    enum: ActivityLevel,
    default: ActivityLevel.MODERATE,
  })
  activityLevel!: ActivityLevel;

  /**
   * RSI Spectrum URL
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  rsiUrl?: string;

  /**
   * Discord invite link or server ID
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  discordInvite?: string;

  /**
   * Twitter/X profile URL
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  twitterUrl?: string;

  /**
   * YouTube channel URL
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  youtubeUrl?: string;

  /**
   * Twitch channel URL
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  twitchUrl?: string;

  /**
   * Organization website URL
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  websiteUrl?: string;

  /**
   * Banner image URL displayed at top of card
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerUrl?: string;

  /**
   * Languages spoken in the organization
   */
  @Column({ type: 'jsonb', nullable: true })
  languages?: string[];

  /**
   * Primary timezone of the organization
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  timezone?: string;

  /**
   * Whether the organization has been verified by staff
   */
  @Column({ default: false })
  isVerified!: boolean;

  /**
   * Whether the organization is actively recruiting
   */
  @Column({ default: false })
  isRecruiting!: boolean;

  /**
   * Whether to redirect applicants to Discord instead of using the in-app application system.
   * When true and discordInvite is set, the "Apply to Join" button opens the Discord invite link.
   */
  @Column({ default: false })
  useDiscordForApplications!: boolean;

  /**
   * Controls which SCStats sections are visible on the public profile page.
   * All sections default to visible when null.
   */
  @Column({ type: 'jsonb', nullable: true })
  scstatsVisibility?: {
    showVerification?: boolean;
    showSkills?: boolean;
    showTimezone?: boolean;
    showAnalytics?: boolean;
  };

  // ==================== RSI ORG METADATA ====================

  /** RSI archetype (e.g. "Organization", "Corporation", "PMC", "Syndicate") */
  @Column({ type: 'varchar', length: 100, nullable: true })
  rsiArchetype?: string;

  /** RSI commitment level (e.g. "Casual", "Regular", "Hardcore") */
  @Column({ type: 'varchar', length: 50, nullable: true })
  rsiCommitment?: string;

  /** RSI roleplay preference (true = Yes, false = No, null = unknown) */
  @Column({ type: 'boolean', nullable: true })
  rsiRolePlay?: boolean;

  /** RSI exclusive membership (true = exclusive, false = non-exclusive, null = unknown) */
  @Column({ type: 'boolean', nullable: true })
  rsiExclusive?: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
