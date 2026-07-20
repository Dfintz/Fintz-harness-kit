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
exports.OrgActivityHeatmap = void 0;
const typeorm_1 = require("typeorm");
let OrgActivityHeatmap = class OrgActivityHeatmap {
    id;
    organizationId;
    dayOfWeek;
    hour;
    presenceCount;
    siteActiveCount;
    rawScore;
    memberCount;
    sampledAt;
    createdAt;
};
exports.OrgActivityHeatmap = OrgActivityHeatmap;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrgActivityHeatmap.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrgActivityHeatmap.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)('smallint'),
    __metadata("design:type", Number)
], OrgActivityHeatmap.prototype, "dayOfWeek", void 0);
__decorate([
    (0, typeorm_1.Column)('smallint'),
    __metadata("design:type", Number)
], OrgActivityHeatmap.prototype, "hour", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], OrgActivityHeatmap.prototype, "presenceCount", void 0);
__decorate([
    (0, typeorm_1.Column)('int', { default: 0 }),
    __metadata("design:type", Number)
], OrgActivityHeatmap.prototype, "siteActiveCount", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 8, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], OrgActivityHeatmap.prototype, "rawScore", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], OrgActivityHeatmap.prototype, "memberCount", void 0);
__decorate([
    (0, typeorm_1.Column)('timestamp'),
    __metadata("design:type", Date)
], OrgActivityHeatmap.prototype, "sampledAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrgActivityHeatmap.prototype, "createdAt", void 0);
exports.OrgActivityHeatmap = OrgActivityHeatmap = __decorate([
    (0, typeorm_1.Entity)('org_activity_heatmaps'),
    (0, typeorm_1.Index)('idx_oah_org_sampled', ['organizationId', 'sampledAt']),
    (0, typeorm_1.Index)('idx_oah_org_cell', ['organizationId', 'dayOfWeek', 'hour'])
], OrgActivityHeatmap);
//# sourceMappingURL=OrgActivityHeatmap.js.map