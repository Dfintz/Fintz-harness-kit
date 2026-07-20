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
exports.OrganizationRelationship = exports.RelationshipStatus = exports.RelationshipType = void 0;
const typeorm_1 = require("typeorm");
var RelationshipType;
(function (RelationshipType) {
    RelationshipType["ALLIED"] = "allied";
    RelationshipType["PARTNERSHIP"] = "partnership";
    RelationshipType["COOPERATIVE"] = "cooperative";
    RelationshipType["AFFILIATED"] = "affiliated";
    RelationshipType["TRADING_PARTNER"] = "trading_partner";
    RelationshipType["NEUTRAL"] = "neutral";
    RelationshipType["OBSERVER"] = "observer";
    RelationshipType["INTERESTED"] = "interested";
    RelationshipType["COMPETITIVE"] = "competitive";
    RelationshipType["RIVAL"] = "rival";
    RelationshipType["HOSTILE"] = "hostile";
    RelationshipType["WAR"] = "war";
    RelationshipType["PARENT"] = "parent";
    RelationshipType["SUBSIDIARY"] = "subsidiary";
    RelationshipType["MERGER_PENDING"] = "merger_pending";
    RelationshipType["UNDER_NEGOTIATION"] = "under_negotiation";
})(RelationshipType || (exports.RelationshipType = RelationshipType = {}));
var RelationshipStatus;
(function (RelationshipStatus) {
    RelationshipStatus["ACTIVE"] = "active";
    RelationshipStatus["PENDING"] = "pending";
    RelationshipStatus["SUSPENDED"] = "suspended";
    RelationshipStatus["TERMINATED"] = "terminated";
    RelationshipStatus["EXPIRED"] = "expired";
})(RelationshipStatus || (exports.RelationshipStatus = RelationshipStatus = {}));
let OrganizationRelationship = class OrganizationRelationship {
    id;
    organizationId;
    targetOrganizationId;
    type;
    status;
    trustScore;
    relationshipStrength;
    interactionCount;
    positiveInteractions;
    negativeInteractions;
    description;
    notes;
    tags;
    metadata;
    primaryContact;
    contactName;
    contactRole;
    contactEmail;
    communicationChannels;
    establishedBy;
    lastModifiedBy;
    establishedDate;
    lastInteractionDate;
    reviewDate;
    expiryDate;
    isMutual;
    isMutuallyRecognized;
    reciprocalRelationshipId;
    isPublic;
    requiresApproval;
    autoRenew;
    createdAt;
    updatedAt;
    calculateHealthScore() {
        const trustWeight = 0.4;
        const strengthWeight = 0.3;
        const interactionWeight = 0.2;
        const recentActivityWeight = 0.1;
        const trustComponent = this.trustScore * trustWeight;
        const strengthComponent = this.relationshipStrength * strengthWeight;
        const totalInteractions = this.interactionCount || 1;
        const positiveRatio = (this.positiveInteractions / totalInteractions) * 100;
        const interactionComponent = positiveRatio * interactionWeight;
        const daysSinceLastInteraction = this.lastInteractionDate
            ? Math.floor((Date.now() - this.lastInteractionDate.getTime()) / (1000 * 60 * 60 * 24))
            : 365;
        const activityScore = Math.max(0, 100 - daysSinceLastInteraction);
        const recentActivityComponent = activityScore * recentActivityWeight;
        return Math.min(100, Math.round(trustComponent + strengthComponent + interactionComponent + recentActivityComponent));
    }
    getRelationshipTier() {
        const health = this.calculateHealthScore();
        if (health >= 80) {
            return 'excellent';
        }
        if (health >= 60) {
            return 'good';
        }
        if (health >= 40) {
            return 'fair';
        }
        if (health >= 20) {
            return 'poor';
        }
        return 'critical';
    }
    needsReview() {
        if (this.reviewDate && this.reviewDate < new Date()) {
            return true;
        }
        if (this.calculateHealthScore() < 40) {
            return true;
        }
        if (this.negativeInteractions > this.positiveInteractions * 2) {
            return true;
        }
        return false;
    }
    isExpired() {
        if (!this.expiryDate) {
            return false;
        }
        return this.expiryDate < new Date();
    }
    getTrustLevel() {
        if (this.trustScore >= 90) {
            return 'Complete Trust';
        }
        if (this.trustScore >= 75) {
            return 'High Trust';
        }
        if (this.trustScore >= 60) {
            return 'Moderate Trust';
        }
        if (this.trustScore >= 40) {
            return 'Low Trust';
        }
        if (this.trustScore >= 20) {
            return 'Minimal Trust';
        }
        return 'No Trust';
    }
    getStrengthLevel() {
        if (this.relationshipStrength >= 90) {
            return 'Very Strong';
        }
        if (this.relationshipStrength >= 75) {
            return 'Strong';
        }
        if (this.relationshipStrength >= 60) {
            return 'Moderate';
        }
        if (this.relationshipStrength >= 40) {
            return 'Weak';
        }
        if (this.relationshipStrength >= 20) {
            return 'Very Weak';
        }
        return 'Negligible';
    }
    getSummary() {
        return {
            id: this.id,
            orgId1: this.organizationId,
            orgId2: this.targetOrganizationId,
            relationship: this.type,
            type: this.type,
            status: this.status,
            trustScore: this.trustScore,
            trustLevel: this.getTrustLevel(),
            relationshipStrength: this.relationshipStrength,
            strengthLevel: this.getStrengthLevel(),
            healthScore: this.calculateHealthScore(),
            tier: this.getRelationshipTier(),
            interactionCount: this.interactionCount,
            positiveRatio: this.interactionCount > 0
                ? ((this.positiveInteractions / this.interactionCount) * 100).toFixed(1)
                : 0,
            lastInteraction: this.lastInteractionDate,
            needsReview: this.needsReview(),
            isExpired: this.isExpired(),
            isMutual: this.isMutual,
        };
    }
};
exports.OrganizationRelationship = OrganizationRelationship;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "targetOrganizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: RelationshipType,
        default: RelationshipType.NEUTRAL,
    }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: RelationshipStatus,
        default: RelationshipStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 5,
        scale: 2,
        default: 50.0,
    }),
    __metadata("design:type", Number)
], OrganizationRelationship.prototype, "trustScore", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 5,
        scale: 2,
        default: 50.0,
    }),
    __metadata("design:type", Number)
], OrganizationRelationship.prototype, "relationshipStrength", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'int',
        default: 0,
    }),
    __metadata("design:type", Number)
], OrganizationRelationship.prototype, "interactionCount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'int',
        default: 0,
    }),
    __metadata("design:type", Number)
], OrganizationRelationship.prototype, "positiveInteractions", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'int',
        default: 0,
    }),
    __metadata("design:type", Number)
], OrganizationRelationship.prototype, "negativeInteractions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], OrganizationRelationship.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', nullable: true }),
    __metadata("design:type", Object)
], OrganizationRelationship.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "primaryContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "contactName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "contactRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "contactEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], OrganizationRelationship.prototype, "communicationChannels", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "establishedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "lastModifiedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationRelationship.prototype, "establishedDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationRelationship.prototype, "lastInteractionDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationRelationship.prototype, "reviewDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], OrganizationRelationship.prototype, "expiryDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationRelationship.prototype, "isMutual", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationRelationship.prototype, "isMutuallyRecognized", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationRelationship.prototype, "reciprocalRelationshipId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationRelationship.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationRelationship.prototype, "requiresApproval", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationRelationship.prototype, "autoRenew", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationRelationship.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationRelationship.prototype, "updatedAt", void 0);
exports.OrganizationRelationship = OrganizationRelationship = __decorate([
    (0, typeorm_1.Entity)('organization_relationships'),
    (0, typeorm_1.Index)(['organizationId', 'targetOrganizationId'], { unique: true }),
    (0, typeorm_1.Index)(['type']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['trustScore'])
], OrganizationRelationship);
//# sourceMappingURL=OrganizationRelationship.js.map