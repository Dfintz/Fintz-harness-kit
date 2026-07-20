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
exports.ActivityTemplate = exports.ActivityTemplateCategory = void 0;
const typeorm_1 = require("typeorm");
const Activity_1 = require("./Activity");
const TenantEntity_1 = require("./base/TenantEntity");
var ActivityTemplateCategory;
(function (ActivityTemplateCategory) {
    ActivityTemplateCategory["COMBAT"] = "combat";
    ActivityTemplateCategory["MINING"] = "mining";
    ActivityTemplateCategory["TRADING"] = "trading";
    ActivityTemplateCategory["EXPLORATION"] = "exploration";
    ActivityTemplateCategory["LOGISTICS"] = "logistics";
    ActivityTemplateCategory["SOCIAL"] = "social";
    ActivityTemplateCategory["TRAINING"] = "training";
    ActivityTemplateCategory["CUSTOM"] = "custom";
})(ActivityTemplateCategory || (exports.ActivityTemplateCategory = ActivityTemplateCategory = {}));
let ActivityTemplate = class ActivityTemplate extends TenantEntity_1.TenantEntity {
    id;
    name;
    description;
    activityType;
    category;
    templateData;
    isPublic;
    isActive;
    usageCount;
    tags;
    createdBy;
    createdByName;
    createdAt;
    updatedAt;
    incrementUsage() {
        this.usageCount += 1;
    }
};
exports.ActivityTemplate = ActivityTemplate;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ActivityTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150 }),
    __metadata("design:type", String)
], ActivityTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ActivityTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: Activity_1.ActivityType }),
    __metadata("design:type", String)
], ActivityTemplate.prototype, "activityType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ActivityTemplateCategory,
        default: ActivityTemplateCategory.CUSTOM,
    }),
    __metadata("design:type", String)
], ActivityTemplate.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], ActivityTemplate.prototype, "templateData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ActivityTemplate.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], ActivityTemplate.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ActivityTemplate.prototype, "usageCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Object)
], ActivityTemplate.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], ActivityTemplate.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], ActivityTemplate.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ActivityTemplate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ActivityTemplate.prototype, "updatedAt", void 0);
exports.ActivityTemplate = ActivityTemplate = __decorate([
    (0, typeorm_1.Entity)('activity_templates'),
    (0, typeorm_1.Index)(['organizationId', 'category']),
    (0, typeorm_1.Index)(['organizationId', 'createdBy']),
    (0, typeorm_1.Index)(['isPublic', 'isActive'])
], ActivityTemplate);
//# sourceMappingURL=ActivityTemplate.js.map