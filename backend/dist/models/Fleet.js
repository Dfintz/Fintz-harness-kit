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
exports.Fleet = exports.FleetType = exports.FleetStatus = void 0;
exports.enrichFleetCounts = enrichFleetCounts;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var FleetStatus;
(function (FleetStatus) {
    FleetStatus["ACTIVE"] = "active";
    FleetStatus["INACTIVE"] = "inactive";
    FleetStatus["DEPLOYED"] = "deployed";
    FleetStatus["DISBANDED"] = "disbanded";
})(FleetStatus || (exports.FleetStatus = FleetStatus = {}));
var FleetType;
(function (FleetType) {
    FleetType["COMBAT"] = "combat";
    FleetType["MINING"] = "mining";
    FleetType["TRADING"] = "trading";
    FleetType["EXPLORATION"] = "exploration";
    FleetType["SALVAGE"] = "salvage";
    FleetType["ESCORT"] = "escort";
    FleetType["RECONNAISSANCE"] = "reconnaissance";
    FleetType["MEDICAL"] = "medical";
    FleetType["MIXED"] = "mixed";
})(FleetType || (exports.FleetType = FleetType = {}));
let Fleet = class Fleet extends TenantEntity_1.TenantEntity {
    id;
    name;
    description;
    emblem;
    status;
    type;
    leaderId;
    secondInCommandId;
    members;
    shipIds;
    maxMembers;
    isPublic;
    allowApplications;
    visibility;
    allowedOrganizations;
    publicViewEnabled;
    allowJoinRequests;
    composition;
    operationalStats;
    primaryActivity;
    deployedAt;
    deploymentLocation;
    color;
    tags;
    crewMode;
    teamId;
    team;
    parentFleetId;
    parent;
    children;
    level;
    sortOrder;
    hierarchyPath;
    isArchived;
    archivedAt;
    archivedBy;
    archiveReason;
    restoredAt;
    restoredBy;
    createdAt;
    updatedAt;
    fleetShips;
    _memberCount;
    get memberCount() {
        if (this._memberCount !== undefined) {
            return this._memberCount;
        }
        return this.members?.length ?? 0;
    }
    set memberCount(value) {
        this._memberCount = value;
    }
    _shipCount;
    get shipCount() {
        if (this._shipCount !== undefined) {
            return this._shipCount;
        }
        return this.fleetShips?.length ?? this.shipIds?.length ?? 0;
    }
    set shipCount(value) {
        this._shipCount = value;
    }
    get isDeployed() {
        return this.status === FleetStatus.DEPLOYED;
    }
    get canAcceptMembers() {
        return this.memberCount < this.maxMembers && this.status === FleetStatus.ACTIVE;
    }
};
exports.Fleet = Fleet;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], Fleet.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Fleet.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "emblem", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: FleetStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], Fleet.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: FleetType.MIXED,
    }),
    __metadata("design:type", String)
], Fleet.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "leaderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "secondInCommandId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], Fleet.prototype, "members", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Fleet.prototype, "shipIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 50 }),
    __metadata("design:type", Number)
], Fleet.prototype, "maxMembers", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Fleet.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Fleet.prototype, "allowApplications", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: 'private' }),
    __metadata("design:type", String)
], Fleet.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Fleet.prototype, "allowedOrganizations", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Fleet.prototype, "publicViewEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Fleet.prototype, "allowJoinRequests", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Fleet.prototype, "composition", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Fleet.prototype, "operationalStats", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "primaryActivity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Fleet.prototype, "deployedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "deploymentLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: '#00d9ff' }),
    __metadata("design:type", String)
], Fleet.prototype, "color", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Fleet.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'conservative' }),
    __metadata("design:type", String)
], Fleet.prototype, "crewMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "teamId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('Team', { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'teamId' }),
    __metadata("design:type", Function)
], Fleet.prototype, "team", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "parentFleetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Fleet, fleet => fleet.children, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'parentFleetId' }),
    __metadata("design:type", Fleet)
], Fleet.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Fleet, fleet => fleet.parent),
    __metadata("design:type", Array)
], Fleet.prototype, "children", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Fleet.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Fleet.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', default: '' }),
    __metadata("design:type", String)
], Fleet.prototype, "hierarchyPath", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Fleet.prototype, "isArchived", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'timestamp' }),
    __metadata("design:type", Date)
], Fleet.prototype, "archivedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "archivedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Fleet.prototype, "archiveReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'timestamp' }),
    __metadata("design:type", Date)
], Fleet.prototype, "restoredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Fleet.prototype, "restoredBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Fleet.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Fleet.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)('FleetShip', 'fleet'),
    __metadata("design:type", Array)
], Fleet.prototype, "fleetShips", void 0);
exports.Fleet = Fleet = __decorate([
    (0, typeorm_1.Entity)('fleets'),
    (0, typeorm_1.Index)('idx_fleet_org_id', ['organizationId']),
    (0, typeorm_1.Index)('idx_fleet_org_name', ['organizationId', 'name']),
    (0, typeorm_1.Index)('idx_fleet_org_createdat', ['organizationId', 'createdAt']),
    (0, typeorm_1.Index)('idx_fleet_status', ['status']),
    (0, typeorm_1.Index)('idx_fleet_type', ['type']),
    (0, typeorm_1.Index)('idx_fleet_leader', ['leaderId']),
    (0, typeorm_1.Index)('idx_fleet_parent', ['parentFleetId']),
    (0, typeorm_1.Index)('idx_fleet_team', ['teamId'])
], Fleet);
function enrichFleetCounts(fleet, shipCountOverride) {
    const shipCount = shipCountOverride ?? fleet.shipCount ?? 0;
    const memberCount = fleet.members?.length ?? 0;
    return Object.assign(fleet, { shipCount, memberCount });
}
//# sourceMappingURL=Fleet.js.map