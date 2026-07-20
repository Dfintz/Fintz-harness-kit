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
exports.OrgDues = exports.DuesFrequency = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var DuesFrequency;
(function (DuesFrequency) {
    DuesFrequency["WEEKLY"] = "weekly";
    DuesFrequency["BIWEEKLY"] = "biweekly";
    DuesFrequency["MONTHLY"] = "monthly";
    DuesFrequency["QUARTERLY"] = "quarterly";
})(DuesFrequency || (exports.DuesFrequency = DuesFrequency = {}));
let OrgDues = class OrgDues extends TenantEntity_1.TenantEntity {
    id;
    name;
    amount;
    frequency;
    isActive;
    dueDay;
    gracePeriodDays;
    createdBy;
    createdAt;
    updatedAt;
};
exports.OrgDues = OrgDues;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrgDues.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], OrgDues.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 20, scale: 2 }),
    __metadata("design:type", Number)
], OrgDues.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], OrgDues.prototype, "frequency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], OrgDues.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 1 }),
    __metadata("design:type", Number)
], OrgDues.prototype, "dueDay", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 7 }),
    __metadata("design:type", Number)
], OrgDues.prototype, "gracePeriodDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], OrgDues.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrgDues.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrgDues.prototype, "updatedAt", void 0);
exports.OrgDues = OrgDues = __decorate([
    (0, typeorm_1.Entity)('org_dues'),
    (0, typeorm_1.Index)(['organizationId', 'isActive'])
], OrgDues);
//# sourceMappingURL=OrgDues.js.map