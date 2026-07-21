import type { SCStatsRawExport } from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { UserGameplayPreferences } from '../../models/UserGameplayPreferences';
import { logger } from '../../utils/logger';

/**
 * @deprecated Local alias — use SCStatsRawExport from @sc-fleet-manager/shared-types
 */
export type SCStatsData = SCStatsRawExport;

/**
 * SCStatsImportService
 *
 * Wave 2.5 — SCStats Integration (Phase 1)
 *
 * Handles importing, parsing, and validating SCStats JSON exports.
 * Auto-calibrates user skill ratings based on objective gameplay metrics.
 * Supports GDPR deletion of imported data.
 */
export class SCStatsImportService {
  private preferencesRepo: Repository<UserGameplayPreferences>;

  constructor() {
    this.preferencesRepo = AppDataSource.getRepository(UserGameplayPreferences);
  }

  /**
   * Parse and validate SCStats JSON export
   */
  parseJSON(jsonData: string): SCStatsData {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonData) as Record<string, unknown>;
    } catch {
      throw new Error('Invalid JSON format');
    }

    // Validate required sections
    if (!data.metadata || !data.playtime || !data.combat || !data.missions || !data.vehicles) {
      throw new Error('Invalid SCStats JSON format: missing required sections');
    }

    const typed = data as unknown as SCStatsData;

    // Validate vehicles structure used by importData
    if (
      !typed.vehicles.favoriteByFlightTime ||
      typeof typed.vehicles.favoriteByFlightTime.name !== 'string' ||
      typeof typed.vehicles.favoriteByFlightTime.hours !== 'number'
    ) {
      throw new Error('Invalid SCStats JSON format: missing or invalid vehicles section');
    }

    // Validate suspicious values (anti-cheating)
    if (typed.combat.kd > 10.0) {
      logger.warn('Suspicious K/D ratio detected', { kd: typed.combat.kd });
    }
    if (typed.playtime.totalHours > 10000) {
      logger.warn('Suspicious total hours detected', { hours: typed.playtime.totalHours });
    }

    return typed;
  }

  /**
   * Import SCStats data for a user
   */
  async importData(
    userId: string,
    jsonData: string,
    consentGranted: boolean
  ): Promise<UserGameplayPreferences> {
    if (!consentGranted) {
      throw new Error('User consent required to import SCStats data');
    }

    const scstatsData = this.parseJSON(jsonData);

    // Get or create user preferences
    let preferences = await this.preferencesRepo.findOne({ where: { userId } });
    preferences ??= this.preferencesRepo.create({ userId });

    // Auto-calibrate skill ratings from SCStats data
    preferences.combatSkill = this.calibrateCombatSkill(scstatsData.combat.kd);
    preferences.pilotingSkill = this.calibratePilotingSkill(
      scstatsData.vehicles.favoriteByFlightTime.hours
    );
    preferences.tradingSkill ??= 50; // Keep existing if no trading data
    preferences.miningSkill = this.calibrateMiningSkill(scstatsData.missions.byType['Mining'] || 0);

    // Store raw JSON (encrypted via entity transformer)
    preferences.scstatsRawData = JSON.stringify(scstatsData);
    preferences.scstatsLastImport = new Date();
    preferences.scstatsVerified = true;
    preferences.scstatsTotalHours = scstatsData.playtime.totalHours;
    preferences.scstatsKdRatio = scstatsData.combat.kd;
    preferences.scstatsMissionsCompleted = scstatsData.missions.totalCompleted;
    preferences.scstatsFavoriteVehicle = scstatsData.vehicles.favoriteByFlightTime.name;
    preferences.scstatsImportCount = (preferences.scstatsImportCount || 0) + 1;
    preferences.scstatsConsentGranted = true;
    preferences.scstatsConsentDate = new Date();

    await this.preferencesRepo.save(preferences);

    logger.info('SCStats data imported successfully', {
      userId,
      totalHours: scstatsData.playtime.totalHours,
    });

    return preferences;
  }

  /**
   * Get SCStats data for a user
   */
  async getData(userId: string): Promise<{
    hasData: boolean;
    lastImport: Date | null;
    totalImports: number;
    consentGranted: boolean;
    metrics: {
      totalHours: number | null;
      kdRatio: number | null;
      missionsCompleted: number | null;
      favoriteVehicle: string | null;
    } | null;
    isStale: boolean;
  }> {
    const preferences = await this.preferencesRepo.findOne({ where: { userId } });

    if (!preferences?.scstatsVerified) {
      return {
        hasData: false,
        lastImport: null,
        totalImports: 0,
        consentGranted: false,
        metrics: null,
        isStale: false,
      };
    }

    const isStale = preferences.scstatsLastImport
      ? (Date.now() - preferences.scstatsLastImport.getTime()) / (1000 * 60 * 60 * 24) > 30
      : false;

    return {
      hasData: true,
      lastImport: preferences.scstatsLastImport,
      totalImports: preferences.scstatsImportCount,
      consentGranted: preferences.scstatsConsentGranted,
      metrics: {
        // NOTE: TypeORM returns PostgreSQL `decimal` columns as strings.
        // Convert to numbers to satisfy the SCStatsMetrics type contract.
        totalHours:
          preferences.scstatsTotalHours !== null ? Number(preferences.scstatsTotalHours) : null,
        kdRatio: preferences.scstatsKdRatio !== null ? Number(preferences.scstatsKdRatio) : null,
        missionsCompleted: preferences.scstatsMissionsCompleted,
        favoriteVehicle: preferences.scstatsFavoriteVehicle,
      },
      isStale,
    };
  }

  /**
   * Delete SCStats data (GDPR compliance)
   */
  async deleteData(userId: string): Promise<void> {
    const preferences = await this.preferencesRepo.findOne({ where: { userId } });
    if (!preferences) {
      return;
    }

    preferences.scstatsRawData = null;
    preferences.scstatsLastImport = null;
    preferences.scstatsVerified = false;
    preferences.scstatsTotalHours = null;
    preferences.scstatsKdRatio = null;
    preferences.scstatsMissionsCompleted = null;
    preferences.scstatsFavoriteVehicle = null;
    preferences.scstatsConsentGranted = false;
    preferences.scstatsConsentDate = null;

    await this.preferencesRepo.save(preferences);

    logger.info('SCStats data deleted', { userId });
  }

  /**
   * Calibrate combat skill from K/D ratio (0-100 scale)
   */
  calibrateCombatSkill(kd: number): number {
    if (kd >= 3.0) {
      return Math.min(90 + (kd - 3.0) * 2, 100);
    }
    if (kd >= 2.0) {
      return 75 + (kd - 2.0) * 15;
    }
    if (kd >= 1.5) {
      return 60 + (kd - 1.5) * 30;
    }
    if (kd >= 1.0) {
      return 45 + (kd - 1.0) * 30;
    }
    return 30 + kd * 15;
  }

  /**
   * Calibrate piloting skill from flight hours (0-100 scale)
   */
  calibratePilotingSkill(hours: number): number {
    if (hours >= 200) {
      return 95;
    }
    if (hours >= 100) {
      return 80 + (hours - 100) * 0.15;
    }
    if (hours >= 50) {
      return 65 + (hours - 50) * 0.3;
    }
    if (hours >= 20) {
      return 45 + (hours - 20) * 0.67;
    }
    return 30 + hours * 0.75;
  }

  /**
   * Calibrate mining skill from mission count (0-100 scale)
   */
  calibrateMiningSkill(miningMissions: number): number {
    if (miningMissions >= 200) {
      return 95;
    }
    if (miningMissions >= 100) {
      return 80 + (miningMissions - 100) * 0.15;
    }
    if (miningMissions >= 50) {
      return 65 + (miningMissions - 50) * 0.3;
    }
    if (miningMissions >= 20) {
      return 45 + (miningMissions - 20) * 0.67;
    }
    return 30 + miningMissions * 0.75;
  }
}

