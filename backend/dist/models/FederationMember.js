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
exports.FederationMember = void 0;
const typeorm_1 = require("typeorm");
const Federation_1 = require("./Federation");
let FederationMember = class FederationMember {
    id;
    federationId;
    federation;
    organizationId;
    organizationName;
    role;
    status;
    associationType;
    votingPower;
    contributions;
    joinedAt;
};
exports.FederationMember = FederationMember;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FederationMember.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], FederationMember.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Federation_1.Federation, federation => federation.members, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'federationId' }),
    __metadata("design:type", Federation_1.Federation)
], FederationMember.prototype, "federation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], FederationMember.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], FederationMember.prototype, "organizationName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'member' }),
    __metadata("design:type", Object)
], FederationMember.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", Object)
], FederationMember.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'full_member' }),
    __metadata("design:type", Object)
], FederationMember.prototype, "associationType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], FederationMember.prototype, "votingPower", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], FederationMember.prototype, "contributions", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FederationMember.prototype, "joinedAt", void 0);
exports.FederationMember = FederationMember = __decorate([
    (0, typeorm_1.Entity)('federation_members'),
    (0, typeorm_1.Index)('idx_fed_member_federation', ['federationId']),
    (0, typeorm_1.Index)('idx_fed_member_org', ['organizationId']),
    (0, typeorm_1.Index)('idx_fed_member_unique', ['federationId', 'organizationId'], { unique: true })
], FederationMember);
//# sourceMappingURL=FederationMember.js.map