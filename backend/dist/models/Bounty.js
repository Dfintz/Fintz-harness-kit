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
exports.Bounty = exports.BountyDifficulty = exports.BountyVisibility = exports.BountyStatus = exports.BountyRewardType = exports.BountyTargetType = exports.BountyType = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var BountyType;
(function (BountyType) {
    BountyType["KILL"] = "kill";
    BountyType["CAPTURE"] = "capture";
    BountyType["INTEL"] = "intel";
    BountyType["TRANSPORT"] = "transport";
    BountyType["RESCUE"] = "rescue";
    BountyType["CUSTOM"] = "custom";
})(BountyType || (exports.BountyType = BountyType = {}));
var BountyTargetType;
(function (BountyTargetType) {
    BountyTargetType["PLAYER"] = "player";
    BountyTargetType["NPC"] = "npc";
    BountyTargetType["SHIP"] = "ship";
    BountyTargetType["LOCATION"] = "location";
    BountyTargetType["ITEM"] = "item";
    BountyTargetType["OTHER"] = "other";
})(BountyTargetType || (exports.BountyTargetType = BountyTargetType = {}));
var BountyRewardType;
(function (BountyRewardType) {
    BountyRewardType["CREDITS"] = "credits";
    BountyRewardType["ITEM"] = "item";
    BountyRewardType["REPUTATION"] = "reputation";
    BountyRewardType["MIXED"] = "mixed";
    BountyRewardType["OTHER"] = "other";
})(BountyRewardType || (exports.BountyRewardType = BountyRewardType = {}));
var BountyStatus;
(function (BountyStatus) {
    BountyStatus["ACTIVE"] = "active";
    BountyStatus["CLAIMED"] = "claimed";
    BountyStatus["IN_PROGRESS"] = "in_progress";
    BountyStatus["COMPLETED"] = "completed";
    BountyStatus["VERIFIED"] = "verified";
    BountyStatus["PAID"] = "paid";
    BountyStatus["CANCELLED"] = "cancelled";
    BountyStatus["EXPIRED"] = "expired";
})(BountyStatus || (exports.BountyStatus = BountyStatus = {}));
var BountyVisibility;
(function (BountyVisibility) {
    BountyVisibility["PUBLIC"] = "public";
    BountyVisibility["ORGANIZATION"] = "organization";
    BountyVisibility["ALLIANCE"] = "alliance";
    BountyVisibility["PRIVATE"] = "private";
})(BountyVisibility || (exports.BountyVisibility = BountyVisibility = {}));
var BountyDifficulty;
(function (BountyDifficulty) {
    BountyDifficulty["EASY"] = "easy";
    BountyDifficulty["MEDIUM"] = "medium";
    BountyDifficulty["HARD"] = "hard";
    BountyDifficulty["EXPERT"] = "expert";
})(BountyDifficulty || (exports.BountyDifficulty = BountyDifficulty = {}));
let Bounty = class Bounty extends TenantEntity_1.TenantEntity {
    id;
    createdBy;
    createdByName;
    title;
    description;
    bountyType;
    targetType;
    targetIdentifier;
    targetName;
    targetDetails;
    rewardType;
    rewardAmount;
    rewardDescription;
    status;
    difficulty;
    location;
    systemLocation;
    claimedBy;
    claimedByName;
    claimedAt;
    completedAt;
    verifiedBy;
    verifiedAt;
    paidAt;
    expiresAt;
    visibility;
    tags;
    metadata;
    linkedActivityId;
    createdAt;
    updatedAt;
    version;
    get isActive() {
        return this.status === BountyStatus.ACTIVE;
    }
    get isClaimed() {
        return this.status === BountyStatus.CLAIMED || this.status === BountyStatus.IN_PROGRESS;
    }
    get isCompleted() {
        return (this.status === BountyStatus.COMPLETED ||
            this.status === BountyStatus.VERIFIED ||
            this.status === BountyStatus.PAID);
    }
    get isExpired() {
        if (!this.expiresAt) {
            return false;
        }
        return new Date() > this.expiresAt;
    }
    get canBeClaimed() {
        return this.status === BountyStatus.ACTIVE && !this.isExpired;
    }
    get hasReward() {
        return ((this.rewardAmount !== undefined && this.rewardAmount > 0) ||
            (this.rewardDescription !== undefined && this.rewardDescription.length > 0));
    }
};
exports.Bounty = Bounty;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Bounty.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], Bounty.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], Bounty.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
    }),
    __metadata("design:type", String)
], Bounty.prototype, "bountyType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
    }),
    __metadata("design:type", String)
], Bounty.prototype, "targetType", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "targetIdentifier", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "targetName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Bounty.prototype, "targetDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
    }),
    __metadata("design:type", String)
], Bounty.prototype, "rewardType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], Bounty.prototype, "rewardAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "rewardDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: BountyStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], Bounty.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        nullable: true,
    }),
    __metadata("design:type", String)
], Bounty.prototype, "difficulty", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200, nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "systemLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "claimedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "claimedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Bounty.prototype, "claimedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Bounty.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "verifiedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Bounty.prototype, "verifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Bounty.prototype, "paidAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Bounty.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: BountyVisibility.ORGANIZATION,
    }),
    __metadata("design:type", String)
], Bounty.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Bounty.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Bounty.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Bounty.prototype, "linkedActivityId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Bounty.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Bounty.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], Bounty.prototype, "version", void 0);
exports.Bounty = Bounty = __decorate([
    (0, typeorm_1.Entity)('bounties'),
    (0, typeorm_1.Index)(['bountyType', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'createdAt']),
    (0, typeorm_1.Index)(['claimedBy']),
    (0, typeorm_1.Index)(['expiresAt'])
], Bounty);
//# sourceMappingURL=Bounty.js.map