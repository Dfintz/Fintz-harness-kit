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
exports.FeatureFlag = exports.FeatureFlagScope = exports.FeatureFlagStatus = void 0;
const typeorm_1 = require("typeorm");
var FeatureFlagStatus;
(function (FeatureFlagStatus) {
    FeatureFlagStatus["ENABLED"] = "enabled";
    FeatureFlagStatus["DISABLED"] = "disabled";
    FeatureFlagStatus["BETA"] = "beta";
    FeatureFlagStatus["PERCENTAGE"] = "percentage";
})(FeatureFlagStatus || (exports.FeatureFlagStatus = FeatureFlagStatus = {}));
var FeatureFlagScope;
(function (FeatureFlagScope) {
    FeatureFlagScope["GLOBAL"] = "global";
    FeatureFlagScope["ORGANIZATION"] = "organization";
    FeatureFlagScope["USER"] = "user";
    FeatureFlagScope["BETA_USERS"] = "beta_users";
})(FeatureFlagScope || (exports.FeatureFlagScope = FeatureFlagScope = {}));
let FeatureFlag = class FeatureFlag {
    id;
    name;
    description;
    status;
    scope;
    percentage;
    targetOrganizations;
    targetUsers;
    metadata;
    createdBy;
    createdAt;
    updatedAt;
};
exports.FeatureFlag = FeatureFlag;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], FeatureFlag.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FeatureFlag.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], FeatureFlag.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: FeatureFlagStatus,
        default: FeatureFlagStatus.DISABLED,
    }),
    __metadata("design:type", String)
], FeatureFlag.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: FeatureFlagScope,
        default: FeatureFlagScope.GLOBAL,
    }),
    __metadata("design:type", String)
], FeatureFlag.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], FeatureFlag.prototype, "percentage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], FeatureFlag.prototype, "targetOrganizations", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], FeatureFlag.prototype, "targetUsers", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], FeatureFlag.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', nullable: true }),
    __metadata("design:type", String)
], FeatureFlag.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], FeatureFlag.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], FeatureFlag.prototype, "updatedAt", void 0);
exports.FeatureFlag = FeatureFlag = __decorate([
    (0, typeorm_1.Entity)('feature_flags'),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['scope'])
], FeatureFlag);
//# sourceMappingURL=FeatureFlag.js.map