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
exports.PollVote = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const Poll_1 = require("./Poll");
let PollVote = class PollVote extends TenantEntity_1.TenantEntity {
    id;
    pollId;
    userId;
    optionId;
    rank;
    poll;
    createdAt;
};
exports.PollVote = PollVote;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PollVote.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], PollVote.prototype, "pollId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], PollVote.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], PollVote.prototype, "optionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], PollVote.prototype, "rank", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Poll_1.Poll, poll => poll.votes, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'pollId' }),
    __metadata("design:type", Poll_1.Poll)
], PollVote.prototype, "poll", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PollVote.prototype, "createdAt", void 0);
exports.PollVote = PollVote = __decorate([
    (0, typeorm_1.Entity)('poll_votes'),
    (0, typeorm_1.Index)(['pollId', 'userId', 'optionId'], { unique: true }),
    (0, typeorm_1.Index)(['pollId']),
    (0, typeorm_1.Index)(['userId'])
], PollVote);
//# sourceMappingURL=PollVote.js.map