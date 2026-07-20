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
exports.BountyClaim = exports.BountyClaimStatus = void 0;
const typeorm_1 = require("typeorm");
const Bounty_1 = require("./Bounty");
const BountyEvidence_1 = require("./BountyEvidence");
var BountyClaimStatus;
(function (BountyClaimStatus) {
    BountyClaimStatus["ACTIVE"] = "active";
    BountyClaimStatus["SUBMITTED"] = "submitted";
    BountyClaimStatus["COMPLETED"] = "completed";
    BountyClaimStatus["ABANDONED"] = "abandoned";
    BountyClaimStatus["REJECTED"] = "rejected";
})(BountyClaimStatus || (exports.BountyClaimStatus = BountyClaimStatus = {}));
let BountyClaim = class BountyClaim {
    id;
    bountyId;
    bounty;
    hunterId;
    hunterName;
    organizationId;
    status;
    notes;
    claimedAt;
    submittedAt;
    completedAt;
    evidence;
    createdAt;
    updatedAt;
    get isActive() {
        return this.status === BountyClaimStatus.ACTIVE;
    }
    get isSubmitted() {
        return this.status === BountyClaimStatus.SUBMITTED;
    }
    get isCompleted() {
        return this.status === BountyClaimStatus.COMPLETED;
    }
    get canSubmitEvidence() {
        return this.status === BountyClaimStatus.ACTIVE || this.status === BountyClaimStatus.SUBMITTED;
    }
    get canBeAbandoned() {
        return this.status === BountyClaimStatus.ACTIVE;
    }
};
exports.BountyClaim = BountyClaim;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BountyClaim.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], BountyClaim.prototype, "bountyId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Bounty_1.Bounty, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'bountyId' }),
    __metadata("design:type", Bounty_1.Bounty)
], BountyClaim.prototype, "bounty", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], BountyClaim.prototype, "hunterId", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], BountyClaim.prototype, "hunterName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], BountyClaim.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: BountyClaimStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], BountyClaim.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], BountyClaim.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], BountyClaim.prototype, "claimedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], BountyClaim.prototype, "submittedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], BountyClaim.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => BountyEvidence_1.BountyEvidence, evidence => evidence.claim),
    __metadata("design:type", Array)
], BountyClaim.prototype, "evidence", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], BountyClaim.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], BountyClaim.prototype, "updatedAt", void 0);
exports.BountyClaim = BountyClaim = __decorate([
    (0, typeorm_1.Entity)('bounty_claims'),
    (0, typeorm_1.Index)(['bountyId', 'status']),
    (0, typeorm_1.Index)(['hunterId', 'status']),
    (0, typeorm_1.Index)(['organizationId', 'status'])
], BountyClaim);
//# sourceMappingURL=BountyClaim.js.map