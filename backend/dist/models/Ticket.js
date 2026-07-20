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
exports.Ticket = exports.TicketRecipientType = exports.TicketStatus = exports.TicketPriority = exports.TicketCategory = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
var TicketCategory;
(function (TicketCategory) {
    TicketCategory["HR"] = "hr";
    TicketCategory["RECRUITMENT"] = "recruitment";
    TicketCategory["DIPLOMACY"] = "diplomacy";
    TicketCategory["GENERAL"] = "general";
    TicketCategory["SUPPORT"] = "support";
})(TicketCategory || (exports.TicketCategory = TicketCategory = {}));
var TicketPriority;
(function (TicketPriority) {
    TicketPriority["LOW"] = "low";
    TicketPriority["MEDIUM"] = "medium";
    TicketPriority["HIGH"] = "high";
    TicketPriority["URGENT"] = "urgent";
})(TicketPriority || (exports.TicketPriority = TicketPriority = {}));
var TicketStatus;
(function (TicketStatus) {
    TicketStatus["OPEN"] = "open";
    TicketStatus["IN_PROGRESS"] = "in_progress";
    TicketStatus["AWAITING_RESPONSE"] = "awaiting_response";
    TicketStatus["ON_HOLD"] = "on_hold";
    TicketStatus["RESOLVED"] = "resolved";
    TicketStatus["CLOSED"] = "closed";
})(TicketStatus || (exports.TicketStatus = TicketStatus = {}));
var TicketRecipientType;
(function (TicketRecipientType) {
    TicketRecipientType["ORG_LEADERSHIP"] = "org_leadership";
    TicketRecipientType["ORG_OFFICERS"] = "org_officers";
    TicketRecipientType["TEAM_LEADER"] = "team_leader";
    TicketRecipientType["ALLIANCE_COUNCIL"] = "alliance_council";
    TicketRecipientType["HR_DEPARTMENT"] = "hr_department";
    TicketRecipientType["RECRUITMENT"] = "recruitment";
    TicketRecipientType["DIPLOMACY"] = "diplomacy";
    TicketRecipientType["SPECIFIC_USER"] = "specific_user";
    TicketRecipientType["PLATFORM_ADMIN"] = "platform_admin";
})(TicketRecipientType || (exports.TicketRecipientType = TicketRecipientType = {}));
let Ticket = class Ticket extends TenantEntity_1.TenantEntity {
    id;
    ticketNumber;
    subject;
    description;
    category;
    priority;
    status;
    creatorId;
    creatorName;
    creatorDiscordId;
    creatorEmail;
    recipientType;
    recipientId;
    recipientName;
    assigneeId;
    assigneeName;
    assignmentHistory;
    messages;
    discordSettings;
    discordChannelId;
    discordThreadId;
    relatedRecruitmentId;
    relatedDiplomacyId;
    relatedApplicationId;
    tags;
    resolution;
    resolvedAt;
    resolvedBy;
    satisfactionRating;
    feedback;
    dueDate;
    slaBreached;
    firstResponseAt;
    createdAt;
    updatedAt;
    closedAt;
    get isOpen() {
        return (this.status === TicketStatus.OPEN ||
            this.status === TicketStatus.IN_PROGRESS ||
            this.status === TicketStatus.AWAITING_RESPONSE);
    }
    get hasDiscordIntegration() {
        return !!(this.discordChannelId || this.discordThreadId);
    }
    get responseTimeMs() {
        if (!this.firstResponseAt) {
            return null;
        }
        return this.firstResponseAt.getTime() - this.createdAt.getTime();
    }
};
exports.Ticket = Ticket;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Ticket.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], Ticket.prototype, "ticketNumber", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Ticket.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)('text'),
    __metadata("design:type", String)
], Ticket.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TicketCategory,
        default: TicketCategory.GENERAL,
    }),
    __metadata("design:type", String)
], Ticket.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TicketPriority,
        default: TicketPriority.MEDIUM,
    }),
    __metadata("design:type", String)
], Ticket.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TicketStatus,
        default: TicketStatus.OPEN,
    }),
    __metadata("design:type", String)
], Ticket.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Ticket.prototype, "creatorId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Ticket.prototype, "creatorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "creatorDiscordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "creatorEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TicketRecipientType,
        nullable: true,
    }),
    __metadata("design:type", String)
], Ticket.prototype, "recipientType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "recipientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "recipientName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "assigneeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "assigneeName", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], Ticket.prototype, "assignmentHistory", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { default: '[]' }),
    __metadata("design:type", Array)
], Ticket.prototype, "messages", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-json', { nullable: true }),
    __metadata("design:type", Object)
], Ticket.prototype, "discordSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "discordChannelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "discordThreadId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "relatedRecruitmentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "relatedDiplomacyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "relatedApplicationId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { default: '' }),
    __metadata("design:type", Array)
], Ticket.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "resolution", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Ticket.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "resolvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Number)
], Ticket.prototype, "satisfactionRating", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", String)
], Ticket.prototype, "feedback", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Ticket.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Ticket.prototype, "slaBreached", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Ticket.prototype, "firstResponseAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Ticket.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Ticket.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Ticket.prototype, "closedAt", void 0);
exports.Ticket = Ticket = __decorate([
    (0, typeorm_1.Entity)('tickets'),
    (0, typeorm_1.Index)(['category', 'status']),
    (0, typeorm_1.Index)(['creatorId']),
    (0, typeorm_1.Index)(['assigneeId']),
    (0, typeorm_1.Index)(['recipientId']),
    (0, typeorm_1.Index)(['organizationId', 'category']),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'createdAt'])
], Ticket);
//# sourceMappingURL=Ticket.js.map