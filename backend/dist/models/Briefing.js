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
exports.Briefing = exports.BriefingClassification = exports.BriefingStatus = void 0;
const typeorm_1 = require("typeorm");
var BriefingStatus;
(function (BriefingStatus) {
    BriefingStatus["DRAFT"] = "draft";
    BriefingStatus["ACTIVE"] = "active";
    BriefingStatus["COMPLETED"] = "completed";
    BriefingStatus["ARCHIVED"] = "archived";
})(BriefingStatus || (exports.BriefingStatus = BriefingStatus = {}));
var BriefingClassification;
(function (BriefingClassification) {
    BriefingClassification["PUBLIC"] = "public";
    BriefingClassification["RESTRICTED"] = "restricted";
    BriefingClassification["CONFIDENTIAL"] = "confidential";
    BriefingClassification["SECRET"] = "secret";
    BriefingClassification["TOP_SECRET"] = "top_secret";
})(BriefingClassification || (exports.BriefingClassification = BriefingClassification = {}));
let Briefing = class Briefing {
    id;
    title;
    creatorId;
    organizationId;
    missionId;
    classification;
    operationIds;
    elements;
    status;
    participants;
    version;
    backgroundImage;
    pages;
    tags;
    createdAt;
    updatedAt;
};
exports.Briefing = Briefing;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Briefing.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Briefing.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Briefing.prototype, "creatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Briefing.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Briefing.prototype, "missionId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: BriefingClassification,
        default: BriefingClassification.RESTRICTED,
    }),
    __metadata("design:type", String)
], Briefing.prototype, "classification", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true, default: '[]' }),
    __metadata("design:type", Array)
], Briefing.prototype, "operationIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', default: '[]' }),
    __metadata("design:type", Array)
], Briefing.prototype, "elements", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: BriefingStatus,
        default: BriefingStatus.DRAFT,
    }),
    __metadata("design:type", String)
], Briefing.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], Briefing.prototype, "participants", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], Briefing.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Briefing.prototype, "backgroundImage", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true, default: '[]' }),
    __metadata("design:type", Array)
], Briefing.prototype, "pages", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], Briefing.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Briefing.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Briefing.prototype, "updatedAt", void 0);
exports.Briefing = Briefing = __decorate([
    (0, typeorm_1.Entity)('briefings'),
    (0, typeorm_1.Index)(['organizationId', 'createdAt'])
], Briefing);
//# sourceMappingURL=Briefing.js.map