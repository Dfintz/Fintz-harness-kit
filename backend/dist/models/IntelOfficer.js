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
exports.IntelOfficer = exports.IntelOfficerRank = void 0;
const typeorm_1 = require("typeorm");
const IntelEntry_1 = require("./IntelEntry");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var IntelOfficerRank;
(function (IntelOfficerRank) {
    IntelOfficerRank["JUNIOR"] = "junior";
    IntelOfficerRank["OFFICER"] = "officer";
    IntelOfficerRank["SENIOR"] = "senior";
    IntelOfficerRank["LEAD"] = "lead";
    IntelOfficerRank["CHIEF"] = "chief";
})(IntelOfficerRank || (exports.IntelOfficerRank = IntelOfficerRank = {}));
let IntelOfficer = class IntelOfficer {
    id;
    organizationId;
    organization;
    userId;
    user;
    rank;
    accessLevel;
    isActive;
    specializations;
    appointedBy;
    appointer;
    revokedBy;
    revoker;
    revokedAt;
    notes;
    appointedAt;
    updatedAt;
};
exports.IntelOfficer = IntelOfficer;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], IntelOfficer.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelOfficer.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], IntelOfficer.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelOfficer.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], IntelOfficer.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelOfficerRank,
        default: IntelOfficerRank.JUNIOR,
    }),
    __metadata("design:type", String)
], IntelOfficer.prototype, "rank", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelEntry_1.IntelAccessLevel,
        default: IntelEntry_1.IntelAccessLevel.READ,
    }),
    __metadata("design:type", String)
], IntelOfficer.prototype, "accessLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Boolean)
], IntelOfficer.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], IntelOfficer.prototype, "specializations", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelOfficer.prototype, "appointedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'appointedBy' }),
    __metadata("design:type", User_1.User)
], IntelOfficer.prototype, "appointer", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelOfficer.prototype, "revokedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'revokedBy' }),
    __metadata("design:type", User_1.User)
], IntelOfficer.prototype, "revoker", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntelOfficer.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], IntelOfficer.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], IntelOfficer.prototype, "appointedAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], IntelOfficer.prototype, "updatedAt", void 0);
exports.IntelOfficer = IntelOfficer = __decorate([
    (0, typeorm_1.Entity)('intel_officers'),
    (0, typeorm_1.Index)(['organizationId', 'userId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId', 'rank'])
], IntelOfficer);
//# sourceMappingURL=IntelOfficer.js.map