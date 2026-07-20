"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGameplayPreferences = exports.Availability = exports.Playstyle = exports.ExperienceLevel = void 0;
const typeorm_1 = require("typeorm");
const encryptionTransformer_1 = require("../utils/encryptionTransformer");
var ExperienceLevel;
(function (ExperienceLevel) {
    ExperienceLevel["BEGINNER"] = "beginner";
    ExperienceLevel["INTERMEDIATE"] = "intermediate";
    ExperienceLevel["ADVANCED"] = "advanced";
    ExperienceLevel["EXPERT"] = "expert";
})(ExperienceLevel || (exports.ExperienceLevel = ExperienceLevel = {}));
var Playstyle;
(function (Playstyle) {
    Playstyle["CASUAL"] = "casual";
    Playstyle["HARDCORE"] = "hardcore";
    Playstyle["COMPETITIVE"] = "competitive";
    Playstyle["ROLEPLAY"] = "roleplay";
    Playstyle["SOCIAL"] = "social";
})(Playstyle || (exports.Playstyle = Playstyle = {}));
var Availability;
(function (Availability) {
    Availability["WEEKDAYS_MORNING"] = "weekdays_morning";
    Availability["WEEKDAYS_AFTERNOON"] = "weekdays_afternoon";
    Availability["WEEKDAYS_EVENING"] = "weekdays_evening";
    Availability["WEEKDAYS_NIGHT"] = "weekdays_night";
    Availability["WEEKENDS_MORNING"] = "weekends_morning";
    Availability["WEEKENDS_AFTERNOON"] = "weekends_afternoon";
    Availability["WEEKENDS_EVENING"] = "weekends_evening";
    Availability["WEEKENDS_NIGHT"] = "weekends_night";
})(Availability || (exports.Availability = Availability = {}));
let UserGameplayPreferences = class UserGameplayPreferences {
    id;
    userId;
    activityPreferences;
    experienceLevels;
    playstyles;
    preferredGroupSizeMin;
    preferredGroupSizeMax;
    requiresVoiceChat;
    prefersSilentPlay;
    timezone;
    availability;
    preferredRoles;
    languages;
    combatSkill;
    pilotingSkill;
    tradingSkill;
    miningSkill;
    allowCrossOrgMatching;
    onlyMatchWithVerified;
    minReputationScore;
    preferenceUpdateCount;
    lastPreferenceUpdate;
    scstatsRawData;
    scstatsLastImport;
    scstatsVerified;
    scstatsTotalHours;
    scstatsKdRatio;
    scstatsMissionsCompleted;
    scstatsFavoriteVehicle;
    scstatsImportCount;
    scstatsConsentGranted;
    scstatsConsentDate;
    createdAt;
    updatedAt;
    canUpdatePreferences() {
        if (!this.lastPreferenceUpdate) {
            return true;
        }
        const hoursSinceUpdate = (Date.now() - this.lastPreferenceUpdate.getTime()) / (1000 * 60 * 60);
        return hoursSinceUpdate >= 1;
    }
    recordUpdate() {
        this.preferenceUpdateCount += 1;
        this.lastPreferenceUpdate = new Date();
    }
    getActivityPreference(activity) {
        return this.activityPreferences[activity] || 0;
    }
    getExperienceLevel(activity) {
        return this.experienceLevels?.[activity] || ExperienceLevel.BEGINNER;
    }
    hasPlaystyle(playstyle) {
        return this.playstyles.includes(playstyle);
    }
    isTimezoneCompatible(otherTimezone) {
        if (!this.timezone || !otherTimezone) {
            return true;
        }
        return this.timezone === otherTimezone;
    }
    getOverallSkillLevel() {
        return Math.round((this.combatSkill + this.pilotingSkill + this.tradingSkill + this.miningSkill) / 4);
    }
    getSummary() {
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
};
exports.UserGameplayPreferences = UserGameplayPreferences;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserGameplayPreferences.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserGameplayPreferences.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], UserGameplayPreferences.prototype, "activityPreferences", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], UserGameplayPreferences.prototype, "experienceLevels", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], UserGameplayPreferences.prototype, "playstyles", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 4 }),
    __metadata("design:type", Number)
], UserGameplayPreferences.prototype, "preferredGroupSizeMin", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 8 }),
    __metadata("design:type", Number)
], UserGameplayPreferences.prototype, "preferredGroupSizeMax", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], UserGameplayPreferences.prototype, "requiresVoiceChat", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], UserGameplayPreferences.prototype, "prefersSilentPlay", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserGameplayPreferences.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], UserGameplayPreferences.prototype, "availability", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], UserGameplayPreferences.prototype, "preferredRoles", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: () => "'english'" }),
    __metadata("design:type", Array)
], UserGameplayPreferences.prototype, "languages", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 50 }),
    __metadata("design:type", Number)
], UserGameplayPreferences.prototype, "combatSkill", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 50 }),
    __metadata("design:type", Number)
], UserGameplayPreferences.prototype, "pilotingSkill", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 50 }),
    __metadata("design:type", Number)
], UserGameplayPreferences.prototype, "tradingSkill", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 50 }),
    __metadata("design:type", Number)
], UserGameplayPreferences.prototype, "miningSkill", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], UserGameplayPreferences.prototype, "allowCrossOrgMatching", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], UserGameplayPreferences.prototype, "onlyMatchWithVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 50 }),
    __metadata("design:type", Number)
], UserGameplayPreferences.prototype, "minReputationScore", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], UserGameplayPreferences.prototype, "preferenceUpdateCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], UserGameplayPreferences.prototype, "lastPreferenceUpdate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_raw_data', type: 'text', nullable: true, transformer: encryptionTransformer_1.encryptionTransformer }),
    __metadata("design:type", Object)
], UserGameplayPreferences.prototype, "scstatsRawData", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_last_import', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], UserGameplayPreferences.prototype, "scstatsLastImport", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_verified', default: false }),
    __metadata("design:type", Boolean)
], UserGameplayPreferences.prototype, "scstatsVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_total_hours', type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], UserGameplayPreferences.prototype, "scstatsTotalHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_kd_ratio', type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], UserGameplayPreferences.prototype, "scstatsKdRatio", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_missions_completed', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], UserGameplayPreferences.prototype, "scstatsMissionsCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_favorite_vehicle', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], UserGameplayPreferences.prototype, "scstatsFavoriteVehicle", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_import_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], UserGameplayPreferences.prototype, "scstatsImportCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_consent_granted', default: false }),
    __metadata("design:type", Boolean)
], UserGameplayPreferences.prototype, "scstatsConsentGranted", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scstats_consent_date', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], UserGameplayPreferences.prototype, "scstatsConsentDate", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserGameplayPreferences.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserGameplayPreferences.prototype, "updatedAt", void 0);
exports.UserGameplayPreferences = UserGameplayPreferences = __decorate([
    (0, typeorm_1.Entity)('user_gameplay_preferences'),
    (0, typeorm_1.Index)(['userId'], { unique: true })
], UserGameplayPreferences);
//# sourceMappingURL=UserGameplayPreferences.js.map