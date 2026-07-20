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
exports.Achievement = exports.AchievementType = exports.AchievementRarity = void 0;
const typeorm_1 = require("typeorm");
const Federation_1 = require("./Federation");
const Organization_1 = require("./Organization");
const UserAchievement_1 = require("./UserAchievement");
var AchievementRarity;
(function (AchievementRarity) {
    AchievementRarity["COMMON"] = "common";
    AchievementRarity["UNCOMMON"] = "uncommon";
    AchievementRarity["RARE"] = "rare";
    AchievementRarity["EPIC"] = "epic";
    AchievementRarity["LEGENDARY"] = "legendary";
})(AchievementRarity || (exports.AchievementRarity = AchievementRarity = {}));
var AchievementType;
(function (AchievementType) {
    AchievementType["TITLE"] = "title";
    AchievementType["BADGE"] = "badge";
})(AchievementType || (exports.AchievementType = AchievementType = {}));
let Achievement = class Achievement {
    id;
    type;
    organizationId;
    organization;
    federationId;
    federation;
    name;
    description;
    category;
    rarity;
    icon;
    metadata;
    createdBy;
    isActive;
    userAchievements;
    createdAt;
    updatedAt;
};
exports.Achievement = Achievement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Achievement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: AchievementType.BADGE }),
    __metadata("design:type", String)
], Achievement.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Achievement.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], Achievement.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Achievement.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Federation_1.Federation, { onDelete: 'CASCADE', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'federationId' }),
    __metadata("design:type", Federation_1.Federation)
], Achievement.prototype, "federation", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], Achievement.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Achievement.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", String)
], Achievement.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: AchievementRarity.COMMON }),
    __metadata("design:type", String)
], Achievement.prototype, "rarity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Achievement.prototype, "icon", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Achievement.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Achievement.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Achievement.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserAchievement_1.UserAchievement, ua => ua.achievement),
    __metadata("design:type", Array)
], Achievement.prototype, "userAchievements", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Achievement.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Achievement.prototype, "updatedAt", void 0);
exports.Achievement = Achievement = __decorate([
    (0, typeorm_1.Entity)('achievements'),
    (0, typeorm_1.Index)('IDX_achievements_type', ['type']),
    (0, typeorm_1.Index)('IDX_achievements_federationId', ['federationId'])
], Achievement);
//# sourceMappingURL=Achievement.js.map