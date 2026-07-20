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
exports.Skill = exports.SkillCategory = void 0;
const typeorm_1 = require("typeorm");
const TenantEntity_1 = require("./base/TenantEntity");
const UserSkill_1 = require("./UserSkill");
var SkillCategory;
(function (SkillCategory) {
    SkillCategory["COMBAT"] = "combat";
    SkillCategory["MINING"] = "mining";
    SkillCategory["TRADING"] = "trading";
    SkillCategory["EXPLORATION"] = "exploration";
    SkillCategory["MEDICAL"] = "medical";
    SkillCategory["ENGINEERING"] = "engineering";
    SkillCategory["PILOTING"] = "piloting";
    SkillCategory["LEADERSHIP"] = "leadership";
    SkillCategory["LOGISTICS"] = "logistics";
    SkillCategory["OTHER"] = "other";
})(SkillCategory || (exports.SkillCategory = SkillCategory = {}));
let Skill = class Skill extends TenantEntity_1.TenantEntity {
    id;
    name;
    description;
    category;
    createdBy;
    userSkills;
    createdAt;
    updatedAt;
};
exports.Skill = Skill;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Skill.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ length: 100 }),
    __metadata("design:type", String)
], Skill.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Skill.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: SkillCategory.OTHER }),
    __metadata("design:type", String)
], Skill.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], Skill.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserSkill_1.UserSkill, us => us.skill),
    __metadata("design:type", Array)
], Skill.prototype, "userSkills", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Skill.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Skill.prototype, "updatedAt", void 0);
exports.Skill = Skill = __decorate([
    (0, typeorm_1.Entity)('skills'),
    (0, typeorm_1.Index)(['organizationId', 'name'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId', 'category'])
], Skill);
//# sourceMappingURL=Skill.js.map