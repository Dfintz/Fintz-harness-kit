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
exports.FederationTeam = void 0;
const typeorm_1 = require("typeorm");
const Federation_1 = require("./Federation");
let FederationTeam = class FederationTeam {
    id;
    federationId;
    federation;
    name;
    description;
    type;
    leaderId;
    leaderName;
    leaderOrgId;
    members;
    status;
    maxMembers;
    createdAt;
    updatedAt;
};
exports.FederationTeam = FederationTeam;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FederationTeam.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], FederationTeam.prototype, "federationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Federation_1.Federation, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'federationId' }),
    __metadata("design:type", Federation_1.Federation)
], FederationTeam.prototype, "federation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], FederationTeam.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], FederationTeam.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'task_force' }),
    __metadata("design:type", String)
], FederationTeam.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], FederationTeam.prototype, "leaderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200, nullable: true }),
    __metadata("design:type", Object)
], FederationTeam.prototype, "leaderName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], FederationTeam.prototype, "leaderOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: '[]' }),
    __metadata("design:type", Array)
], FederationTeam.prototype, "members", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'active' }),
    __metadata("design:type", String)
], FederationTeam.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 20 }),
    __metadata("design:type", Number)
], FederationTeam.prototype, "maxMembers", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FederationTeam.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], FederationTeam.prototype, "updatedAt", void 0);
exports.FederationTeam = FederationTeam = __decorate([
    (0, typeorm_1.Entity)('federation_teams'),
    (0, typeorm_1.Index)('idx_fed_team_federation', ['federationId']),
    (0, typeorm_1.Index)('idx_fed_team_status', ['federationId', 'status'])
], FederationTeam);
//# sourceMappingURL=FederationTeam.js.map