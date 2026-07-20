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
exports.ActivityParticipantEntity = exports.ActivityParticipantStatus = void 0;
const typeorm_1 = require("typeorm");
const Activity_1 = require("./Activity");
var ActivityParticipantStatus;
(function (ActivityParticipantStatus) {
    ActivityParticipantStatus["INVITED"] = "invited";
    ActivityParticipantStatus["ACCEPTED"] = "accepted";
    ActivityParticipantStatus["DECLINED"] = "declined";
    ActivityParticipantStatus["STANDBY"] = "standby";
})(ActivityParticipantStatus || (exports.ActivityParticipantStatus = ActivityParticipantStatus = {}));
let ActivityParticipantEntity = class ActivityParticipantEntity {
    id;
    activityId;
    userId;
    userName;
    avatarUrl;
    organizationId;
    organizationName;
    role;
    status;
    joinedAt;
    shipType;
    shipName;
    shipId;
    crewPosition;
    crewShipId;
    reputation;
    notes;
    message;
    metadata;
    updatedAt;
    activity;
};
exports.ActivityParticipantEntity = ActivityParticipantEntity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "activityId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "userName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "avatarUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "organizationName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 50,
        default: Activity_1.ParticipantRole.MEMBER,
    }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: ActivityParticipantStatus.ACCEPTED,
    }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ActivityParticipantEntity.prototype, "joinedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "shipType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "shipName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "shipId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, length: 50 }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "crewPosition", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "crewShipId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ActivityParticipantEntity.prototype, "reputation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ActivityParticipantEntity.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], ActivityParticipantEntity.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], ActivityParticipantEntity.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('Activity', { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'activityId' }),
    __metadata("design:type", Object)
], ActivityParticipantEntity.prototype, "activity", void 0);
exports.ActivityParticipantEntity = ActivityParticipantEntity = __decorate([
    (0, typeorm_1.Entity)('activity_participants'),
    (0, typeorm_1.Unique)('UQ_activity_participant', ['activityId', 'userId']),
    (0, typeorm_1.Index)('IDX_activity_participants_user', ['userId']),
    (0, typeorm_1.Index)('IDX_activity_participants_activity', ['activityId']),
    (0, typeorm_1.Index)('IDX_activity_participants_status', ['activityId', 'status'])
], ActivityParticipantEntity);
//# sourceMappingURL=ActivityParticipant.js.map