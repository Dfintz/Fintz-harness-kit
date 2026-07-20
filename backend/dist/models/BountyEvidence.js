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
exports.BountyEvidence = exports.EvidenceType = void 0;
const typeorm_1 = require("typeorm");
const BountyClaim_1 = require("./BountyClaim");
var EvidenceType;
(function (EvidenceType) {
    EvidenceType["SCREENSHOT"] = "screenshot";
    EvidenceType["VIDEO"] = "video";
    EvidenceType["TEXT"] = "text";
    EvidenceType["LINK"] = "link";
    EvidenceType["FILE"] = "file";
})(EvidenceType || (exports.EvidenceType = EvidenceType = {}));
let BountyEvidence = class BountyEvidence {
    id;
    claimId;
    claim;
    evidenceType;
    content;
    fileUrl;
    fileName;
    fileSize;
    mimeType;
    submittedBy;
    submittedAt;
    createdAt;
    get isFile() {
        return this.evidenceType === EvidenceType.SCREENSHOT ||
            this.evidenceType === EvidenceType.VIDEO ||
            this.evidenceType === EvidenceType.FILE;
    }
    get isText() {
        return this.evidenceType === EvidenceType.TEXT;
    }
    get isLink() {
        return this.evidenceType === EvidenceType.LINK;
    }
    get hasFile() {
        return !!this.fileUrl;
    }
};
exports.BountyEvidence = BountyEvidence;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], BountyEvidence.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], BountyEvidence.prototype, "claimId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BountyClaim_1.BountyClaim, claim => claim.evidence, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'claimId' }),
    __metadata("design:type", BountyClaim_1.BountyClaim)
], BountyEvidence.prototype, "claim", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20
    }),
    __metadata("design:type", String)
], BountyEvidence.prototype, "evidenceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], BountyEvidence.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 500, nullable: true }),
    __metadata("design:type", String)
], BountyEvidence.prototype, "fileUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 255, nullable: true }),
    __metadata("design:type", String)
], BountyEvidence.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], BountyEvidence.prototype, "fileSize", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100, nullable: true }),
    __metadata("design:type", String)
], BountyEvidence.prototype, "mimeType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], BountyEvidence.prototype, "submittedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], BountyEvidence.prototype, "submittedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], BountyEvidence.prototype, "createdAt", void 0);
exports.BountyEvidence = BountyEvidence = __decorate([
    (0, typeorm_1.Entity)('bounty_evidence'),
    (0, typeorm_1.Index)(['claimId'])
], BountyEvidence);
//# sourceMappingURL=BountyEvidence.js.map