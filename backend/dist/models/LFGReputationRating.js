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
exports.LFGReputationRating = exports.ReputationCategory = void 0;
const typeorm_1 = require("typeorm");
var ReputationCategory;
(function (ReputationCategory) {
    ReputationCategory["COMMUNICATION"] = "communication";
    ReputationCategory["TEAMWORK"] = "teamwork";
    ReputationCategory["SKILL"] = "skill";
    ReputationCategory["RELIABILITY"] = "reliability";
    ReputationCategory["LEADERSHIP"] = "leadership";
})(ReputationCategory || (exports.ReputationCategory = ReputationCategory = {}));
let LFGReputationRating = class LFGReputationRating {
    id;
    sessionId;
    userId;
    raterId;
    overallRating;
    categoryRatings;
    comment;
    isPositive;
    createdAt;
    updatedAt;
    isPositiveRating() {
        return this.overallRating >= 4;
    }
    getAverageCategoryRating() {
        if (!this.categoryRatings) {
            return this.overallRating;
        }
        const ratings = Object.values(this.categoryRatings);
        if (ratings.length === 0) {
            return this.overallRating;
        }
        const sum = ratings.reduce((acc, val) => acc + (val || 0), 0);
        return sum / ratings.length;
    }
    getSummary() {
        return {
            overall: this.overallRating,
            isPositive: this.isPositiveRating(),
            categories: this.categoryRatings ? Object.keys(this.categoryRatings).length : 0,
            hasComment: !!this.comment,
        };
    }
};
exports.LFGReputationRating = LFGReputationRating;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LFGReputationRating.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], LFGReputationRating.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], LFGReputationRating.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], LFGReputationRating.prototype, "raterId", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], LFGReputationRating.prototype, "overallRating", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], LFGReputationRating.prototype, "categoryRatings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], LFGReputationRating.prototype, "comment", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], LFGReputationRating.prototype, "isPositive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], LFGReputationRating.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], LFGReputationRating.prototype, "updatedAt", void 0);
exports.LFGReputationRating = LFGReputationRating = __decorate([
    (0, typeorm_1.Entity)('lfg_reputation_ratings'),
    (0, typeorm_1.Index)(['userId', 'raterId'], { unique: true })
], LFGReputationRating);
//# sourceMappingURL=LFGReputationRating.js.map