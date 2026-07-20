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
exports.FederationIntelEntry = void 0;
const typeorm_1 = require("typeorm");
const Federation_1 = require("./Federation");
let FederationIntelEntry = class FederationIntelEntry {
    id;
    federationId;
    federation;
    title;
    content;
    classification;
    status;
    submittedBy;
    submittedByName;
    submittedByOrgId;
    approvedBy;
    tags;
    visibleToTreaties;
    createdAt;
    updatedAt;
};
exports.FederationIntelEntry = FederationIntelEntry;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FederationIntelEntry.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], FederationIntelEntry.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Federation_1.Federation, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'federationId' }),
    __metadata("design:type", Federation_1.Federation)
], FederationIntelEntry.prototype, "federation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], FederationIntelEntry.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], FederationIntelEntry.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'open' }),
    __metadata("design:type", String)
], FederationIntelEntry.prototype, "classification", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'draft' }),
    __metadata("design:type", String)
], FederationIntelEntry.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], FederationIntelEntry.prototype, "submittedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], FederationIntelEntry.prototype, "submittedByName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], FederationIntelEntry.prototype, "submittedByOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], FederationIntelEntry.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], FederationIntelEntry.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], FederationIntelEntry.prototype, "visibleToTreaties", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FederationIntelEntry.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], FederationIntelEntry.prototype, "updatedAt", void 0);
exports.FederationIntelEntry = FederationIntelEntry = __decorate([
    (0, typeorm_1.Entity)('federation_intel_entries'),
    (0, typeorm_1.Index)('idx_fed_intel_federation', ['federationId']),
    (0, typeorm_1.Index)('idx_fed_intel_status', ['federationId', 'status']),
    (0, typeorm_1.Index)('idx_fed_intel_classification', ['federationId', 'classification'])
], FederationIntelEntry);
//# sourceMappingURL=FederationIntelEntry.js.map