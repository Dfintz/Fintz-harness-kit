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
exports.JobApplication = exports.JobApplicationType = exports.JobApplicationStatus = void 0;
const typeorm_1 = require("typeorm");
const PublicJobListing_1 = require("./PublicJobListing");
const User_1 = require("./User");
var JobApplicationStatus;
(function (JobApplicationStatus) {
    JobApplicationStatus["PENDING"] = "pending";
    JobApplicationStatus["APPROVED"] = "approved";
    JobApplicationStatus["REJECTED"] = "rejected";
    JobApplicationStatus["WAITLISTED"] = "waitlisted";
    JobApplicationStatus["WITHDRAWN"] = "withdrawn";
})(JobApplicationStatus || (exports.JobApplicationStatus = JobApplicationStatus = {}));
var JobApplicationType;
(function (JobApplicationType) {
    JobApplicationType["CREW"] = "crew";
    JobApplicationType["PASSENGER"] = "passenger";
    JobApplicationType["VEHICLE"] = "vehicle";
    JobApplicationType["GENERAL"] = "general";
})(JobApplicationType || (exports.JobApplicationType = JobApplicationType = {}));
let JobApplication = class JobApplication {
    id;
    jobListingId;
    jobListing;
    applicantUserId;
    applicant;
    applicationType;
    status;
    applicantDisplayName;
    message;
    shipIndex;
    roleIndex;
    roleName;
    shipName;
    passengerShipIndex;
    passengerRole;
    vehicleName;
    formResponses;
    reviewedBy;
    reviewNote;
    reviewedAt;
    waitlistPosition;
    createdAt;
    updatedAt;
};
exports.JobApplication = JobApplication;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], JobApplication.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], JobApplication.prototype, "jobListingId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => PublicJobListing_1.PublicJobListing, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'jobListingId' }),
    __metadata("design:type", PublicJobListing_1.PublicJobListing)
], JobApplication.prototype, "jobListing", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], JobApplication.prototype, "applicantUserId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'applicantUserId' }),
    __metadata("design:type", User_1.User)
], JobApplication.prototype, "applicant", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: JobApplicationType,
        default: JobApplicationType.GENERAL,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], JobApplication.prototype, "applicationType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: JobApplicationStatus,
        default: JobApplicationStatus.PENDING,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], JobApplication.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], JobApplication.prototype, "applicantDisplayName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], JobApplication.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], JobApplication.prototype, "shipIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], JobApplication.prototype, "roleIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], JobApplication.prototype, "roleName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], JobApplication.prototype, "shipName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], JobApplication.prototype, "passengerShipIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], JobApplication.prototype, "passengerRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], JobApplication.prototype, "vehicleName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], JobApplication.prototype, "formResponses", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], JobApplication.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], JobApplication.prototype, "reviewNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], JobApplication.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], JobApplication.prototype, "waitlistPosition", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], JobApplication.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], JobApplication.prototype, "updatedAt", void 0);
exports.JobApplication = JobApplication = __decorate([
    (0, typeorm_1.Entity)('job_applications')
], JobApplication);
//# sourceMappingURL=JobApplication.js.map