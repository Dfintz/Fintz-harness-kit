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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgWatchlistEntry = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
let OrgWatchlistEntry = class OrgWatchlistEntry extends TenantEntity_1.TenantEntity {
    id;
    rsiHandle;
    citizenName;
    reason;
    threatLevel;
    notes;
    addedBy;
    createdAt;
    updatedAt;
    getFlagSeverity() {
        const mapping = {
            [shared_types_1.WatchlistThreatLevel.LOW]: shared_types_1.FlagSeverity.INFO,
            [shared_types_1.WatchlistThreatLevel.MODERATE]: shared_types_1.FlagSeverity.MEDIUM,
            [shared_types_1.WatchlistThreatLevel.HIGH]: shared_types_1.FlagSeverity.HIGH,
            [shared_types_1.WatchlistThreatLevel.CRITICAL]: shared_types_1.FlagSeverity.CRITICAL,
        };
        return mapping[this.threatLevel] ?? shared_types_1.FlagSeverity.MEDIUM;
    }
    getSummary() {
        return `${this.citizenName} [${this.rsiHandle}] — ${this.reason} (${this.threatLevel})`;
    }
};
exports.OrgWatchlistEntry = OrgWatchlistEntry;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrgWatchlistEntry.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], OrgWatchlistEntry.prototype, "rsiHandle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], OrgWatchlistEntry.prototype, "citizenName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 30,
    }),
    __metadata("design:type", typeof (_a = typeof shared_types_1.WatchlistReason !== "undefined" && shared_types_1.WatchlistReason) === "function" ? _a : Object)
], OrgWatchlistEntry.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 12,
    }),
    __metadata("design:type", typeof (_b = typeof shared_types_1.WatchlistThreatLevel !== "undefined" && shared_types_1.WatchlistThreatLevel) === "function" ? _b : Object)
], OrgWatchlistEntry.prototype, "threatLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrgWatchlistEntry.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], OrgWatchlistEntry.prototype, "addedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrgWatchlistEntry.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrgWatchlistEntry.prototype, "updatedAt", void 0);
exports.OrgWatchlistEntry = OrgWatchlistEntry = __decorate([
    (0, typeorm_1.Entity)('org_watchlist_entries'),
    (0, typeorm_1.Index)(['organizationId', 'rsiHandle'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId', 'reason']),
    (0, typeorm_1.Index)(['organizationId', 'threatLevel']),
    (0, typeorm_1.Index)(['rsiHandle'])
], OrgWatchlistEntry);
//# sourceMappingURL=OrgWatchlistEntry.js.map