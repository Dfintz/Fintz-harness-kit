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
exports.OrgActivityScore = void 0;
const typeorm_1 = require("typeorm");
let OrgActivityScore = class OrgActivityScore {
    id;
    organizationId;
    score;
    tier;
    breakdown;
    memberCount;
    computedAt;
    createdAt;
};
exports.OrgActivityScore = OrgActivityScore;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrgActivityScore.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrgActivityScore.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 5, scale: 2 }),
    __metadata("design:type", Number)
], OrgActivityScore.prototype, "score", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 20 }),
    __metadata("design:type", Object)
], OrgActivityScore.prototype, "tier", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb'),
    __metadata("design:type", Object)
], OrgActivityScore.prototype, "breakdown", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], OrgActivityScore.prototype, "memberCount", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamp'),
    __metadata("design:type", Date)
], OrgActivityScore.prototype, "computedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrgActivityScore.prototype, "createdAt", void 0);
exports.OrgActivityScore = OrgActivityScore = __decorate([
    (0, typeorm_1.Entity)('org_activity_scores'),
    (0, typeorm_1.Index)('idx_oas_org_date', ['organizationId', 'computedAt']),
    (0, typeorm_1.Index)('idx_oas_score', ['score'])
], OrgActivityScore);
//# sourceMappingURL=OrgActivityScore.js.map