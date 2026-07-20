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
exports.Application = exports.OrgApplication = exports.ApplicationStatus = exports.OrgApplicationStatus = exports.ApplicantType = exports.ApplicationTargetType = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var ApplicationTargetType;
(function (ApplicationTargetType) {
    ApplicationTargetType["ORGANIZATION"] = "organization";
    ApplicationTargetType["ALLIANCE"] = "alliance";
    ApplicationTargetType["FEDERATION"] = "federation";
})(ApplicationTargetType || (exports.ApplicationTargetType = ApplicationTargetType = {}));
var ApplicantType;
(function (ApplicantType) {
    ApplicantType["USER"] = "user";
    ApplicantType["ORGANIZATION"] = "organization";
})(ApplicantType || (exports.ApplicantType = ApplicantType = {}));
var OrgApplicationStatus;
(function (OrgApplicationStatus) {
    OrgApplicationStatus["PENDING"] = "pending";
    OrgApplicationStatus["APPROVED"] = "approved";
    OrgApplicationStatus["REJECTED"] = "rejected";
    OrgApplicationStatus["WITHDRAWN"] = "withdrawn";
})(OrgApplicationStatus || (exports.ApplicationStatus = exports.OrgApplicationStatus = OrgApplicationStatus = {}));
let OrgApplication = class OrgApplication {
    id;
    targetType;
    applicantType;
    organizationId;
    organization;
    applicantUserId;
    applicant;
    status;
    message;
    formResponses;
    source;
    applicantOrgId;
    applicantOrgName;
    reviewedBy;
    reviewer;
    reviewNote;
    reviewedAt;
    createdAt;
    updatedAt;
};
exports.OrgApplication = OrgApplication;
exports.Application = OrgApplication;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrgApplication.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'organization',
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], OrgApplication.prototype, "targetType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'user',
    }),
    __metadata("design:type", String)
], OrgApplication.prototype, "applicantType", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], OrgApplication.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], OrgApplication.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], OrgApplication.prototype, "applicantUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'applicantUserId' }),
    __metadata("design:type", User_1.User)
], OrgApplication.prototype, "applicant", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: OrgApplicationStatus,
        default: OrgApplicationStatus.PENDING,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], OrgApplication.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrgApplication.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrgApplication.prototype, "formResponses", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", String)
], OrgApplication.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], OrgApplication.prototype, "applicantOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", String)
], OrgApplication.prototype, "applicantOrgName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], OrgApplication.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'reviewedBy' }),
    __metadata("design:type", User_1.User)
], OrgApplication.prototype, "reviewer", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrgApplication.prototype, "reviewNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrgApplication.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrgApplication.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrgApplication.prototype, "updatedAt", void 0);
exports.Application = exports.OrgApplication = OrgApplication = __decorate([
    (0, typeorm_1.Entity)('org_applications'),
    (0, typeorm_1.Index)(['organizationId', 'status'])
], OrgApplication);
//# sourceMappingURL=OrgApplication.js.map