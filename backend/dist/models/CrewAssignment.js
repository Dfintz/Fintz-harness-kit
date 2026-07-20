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
exports.CrewAssignment = exports.AssignmentStatus = exports.CrewRole = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
var CrewRole;
(function (CrewRole) {
    CrewRole["CAPTAIN"] = "captain";
    CrewRole["PILOT"] = "pilot";
    CrewRole["ENGINEER"] = "engineer";
    CrewRole["GUNNER"] = "gunner";
    CrewRole["MEDIC"] = "medic";
    CrewRole["CARGO"] = "cargo";
    CrewRole["NAVIGATOR"] = "navigator";
})(CrewRole || (exports.CrewRole = CrewRole = {}));
var AssignmentStatus;
(function (AssignmentStatus) {
    AssignmentStatus["ACTIVE"] = "active";
    AssignmentStatus["INACTIVE"] = "inactive";
    AssignmentStatus["COMPLETED"] = "completed";
})(AssignmentStatus || (exports.AssignmentStatus = AssignmentStatus = {}));
let CrewAssignment = class CrewAssignment {
    id;
    organizationId;
    organization;
    shipId;
    missionId;
    assignerId;
    crew;
    startDate;
    endDate;
    status;
    notes;
    createdAt;
    updatedAt;
};
exports.CrewAssignment = CrewAssignment;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], CrewAssignment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CrewAssignment.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], CrewAssignment.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CrewAssignment.prototype, "shipId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], CrewAssignment.prototype, "missionId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], CrewAssignment.prototype, "assignerId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], CrewAssignment.prototype, "crew", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CrewAssignment.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], CrewAssignment.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        default: AssignmentStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], CrewAssignment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], CrewAssignment.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], CrewAssignment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], CrewAssignment.prototype, "updatedAt", void 0);
exports.CrewAssignment = CrewAssignment = __decorate([
    (0, typeorm_1.Entity)('crew_assignments'),
    (0, typeorm_1.Index)('idx_crew_assignment_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_crew_assignment_ship', ['shipId'])
], CrewAssignment);
//# sourceMappingURL=CrewAssignment.js.map