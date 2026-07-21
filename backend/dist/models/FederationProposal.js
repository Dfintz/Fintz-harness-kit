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
exports.FederationProposal = void 0;
const typeorm_1 = require("typeorm");
const Federation_1 = require("./Federation");
let FederationProposal = class FederationProposal {
    id;
    federationId;
    federation;
    type;
    title;
    description;
    proposedBy;
    proposedByOrg;
    votes;
    status;
    requiredApproval;
    metadata;
    votingEndsAt;
    createdAt;
};
exports.FederationProposal = FederationProposal;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FederationProposal.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], FederationProposal.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Federation_1.Federation, federation => federation.proposals, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'federationId' }),
    __metadata("design:type", Federation_1.Federation)
], FederationProposal.prototype, "federation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], FederationProposal.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], FederationProposal.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], FederationProposal.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], FederationProposal.prototype, "proposedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], FederationProposal.prototype, "proposedByOrg", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], FederationProposal.prototype, "votes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'open' }),
    __metadata("design:type", String)
], FederationProposal.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], FederationProposal.prototype, "requiredApproval", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], FederationProposal.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], FederationProposal.prototype, "votingEndsAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FederationProposal.prototype, "createdAt", void 0);
exports.FederationProposal = FederationProposal = __decorate([
    (0, typeorm_1.Entity)('federation_proposals'),
    (0, typeorm_1.Index)('idx_fed_proposal_federation', ['federationId']),
    (0, typeorm_1.Index)('idx_fed_proposal_status', ['status']),
    (0, typeorm_1.Index)('idx_fed_proposal_federation_status', ['federationId', 'status'])
], FederationProposal);
//# sourceMappingURL=FederationProposal.js.map