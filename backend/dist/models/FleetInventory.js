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
exports.FleetInventory = exports.StockStatus = exports.InventoryUnit = exports.InventoryCategory = void 0;
const typeorm_1 = require("typeorm");
var InventoryCategory;
(function (InventoryCategory) {
    InventoryCategory["FUEL"] = "fuel";
    InventoryCategory["AMMUNITION"] = "ammunition";
    InventoryCategory["MEDICAL"] = "medical";
    InventoryCategory["FOOD"] = "food";
    InventoryCategory["MINING"] = "mining";
    InventoryCategory["REPAIR"] = "repair";
    InventoryCategory["TRADE"] = "trade";
    InventoryCategory["COMPONENTS"] = "components";
    InventoryCategory["CONSUMABLES"] = "consumables";
    InventoryCategory["OTHER"] = "other";
})(InventoryCategory || (exports.InventoryCategory = InventoryCategory = {}));
var InventoryUnit;
(function (InventoryUnit) {
    InventoryUnit["UNITS"] = "units";
    InventoryUnit["SCU"] = "scu";
    InventoryUnit["LITERS"] = "liters";
    InventoryUnit["KILOGRAMS"] = "kilograms";
    InventoryUnit["TONNES"] = "tonnes";
})(InventoryUnit || (exports.InventoryUnit = InventoryUnit = {}));
var StockStatus;
(function (StockStatus) {
    StockStatus["ADEQUATE"] = "adequate";
    StockStatus["LOW"] = "low";
    StockStatus["CRITICAL"] = "critical";
    StockStatus["OUT_OF_STOCK"] = "out_of_stock";
})(StockStatus || (exports.StockStatus = StockStatus = {}));
let FleetInventory = class FleetInventory {
    id;
    organizationId;
    fleetId;
    itemName;
    description;
    category;
    quantity;
    unit;
    thresholds;
    status;
    location;
    unitCost;
    totalValue;
    supplierId;
    supplierName;
    alertEnabled;
    lastRestockDate;
    nextRestockDate;
    averageConsumptionRate;
    estimatedDaysRemaining;
    notes;
    managerId;
    createdAt;
    updatedAt;
};
exports.FleetInventory = FleetInventory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FleetInventory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetInventory.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetInventory.prototype, "fleetId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetInventory.prototype, "itemName", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], FleetInventory.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: InventoryCategory.OTHER
    }),
    __metadata("design:type", String)
], FleetInventory.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], FleetInventory.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: InventoryUnit.UNITS
    }),
    __metadata("design:type", String)
], FleetInventory.prototype, "unit", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Object)
], FleetInventory.prototype, "thresholds", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: StockStatus.ADEQUATE
    }),
    __metadata("design:type", String)
], FleetInventory.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], FleetInventory.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], FleetInventory.prototype, "unitCost", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], FleetInventory.prototype, "totalValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FleetInventory.prototype, "supplierId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FleetInventory.prototype, "supplierName", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], FleetInventory.prototype, "alertEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], FleetInventory.prototype, "lastRestockDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], FleetInventory.prototype, "nextRestockDate", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], FleetInventory.prototype, "averageConsumptionRate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], FleetInventory.prototype, "estimatedDaysRemaining", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], FleetInventory.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetInventory.prototype, "managerId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FleetInventory.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], FleetInventory.prototype, "updatedAt", void 0);
exports.FleetInventory = FleetInventory = __decorate([
    (0, typeorm_1.Entity)('fleet_inventory')
], FleetInventory);
//# sourceMappingURL=FleetInventory.js.map