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
exports.FleetVisibilityRule = void 0;
const typeorm_1 = require("typeorm");
const Fleet_1 = require("./Fleet");
let FleetVisibilityRule = class FleetVisibilityRule {
    id;
    fleetId;
    fleet;
    organizationId;
    scope;
    minSecurityLevel;
    targetAllianceOrgId;
    targetFederationId;
    accessLevel;
    isActive;
    createdAt;
    updatedAt;
};
exports.FleetVisibilityRule = FleetVisibilityRule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FleetVisibilityRule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], FleetVisibilityRule.prototype, "fleetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Fleet_1.Fleet, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'fleetId' }),
    __metadata("design:type", Fleet_1.Fleet)
], FleetVisibilityRule.prototype, "fleet", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], FleetVisibilityRule.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], FleetVisibilityRule.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], FleetVisibilityRule.prototype, "minSecurityLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], FleetVisibilityRule.prototype, "targetAllianceOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], FleetVisibilityRule.prototype, "targetFederationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'summary' }),
    __metadata("design:type", String)
], FleetVisibilityRule.prototype, "accessLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], FleetVisibilityRule.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FleetVisibilityRule.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], FleetVisibilityRule.prototype, "updatedAt", void 0);
exports.FleetVisibilityRule = FleetVisibilityRule = __decorate([
    (0, typeorm_1.Entity)('fleet_visibility_rules'),
    (0, typeorm_1.Index)('idx_fvr_fleet', ['fleetId']),
    (0, typeorm_1.Index)('idx_fvr_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_fvr_fleet_scope', ['fleetId', 'scope']),
    (0, typeorm_1.Index)('idx_fvr_target_alliance', ['targetAllianceOrgId']),
    (0, typeorm_1.Index)('idx_fvr_target_federation', ['targetFederationId'])
], FleetVisibilityRule);
//# sourceMappingURL=FleetVisibilityRule.js.map