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
exports.Team = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
let Team = class Team extends TenantEntity_1.TenantEntity {
    id;
    name;
    description;
    type;
    emblem;
    assignedShipId;
    assignedDivisionId;
    parentTeamId;
    parent;
    children;
    level;
    sortOrder;
    maxMembers;
    isActive;
    joinPolicy;
    members;
    createdAt;
    updatedAt;
};
exports.Team = Team;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Team.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], Team.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Team.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'squadron' }),
    __metadata("design:type", String)
], Team.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Team.prototype, "emblem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Team.prototype, "assignedShipId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Team.prototype, "assignedDivisionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Team.prototype, "parentTeamId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)('Team', 'children', { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'parentTeamId' }),
    __metadata("design:type", Team)
], Team.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.OneToMany)('Team', 'parent'),
    __metadata("design:type", Array)
], Team.prototype, "children", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Team.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Team.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 20 }),
    __metadata("design:type", Number)
], Team.prototype, "maxMembers", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Team.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'closed' }),
    __metadata("design:type", String)
], Team.prototype, "joinPolicy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)('TeamMember', 'team'),
    __metadata("design:type", Array)
], Team.prototype, "members", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Team.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Team.prototype, "updatedAt", void 0);
exports.Team = Team = __decorate([
    (0, typeorm_1.Entity)('teams'),
    (0, typeorm_1.Index)('idx_team_org_parent', ['organizationId', 'parentTeamId']),
    (0, typeorm_1.Index)('idx_team_org_name', ['organizationId', 'name'], { unique: true })
], Team);
//# sourceMappingURL=Team.js.map