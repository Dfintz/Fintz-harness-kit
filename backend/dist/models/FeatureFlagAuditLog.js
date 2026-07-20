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
exports.FeatureFlagAuditLog = exports.FeatureFlagAction = void 0;
const typeorm_1 = require("typeorm");
const FeatureFlag_1 = require("./FeatureFlag");
var FeatureFlagAction;
(function (FeatureFlagAction) {
    FeatureFlagAction["CREATED"] = "created";
    FeatureFlagAction["UPDATED"] = "updated";
    FeatureFlagAction["DELETED"] = "deleted";
    FeatureFlagAction["EVALUATED"] = "evaluated";
})(FeatureFlagAction || (exports.FeatureFlagAction = FeatureFlagAction = {}));
let FeatureFlagAuditLog = class FeatureFlagAuditLog {
    id;
    featureFlagId;
    featureFlag;
    action;
    userId;
    organizationId;
    previousValue;
    newValue;
    evaluationResult;
    metadata;
    createdAt;
};
exports.FeatureFlagAuditLog = FeatureFlagAuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FeatureFlagAuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], FeatureFlagAuditLog.prototype, "featureFlagId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => FeatureFlag_1.FeatureFlag, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'featureFlagId' }),
    __metadata("design:type", FeatureFlag_1.FeatureFlag)
], FeatureFlagAuditLog.prototype, "featureFlag", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: FeatureFlagAction
    }),
    __metadata("design:type", String)
], FeatureFlagAuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FeatureFlagAuditLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FeatureFlagAuditLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], FeatureFlagAuditLog.prototype, "previousValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], FeatureFlagAuditLog.prototype, "newValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', nullable: true }),
    __metadata("design:type", Boolean)
], FeatureFlagAuditLog.prototype, "evaluationResult", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], FeatureFlagAuditLog.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FeatureFlagAuditLog.prototype, "createdAt", void 0);
exports.FeatureFlagAuditLog = FeatureFlagAuditLog = __decorate([
    (0, typeorm_1.Entity)('feature_flag_audit_logs'),
    (0, typeorm_1.Index)(['featureFlagId', 'createdAt']),
    (0, typeorm_1.Index)(['action', 'createdAt']),
    (0, typeorm_1.Index)(['userId'])
], FeatureFlagAuditLog);
//# sourceMappingURL=FeatureFlagAuditLog.js.map