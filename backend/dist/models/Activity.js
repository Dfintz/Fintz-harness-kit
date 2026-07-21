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
exports.Activity = exports.ApplicationStatus = exports.DifficultyLevel = exports.PaymentType = exports.ParticipantRole = exports.ActivityVisibility = exports.ActivityStatus = exports.ActivityType = void 0;
const typeorm_1 = require("typeorm");
const OptionalTenantEntity_1 = require("./base/OptionalTenantEntity");
var ActivityType;
(function (ActivityType) {
    ActivityType["MISSION"] = "mission";
    ActivityType["CONTRACT"] = "contract";
    ActivityType["BOUNTY"] = "bounty";
    ActivityType["EVENT"] = "event";
    ActivityType["LFG"] = "lfg";
    ActivityType["OPERATION"] = "operation";
    ActivityType["RECRUITMENT"] = "recruitment";
    ActivityType["JOB_LISTING"] = "job_listing";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
var ActivityStatus;
(function (ActivityStatus) {
    ActivityStatus["DRAFT"] = "draft";
    ActivityStatus["OPEN"] = "open";
    ActivityStatus["PLANNING"] = "planning";
    ActivityStatus["RECRUITING"] = "recruiting";
    ActivityStatus["READY"] = "ready";
    ActivityStatus["IN_PROGRESS"] = "in_progress";
    ActivityStatus["COMPLETED"] = "completed";
    ActivityStatus["FAILED"] = "failed";
    ActivityStatus["CANCELLED"] = "cancelled";
    ActivityStatus["EXPIRED"] = "expired";
})(ActivityStatus || (exports.ActivityStatus = ActivityStatus = {}));
var ActivityVisibility;
(function (ActivityVisibility) {
    ActivityVisibility["PUBLIC"] = "public";
    ActivityVisibility["ORGANIZATION"] = "organization";
    ActivityVisibility["CROSS_ORG"] = "cross_org";
    ActivityVisibility["ALLIANCE"] = "alliance";
    ActivityVisibility["PRIVATE"] = "private";
    ActivityVisibility["LISTED"] = "listed";
})(ActivityVisibility || (exports.ActivityVisibility = ActivityVisibility = {}));
var ParticipantRole;
(function (ParticipantRole) {
    ParticipantRole["LEADER"] = "leader";
    ParticipantRole["CO_LEADER"] = "co_leader";
    ParticipantRole["COMMANDER"] = "commander";
    ParticipantRole["PILOT"] = "pilot";
    ParticipantRole["GUNNER"] = "gunner";
    ParticipantRole["ENGINEER"] = "engineer";
    ParticipantRole["MEDIC"] = "medic";
    ParticipantRole["SCOUT"] = "scout";
    ParticipantRole["TANK"] = "tank";
    ParticipantRole["DPS"] = "dps";
    ParticipantRole["SUPPORT"] = "support";
    ParticipantRole["CONTRACTOR"] = "contractor";
    ParticipantRole["CLIENT"] = "client";
    ParticipantRole["HUNTER"] = "hunter";
    ParticipantRole["MEMBER"] = "member";
    ParticipantRole["ANY"] = "any";
})(ParticipantRole || (exports.ParticipantRole = ParticipantRole = {}));
var PaymentType;
(function (PaymentType) {
    PaymentType["FIXED"] = "fixed";
    PaymentType["HOURLY"] = "hourly";
    PaymentType["PERCENTAGE"] = "percentage";
    PaymentType["NEGOTIABLE"] = "negotiable";
})(PaymentType || (exports.PaymentType = PaymentType = {}));
var DifficultyLevel;
(function (DifficultyLevel) {
    DifficultyLevel["EASY"] = "easy";
    DifficultyLevel["MEDIUM"] = "medium";
    DifficultyLevel["HARD"] = "hard";
    DifficultyLevel["EXPERT"] = "expert";
})(DifficultyLevel || (exports.DifficultyLevel = DifficultyLevel = {}));
var ApplicationStatus;
(function (ApplicationStatus) {
    ApplicationStatus["PENDING"] = "pending";
    ApplicationStatus["UNDER_REVIEW"] = "under_review";
    ApplicationStatus["INTERVIEW_SCHEDULED"] = "interview_scheduled";
    ApplicationStatus["ACCEPTED"] = "accepted";
    ApplicationStatus["REJECTED"] = "rejected";
    ApplicationStatus["WITHDRAWN"] = "withdrawn";
    ApplicationStatus["WAITLISTED"] = "waitlisted";
    ApplicationStatus["COMPLETED"] = "completed";
})(ApplicationStatus || (exports.ApplicationStatus = ApplicationStatus = {}));
let Activity = class Activity extends OptionalTenantEntity_1.OptionalTenantEntity {
    id;
    title;
    description;
    activityType;
    status;
    visibility;
    creatorId;
    creatorName;
    organizationName;
    teamId;
    team;
    participatingOrgs;
    invitedOrgs;
    alliedOrgs;
    participants;
    currentParticipants;
    actualParticipants;
    maxParticipants;
    minParticipants;
    waitlist;
    roleRequirements;
    resourceRequirements;
    scheduledStartDate;
    scheduledEndDate;
    timezone;
    estimatedDuration;
    actualStartDate;
    actualEndDate;
    startedAt;
    completedAt;
    cancelledAt;
    actualDuration;
    location;
    systemLocation;
    difficulty;
    voiceChannel;
    voiceChannelId;
    voiceChannelName;
    discordEventId;
    routePlan;
    totalDistance;
    totalEstimatedTime;
    totalCargoCapacity;
    totalQuantumFuel;
    totalQuantumFuelRequired;
    maxJumpRange;
    hasRefuelShip;
    shipAssignments;
    ships;
    shipRequirementType;
    requiredShips;
    requiredShipTypes;
    totalCrewCapacity;
    totalCrewAssigned;
    miningData;
    isMiningOperation;
    targetResources;
    rewardCredits;
    rewardReputation;
    rewardItems;
    paymentType;
    paymentAmount;
    currency;
    paymentNotes;
    difficultyLevel;
    applications;
    currentApplicants;
    maxApplicants;
    contractorRequirements;
    screeningEnabled;
    autoAcceptQualified;
    applicationQuestions;
    rolesNeeded;
    requirements;
    expiresAt;
    bannerImageUrl;
    contactName;
    contactEmail;
    contactDiscord;
    tags;
    categories;
    metadata;
    linkedMissionId;
    linkedContractId;
    linkedBountyId;
    linkedEventId;
    parentActivityId;
    completionReport;
    isFeatured;
    isUrgent;
    requiresApproval;
    notes;
    createdAt;
    updatedAt;
    get isMultiOrg() {
        return (this.participatingOrgs.length > 1 ||
            this.visibility === ActivityVisibility.CROSS_ORG ||
            this.visibility === ActivityVisibility.ALLIANCE);
    }
    get isFull() {
        return this.maxParticipants !== undefined && this.currentParticipants >= this.maxParticipants;
    }
    get hasStarted() {
        return this.actualStartDate !== undefined && this.actualStartDate <= new Date();
    }
    get isExpired() {
        if (!this.scheduledEndDate) {
            return false;
        }
        return new Date() > this.scheduledEndDate;
    }
    get canJoin() {
        return (this.status === ActivityStatus.OPEN ||
            (this.status === ActivityStatus.RECRUITING && !this.isFull && !this.hasStarted));
    }
};
exports.Activity = Activity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Activity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Activity.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], Activity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ActivityType,
    }),
    __metadata("design:type", String)
], Activity.prototype, "activityType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ActivityStatus,
        default: ActivityStatus.DRAFT,
    }),
    __metadata("design:type", String)
], Activity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ActivityVisibility,
        default: ActivityVisibility.ORGANIZATION,
    }),
    __metadata("design:type", String)
], Activity.prototype, "visibility", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Activity.prototype, "creatorId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Activity.prototype, "creatorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "organizationName", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_activity_team'),
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "teamId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('Team', { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'teamId' }),
    __metadata("design:type", Function)
], Activity.prototype, "team", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { default: '[]' }),
    __metadata("design:type", Array)
], Activity.prototype, "participatingOrgs", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Activity.prototype, "invitedOrgs", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Activity.prototype, "alliedOrgs", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]', select: false }),
    __metadata("design:type", Array)
], Activity.prototype, "participants", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Activity.prototype, "currentParticipants", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "actualParticipants", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "maxParticipants", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], Activity.prototype, "minParticipants", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Activity.prototype, "waitlist", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Activity.prototype, "roleRequirements", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Activity.prototype, "resourceRequirements", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Activity.prototype, "scheduledStartDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Activity.prototype, "scheduledEndDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "estimatedDuration", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Activity.prototype, "actualStartDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Activity.prototype, "actualEndDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Activity.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Activity.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Activity.prototype, "cancelledAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "actualDuration", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "systemLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "difficulty", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "voiceChannel", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "voiceChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "voiceChannelName", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_activity_discord_event_id'),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "discordEventId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Activity.prototype, "routePlan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "totalDistance", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "totalEstimatedTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "totalCargoCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "totalQuantumFuel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "totalQuantumFuelRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "maxJumpRange", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false, nullable: true }),
    __metadata("design:type", Boolean)
], Activity.prototype, "hasRefuelShip", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Activity.prototype, "shipAssignments", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Activity.prototype, "ships", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true, default: 'none' }),
    __metadata("design:type", String)
], Activity.prototype, "shipRequirementType", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Activity.prototype, "requiredShips", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "requiredShipTypes", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "totalCrewCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "totalCrewAssigned", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "miningData", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Activity.prototype, "isMiningOperation", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "targetResources", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Activity.prototype, "rewardCredits", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Activity.prototype, "rewardReputation", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Array)
], Activity.prototype, "rewardItems", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PaymentType,
        nullable: true,
    }),
    __metadata("design:type", String)
], Activity.prototype, "paymentType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "paymentAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 10, default: 'aUEC' }),
    __metadata("design:type", String)
], Activity.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "paymentNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: DifficultyLevel,
        nullable: true,
    }),
    __metadata("design:type", String)
], Activity.prototype, "difficultyLevel", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], Activity.prototype, "applications", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Activity.prototype, "currentApplicants", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Activity.prototype, "maxApplicants", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "contractorRequirements", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Activity.prototype, "screeningEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Activity.prototype, "autoAcceptQualified", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { nullable: true }),
    __metadata("design:type", Array)
], Activity.prototype, "applicationQuestions", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Activity.prototype, "rolesNeeded", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "requirements", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Activity.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "bannerImageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "contactName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "contactEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "contactDiscord", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Activity.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Activity.prototype, "categories", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "linkedMissionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "linkedContractId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "linkedBountyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "linkedEventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "parentActivityId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Activity.prototype, "completionReport", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Activity.prototype, "isFeatured", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Activity.prototype, "isUrgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Activity.prototype, "requiresApproval", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Activity.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Activity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Activity.prototype, "updatedAt", void 0);
exports.Activity = Activity = __decorate([
    (0, typeorm_1.Entity)('activities'),
    (0, typeorm_1.Index)(['activityType', 'status']),
    (0, typeorm_1.Index)(['creatorId']),
    (0, typeorm_1.Index)(['scheduledStartDate']),
    (0, typeorm_1.Index)(['organizationId', 'activityType']),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'createdAt'])
], Activity);
//# sourceMappingURL=Activity.js.map