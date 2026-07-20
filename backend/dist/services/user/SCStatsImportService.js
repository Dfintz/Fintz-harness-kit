"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCStatsImportService = void 0;
const data_source_1 = require("../../data-source");
const UserGameplayPreferences_1 = require("../../models/UserGameplayPreferences");
const logger_1 = require("../../utils/logger");
class SCStatsImportService {
    preferencesRepo;
    constructor() {
        this.preferencesRepo = data_source_1.AppDataSource.getRepository(UserGameplayPreferences_1.UserGameplayPreferences);
    }
    parseJSON(jsonData) {
        let data;
        try {
            data = JSON.parse(jsonData);
        }
        catch {
            throw new Error('Invalid JSON format');
        }
        if (!data.metadata || !data.playtime || !data.combat || !data.missions || !data.vehicles) {
            throw new Error('Invalid SCStats JSON format: missing required sections');
        }
        const typed = data;
        if (!typed.vehicles.favoriteByFlightTime ||
            typeof typed.vehicles.favoriteByFlightTime.name !== 'string' ||
            typeof typed.vehicles.favoriteByFlightTime.hours !== 'number') {
            throw new Error('Invalid SCStats JSON format: missing or invalid vehicles section');
        }
        if (typed.combat.kd > 10.0) {
            logger_1.logger.warn('Suspicious K/D ratio detected', { kd: typed.combat.kd });
        }
        if (typed.playtime.totalHours > 10000) {
            logger_1.logger.warn('Suspicious total hours detected', { hours: typed.playtime.totalHours });
        }
        return typed;
    }
    async importData(userId, jsonData, consentGranted) {
        if (!consentGranted) {
            throw new Error('User consent required to import SCStats data');
        }
        const scstatsData = this.parseJSON(jsonData);
        let preferences = await this.preferencesRepo.findOne({ where: { userId } });
        preferences ??= this.preferencesRepo.create({ userId });
        preferences.combatSkill = this.calibrateCombatSkill(scstatsData.combat.kd);
        preferences.pilotingSkill = this.calibratePilotingSkill(scstatsData.vehicles.favoriteByFlightTime.hours);
        preferences.tradingSkill ??= 50;
        preferences.miningSkill = this.calibrateMiningSkill(scstatsData.missions.byType['Mining'] || 0);
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
        logger_1.logger.info('SCStats data imported successfully', {
            userId,
            totalHours: scstatsData.playtime.totalHours,
        });
        return preferences;
    }
    async getData(userId) {
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
                totalHours: preferences.scstatsTotalHours !== null ? Number(preferences.scstatsTotalHours) : null,
                kdRatio: preferences.scstatsKdRatio !== null ? Number(preferences.scstatsKdRatio) : null,
                missionsCompleted: preferences.scstatsMissionsCompleted,
                favoriteVehicle: preferences.scstatsFavoriteVehicle,
            },
            isStale,
        };
    }
    async deleteData(userId) {
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
        logger_1.logger.info('SCStats data deleted', { userId });
    }
    calibrateCombatSkill(kd) {
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
    calibratePilotingSkill(hours) {
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
    calibrateMiningSkill(miningMissions) {
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
exports.SCStatsImportService = SCStatsImportService;
//# sourceMappingURL=SCStatsImportService.js.map