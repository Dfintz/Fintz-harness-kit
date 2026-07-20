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
exports.UserShip = exports.ShipSharingLevel = exports.ShipCondition = exports.ShipOwnershipStatus = void 0;
const typeorm_1 = require("typeorm");
var ShipOwnershipStatus;
(function (ShipOwnershipStatus) {
    ShipOwnershipStatus["OWNED"] = "owned";
    ShipOwnershipStatus["PLEDGED"] = "pledged";
    ShipOwnershipStatus["LOANED"] = "loaned";
    ShipOwnershipStatus["GIFTED"] = "gifted";
    ShipOwnershipStatus["LOST"] = "lost";
    ShipOwnershipStatus["DESTROYED"] = "destroyed";
    ShipOwnershipStatus["SOLD"] = "sold";
})(ShipOwnershipStatus || (exports.ShipOwnershipStatus = ShipOwnershipStatus = {}));
var ShipCondition;
(function (ShipCondition) {
    ShipCondition["PRISTINE"] = "pristine";
    ShipCondition["EXCELLENT"] = "excellent";
    ShipCondition["GOOD"] = "good";
    ShipCondition["FAIR"] = "fair";
    ShipCondition["POOR"] = "poor";
    ShipCondition["DAMAGED"] = "damaged";
    ShipCondition["CRITICAL"] = "critical";
})(ShipCondition || (exports.ShipCondition = ShipCondition = {}));
var ShipSharingLevel;
(function (ShipSharingLevel) {
    ShipSharingLevel["PRIVATE"] = "private";
    ShipSharingLevel["PERSONAL"] = "personal";
    ShipSharingLevel["SHARED_USERS"] = "shared_users";
    ShipSharingLevel["ORGANIZATION"] = "organization";
    ShipSharingLevel["ALLIANCE"] = "alliance";
    ShipSharingLevel["PUBLIC"] = "public";
})(ShipSharingLevel || (exports.ShipSharingLevel = ShipSharingLevel = {}));
let UserShip = class UserShip {
    id;
    userId;
    shipId;
    shipName;
    customName;
    status;
    condition;
    acquiredDate;
    acquiredPrice;
    acquiredCurrency;
    insuranceLevel;
    insuranceExpires;
    location;
    hangar;
    loanedFrom;
    loanedTo;
    loanExpires;
    description;
    notes;
    modifications;
    flightHours;
    missionsCompleted;
    totalEarnings;
    tags;
    sharingLevel;
    useCustomVisibility;
    sharedWithUsers;
    visibleToOrganization;
    classificationChangedBy;
    classificationChangedAt;
    classificationReason;
    erkulLoadoutUrl;
    isActive;
    createdAt;
    updatedAt;
    deletedAt;
    isLoaned() {
        return this.status === ShipOwnershipStatus.LOANED;
    }
    needsInsuranceRenewal() {
        if (!this.insuranceExpires) {
            return false;
        }
        const daysUntilExpiry = Math.floor((this.insuranceExpires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 30;
    }
    getDisplayName() {
        return this.customName || this.shipName;
    }
    isOperational() {
        return (this.condition !== ShipCondition.DAMAGED &&
            this.condition !== ShipCondition.CRITICAL &&
            this.status !== ShipOwnershipStatus.DESTROYED &&
            this.status !== ShipOwnershipStatus.LOST &&
            this.status !== ShipOwnershipStatus.SOLD);
    }
    isSharedWithOrg() {
        return (this.sharingLevel === ShipSharingLevel.ORGANIZATION ||
            this.sharingLevel === ShipSharingLevel.ALLIANCE);
    }
    isSharedWithUser(userId) {
        if (this.userId === userId) {
            return true;
        }
        if (this.sharingLevel === ShipSharingLevel.PERSONAL) {
            return false;
        }
        if (this.sharingLevel === ShipSharingLevel.SHARED_USERS) {
            return (this.sharedWithUsers || []).includes(userId);
        }
        return true;
    }
    isSharedWithAlliance() {
        return this.sharingLevel === ShipSharingLevel.ALLIANCE;
    }
};
exports.UserShip = UserShip;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserShip.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserShip.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "shipId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], UserShip.prototype, "shipName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "customName", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ShipOwnershipStatus,
        default: ShipOwnershipStatus.OWNED,
    }),
    __metadata("design:type", String)
], UserShip.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ShipCondition,
        default: ShipCondition.GOOD,
    }),
    __metadata("design:type", String)
], UserShip.prototype, "condition", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], UserShip.prototype, "acquiredDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], UserShip.prototype, "acquiredPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "acquiredCurrency", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "insuranceLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], UserShip.prototype, "insuranceExpires", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "hangar", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "loanedFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "loanedTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], UserShip.prototype, "loanExpires", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)('jsonb', { nullable: true }),
    __metadata("design:type", Object)
], UserShip.prototype, "modifications", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], UserShip.prototype, "flightHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], UserShip.prototype, "missionsCompleted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], UserShip.prototype, "totalEarnings", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], UserShip.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ShipSharingLevel,
        default: ShipSharingLevel.ORGANIZATION,
    }),
    __metadata("design:type", String)
], UserShip.prototype, "sharingLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], UserShip.prototype, "useCustomVisibility", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], UserShip.prototype, "sharedWithUsers", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], UserShip.prototype, "visibleToOrganization", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "classificationChangedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], UserShip.prototype, "classificationChangedAt", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "classificationReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], UserShip.prototype, "erkulLoadoutUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], UserShip.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserShip.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserShip.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)(),
    __metadata("design:type", Date)
], UserShip.prototype, "deletedAt", void 0);
exports.UserShip = UserShip = __decorate([
    (0, typeorm_1.Entity)('user_ships'),
    (0, typeorm_1.Index)(['userId', 'status']),
    (0, typeorm_1.Index)(['userId', 'shipId']),
    (0, typeorm_1.Index)(['insuranceExpires']),
    (0, typeorm_1.Index)(['userId', 'insuranceExpires'])
], UserShip);
//# sourceMappingURL=UserShip.js.map