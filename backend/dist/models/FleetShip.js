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
exports.FleetShip = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const Fleet_1 = require("./Fleet");
const Ship_1 = require("./Ship");
let FleetShip = class FleetShip extends TenantEntity_1.TenantEntity {
    id;
    fleetId;
    fleet;
    shipId;
    ship;
    role;
    notes;
    assignedBy;
    assignedAt;
    updatedAt;
};
exports.FleetShip = FleetShip;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FleetShip.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetShip.prototype, "fleetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Fleet_1.Fleet, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'fleetId' }),
    __metadata("design:type", Fleet_1.Fleet)
], FleetShip.prototype, "fleet", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], FleetShip.prototype, "shipId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Ship_1.Ship, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'shipId' }),
    __metadata("design:type", Ship_1.Ship)
], FleetShip.prototype, "ship", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], FleetShip.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], FleetShip.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], FleetShip.prototype, "assignedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FleetShip.prototype, "assignedAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], FleetShip.prototype, "updatedAt", void 0);
exports.FleetShip = FleetShip = __decorate([
    (0, typeorm_1.Entity)('fleet_ships'),
    (0, typeorm_1.Index)(['fleetId', 'shipId'], { unique: true }),
    (0, typeorm_1.Index)(['fleetId']),
    (0, typeorm_1.Index)(['shipId'])
], FleetShip);
//# sourceMappingURL=FleetShip.js.map