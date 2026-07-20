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
exports.Equipment = exports.EquipmentRarity = exports.EquipmentStatus = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var EquipmentStatus;
(function (EquipmentStatus) {
    EquipmentStatus["AVAILABLE"] = "available";
    EquipmentStatus["EQUIPPED"] = "equipped";
    EquipmentStatus["IN_TRANSIT"] = "in_transit";
    EquipmentStatus["DAMAGED"] = "damaged";
    EquipmentStatus["DESTROYED"] = "destroyed";
})(EquipmentStatus || (exports.EquipmentStatus = EquipmentStatus = {}));
var EquipmentRarity;
(function (EquipmentRarity) {
    EquipmentRarity["COMMON"] = "common";
    EquipmentRarity["UNCOMMON"] = "uncommon";
    EquipmentRarity["RARE"] = "rare";
    EquipmentRarity["EPIC"] = "epic";
    EquipmentRarity["LEGENDARY"] = "legendary";
})(EquipmentRarity || (exports.EquipmentRarity = EquipmentRarity = {}));
let Equipment = class Equipment {
    id;
    organizationId;
    organization;
    name;
    type;
    rarity;
    description;
    ownerId;
    owner;
    shipId;
    status;
    quantity;
    metadata;
    createdAt;
    updatedAt;
};
exports.Equipment = Equipment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Equipment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Equipment.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], Equipment.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], Equipment.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 64 }),
    __metadata("design:type", String)
], Equipment.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: EquipmentRarity.COMMON }),
    __metadata("design:type", String)
], Equipment.prototype, "rarity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Equipment.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Equipment.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ownerId' }),
    __metadata("design:type", User_1.User)
], Equipment.prototype, "owner", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Equipment.prototype, "shipId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', default: EquipmentStatus.AVAILABLE }),
    __metadata("design:type", String)
], Equipment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], Equipment.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], Equipment.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Equipment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Equipment.prototype, "updatedAt", void 0);
exports.Equipment = Equipment = __decorate([
    (0, typeorm_1.Entity)('equipment')
], Equipment);
//# sourceMappingURL=Equipment.js.map