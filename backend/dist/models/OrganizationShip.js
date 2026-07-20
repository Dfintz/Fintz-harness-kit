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
exports.OrganizationShip = exports.OrgShipRole = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const UserShip_1 = require("./UserShip");
var OrgShipRole;
(function (OrgShipRole) {
    OrgShipRole["COMMAND"] = "command";
    OrgShipRole["COMBAT"] = "combat";
    OrgShipRole["LOGISTICS"] = "logistics";
    OrgShipRole["MINING"] = "mining";
    OrgShipRole["EXPLORATION"] = "exploration";
    OrgShipRole["MEDICAL"] = "medical";
    OrgShipRole["TRANSPORT"] = "transport";
    OrgShipRole["SUPPORT"] = "support";
    OrgShipRole["RESERVE"] = "reserve";
})(OrgShipRole || (exports.OrgShipRole = OrgShipRole = {}));
let OrganizationShip = class OrganizationShip extends TenantEntity_1.TenantEntity {
    id;
    shipId;
    shipName;
    customName;
    role;
    status;
    condition;
    acquisitionMethod;
    acquiredBy;
    acquiredDate;
    acquisitionCost;
    assignedCaptain;
    assignedCrew;
    maxCrew;
    location;
    homeBase;
    sharingLevel;
    minRequiredRank;
    useCustomVisibility;
    insuranceLevel;
    insuranceExpires;
    lastMaintenance;
    nextMaintenance;
    flightHours;
    missionsCompleted;
    totalEarnings;
    maintenanceCosts;
    modifications;
    isAvailable;
    isCapital;
    requiresPermission;
    minimumRank;
    notes;
    tags;
    isActive;
    createdAt;
    updatedAt;
    getDisplayName() {
        return this.customName || this.shipName;
    }
    needsMaintenance() {
        if (!this.nextMaintenance) {
            return false;
        }
        return new Date() >= this.nextMaintenance;
    }
    isOperational() {
        return this.condition !== UserShip_1.ShipCondition.DAMAGED &&
            this.condition !== UserShip_1.ShipCondition.CRITICAL &&
            this.status !== UserShip_1.ShipOwnershipStatus.DESTROYED &&
            this.status !== UserShip_1.ShipOwnershipStatus.LOST &&
            this.isActive;
    }
    isReadyForUse() {
        return this.isOperational() &&
            this.isAvailable &&
            !this.needsMaintenance();
    }
    canUserCaptain(userRank) {
        if (!this.requiresPermission) {
            return true;
        }
        if (!this.minimumRank) {
            return true;
        }
        if (!userRank) {
            return false;
        }
        return true;
    }
    getCrewFillPercentage() {
        if (!this.maxCrew || !this.assignedCrew) {
            return 0;
        }
        return (this.assignedCrew.length / this.maxCrew) * 100;
    }
};
exports.OrganizationShip = OrganizationShip;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationShip.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationShip.prototype, "shipId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationShip.prototype, "shipName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "customName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: OrgShipRole,
        default: OrgShipRole.RESERVE
    }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: UserShip_1.ShipOwnershipStatus,
        default: UserShip_1.ShipOwnershipStatus.OWNED
    }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: UserShip_1.ShipCondition,
        default: UserShip_1.ShipCondition.GOOD
    }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "acquisitionMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "acquiredBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationShip.prototype, "acquiredDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], OrganizationShip.prototype, "acquisitionCost", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "assignedCaptain", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], OrganizationShip.prototype, "assignedCrew", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], OrganizationShip.prototype, "maxCrew", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "homeBase", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: UserShip_1.ShipSharingLevel,
        default: UserShip_1.ShipSharingLevel.ORGANIZATION,
    }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "sharingLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], OrganizationShip.prototype, "minRequiredRank", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationShip.prototype, "useCustomVisibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "insuranceLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationShip.prototype, "insuranceExpires", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationShip.prototype, "lastMaintenance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationShip.prototype, "nextMaintenance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], OrganizationShip.prototype, "flightHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], OrganizationShip.prototype, "missionsCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrganizationShip.prototype, "totalEarnings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrganizationShip.prototype, "maintenanceCosts", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { nullable: true }),
    __metadata("design:type", Object)
], OrganizationShip.prototype, "modifications", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], OrganizationShip.prototype, "isAvailable", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationShip.prototype, "isCapital", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationShip.prototype, "requiresPermission", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "minimumRank", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], OrganizationShip.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], OrganizationShip.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], OrganizationShip.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationShip.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationShip.prototype, "updatedAt", void 0);
exports.OrganizationShip = OrganizationShip = __decorate([
    (0, typeorm_1.Entity)('organization_ships'),
    (0, typeorm_1.Index)(['organizationId', 'shipId']),
    (0, typeorm_1.Index)(['organizationId', 'role']),
    (0, typeorm_1.Index)(['organizationId', 'status'])
], OrganizationShip);
//# sourceMappingURL=OrganizationShip.js.map