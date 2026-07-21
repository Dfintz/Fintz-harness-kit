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
exports.TradingRoute = exports.RouteVisibility = exports.RouteStatus = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
Object.defineProperty(exports, "RouteStatus", { enumerable: true, get: function () { return shared_types_1.RouteStatus; } });
Object.defineProperty(exports, "RouteVisibility", { enumerable: true, get: function () { return shared_types_1.RouteVisibility; } });
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let TradingRoute = class TradingRoute {
    id;
    name;
    description;
    creatorId;
    organizationId;
    organization;
    visibility;
    stops;
    estimatedProfit;
    estimatedDuration;
    minCargoCapacity;
    fleetComposition;
    status;
    performance;
    tags;
    notes;
    createdAt;
    updatedAt;
};
exports.TradingRoute = TradingRoute;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], TradingRoute.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TradingRoute.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], TradingRoute.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], TradingRoute.prototype, "creatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], TradingRoute.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], TradingRoute.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: shared_types_1.RouteVisibility.ORGANIZATION,
    }),
    __metadata("design:type", String)
], TradingRoute.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json'),
    __metadata("design:type", Array)
], TradingRoute.prototype, "stops", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], TradingRoute.prototype, "estimatedProfit", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], TradingRoute.prototype, "estimatedDuration", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], TradingRoute.prototype, "minCargoCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], TradingRoute.prototype, "fleetComposition", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: shared_types_1.RouteStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], TradingRoute.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], TradingRoute.prototype, "performance", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], TradingRoute.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], TradingRoute.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TradingRoute.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], TradingRoute.prototype, "updatedAt", void 0);
exports.TradingRoute = TradingRoute = __decorate([
    (0, typeorm_1.Entity)('trading_routes'),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['creatorId', 'status'])
], TradingRoute);
//# sourceMappingURL=TradingRoute.js.map