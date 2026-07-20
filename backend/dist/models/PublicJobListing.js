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
exports.PublicJobListing = exports.ListingCategory = exports.ListingOwnerType = exports.PayType = exports.JobType = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const PublicOrgProfile_1 = require("./PublicOrgProfile");
var JobType;
(function (JobType) {
    JobType["CREW"] = "crew";
    JobType["PILOT"] = "pilot";
    JobType["GUNNER"] = "gunner";
    JobType["ENGINEER"] = "engineer";
    JobType["MEDIC"] = "medic";
    JobType["MINER"] = "miner";
    JobType["HAULER"] = "hauler";
    JobType["SCOUT"] = "scout";
    JobType["SECURITY"] = "security";
    JobType["LEADERSHIP"] = "leadership";
    JobType["SUPPORT"] = "support";
    JobType["OTHER"] = "other";
})(JobType || (exports.JobType = JobType = {}));
var PayType;
(function (PayType) {
    PayType["FIXED"] = "fixed";
    PayType["HOURLY"] = "hourly";
    PayType["PERCENTAGE"] = "percentage";
    PayType["NEGOTIABLE"] = "negotiable";
    PayType["VOLUNTEER"] = "volunteer";
})(PayType || (exports.PayType = PayType = {}));
var ListingOwnerType;
(function (ListingOwnerType) {
    ListingOwnerType["ORGANIZATION"] = "organization";
    ListingOwnerType["ALLIANCE"] = "alliance";
    ListingOwnerType["USER"] = "user";
})(ListingOwnerType || (exports.ListingOwnerType = ListingOwnerType = {}));
var ListingCategory;
(function (ListingCategory) {
    ListingCategory["JOB"] = "job";
    ListingCategory["SERVICE"] = "service";
})(ListingCategory || (exports.ListingCategory = ListingCategory = {}));
let PublicJobListing = class PublicJobListing {
    id;
    organizationId;
    organization;
    allianceId;
    ownerType;
    listingCategory;
    title;
    description;
    jobType;
    focus;
    payType;
    payMin;
    payMax;
    experienceLevel;
    isActive;
    postedAt;
    expiresAt;
    createdBy;
    contactInfo;
    timezone;
    languages;
    tags;
    crewSpotsTotal;
    crewSpotsFilled;
    requiredShips;
    shipRequirementType;
    shipCrewBreakdown;
    approvedVehicles;
    createdAt;
    updatedAt;
    isExpired() {
        if (!this.expiresAt) {
            return false;
        }
        return new Date() > this.expiresAt;
    }
    isVisible() {
        return this.isActive && !this.isExpired();
    }
    getPayDisplay() {
        if (!this.payType) {
            return 'Not specified';
        }
        if (this.payType === PayType.VOLUNTEER) {
            return 'Volunteer';
        }
        if (this.payType === PayType.NEGOTIABLE) {
            return 'Negotiable';
        }
        const suffix = this.payType === PayType.PERCENTAGE ? '%' : ' aUEC';
        const hourlyIndicator = this.payType === PayType.HOURLY ? '/hr' : '';
        if (this.payMin && this.payMax) {
            return `${this.payMin.toLocaleString()}-${this.payMax.toLocaleString()}${suffix}${hourlyIndicator}`;
        }
        if (this.payMin) {
            return `From ${this.payMin.toLocaleString()}${suffix}${hourlyIndicator}`;
        }
        if (this.payMax) {
            return `Up to ${this.payMax.toLocaleString()}${suffix}${hourlyIndicator}`;
        }
        return 'Negotiable';
    }
};
exports.PublicJobListing = PublicJobListing;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PublicJobListing.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], PublicJobListing.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { nullable: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], PublicJobListing.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], PublicJobListing.prototype, "allianceId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ListingOwnerType,
        default: ListingOwnerType.ORGANIZATION,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], PublicJobListing.prototype, "ownerType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ListingCategory,
        default: ListingCategory.JOB,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], PublicJobListing.prototype, "listingCategory", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], PublicJobListing.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], PublicJobListing.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: JobType,
        default: JobType.CREW,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], PublicJobListing.prototype, "jobType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PublicOrgProfile_1.OrgPrimaryFocus,
        default: PublicOrgProfile_1.OrgPrimaryFocus.MIXED,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], PublicJobListing.prototype, "focus", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PayType,
        nullable: true,
    }),
    __metadata("design:type", String)
], PublicJobListing.prototype, "payType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], PublicJobListing.prototype, "payMin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], PublicJobListing.prototype, "payMax", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PublicJobListing.prototype, "experienceLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Boolean)
], PublicJobListing.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', default: () => 'NOW()' }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], PublicJobListing.prototype, "postedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], PublicJobListing.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PublicJobListing.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], PublicJobListing.prototype, "contactInfo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], PublicJobListing.prototype, "timezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], PublicJobListing.prototype, "languages", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], PublicJobListing.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], PublicJobListing.prototype, "crewSpotsTotal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PublicJobListing.prototype, "crewSpotsFilled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Array)
], PublicJobListing.prototype, "requiredShips", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true, default: 'none' }),
    __metadata("design:type", String)
], PublicJobListing.prototype, "shipRequirementType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], PublicJobListing.prototype, "shipCrewBreakdown", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true, default: '[]' }),
    __metadata("design:type", Object)
], PublicJobListing.prototype, "approvedVehicles", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], PublicJobListing.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], PublicJobListing.prototype, "updatedAt", void 0);
exports.PublicJobListing = PublicJobListing = __decorate([
    (0, typeorm_1.Entity)('public_job_listings')
], PublicJobListing);
//# sourceMappingURL=PublicJobListing.js.map