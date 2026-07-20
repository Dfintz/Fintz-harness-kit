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
exports.RsiUserLink = exports.SyncStatus = exports.VerificationMethod = void 0;
const crypto_1 = require("crypto");
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var VerificationMethod;
(function (VerificationMethod) {
    VerificationMethod["MANUAL"] = "manual";
    VerificationMethod["BIO_CODE"] = "bio_code";
    VerificationMethod["DISCORD_MATCH"] = "discord_match";
})(VerificationMethod || (exports.VerificationMethod = VerificationMethod = {}));
var SyncStatus;
(function (SyncStatus) {
    SyncStatus["PENDING"] = "pending";
    SyncStatus["SYNCED"] = "synced";
    SyncStatus["FAILED"] = "failed";
    SyncStatus["REMOVED"] = "removed";
    SyncStatus["NEEDS_REVIEW"] = "needs_review";
})(SyncStatus || (exports.SyncStatus = SyncStatus = {}));
let RsiUserLink = class RsiUserLink {
    id;
    userId;
    user;
    organizationId;
    organization;
    rsiHandle;
    verificationMethod;
    verificationCode;
    verifiedAt;
    lastSyncedAt;
    syncStatus;
    discordUserId;
    lastKnownRank;
    isAffiliate;
    metadata;
    createdAt;
    updatedAt;
    isVerified() {
        return this.verifiedAt !== null && this.verifiedAt !== undefined;
    }
    isSynced() {
        return this.syncStatus === SyncStatus.SYNCED;
    }
    isPending() {
        return this.syncStatus === SyncStatus.PENDING;
    }
    isRemoved() {
        return this.syncStatus === SyncStatus.REMOVED;
    }
    hasFailed() {
        return this.syncStatus === SyncStatus.FAILED;
    }
    needsReview() {
        return this.syncStatus === SyncStatus.NEEDS_REVIEW;
    }
    hasDiscordId() {
        return !!this.discordUserId && this.discordUserId.length > 0;
    }
    markVerified() {
        this.verifiedAt = new Date();
    }
    markSynced(rank, isAffiliate) {
        this.syncStatus = SyncStatus.SYNCED;
        this.lastSyncedAt = new Date();
        if (rank !== undefined) {
            this.lastKnownRank = rank;
        }
        if (isAffiliate !== undefined) {
            this.isAffiliate = isAffiliate;
        }
    }
    markFailed(reason) {
        this.syncStatus = SyncStatus.FAILED;
        if (reason) {
            this.metadata = {
                ...this.metadata,
                lastFailureReason: reason,
                lastFailureAt: new Date().toISOString(),
            };
        }
    }
    markRemoved() {
        this.syncStatus = SyncStatus.REMOVED;
        this.metadata = {
            ...this.metadata,
            removedAt: new Date().toISOString(),
        };
    }
    markNeedsReview(reason) {
        this.syncStatus = SyncStatus.NEEDS_REVIEW;
        this.metadata = {
            ...this.metadata,
            reviewReason: reason ?? 'Unknown',
            reviewFlaggedAt: new Date().toISOString(),
        };
    }
    static generateVerificationCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = 'SCFM-';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt((0, crypto_1.randomInt)(chars.length));
        }
        return code;
    }
    getSummary() {
        return {
            rsiHandle: this.rsiHandle,
            isVerified: this.isVerified(),
            syncStatus: this.syncStatus,
            lastKnownRank: this.lastKnownRank ?? null,
            isAffiliate: this.isAffiliate,
            hasDiscordId: this.hasDiscordId(),
        };
    }
};
exports.RsiUserLink = RsiUserLink;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RsiUserLink.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], RsiUserLink.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { nullable: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], RsiUserLink.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], RsiUserLink.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: false, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], RsiUserLink.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], RsiUserLink.prototype, "rsiHandle", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
    }),
    __metadata("design:type", String)
], RsiUserLink.prototype, "verificationMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], RsiUserLink.prototype, "verificationCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RsiUserLink.prototype, "verifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], RsiUserLink.prototype, "lastSyncedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: SyncStatus.PENDING,
    }),
    __metadata("design:type", String)
], RsiUserLink.prototype, "syncStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], RsiUserLink.prototype, "discordUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], RsiUserLink.prototype, "lastKnownRank", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], RsiUserLink.prototype, "isAffiliate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], RsiUserLink.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiUserLink.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], RsiUserLink.prototype, "updatedAt", void 0);
exports.RsiUserLink = RsiUserLink = __decorate([
    (0, typeorm_1.Entity)('rsi_user_links'),
    (0, typeorm_1.Unique)('UQ_rsi_user_links_user_org', ['userId', 'organizationId']),
    (0, typeorm_1.Index)('IDX_rsi_user_links_user_id', ['userId']),
    (0, typeorm_1.Index)('IDX_rsi_user_links_org_id', ['organizationId']),
    (0, typeorm_1.Index)('IDX_rsi_user_links_rsi_handle', ['rsiHandle']),
    (0, typeorm_1.Index)('IDX_rsi_user_links_sync_status', ['syncStatus']),
    (0, typeorm_1.Index)('IDX_rsi_user_links_discord_user_id', ['discordUserId'])
], RsiUserLink);
//# sourceMappingURL=RsiUserLink.js.map