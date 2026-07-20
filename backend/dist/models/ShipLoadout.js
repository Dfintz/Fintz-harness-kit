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
exports.ShipLoadout = void 0;
const typeorm_1 = require("typeorm");
let ShipLoadout = class ShipLoadout {
    id;
    name;
    ownerId;
    shipId;
    shipName;
    components;
    description;
    erkulGamesUrl;
    spViewerUrl;
    statistics;
    version;
    parentLoadoutId;
    isLatestVersion;
    sharedWithFleet;
    sharedWithOrg;
    sharedWithAlliance;
    sharedWithOrgs;
    sharedWithUsers;
    notes;
    createdAt;
    updatedAt;
};
exports.ShipLoadout = ShipLoadout;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ShipLoadout.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShipLoadout.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShipLoadout.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShipLoadout.prototype, "shipId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ShipLoadout.prototype, "shipName", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], ShipLoadout.prototype, "components", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ShipLoadout.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShipLoadout.prototype, "erkulGamesUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, length: 500 }),
    __metadata("design:type", String)
], ShipLoadout.prototype, "spViewerUrl", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], ShipLoadout.prototype, "statistics", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], ShipLoadout.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ShipLoadout.prototype, "parentLoadoutId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], ShipLoadout.prototype, "isLatestVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ShipLoadout.prototype, "sharedWithFleet", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ShipLoadout.prototype, "sharedWithOrg", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ShipLoadout.prototype, "sharedWithAlliance", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true, default: '' }),
    __metadata("design:type", Array)
], ShipLoadout.prototype, "sharedWithOrgs", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], ShipLoadout.prototype, "sharedWithUsers", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], ShipLoadout.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ShipLoadout.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ShipLoadout.prototype, "updatedAt", void 0);
exports.ShipLoadout = ShipLoadout = __decorate([
    (0, typeorm_1.Entity)('ship_loadouts')
], ShipLoadout);
//# sourceMappingURL=ShipLoadout.js.map