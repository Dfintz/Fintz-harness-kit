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
exports.UserSkill = exports.SkillLevel = void 0;
const typeorm_1 = require("typeorm");
const Skill_1 = require("./Skill");
const SkillEndorsement_1 = require("./SkillEndorsement");
var SkillLevel;
(function (SkillLevel) {
    SkillLevel["BEGINNER"] = "beginner";
    SkillLevel["INTERMEDIATE"] = "intermediate";
    SkillLevel["ADVANCED"] = "advanced";
    SkillLevel["EXPERT"] = "expert";
})(SkillLevel || (exports.SkillLevel = SkillLevel = {}));
let UserSkill = class UserSkill {
    id;
    organizationId;
    userId;
    skillId;
    skill;
    level;
    endorsementCount;
    endorsements;
    createdAt;
    updatedAt;
};
exports.UserSkill = UserSkill;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserSkill.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], UserSkill.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], UserSkill.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], UserSkill.prototype, "skillId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Skill_1.Skill, s => s.userSkills, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'skillId' }),
    __metadata("design:type", Skill_1.Skill)
], UserSkill.prototype, "skill", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: SkillLevel.BEGINNER }),
    __metadata("design:type", String)
], UserSkill.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], UserSkill.prototype, "endorsementCount", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SkillEndorsement_1.SkillEndorsement, e => e.userSkill),
    __metadata("design:type", Array)
], UserSkill.prototype, "endorsements", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], UserSkill.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], UserSkill.prototype, "updatedAt", void 0);
exports.UserSkill = UserSkill = __decorate([
    (0, typeorm_1.Entity)('user_skills'),
    (0, typeorm_1.Index)(['organizationId', 'userId', 'skillId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId', 'userId']),
    (0, typeorm_1.Index)(['skillId'])
], UserSkill);
//# sourceMappingURL=UserSkill.js.map