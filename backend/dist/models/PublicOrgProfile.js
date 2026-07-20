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
exports.PublicOrgProfile = exports.ActivityLevel = exports.OrgPrimaryFocus = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
var OrgPrimaryFocus;
(function (OrgPrimaryFocus) {
    OrgPrimaryFocus["COMBAT"] = "combat";
    OrgPrimaryFocus["MINING"] = "mining";
    OrgPrimaryFocus["TRADING"] = "trading";
    OrgPrimaryFocus["EXPLORATION"] = "exploration";
    OrgPrimaryFocus["BOUNTY_HUNTING"] = "bounty_hunting";
    OrgPrimaryFocus["MEDICAL"] = "medical";
    OrgPrimaryFocus["TRANSPORT"] = "transport";
    OrgPrimaryFocus["SALVAGE"] = "salvage";
    OrgPrimaryFocus["SECURITY"] = "security";
    OrgPrimaryFocus["SOCIAL"] = "social";
    OrgPrimaryFocus["PIRACY"] = "piracy";
    OrgPrimaryFocus["RACING"] = "racing";
    OrgPrimaryFocus["MIXED"] = "mixed";
})(OrgPrimaryFocus || (exports.OrgPrimaryFocus = OrgPrimaryFocus = {}));
var ActivityLevel;
(function (ActivityLevel) {
    ActivityLevel["INACTIVE"] = "inactive";
    ActivityLevel["LOW"] = "low";
    ActivityLevel["MODERATE"] = "moderate";
    ActivityLevel["HIGH"] = "high";
    ActivityLevel["VERY_HIGH"] = "very_high";
})(ActivityLevel || (exports.ActivityLevel = ActivityLevel = {}));
let PublicOrgProfile = class PublicOrgProfile {
    id;
    organizationId;
    organization;
    slug;
    isPublic;
    tagline;
    primaryFocus;
    secondaryFocus;
    memberCount;
    activityLevel;
    rsiUrl;
    discordInvite;
    twitterUrl;
    youtubeUrl;
    twitchUrl;
    websiteUrl;
    bannerUrl;
    languages;
    timezone;
    isVerified;
    isRecruiting;
    useDiscordForApplications;
    scstatsVisibility;
    rsiArchetype;
    rsiCommitment;
    rsiRolePlay;
    rsiExclusive;
    createdAt;
    updatedAt;
};
exports.PublicOrgProfile = PublicOrgProfile;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => Organization_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], PublicOrgProfile.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true, unique: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "slug", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], PublicOrgProfile.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "tagline", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: OrgPrimaryFocus,
        default: OrgPrimaryFocus.MIXED,
    }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "primaryFocus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], PublicOrgProfile.prototype, "secondaryFocus", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], PublicOrgProfile.prototype, "memberCount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ActivityLevel,
        default: ActivityLevel.MODERATE,
    }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "activityLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "rsiUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "discordInvite", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "twitterUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "youtubeUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "twitchUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "websiteUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "bannerUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], PublicOrgProfile.prototype, "languages", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], PublicOrgProfile.prototype, "isVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], PublicOrgProfile.prototype, "isRecruiting", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], PublicOrgProfile.prototype, "useDiscordForApplications", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], PublicOrgProfile.prototype, "scstatsVisibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "rsiArchetype", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], PublicOrgProfile.prototype, "rsiCommitment", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', nullable: true }),
    __metadata("design:type", Boolean)
], PublicOrgProfile.prototype, "rsiRolePlay", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', nullable: true }),
    __metadata("design:type", Boolean)
], PublicOrgProfile.prototype, "rsiExclusive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PublicOrgProfile.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], PublicOrgProfile.prototype, "updatedAt", void 0);
exports.PublicOrgProfile = PublicOrgProfile = __decorate([
    (0, typeorm_1.Entity)('public_org_profiles'),
    (0, typeorm_1.Index)(['isPublic']),
    (0, typeorm_1.Index)(['primaryFocus']),
    (0, typeorm_1.Index)(['activityLevel']),
    (0, typeorm_1.Index)(['isRecruiting']),
    (0, typeorm_1.Index)(['isVerified']),
    (0, typeorm_1.Index)(['memberCount'])
], PublicOrgProfile);
//# sourceMappingURL=PublicOrgProfile.js.map