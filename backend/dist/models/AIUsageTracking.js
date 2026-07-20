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
exports.AIUsageTracking = exports.AIFeatureType = void 0;
const typeorm_1 = require("typeorm");
var AIFeatureType;
(function (AIFeatureType) {
    AIFeatureType["BRIEFING_GENERATION"] = "briefing_generation";
    AIFeatureType["MISSION_SUMMARY"] = "mission_summary";
})(AIFeatureType || (exports.AIFeatureType = AIFeatureType = {}));
let AIUsageTracking = class AIUsageTracking {
    id;
    organizationId;
    featureType;
    usageDate;
    requestCount;
    promptTokens;
    completionTokens;
    totalTokens;
    lastModelUsed;
    lastRequestByUserId;
    createdAt;
    updatedAt;
};
exports.AIUsageTracking = AIUsageTracking;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AIUsageTracking.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AIUsageTracking.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: AIFeatureType, default: AIFeatureType.BRIEFING_GENERATION }),
    __metadata("design:type", String)
], AIUsageTracking.prototype, "featureType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date' }),
    __metadata("design:type", String)
], AIUsageTracking.prototype, "usageDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], AIUsageTracking.prototype, "requestCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], AIUsageTracking.prototype, "promptTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], AIUsageTracking.prototype, "completionTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], AIUsageTracking.prototype, "totalTokens", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], AIUsageTracking.prototype, "lastModelUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], AIUsageTracking.prototype, "lastRequestByUserId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AIUsageTracking.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], AIUsageTracking.prototype, "updatedAt", void 0);
exports.AIUsageTracking = AIUsageTracking = __decorate([
    (0, typeorm_1.Entity)('ai_usage_tracking'),
    (0, typeorm_1.Index)(['organizationId', 'featureType', 'usageDate'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId', 'usageDate'])
], AIUsageTracking);
//# sourceMappingURL=AIUsageTracking.js.map