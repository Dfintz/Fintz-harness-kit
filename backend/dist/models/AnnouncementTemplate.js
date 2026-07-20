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
exports.AnnouncementTemplate = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let AnnouncementTemplate = class AnnouncementTemplate {
    id;
    organizationId;
    organization;
    name;
    title;
    content;
    embedConfig;
    isGlobal;
    createdBy;
    createdByName;
    createdAt;
    updatedAt;
    deletedAt;
    deletedBy;
    isAvailableTo(organizationId) {
        if (this.isGlobal) {
            return true;
        }
        return this.organizationId === organizationId;
    }
    canBeModifiedBy(userId, isPlatformAdmin) {
        if (isPlatformAdmin) {
            return true;
        }
        if (this.isGlobal) {
            return false;
        }
        return this.createdBy === userId;
    }
};
exports.AnnouncementTemplate = AnnouncementTemplate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AnnouncementTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], AnnouncementTemplate.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], AnnouncementTemplate.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], AnnouncementTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 256, nullable: true }),
    __metadata("design:type", String)
], AnnouncementTemplate.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], AnnouncementTemplate.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { nullable: true }),
    __metadata("design:type", Object)
], AnnouncementTemplate.prototype, "embedConfig", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], AnnouncementTemplate.prototype, "isGlobal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], AnnouncementTemplate.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], AnnouncementTemplate.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AnnouncementTemplate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], AnnouncementTemplate.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], AnnouncementTemplate.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], AnnouncementTemplate.prototype, "deletedBy", void 0);
exports.AnnouncementTemplate = AnnouncementTemplate = __decorate([
    (0, typeorm_1.Entity)('announcement_templates'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['isGlobal']),
    (0, typeorm_1.Index)(['createdBy']),
    (0, typeorm_1.Index)(['name'])
], AnnouncementTemplate);
//# sourceMappingURL=AnnouncementTemplate.js.map