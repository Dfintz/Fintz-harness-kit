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
exports.SkillEndorsement = void 0;
const typeorm_1 = require("typeorm");
const UserSkill_1 = require("./UserSkill");
let SkillEndorsement = class SkillEndorsement {
    id;
    userSkillId;
    userSkill;
    endorsedBy;
    createdAt;
};
exports.SkillEndorsement = SkillEndorsement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SkillEndorsement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], SkillEndorsement.prototype, "userSkillId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => UserSkill_1.UserSkill, us => us.endorsements, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'userSkillId' }),
    __metadata("design:type", UserSkill_1.UserSkill)
], SkillEndorsement.prototype, "userSkill", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], SkillEndorsement.prototype, "endorsedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], SkillEndorsement.prototype, "createdAt", void 0);
exports.SkillEndorsement = SkillEndorsement = __decorate([
    (0, typeorm_1.Entity)('skill_endorsements'),
    (0, typeorm_1.Index)(['userSkillId', 'endorsedBy'], { unique: true })
], SkillEndorsement);
//# sourceMappingURL=SkillEndorsement.js.map