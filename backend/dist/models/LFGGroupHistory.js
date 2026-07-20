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
exports.LFGGroupHistory = void 0;
const typeorm_1 = require("typeorm");
let LFGGroupHistory = class LFGGroupHistory {
    id;
    lfgPostId;
    activity;
    description;
    creatorId;
    creatorName;
    participantIds;
    participantCount;
    guildId;
    channelId;
    wasSuccessful;
    durationMinutes;
    completionNotes;
    completedAt;
    userId;
    getSuccessScore() {
        return this.wasSuccessful ? 100 : 0;
    }
    getSummary() {
        return {
            activity: this.activity,
            participants: this.participantCount,
            successful: this.wasSuccessful,
            duration: this.durationMinutes,
        };
    }
};
exports.LFGGroupHistory = LFGGroupHistory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LFGGroupHistory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], LFGGroupHistory.prototype, "lfgPostId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], LFGGroupHistory.prototype, "activity", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LFGGroupHistory.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], LFGGroupHistory.prototype, "creatorId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LFGGroupHistory.prototype, "creatorName", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], LFGGroupHistory.prototype, "participantIds", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], LFGGroupHistory.prototype, "participantCount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], LFGGroupHistory.prototype, "guildId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], LFGGroupHistory.prototype, "channelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], LFGGroupHistory.prototype, "wasSuccessful", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], LFGGroupHistory.prototype, "durationMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], LFGGroupHistory.prototype, "completionNotes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], LFGGroupHistory.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], LFGGroupHistory.prototype, "userId", void 0);
exports.LFGGroupHistory = LFGGroupHistory = __decorate([
    (0, typeorm_1.Entity)('lfg_group_history')
], LFGGroupHistory);
//# sourceMappingURL=LFGGroupHistory.js.map