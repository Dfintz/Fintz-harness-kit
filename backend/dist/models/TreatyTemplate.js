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
exports.TreatyTemplate = void 0;
const typeorm_1 = require("typeorm");
let TreatyTemplate = class TreatyTemplate {
    id;
    name;
    description;
    category;
    scope;
    clauses;
    isBuiltIn;
    organizationId;
    isPublished;
    version;
    tags;
    createdAt;
    updatedAt;
};
exports.TreatyTemplate = TreatyTemplate;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], TreatyTemplate.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TreatyTemplate.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], TreatyTemplate.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], TreatyTemplate.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'both' }),
    __metadata("design:type", String)
], TreatyTemplate.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: '[]' }),
    __metadata("design:type", Array)
], TreatyTemplate.prototype, "clauses", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], TreatyTemplate.prototype, "isBuiltIn", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], TreatyTemplate.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], TreatyTemplate.prototype, "isPublished", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], TreatyTemplate.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], TreatyTemplate.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TreatyTemplate.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], TreatyTemplate.prototype, "updatedAt", void 0);
exports.TreatyTemplate = TreatyTemplate = __decorate([
    (0, typeorm_1.Entity)('treaty_templates'),
    (0, typeorm_1.Index)('idx_treaty_tpl_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_treaty_tpl_category', ['category']),
    (0, typeorm_1.Index)('idx_treaty_tpl_scope', ['scope']),
    (0, typeorm_1.Index)('idx_treaty_tpl_builtin', ['isBuiltIn']),
    (0, typeorm_1.Index)('idx_treaty_tpl_published', ['isPublished'])
], TreatyTemplate);
//# sourceMappingURL=TreatyTemplate.js.map