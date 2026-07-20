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
exports.OrganizationInventory = exports.OrganizationInventoryCategory = void 0;
const typeorm_1 = require("typeorm");
var OrganizationInventoryCategory;
(function (OrganizationInventoryCategory) {
    OrganizationInventoryCategory["SHIPS"] = "ships";
    OrganizationInventoryCategory["COMPONENTS"] = "components";
    OrganizationInventoryCategory["COMMODITIES"] = "commodities";
})(OrganizationInventoryCategory || (exports.OrganizationInventoryCategory = OrganizationInventoryCategory = {}));
let OrganizationInventory = class OrganizationInventory {
    id;
    organizationId;
    itemName;
    description;
    category;
    quantity;
    unit;
    unitValue;
    totalValue;
    notes;
    location;
    assignedTo;
    createdAt;
    updatedAt;
};
exports.OrganizationInventory = OrganizationInventory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationInventory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationInventory.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationInventory.prototype, "itemName", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], OrganizationInventory.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: OrganizationInventoryCategory.COMMODITIES
    }),
    __metadata("design:type", String)
], OrganizationInventory.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 1 }),
    __metadata("design:type", Number)
], OrganizationInventory.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationInventory.prototype, "unit", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrganizationInventory.prototype, "unitValue", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrganizationInventory.prototype, "totalValue", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], OrganizationInventory.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationInventory.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationInventory.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationInventory.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationInventory.prototype, "updatedAt", void 0);
exports.OrganizationInventory = OrganizationInventory = __decorate([
    (0, typeorm_1.Entity)('organization_inventory')
], OrganizationInventory);
//# sourceMappingURL=OrganizationInventory.js.map