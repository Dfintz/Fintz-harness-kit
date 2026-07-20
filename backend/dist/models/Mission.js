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
var Mission_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mission = exports.MissionPriority = exports.MissionDifficulty = exports.MissionStatus = exports.MissionType = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const Fleet_1 = require("./Fleet");
var MissionType;
(function (MissionType) {
    MissionType["COMBAT"] = "combat";
    MissionType["MINING"] = "mining";
    MissionType["TRADING"] = "trading";
    MissionType["EXPLORATION"] = "exploration";
    MissionType["LOGISTICS"] = "logistics";
    MissionType["RESCUE"] = "rescue";
    MissionType["RECONNAISSANCE"] = "reconnaissance";
    MissionType["ESCORT"] = "escort";
    MissionType["SALVAGE"] = "salvage";
    MissionType["CUSTOM"] = "custom";
})(MissionType || (exports.MissionType = MissionType = {}));
var MissionStatus;
(function (MissionStatus) {
    MissionStatus["DRAFT"] = "draft";
    MissionStatus["PLANNED"] = "planned";
    MissionStatus["BRIEFED"] = "briefed";
    MissionStatus["IN_PROGRESS"] = "in_progress";
    MissionStatus["COMPLETED"] = "completed";
    MissionStatus["FAILED"] = "failed";
    MissionStatus["CANCELLED"] = "cancelled";
})(MissionStatus || (exports.MissionStatus = MissionStatus = {}));
var MissionDifficulty;
(function (MissionDifficulty) {
    MissionDifficulty["TRIVIAL"] = "trivial";
    MissionDifficulty["EASY"] = "easy";
    MissionDifficulty["MEDIUM"] = "medium";
    MissionDifficulty["HARD"] = "hard";
    MissionDifficulty["EXTREME"] = "extreme";
})(MissionDifficulty || (exports.MissionDifficulty = MissionDifficulty = {}));
var MissionPriority;
(function (MissionPriority) {
    MissionPriority["LOW"] = "low";
    MissionPriority["NORMAL"] = "normal";
    MissionPriority["HIGH"] = "high";
    MissionPriority["CRITICAL"] = "critical";
})(MissionPriority || (exports.MissionPriority = MissionPriority = {}));
let Mission = class Mission extends TenantEntity_1.TenantEntity {
    static { Mission_1 = this; }
    id;
    title;
    description;
    missionType;
    status;
    difficulty;
    priority;
    createdBy;
    assignedTo;
    fleetId;
    fleet;
    linkedActivityId;
    location;
    objectives;
    participants;
    tags;
    sourceReference;
    reward;
    startDate;
    endDate;
    completedAt;
    notes;
    createdAt;
    updatedAt;
    isActive() {
        return this.status === MissionStatus.IN_PROGRESS;
    }
    isTerminal() {
        return [MissionStatus.COMPLETED, MissionStatus.FAILED, MissionStatus.CANCELLED].includes(this.status);
    }
    static STATUS_TRANSITIONS = shared_types_1.MISSION_STATUS_TRANSITIONS;
    canTransitionTo(newStatus) {
        return Mission_1.STATUS_TRANSITIONS[this.status]?.includes(newStatus) ?? false;
    }
};
exports.Mission = Mission;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Mission.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 200 }),
    __metadata("design:type", String)
], Mission.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Mission.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: MissionType, default: MissionType.CUSTOM }),
    __metadata("design:type", String)
], Mission.prototype, "missionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: MissionStatus, default: MissionStatus.DRAFT }),
    __metadata("design:type", String)
], Mission.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: MissionDifficulty, default: MissionDifficulty.MEDIUM }),
    __metadata("design:type", String)
], Mission.prototype, "difficulty", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: MissionPriority, default: MissionPriority.NORMAL }),
    __metadata("design:type", String)
], Mission.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Mission.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Mission.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.Index)('idx_mission_fleet'),
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Mission.prototype, "fleetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Fleet_1.Fleet, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'fleetId' }),
    __metadata("design:type", Fleet_1.Fleet)
], Mission.prototype, "fleet", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Mission.prototype, "linkedActivityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", String)
], Mission.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true, default: '[]' }),
    __metadata("design:type", Array)
], Mission.prototype, "objectives", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true, default: '[]' }),
    __metadata("design:type", Array)
], Mission.prototype, "participants", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true, default: '' }),
    __metadata("design:type", Array)
], Mission.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Mission.prototype, "sourceReference", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Mission.prototype, "reward", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Mission.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Mission.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Mission.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Mission.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Mission.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Mission.prototype, "updatedAt", void 0);
exports.Mission = Mission = Mission_1 = __decorate([
    (0, typeorm_1.Entity)('missions'),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'missionType']),
    (0, typeorm_1.Index)(['organizationId', 'createdBy']),
    (0, typeorm_1.Index)(['organizationId', 'createdAt'])
], Mission);
//# sourceMappingURL=Mission.js.map