"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillService = void 0;
const database_1 = require("../../config/database");
const Skill_1 = require("../../models/Skill");
const SkillEndorsement_1 = require("../../models/SkillEndorsement");
const UserSkill_1 = require("../../models/UserSkill");
const apiErrors_1 = require("../../utils/apiErrors");
class SkillService {
    skillRepository = database_1.AppDataSource.getRepository(Skill_1.Skill);
    userSkillRepository = database_1.AppDataSource.getRepository(UserSkill_1.UserSkill);
    endorsementRepository = database_1.AppDataSource.getRepository(SkillEndorsement_1.SkillEndorsement);
    async listSkills(organizationId, filters) {
        const qb = this.skillRepository
            .createQueryBuilder('skill')
            .where('skill.organizationId = :organizationId', { organizationId })
            .orderBy('skill.name', 'ASC');
        if (filters?.category) {
            qb.andWhere('skill.category = :category', { category: filters.category });
        }
        if (filters?.search) {
            qb.andWhere('skill.name ILIKE :search', { search: `%${filters.search}%` });
        }
        qb.take(filters?.limit ?? 50);
        return qb.getMany();
    }
    async getSkill(organizationId, skillId) {
        return this.skillRepository.findOne({
            where: { id: skillId, organizationId },
        });
    }
    async createSkill(organizationId, userId, data) {
        const existing = await this.skillRepository.findOne({
            where: { organizationId, name: data.name },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('A skill with this name already exists');
        }
        const skill = this.skillRepository.create({
            name: data.name,
            description: data.description,
            category: data.category ?? Skill_1.SkillCategory.OTHER,
            organizationId,
            createdBy: userId,
        });
        return this.skillRepository.save(skill);
    }
    async updateSkill(organizationId, skillId, data) {
        const skill = await this.skillRepository.findOne({
            where: { id: skillId, organizationId },
        });
        if (!skill) {
            throw new apiErrors_1.NotFoundError('Skill');
        }
        if (data.name && data.name !== skill.name) {
            const duplicate = await this.skillRepository.findOne({
                where: { organizationId, name: data.name },
            });
            if (duplicate) {
                throw new apiErrors_1.ConflictError('A skill with this name already exists');
            }
        }
        if (data.name !== undefined) {
            skill.name = data.name;
        }
        if (data.description !== undefined) {
            skill.description = data.description;
        }
        if (data.category !== undefined) {
            skill.category = data.category;
        }
        return this.skillRepository.save(skill);
    }
    async deleteSkill(organizationId, skillId) {
        const skill = await this.skillRepository.findOne({
            where: { id: skillId, organizationId },
        });
        if (!skill) {
            throw new apiErrors_1.NotFoundError('Skill');
        }
        await this.userSkillRepository.delete({ skillId });
        await this.skillRepository.remove(skill);
    }
    async getUserSkills(organizationId, userId) {
        return this.userSkillRepository.find({
            where: { organizationId, userId },
            relations: ['skill'],
            order: { createdAt: 'DESC' },
        });
    }
    async endorseSkill(organizationId, endorserId, skillId, userId) {
        const skill = await this.skillRepository.findOne({
            where: { id: skillId, organizationId },
        });
        if (!skill) {
            throw new apiErrors_1.NotFoundError('Skill');
        }
        if (endorserId === userId) {
            throw new apiErrors_1.ValidationError('You cannot endorse your own skill');
        }
        let userSkill = await this.userSkillRepository.findOne({
            where: { organizationId, userId, skillId },
        });
        if (!userSkill) {
            userSkill = this.userSkillRepository.create({
                organizationId,
                userId,
                skillId,
                level: UserSkill_1.SkillLevel.BEGINNER,
            });
            userSkill = await this.userSkillRepository.save(userSkill);
        }
        const existing = await this.endorsementRepository.findOne({
            where: { userSkillId: userSkill.id, endorsedBy: endorserId },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('You have already endorsed this skill');
        }
        const endorsement = this.endorsementRepository.create({
            userSkillId: userSkill.id,
            endorsedBy: endorserId,
        });
        const saved = await this.endorsementRepository.save(endorsement);
        userSkill.endorsementCount += 1;
        await this.userSkillRepository.save(userSkill);
        return saved;
    }
    async getCategories() {
        return Object.values(Skill_1.SkillCategory);
    }
}
exports.SkillService = SkillService;
//# sourceMappingURL=SkillService.js.map