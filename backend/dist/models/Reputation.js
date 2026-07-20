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
exports.Reputation = exports.ReputationCategory = void 0;
const typeorm_1 = require("typeorm");
var ReputationCategory;
(function (ReputationCategory) {
    ReputationCategory["COMBAT"] = "combat";
    ReputationCategory["TRADING"] = "trading";
    ReputationCategory["MINING"] = "mining";
    ReputationCategory["EXPLORATION"] = "exploration";
    ReputationCategory["RELIABILITY"] = "reliability";
    ReputationCategory["LEADERSHIP"] = "leadership";
})(ReputationCategory || (exports.ReputationCategory = ReputationCategory = {}));
let Reputation = class Reputation {
    id;
    userId;
    scores;
    overallScore;
    history;
    lastUpdated;
    createdAt;
};
exports.Reputation = Reputation;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], Reputation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Reputation.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], Reputation.prototype, "scores", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Reputation.prototype, "overallScore", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], Reputation.prototype, "history", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Reputation.prototype, "lastUpdated", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Reputation.prototype, "createdAt", void 0);
exports.Reputation = Reputation = __decorate([
    (0, typeorm_1.Entity)('reputation')
], Reputation);
//# sourceMappingURL=Reputation.js.map