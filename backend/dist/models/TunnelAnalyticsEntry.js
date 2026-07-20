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
exports.TunnelAnalyticsEntry = void 0;
const typeorm_1 = require("typeorm");
const Tunnel_1 = require("./Tunnel");
let TunnelAnalyticsEntry = class TunnelAnalyticsEntry {
    id;
    tunnelId;
    tunnel;
    periodStart;
    messagesRelayed;
    messagesBlocked;
    uniqueUsers;
    peakConnections;
    attachmentsRelayed;
    reactionsRelayed;
    createdAt;
};
exports.TunnelAnalyticsEntry = TunnelAnalyticsEntry;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], TunnelAnalyticsEntry.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)('IDX_tunnel_analytics_tunnel'),
    __metadata("design:type", String)
], TunnelAnalyticsEntry.prototype, "tunnelId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Tunnel_1.Tunnel, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'tunnelId' }),
    __metadata("design:type", Tunnel_1.Tunnel)
], TunnelAnalyticsEntry.prototype, "tunnel", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamp'),
    (0, typeorm_1.Index)('IDX_tunnel_analytics_period'),
    __metadata("design:type", Date)
], TunnelAnalyticsEntry.prototype, "periodStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], TunnelAnalyticsEntry.prototype, "messagesRelayed", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], TunnelAnalyticsEntry.prototype, "messagesBlocked", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], TunnelAnalyticsEntry.prototype, "uniqueUsers", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], TunnelAnalyticsEntry.prototype, "peakConnections", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], TunnelAnalyticsEntry.prototype, "attachmentsRelayed", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], TunnelAnalyticsEntry.prototype, "reactionsRelayed", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TunnelAnalyticsEntry.prototype, "createdAt", void 0);
exports.TunnelAnalyticsEntry = TunnelAnalyticsEntry = __decorate([
    (0, typeorm_1.Entity)('tunnel_analytics'),
    (0, typeorm_1.Index)('IDX_tunnel_analytics_tunnel_period', ['tunnelId', 'periodStart'])
], TunnelAnalyticsEntry);
//# sourceMappingURL=TunnelAnalyticsEntry.js.map