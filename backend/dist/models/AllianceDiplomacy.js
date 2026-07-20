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
exports.AllianceDiplomacy = exports.AllianceType = exports.DiplomacyStatus = void 0;
const typeorm_1 = require("typeorm");
var DiplomacyStatus;
(function (DiplomacyStatus) {
    DiplomacyStatus["PROPOSED"] = "proposed";
    DiplomacyStatus["ACTIVE"] = "active";
    DiplomacyStatus["SUSPENDED"] = "suspended";
    DiplomacyStatus["TERMINATED"] = "terminated";
})(DiplomacyStatus || (exports.DiplomacyStatus = DiplomacyStatus = {}));
var AllianceType;
(function (AllianceType) {
    AllianceType["TRADE"] = "trade";
    AllianceType["MILITARY"] = "military";
    AllianceType["MUTUAL_DEFENSE"] = "mutual_defense";
    AllianceType["NON_AGGRESSION"] = "non_aggression";
    AllianceType["FULL_ALLIANCE"] = "full_alliance";
})(AllianceType || (exports.AllianceType = AllianceType = {}));
let AllianceDiplomacy = class AllianceDiplomacy {
    id;
    orgId1;
    orgId2;
    allianceType;
    status;
    proposedBy;
    approvedBy;
    terms;
    incidents;
    startDate;
    endDate;
    notes;
    createdAt;
    updatedAt;
};
exports.AllianceDiplomacy = AllianceDiplomacy;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], AllianceDiplomacy.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AllianceDiplomacy.prototype, "orgId1", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AllianceDiplomacy.prototype, "orgId2", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar'
    }),
    __metadata("design:type", String)
], AllianceDiplomacy.prototype, "allianceType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: DiplomacyStatus.PROPOSED
    }),
    __metadata("design:type", String)
], AllianceDiplomacy.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AllianceDiplomacy.prototype, "proposedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AllianceDiplomacy.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], AllianceDiplomacy.prototype, "terms", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], AllianceDiplomacy.prototype, "incidents", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], AllianceDiplomacy.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], AllianceDiplomacy.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], AllianceDiplomacy.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AllianceDiplomacy.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], AllianceDiplomacy.prototype, "updatedAt", void 0);
exports.AllianceDiplomacy = AllianceDiplomacy = __decorate([
    (0, typeorm_1.Entity)('alliance_diplomacy')
], AllianceDiplomacy);
//# sourceMappingURL=AllianceDiplomacy.js.map