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
exports.TradeUserReputation = void 0;
const typeorm_1 = require("typeorm");
let TradeUserReputation = class TradeUserReputation {
    id;
    userId;
    totalRuns;
    successfulRuns;
    failedRuns;
    abortedRuns;
    successRate;
    totalProfitGenerated;
    avgProfitPerRun;
    avgEstimateAccuracy;
    profitConsistency;
    routeStats;
    currentSuccessStreak;
    longestSuccessStreak;
    overallScore;
    lastRunAt;
    createdAt;
    updatedAt;
    calculateOverallScore() {
        const successComponent = (Number(this.successRate) / 100) * 30;
        const efficiencyComponent = (Number(this.avgEstimateAccuracy) / 100) * 25;
        const consistencyComponent = (Number(this.profitConsistency) / 100) * 25;
        const accuracyComponent = (Number(this.avgEstimateAccuracy) / 100) * 10;
        const experienceComponent = Math.min(this.totalRuns / 100, 1) * 10;
        const score = successComponent +
            efficiencyComponent +
            consistencyComponent +
            accuracyComponent +
            experienceComponent;
        return Math.round(Math.max(0, Math.min(100, score)));
    }
    getReputationTier() {
        const score = Number(this.overallScore);
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
            score: Number(this.overallScore),
            tier: `${tier.icon} ${tier.tier}`,
            runs: this.totalRuns,
            successRate: Number(this.successRate),
            avgProfit: Number(this.avgProfitPerRun),
            streak: this.currentSuccessStreak,
        };
    }
    isExperienced() {
        return this.totalRuns >= 10;
    }
    isHighPerformer() {
        return Number(this.successRate) >= 80 && this.totalRuns >= 5;
    }
};
exports.TradeUserReputation = TradeUserReputation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TradeUserReputation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], TradeUserReputation.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "totalRuns", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "successfulRuns", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "failedRuns", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "abortedRuns", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "successRate", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "totalProfitGenerated", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "avgProfitPerRun", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "avgEstimateAccuracy", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, default: 50 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "profitConsistency", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], TradeUserReputation.prototype, "routeStats", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "currentSuccessStreak", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "longestSuccessStreak", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2, default: 50 }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Number)
], TradeUserReputation.prototype, "overallScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], TradeUserReputation.prototype, "lastRunAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TradeUserReputation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], TradeUserReputation.prototype, "updatedAt", void 0);
exports.TradeUserReputation = TradeUserReputation = __decorate([
    (0, typeorm_1.Entity)('trade_user_reputation')
], TradeUserReputation);
//# sourceMappingURL=TradeUserReputation.js.map