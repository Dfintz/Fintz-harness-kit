import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { encryptionTransformer } from '../utils/encryptionTransformer';

/**
 * Experience level for different activity types
 */
export enum ExperienceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

/**
 * Playstyle preferences
 */
export enum Playstyle {
  CASUAL = 'casual',
  HARDCORE = 'hardcore',
  COMPETITIVE = 'competitive',
  ROLEPLAY = 'roleplay',
  SOCIAL = 'social',
}

/**
 * Availability preferences
 */
export enum Availability {
  WEEKDAYS_MORNING = 'weekdays_morning',
  WEEKDAYS_AFTERNOON = 'weekdays_afternoon',
  WEEKDAYS_EVENING = 'weekdays_evening',
  WEEKDAYS_NIGHT = 'weekdays_night',
  WEEKENDS_MORNING = 'weekends_morning',
  WEEKENDS_AFTERNOON = 'weekends_afternoon',
  WEEKENDS_EVENING = 'weekends_evening',
  WEEKENDS_NIGHT = 'weekends_night',
}

/**
 * User's gameplay preferences for matchmaking
 */
@Entity('user_gameplay_preferences')
@Index(['userId'], { unique: true })
export class UserGameplayPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  // Activity Preferences (JSON array of preferred activities with weights)
  @Column('simple-json')
  activityPreferences: {
    [activity: string]: number; // activity name -> preference weight (0-100)
  };

  // Experience levels for different activities
  @Column('simple-json', { nullable: true })
  experienceLevels?: {
    [activity: string]: ExperienceLevel;
  };

  // General playstyle preferences
  @Column('simple-array')
  playstyles: Playstyle[];

  // Preferred group size
  @Column('int', { default: 4 })
  preferredGroupSizeMin: number;

  @Column('int', { default: 8 })
  preferredGroupSizeMax: number;

  // Communication preferences
  @Column({ default: false })
  requiresVoiceChat: boolean;

  @Column({ default: false })
  prefersSilentPlay: boolean;

  // Timezone and availability
  @Column({ nullable: true })
  timezone?: string; // e.g., "America/New_York"

  @Column('simple-array', { nullable: true })
  availability?: Availability[];

  // Role preferences (from EventRole enum)
  @Column('simple-array', { nullable: true })
  preferredRoles?: string[];

  // Languages
  @Column('simple-array', { default: () => "'english'" })
  languages: string[];

  // Skill level indicators (0-100 scale)
  @Column('int', { default: 50 })
  combatSkill: number;

  @Column('int', { default: 50 })
  pilotingSkill: number;

  @Column('int', { default: 50 })
  tradingSkill: number;

  @Column('int', { default: 50 })
  miningSkill: number;

  // Matchmaking preferences
  @Column({ default: true })
  allowCrossOrgMatching: boolean;

  @Column({ default: false })
  onlyMatchWithVerified: boolean;

  @Column({ default: 50 })
  minReputationScore: number; // Minimum reputation score for matches (0-100)

  // Anti-abuse: Track preference updates to prevent gaming the system
  @Column('int', { default: 0 })
  preferenceUpdateCount: number;

  @Column({ nullable: true })
  lastPreferenceUpdate?: Date;

  // SCStats Integration (Wave 2.5)
  @Column({ name: 'scstats_raw_data', type: 'text', nullable: true, transformer: encryptionTransformer })
  scstatsRawData: string | null;

  @Column({ name: 'scstats_last_import', type: 'timestamp', nullable: true })
  scstatsLastImport: Date | null;

  @Column({ name: 'scstats_verified', default: false })
  scstatsVerified: boolean;

  @Column({ name: 'scstats_total_hours', type: 'decimal', precision: 10, scale: 2, nullable: true })
  scstatsTotalHours: number | null;

  @Column({ name: 'scstats_kd_ratio', type: 'decimal', precision: 10, scale: 2, nullable: true })
  scstatsKdRatio: number | null;

  @Column({ name: 'scstats_missions_completed', type: 'int', nullable: true })
  scstatsMissionsCompleted: number | null;

  @Column({ name: 'scstats_favorite_vehicle', type: 'varchar', length: 255, nullable: true })
  scstatsFavoriteVehicle: string | null;

  @Column({ name: 'scstats_import_count', type: 'int', default: 0 })
  scstatsImportCount: number;

  @Column({ name: 'scstats_consent_granted', default: false })
  scstatsConsentGranted: boolean;

  @Column({ name: 'scstats_consent_date', type: 'timestamp', nullable: true })
  scstatsConsentDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Validate preference update rate (anti-abuse)
   * Returns true if update is allowed
   */
  canUpdatePreferences(): boolean {
    if (!this.lastPreferenceUpdate) {
      return true;
    }

    // Allow max 1 update per hour
    const hoursSinceUpdate = (Date.now() - this.lastPreferenceUpdate.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate >= 1;
  }

  /**
   * Record preference update
   */
  recordUpdate(): void {
    this.preferenceUpdateCount += 1;
    this.lastPreferenceUpdate = new Date();
  }

  /**
   * Get activity preference weight (0-100)
   */
  getActivityPreference(activity: string): number {
    return this.activityPreferences[activity] || 0;
  }

  /**
   * Get experience level for activity
   */
  getExperienceLevel(activity: string): ExperienceLevel {
    return this.experienceLevels?.[activity] || ExperienceLevel.BEGINNER;
  }

  /**
   * Check if user prefers this playstyle
   */
  hasPlaystyle(playstyle: Playstyle): boolean {
    return this.playstyles.includes(playstyle);
  }

  /**
   * Check timezone compatibility (within 3 hours)
   *
   * Note: This is a simplified implementation. In production, use a proper
   * timezone library like 'dayjs' with timezone plugin or 'date-fns-tz'
   * to calculate actual UTC offsets for accurate matching.
   */
  isTimezoneCompatible(otherTimezone: string | undefined): boolean {
    if (!this.timezone || !otherTimezone) {
      return true; // No restriction if either is undefined
    }

    // Simplified check - exact string match
    // TODO: Use proper timezone library to compare UTC offsets
    return this.timezone === otherTimezone;
  }

  /**
   * Get overall skill level (average of all skills)
   */
  getOverallSkillLevel(): number {
    return Math.round(
      (this.combatSkill + this.pilotingSkill + this.tradingSkill + this.miningSkill) / 4
    );
  }

  /**
   * Get preferences summary for display
   */
  getSummary(): {
    topActivities: string[];
    playstyles: string[];
    skillLevel: number;
    languages: string[];
  } {
    // Get top 3 activities by preference weight
    const topActivities = Object.entries(this.activityPreferences)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([activity]) => activity);

    return {
      topActivities,
      playstyles: this.playstyles,
      skillLevel: this.getOverallSkillLevel(),
      languages: this.languages,
    };
  }
}
