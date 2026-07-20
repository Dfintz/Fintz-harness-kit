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
exports.HunterProfile = exports.HunterRank = void 0;
const typeorm_1 = require("typeorm");
var HunterRank;
(function (HunterRank) {
    HunterRank["ROOKIE"] = "rookie";
    HunterRank["APPRENTICE"] = "apprentice";
    HunterRank["HUNTER"] = "hunter";
    HunterRank["VETERAN"] = "veteran";
    HunterRank["ELITE"] = "elite";
    HunterRank["LEGENDARY"] = "legendary";
})(HunterRank || (exports.HunterRank = HunterRank = {}));
let HunterProfile = class HunterProfile {
    id;
    userId;
    userName;
    organizationId;
    totalBountiesCompleted;
    totalBountiesClaimed;
    totalBountiesAbandoned;
    totalBountiesRejected;
    totalRewardsEarned;
    successRate;
    averageCompletionTimeMinutes;
    rank;
    reputationScore;
    killBountiesCompleted;
    captureBountiesCompleted;
    intelBountiesCompleted;
    transportBountiesCompleted;
    rescueBountiesCompleted;
    customBountiesCompleted;
    lastBountyCompletedAt;
    currentStreak;
    longestStreak;
    createdAt;
    updatedAt;
    get isActive() {
        if (!this.lastBountyCompletedAt) {
            return false;
        }
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return this.lastBountyCompletedAt > thirtyDaysAgo;
    }
    get primarySpecialization() {
        const specializations = [
            { type: 'kill', count: this.killBountiesCompleted },
            { type: 'capture', count: this.captureBountiesCompleted },
            { type: 'intel', count: this.intelBountiesCompleted },
            { type: 'transport', count: this.transportBountiesCompleted },
            { type: 'rescue', count: this.rescueBountiesCompleted },
            { type: 'custom', count: this.customBountiesCompleted }
        ];
        const maxSpec = specializations.reduce((max, spec) => spec.count > max.count ? spec : max, { type: 'none', count: 0 });
        return maxSpec.count > 0 ? maxSpec.type : 'generalist';
    }
};
exports.HunterProfile = HunterProfile;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], HunterProfile.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], HunterProfile.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], HunterProfile.prototype, "userName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], HunterProfile.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "totalBountiesCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "totalBountiesClaimed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "totalBountiesAbandoned", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "totalBountiesRejected", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "totalRewardsEarned", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "successRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "averageCompletionTimeMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        default: HunterRank.ROOKIE
    }),
    __metadata("design:type", String)
], HunterProfile.prototype, "rank", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "reputationScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "killBountiesCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "captureBountiesCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "intelBountiesCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "transportBountiesCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "rescueBountiesCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "customBountiesCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], HunterProfile.prototype, "lastBountyCompletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "currentStreak", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], HunterProfile.prototype, "longestStreak", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], HunterProfile.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], HunterProfile.prototype, "updatedAt", void 0);
exports.HunterProfile = HunterProfile = __decorate([
    (0, typeorm_1.Entity)('hunter_profiles'),
    (0, typeorm_1.Index)(['userId', 'organizationId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId', 'totalBountiesCompleted']),
    (0, typeorm_1.Index)(['organizationId', 'totalRewardsEarned']),
    (0, typeorm_1.Index)(['organizationId', 'reputationScore'])
], HunterProfile);
//# sourceMappingURL=HunterProfile.js.map