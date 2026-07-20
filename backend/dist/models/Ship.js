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
exports.Ship = exports.ShipDataSource = exports.ShipStatus = exports.ShipSize = void 0;
const typeorm_1 = require("typeorm");
const OptionalTenantEntity_1 = require("./base/OptionalTenantEntity");
const FleetShip_1 = require("./FleetShip");
var ShipSize;
(function (ShipSize) {
    ShipSize["VEHICLE"] = "vehicle";
    ShipSize["SNUB"] = "snub";
    ShipSize["SMALL"] = "small";
    ShipSize["MEDIUM"] = "medium";
    ShipSize["LARGE"] = "large";
    ShipSize["SUB_CAPITAL"] = "sub_capital";
    ShipSize["CAPITAL"] = "capital";
})(ShipSize || (exports.ShipSize = ShipSize = {}));
var ShipStatus;
(function (ShipStatus) {
    ShipStatus["FLIGHT_READY"] = "flight_ready";
    ShipStatus["IN_CONCEPT"] = "in_concept";
    ShipStatus["IN_PRODUCTION"] = "in_production";
    ShipStatus["ANNOUNCED"] = "announced";
})(ShipStatus || (exports.ShipStatus = ShipStatus = {}));
var ShipDataSource;
(function (ShipDataSource) {
    ShipDataSource["ERKUL"] = "erkul";
    ShipDataSource["SHEETS"] = "sheets";
    ShipDataSource["CSV"] = "csv";
    ShipDataSource["MANUAL"] = "manual";
})(ShipDataSource || (exports.ShipDataSource = ShipDataSource = {}));
let Ship = class Ship extends OptionalTenantEntity_1.OptionalTenantEntity {
    id;
    name;
    manufacturer;
    manufacturerCode;
    description;
    role;
    career;
    roles;
    size;
    status;
    crew;
    minCrew;
    maxCrew;
    length;
    beam;
    height;
    mass;
    cargo;
    vehicleCargo;
    price;
    pledgePrice;
    speed;
    afterburnerSpeed;
    quantumSpeed;
    quantumFuelCapacity;
    hydrogenFuelCapacity;
    shields;
    armor;
    weapons;
    hardpoints;
    hangarSize;
    storageUrl;
    thumbnailUrl;
    imageUrl;
    brochureUrl;
    isActive;
    loanerShip;
    variants;
    isVehicle;
    isFlyable;
    metadata;
    dataSource;
    lastFetchedAt;
    createdAt;
    updatedAt;
    fleetAssignments;
};
exports.Ship = Ship;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], Ship.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Ship.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Ship.prototype, "manufacturer", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "manufacturerCode", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "career", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], Ship.prototype, "roles", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        nullable: true,
    }),
    __metadata("design:type", String)
], Ship.prototype, "size", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: ShipStatus.FLIGHT_READY,
    }),
    __metadata("design:type", String)
], Ship.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "crew", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "minCrew", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "maxCrew", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "length", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "beam", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "height", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "mass", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "cargo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "vehicleCargo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "pledgePrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "speed", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "afterburnerSpeed", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "quantumSpeed", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "quantumFuelCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "hydrogenFuelCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "shields", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Ship.prototype, "armor", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Ship.prototype, "weapons", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Ship.prototype, "hardpoints", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "hangarSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "storageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "imageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "brochureUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Ship.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ship.prototype, "loanerShip", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], Ship.prototype, "variants", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Ship.prototype, "isVehicle", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Ship.prototype, "isFlyable", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Ship.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: ShipDataSource.MANUAL }),
    __metadata("design:type", String)
], Ship.prototype, "dataSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Ship.prototype, "lastFetchedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Ship.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Ship.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => FleetShip_1.FleetShip, fleetShip => fleetShip.ship),
    __metadata("design:type", Array)
], Ship.prototype, "fleetAssignments", void 0);
exports.Ship = Ship = __decorate([
    (0, typeorm_1.Entity)('ships'),
    (0, typeorm_1.Index)(['organizationId', 'name']),
    (0, typeorm_1.Index)(['organizationId', 'manufacturer']),
    (0, typeorm_1.Index)(['organizationId', 'isActive'])
], Ship);
//# sourceMappingURL=Ship.js.map