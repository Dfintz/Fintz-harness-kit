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
exports.LFGUserReputation = void 0;
const typeorm_1 = require("typeorm");
let LFGUserReputation = class LFGUserReputation {
    id;
    userId;
    totalSessions;
    successfulSessions;
    failedSessions;
    successRate;
    totalRatingsReceived;
    averageRating;
    positiveRatings;
    negativeRatings;
    categoryAverages;
    activityStats;
    overallScore;
    sessionsAsLeader;
    successfulLeaderSessions;
    leadershipSuccessRate;
    currentSuccessStreak;
    longestSuccessStreak;
    lastSessionAt;
    createdAt;
    updatedAt;
    calculateOverallScore() {
        let score = 50;
        score += (this.successRate / 100) * 30;
        if (this.averageRating > 0) {
            score += ((this.averageRating - 1) / 4) * 25;
        }
        if (this.totalRatingsReceived > 0) {
            const positiveRatio = this.positiveRatings / this.totalRatingsReceived;
            score += positiveRatio * 15;
        }
        if (this.sessionsAsLeader > 0) {
            score += (this.leadershipSuccessRate / 100) * 10;
        }
        if (this.currentSuccessStreak > 0) {
            const streakBonus = Math.min(this.currentSuccessStreak / 10, 1) * 10;
            score += streakBonus;
        }
        if (this.totalSessions > 0) {
            const experienceBonus = Math.min(this.totalSessions / 100, 1) * 10;
            score += experienceBonus;
        }
        return Math.round(Math.max(0, Math.min(100, score)));
    }
    getReputationTier() {
        const score = this.overallScore;
        if (score >= 90) {
            return { tier: 'Legendary', icon: '🏆', minScore: 90 };
        }
        if (score >= 80) {
            return { tier: 'Elite', icon: '⭐', minScore: 80 };
        }
        if (score >= 70) {
            return { tier: 'Veteran', icon: '🎖️', minScore: 70 };
        }
        if (score >= 60) {
            return { tier: 'Experienced', icon: '🎯', minScore: 60 };
        }
        if (score >= 50) {
            return { tier: 'Reliable', icon: '✅', minScore: 50 };
        }
        if (score >= 40) {
            return { tier: 'Average', icon: '⚪', minScore: 40 };
        }
        if (score >= 30) {
            return { tier: 'Developing', icon: '🔵', minScore: 30 };
        }
        return { tier: 'Rookie', icon: '🆕', minScore: 0 };
    }
    getSummary() {
        const tier = this.getReputationTier();
        return {
            userId: this.userId,
            score: this.overallScore,
            tier: `${tier.icon} ${tier.tier}`,
            sessions: this.totalSessions,
            successRate: this.successRate,
            averageRating: this.averageRating,
            streak: this.currentSuccessStreak,
        };
    }
    isExperienced() {
        return this.totalSessions >= 10;
    }
    isHighlyRated() {
        return this.averageRating >= 4.0 && this.totalRatingsReceived >= 5;
    }
    isSuccessfulLeader() {
        return this.sessionsAsLeader >= 5 && this.leadershipSuccessRate >= 70;
    }
};
exports.LFGUserReputation = LFGUserReputation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LFGUserReputation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], LFGUserReputation.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "totalSessions", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "successfulSessions", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "failedSessions", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "successRate", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "totalRatingsReceived", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 3, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "averageRating", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "positiveRatings", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "negativeRatings", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], LFGUserReputation.prototype, "categoryAverages", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], LFGUserReputation.prototype, "activityStats", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, default: 50 }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "overallScore", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "sessionsAsLeader", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "successfulLeaderSessions", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "leadershipSuccessRate", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "currentSuccessStreak", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], LFGUserReputation.prototype, "longestSuccessStreak", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], LFGUserReputation.prototype, "lastSessionAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], LFGUserReputation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], LFGUserReputation.prototype, "updatedAt", void 0);
exports.LFGUserReputation = LFGUserReputation = __decorate([
    (0, typeorm_1.Entity)('lfg_user_reputation')
], LFGUserReputation);
//# sourceMappingURL=LFGUserReputation.js.map