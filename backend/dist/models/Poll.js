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
exports.Poll = exports.PollStatus = exports.PollVisibility = exports.PollType = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const PollVote_1 = require("./PollVote");
var PollType;
(function (PollType) {
    PollType["SINGLE_CHOICE"] = "single_choice";
    PollType["MULTIPLE_CHOICE"] = "multiple_choice";
    PollType["RANKED"] = "ranked";
    PollType["APPROVAL"] = "approval";
})(PollType || (exports.PollType = PollType = {}));
var PollVisibility;
(function (PollVisibility) {
    PollVisibility["PUBLIC"] = "public";
    PollVisibility["MEMBERS_ONLY"] = "members_only";
    PollVisibility["ROLE_RESTRICTED"] = "role_restricted";
})(PollVisibility || (exports.PollVisibility = PollVisibility = {}));
var PollStatus;
(function (PollStatus) {
    PollStatus["DRAFT"] = "draft";
    PollStatus["ACTIVE"] = "active";
    PollStatus["CLOSED"] = "closed";
    PollStatus["CANCELLED"] = "cancelled";
})(PollStatus || (exports.PollStatus = PollStatus = {}));
let Poll = class Poll extends TenantEntity_1.TenantEntity {
    id;
    title;
    description;
    pollType;
    visibility;
    options;
    isAnonymous;
    maxSelections;
    status;
    createdBy;
    createdByName;
    endsAt;
    closedBy;
    closedAt;
    allowedRoles;
    federationId;
    votingMode;
    votes;
    createdAt;
    updatedAt;
    version;
    get isActive() {
        return this.status === PollStatus.ACTIVE;
    }
    get isClosed() {
        return this.status === PollStatus.CLOSED || this.status === PollStatus.CANCELLED;
    }
    get isExpired() {
        if (!this.endsAt) {
            return false;
        }
        return new Date() > this.endsAt;
    }
};
exports.Poll = Poll;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Poll.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], Poll.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Poll.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], Poll.prototype, "pollType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: PollVisibility.MEMBERS_ONLY }),
    __metadata("design:type", String)
], Poll.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Array)
], Poll.prototype, "options", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Poll.prototype, "isAnonymous", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 1 }),
    __metadata("design:type", Number)
], Poll.prototype, "maxSelections", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: PollStatus.ACTIVE }),
    __metadata("design:type", String)
], Poll.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], Poll.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], Poll.prototype, "createdByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Poll.prototype, "endsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Poll.prototype, "closedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Poll.prototype, "closedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], Poll.prototype, "allowedRoles", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Poll.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true, default: 'equal' }),
    __metadata("design:type", String)
], Poll.prototype, "votingMode", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PollVote_1.PollVote, vote => vote.poll),
    __metadata("design:type", Array)
], Poll.prototype, "votes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Poll.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Poll.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.VersionColumn)(),
    __metadata("design:type", Number)
], Poll.prototype, "version", void 0);
exports.Poll = Poll = __decorate([
    (0, typeorm_1.Entity)('polls'),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'createdAt']),
    (0, typeorm_1.Index)(['status', 'endsAt']),
    (0, typeorm_1.Index)(['createdBy'])
], Poll);
//# sourceMappingURL=Poll.js.map