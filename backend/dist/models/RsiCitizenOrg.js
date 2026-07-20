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
exports.RsiCitizenOrg = void 0;
const typeorm_1 = require("typeorm");
let RsiCitizenOrg = class RsiCitizenOrg {
    id;
    citizenHandle;
    organizationSid;
    organizationName;
    rank;
    stars;
    isMain;
    isAffiliate;
    lastFetchedAt;
    createdAt;
    updatedAt;
};
exports.RsiCitizenOrg = RsiCitizenOrg;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RsiCitizenOrg.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], RsiCitizenOrg.prototype, "citizenHandle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], RsiCitizenOrg.prototype, "organizationSid", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], RsiCitizenOrg.prototype, "organizationName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], RsiCitizenOrg.prototype, "rank", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], RsiCitizenOrg.prototype, "stars", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiCitizenOrg.prototype, "isMain", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RsiCitizenOrg.prototype, "isAffiliate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], RsiCitizenOrg.prototype, "lastFetchedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RsiCitizenOrg.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], RsiCitizenOrg.prototype, "updatedAt", void 0);
exports.RsiCitizenOrg = RsiCitizenOrg = __decorate([
    (0, typeorm_1.Entity)('rsi_citizen_orgs'),
    (0, typeorm_1.Unique)('UQ_rsi_citizen_orgs_handle_sid', ['citizenHandle', 'organizationSid']),
    (0, typeorm_1.Index)('IDX_rsi_citizen_orgs_handle', ['citizenHandle']),
    (0, typeorm_1.Index)('IDX_rsi_citizen_orgs_org_sid', ['organizationSid']),
    (0, typeorm_1.Index)('IDX_rsi_citizen_orgs_fetched_at', ['lastFetchedAt'])
], RsiCitizenOrg);
//# sourceMappingURL=RsiCitizenOrg.js.map