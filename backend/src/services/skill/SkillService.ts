import { AppDataSource } from '../../config/database';
import { Skill, SkillCategory } from '../../models/Skill';
import { SkillEndorsement } from '../../models/SkillEndorsement';
import { SkillLevel, UserSkill } from '../../models/UserSkill';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';

export class SkillService {
  private readonly skillRepository = AppDataSource.getRepository(Skill);
  private readonly userSkillRepository = AppDataSource.getRepository(UserSkill);
  private readonly endorsementRepository = AppDataSource.getRepository(SkillEndorsement);

  async listSkills(
    organizationId: string,
    filters?: { category?: string; search?: string; limit?: number }
  ): Promise<Skill[]> {
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

  async getSkill(organizationId: string, skillId: string): Promise<Skill | null> {
    return this.skillRepository.findOne({
      where: { id: skillId, organizationId },
    });
  }

  async createSkill(
    organizationId: string,
    userId: string,
    data: { name: string; description?: string; category?: string }
  ): Promise<Skill> {
    const existing = await this.skillRepository.findOne({
      where: { organizationId, name: data.name },
    });
    if (existing) {
      throw new ConflictError('A skill with this name already exists');
    }

    const skill = this.skillRepository.create({
      name: data.name,
      description: data.description,
      category: (data.category as SkillCategory) ?? SkillCategory.OTHER,
      organizationId,
      createdBy: userId,
    });
    return this.skillRepository.save(skill);
  }

  async updateSkill(
    organizationId: string,
    skillId: string,
    data: { name?: string; description?: string; category?: string }
  ): Promise<Skill> {
    const skill = await this.skillRepository.findOne({
      where: { id: skillId, organizationId },
    });
    if (!skill) {
      throw new NotFoundError('Skill');
    }

    if (data.name && data.name !== skill.name) {
      const duplicate = await this.skillRepository.findOne({
        where: { organizationId, name: data.name },
      });
      if (duplicate) {
        throw new ConflictError('A skill with this name already exists');
      }
    }

    if (data.name !== undefined) {
      skill.name = data.name;
    }
    if (data.description !== undefined) {
      skill.description = data.description;
    }
    if (data.category !== undefined) {
      skill.category = data.category as SkillCategory;
    }

    return this.skillRepository.save(skill);
  }

  async deleteSkill(organizationId: string, skillId: string): Promise<void> {
    const skill = await this.skillRepository.findOne({
      where: { id: skillId, organizationId },
    });
    if (!skill) {
      throw new NotFoundError('Skill');
    }

    await this.userSkillRepository.delete({ skillId });
    await this.skillRepository.remove(skill);
  }

  async getUserSkills(organizationId: string, userId: string): Promise<UserSkill[]> {
    return this.userSkillRepository.find({
      where: { organizationId, userId },
      relations: ['skill'],
      order: { createdAt: 'DESC' },
    });
  }

  async endorseSkill(
    organizationId: string,
    endorserId: string,
    skillId: string,
    userId: string
  ): Promise<SkillEndorsement> {
    // Verify skill belongs to org
    const skill = await this.skillRepository.findOne({
      where: { id: skillId, organizationId },
    });
    if (!skill) {
      throw new NotFoundError('Skill');
    }

    if (endorserId === userId) {
      throw new ValidationError('You cannot endorse your own skill');
    }

    // Get or create the user skill
    let userSkill = await this.userSkillRepository.findOne({
      where: { organizationId, userId, skillId },
    });
    if (!userSkill) {
      userSkill = this.userSkillRepository.create({
        organizationId,
        userId,
        skillId,
        level: SkillLevel.BEGINNER,
      });
      userSkill = await this.userSkillRepository.save(userSkill);
    }

    // Check if already endorsed
    const existing = await this.endorsementRepository.findOne({
      where: { userSkillId: userSkill.id, endorsedBy: endorserId },
    });
    if (existing) {
      throw new ConflictError('You have already endorsed this skill');
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

  async getCategories(): Promise<string[]> {
    return Object.values(SkillCategory);
  }
}

