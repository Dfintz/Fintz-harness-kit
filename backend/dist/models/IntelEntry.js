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
exports.IntelEntry = exports.IntelCategory = exports.IntelClassification = exports.IntelAccessLevel = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var IntelAccessLevel;
(function (IntelAccessLevel) {
    IntelAccessLevel["READ"] = "read";
    IntelAccessLevel["WRITE"] = "write";
    IntelAccessLevel["EDIT"] = "edit";
    IntelAccessLevel["DELETE"] = "delete";
    IntelAccessLevel["ADMIN"] = "admin";
})(IntelAccessLevel || (exports.IntelAccessLevel = IntelAccessLevel = {}));
var IntelClassification;
(function (IntelClassification) {
    IntelClassification["PUBLIC"] = "public";
    IntelClassification["RESTRICTED"] = "restricted";
    IntelClassification["CONFIDENTIAL"] = "confidential";
    IntelClassification["SECRET"] = "secret";
    IntelClassification["TOP_SECRET"] = "top_secret";
})(IntelClassification || (exports.IntelClassification = IntelClassification = {}));
var IntelCategory;
(function (IntelCategory) {
    IntelCategory["STRATEGIC"] = "strategic";
    IntelCategory["TACTICAL"] = "tactical";
    IntelCategory["PERSONNEL"] = "personnel";
    IntelCategory["ENEMY"] = "enemy";
    IntelCategory["ALLIANCE"] = "alliance";
    IntelCategory["ECONOMIC"] = "economic";
    IntelCategory["TECHNICAL"] = "technical";
    IntelCategory["OTHER"] = "other";
})(IntelCategory || (exports.IntelCategory = IntelCategory = {}));
let IntelEntry = class IntelEntry {
    id;
    organizationId;
    organization;
    title;
    content;
    classification;
    category;
    tags;
    location;
    eventDate;
    isArchived;
    createdBy;
    creator;
    updatedBy;
    updater;
    createdAt;
    updatedAt;
    declassificationDate;
    targetClassification;
    reviewDate;
    reviewIntervalDays;
    lastReviewedAt;
    lastReviewedBy;
    autoDeclassify;
    expirationDate;
    isExpired;
    isShared;
    shareCount;
    metadata;
};
exports.IntelEntry = IntelEntry;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], IntelEntry.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelEntry.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], IntelEntry.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], IntelEntry.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], IntelEntry.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelClassification,
        default: IntelClassification.RESTRICTED,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelEntry.prototype, "classification", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelCategory,
        default: IntelCategory.OTHER,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelEntry.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], IntelEntry.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], IntelEntry.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntelEntry.prototype, "eventDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Boolean)
], IntelEntry.prototype, "isArchived", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelEntry.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'createdBy' }),
    __metadata("design:type", User_1.User)
], IntelEntry.prototype, "creator", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], IntelEntry.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'updatedBy' }),
    __metadata("design:type", User_1.User)
], IntelEntry.prototype, "updater", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], IntelEntry.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], IntelEntry.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], IntelEntry.prototype, "declassificationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelClassification,
        nullable: true,
    }),
    __metadata("design:type", String)
], IntelEntry.prototype, "targetClassification", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], IntelEntry.prototype, "reviewDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], IntelEntry.prototype, "reviewIntervalDays", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntelEntry.prototype, "lastReviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], IntelEntry.prototype, "lastReviewedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], IntelEntry.prototype, "autoDeclassify", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntelEntry.prototype, "expirationDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], IntelEntry.prototype, "isExpired", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], IntelEntry.prototype, "isShared", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], IntelEntry.prototype, "shareCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], IntelEntry.prototype, "metadata", void 0);
exports.IntelEntry = IntelEntry = __decorate([
    (0, typeorm_1.Entity)('intel_entries')
], IntelEntry);
//# sourceMappingURL=IntelEntry.js.map