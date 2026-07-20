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
exports.RelationshipHistory = exports.InteractionSentiment = exports.ChangeType = void 0;
const typeorm_1 = require("typeorm");
var ChangeType;
(function (ChangeType) {
    ChangeType["CREATED"] = "created";
    ChangeType["TYPE_CHANGED"] = "type_changed";
    ChangeType["STATUS_CHANGED"] = "status_changed";
    ChangeType["TRUST_UPDATED"] = "trust_updated";
    ChangeType["STRENGTH_UPDATED"] = "strength_updated";
    ChangeType["INTERACTION_RECORDED"] = "interaction_recorded";
    ChangeType["METADATA_UPDATED"] = "metadata_updated";
    ChangeType["NOTES_UPDATED"] = "notes_updated";
    ChangeType["CONTACT_UPDATED"] = "contact_updated";
    ChangeType["REVIEW_SCHEDULED"] = "review_scheduled";
    ChangeType["EXPIRED"] = "expired";
    ChangeType["RENEWED"] = "renewed";
    ChangeType["SUSPENDED"] = "suspended";
    ChangeType["REACTIVATED"] = "reactivated";
    ChangeType["TERMINATED"] = "terminated";
    ChangeType["MUTUAL_ESTABLISHED"] = "mutual_established";
    ChangeType["MUTUAL_BROKEN"] = "mutual_broken";
    ChangeType["CUSTOM"] = "custom";
})(ChangeType || (exports.ChangeType = ChangeType = {}));
var InteractionSentiment;
(function (InteractionSentiment) {
    InteractionSentiment["VERY_POSITIVE"] = "very_positive";
    InteractionSentiment["POSITIVE"] = "positive";
    InteractionSentiment["NEUTRAL"] = "neutral";
    InteractionSentiment["NEGATIVE"] = "negative";
    InteractionSentiment["VERY_NEGATIVE"] = "very_negative";
})(InteractionSentiment || (exports.InteractionSentiment = InteractionSentiment = {}));
let RelationshipHistory = class RelationshipHistory {
    id;
    relationshipId;
    organizationId;
    targetOrganizationId;
    changeType;
    description;
    previousValue;
    newValue;
    changeDetails;
    actorId;
    actorName;
    actorRole;
    reason;
    notes;
    tags;
    metadata;
    isSystemGenerated;
    isSignificant;
    requiresNotification;
    notificationSent;
    createdAt;
    getSentimentScore() {
        if (!this.changeDetails?.sentiment) {
            return 0;
        }
        const sentimentScores = {
            [InteractionSentiment.VERY_POSITIVE]: 2,
            [InteractionSentiment.POSITIVE]: 1,
            [InteractionSentiment.NEUTRAL]: 0,
            [InteractionSentiment.NEGATIVE]: -1,
            [InteractionSentiment.VERY_NEGATIVE]: -2
        };
        return sentimentScores[this.changeDetails.sentiment];
    }
    isPositiveChange() {
        const positiveTypes = [
            ChangeType.CREATED,
            ChangeType.REACTIVATED,
            ChangeType.RENEWED,
            ChangeType.MUTUAL_ESTABLISHED
        ];
        if (positiveTypes.includes(this.changeType)) {
            return true;
        }
        if (this.changeType === ChangeType.TRUST_UPDATED && (this.changeDetails?.trustScoreDelta || 0) > 0) {
            return true;
        }
        if (this.changeType === ChangeType.STRENGTH_UPDATED && (this.changeDetails?.strengthDelta || 0) > 0) {
            return true;
        }
        if (this.changeType === ChangeType.INTERACTION_RECORDED) {
            const sentiment = this.changeDetails?.sentiment;
            return sentiment === InteractionSentiment.POSITIVE || sentiment === InteractionSentiment.VERY_POSITIVE;
        }
        return false;
    }
    isNegativeChange() {
        const negativeTypes = [
            ChangeType.TERMINATED,
            ChangeType.SUSPENDED,
            ChangeType.EXPIRED,
            ChangeType.MUTUAL_BROKEN
        ];
        if (negativeTypes.includes(this.changeType)) {
            return true;
        }
        if (this.changeType === ChangeType.TRUST_UPDATED && (this.changeDetails?.trustScoreDelta || 0) < 0) {
            return true;
        }
        if (this.changeType === ChangeType.STRENGTH_UPDATED && (this.changeDetails?.strengthDelta || 0) < 0) {
            return true;
        }
        if (this.changeType === ChangeType.INTERACTION_RECORDED) {
            const sentiment = this.changeDetails?.sentiment;
            return sentiment === InteractionSentiment.NEGATIVE || sentiment === InteractionSentiment.VERY_NEGATIVE;
        }
        return false;
    }
    getImpactLevel() {
        if (this.changeDetails?.impact) {
            return this.changeDetails.impact;
        }
        const highImpactTypes = [
            ChangeType.CREATED,
            ChangeType.TERMINATED,
            ChangeType.TYPE_CHANGED,
            ChangeType.MUTUAL_ESTABLISHED,
            ChangeType.MUTUAL_BROKEN
        ];
        if (highImpactTypes.includes(this.changeType)) {
            return 'high';
        }
        if (Math.abs(this.changeDetails?.trustScoreDelta || 0) >= 10) {
            return 'high';
        }
        if (Math.abs(this.changeDetails?.strengthDelta || 0) >= 10) {
            return 'high';
        }
        if (this.changeType === ChangeType.STATUS_CHANGED) {
            return 'medium';
        }
        return 'low';
    }
    getChangeSummary() {
        const summaries = {
            [ChangeType.CREATED]: 'Relationship established',
            [ChangeType.TYPE_CHANGED]: `Changed from ${this.previousValue} to ${this.newValue}`,
            [ChangeType.STATUS_CHANGED]: `Status changed from ${this.previousValue} to ${this.newValue}`,
            [ChangeType.TRUST_UPDATED]: `Trust score ${(this.changeDetails?.trustScoreDelta || 0) > 0 ? 'increased' : 'decreased'} by ${Math.abs(this.changeDetails?.trustScoreDelta || 0)}`,
            [ChangeType.STRENGTH_UPDATED]: `Relationship strength ${(this.changeDetails?.strengthDelta || 0) > 0 ? 'increased' : 'decreased'} by ${Math.abs(this.changeDetails?.strengthDelta || 0)}`,
            [ChangeType.INTERACTION_RECORDED]: `${this.changeDetails?.sentiment || 'Neutral'} interaction recorded`,
            [ChangeType.METADATA_UPDATED]: 'Metadata updated',
            [ChangeType.NOTES_UPDATED]: 'Notes updated',
            [ChangeType.CONTACT_UPDATED]: 'Contact information updated',
            [ChangeType.REVIEW_SCHEDULED]: 'Review scheduled',
            [ChangeType.EXPIRED]: 'Relationship expired',
            [ChangeType.RENEWED]: 'Relationship renewed',
            [ChangeType.SUSPENDED]: 'Relationship suspended',
            [ChangeType.REACTIVATED]: 'Relationship reactivated',
            [ChangeType.TERMINATED]: 'Relationship terminated',
            [ChangeType.MUTUAL_ESTABLISHED]: 'Mutual relationship established',
            [ChangeType.MUTUAL_BROKEN]: 'Mutual relationship broken',
            [ChangeType.CUSTOM]: this.description
        };
        return summaries[this.changeType] || this.description;
    }
    getDetailedSummary() {
        return {
            id: this.id,
            relationshipId: this.relationshipId,
            changeType: this.changeType,
            summary: this.getChangeSummary(),
            description: this.description,
            previousValue: this.previousValue,
            newValue: this.newValue,
            impact: this.getImpactLevel(),
            isPositive: this.isPositiveChange(),
            isNegative: this.isNegativeChange(),
            sentimentScore: this.getSentimentScore(),
            actor: {
                id: this.actorId,
                name: this.actorName,
                role: this.actorRole
            },
            reason: this.reason,
            notes: this.notes,
            tags: this.tags,
            isSystemGenerated: this.isSystemGenerated,
            isSignificant: this.isSignificant,
            createdAt: this.createdAt,
            changeDetails: this.changeDetails
        };
    }
};
exports.RelationshipHistory = RelationshipHistory;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "relationshipId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "targetOrganizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: ChangeType
    }),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "changeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RelationshipHistory.prototype, "previousValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RelationshipHistory.prototype, "newValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RelationshipHistory.prototype, "changeDetails", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "actorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "actorRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], RelationshipHistory.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], RelationshipHistory.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], RelationshipHistory.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RelationshipHistory.prototype, "isSystemGenerated", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RelationshipHistory.prototype, "isSignificant", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RelationshipHistory.prototype, "requiresNotification", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RelationshipHistory.prototype, "notificationSent", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], RelationshipHistory.prototype, "createdAt", void 0);
exports.RelationshipHistory = RelationshipHistory = __decorate([
    (0, typeorm_1.Entity)('relationship_history'),
    (0, typeorm_1.Index)(['relationshipId', 'createdAt']),
    (0, typeorm_1.Index)(['organizationId', 'targetOrganizationId']),
    (0, typeorm_1.Index)(['changeType']),
    (0, typeorm_1.Index)(['actorId'])
], RelationshipHistory);
//# sourceMappingURL=RelationshipHistory.js.map