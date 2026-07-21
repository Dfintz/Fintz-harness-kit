import { AppDataSource } from '../../config/database';
import { Tag } from '../../models/Tag';
import { TagAssignment } from '../../models/TagAssignment';
import { ConflictError, NotFoundError } from '../../utils/apiErrors';

export class TagService {
  private readonly tagRepository = AppDataSource.getRepository(Tag);
  private readonly assignmentRepository = AppDataSource.getRepository(TagAssignment);

  async listTags(
    organizationId: string,
    filters?: { search?: string; limit?: number }
  ): Promise<Tag[]> {
    const qb = this.tagRepository
      .createQueryBuilder('tag')
      .where('tag.organizationId = :organizationId', { organizationId })
      .orderBy('tag.name', 'ASC');

    if (filters?.search) {
      qb.andWhere('tag.name ILIKE :search', { search: `%${filters.search}%` });
    }

    qb.take(filters?.limit ?? 50);

    return qb.getMany();
  }

  async getTag(organizationId: string, tagId: string): Promise<Tag | null> {
    return this.tagRepository.findOne({
      where: { id: tagId, organizationId },
    });
  }

  async createTag(
    organizationId: string,
    userId: string,
    data: { name: string; color?: string; description?: string }
  ): Promise<Tag> {
    const existing = await this.tagRepository.findOne({
      where: { organizationId, name: data.name },
    });
    if (existing) {
      throw new ConflictError('A tag with this name already exists');
    }

    const tag = this.tagRepository.create({
      ...data,
      organizationId,
      createdBy: userId,
    });
    return this.tagRepository.save(tag);
  }

  async updateTag(
    organizationId: string,
    tagId: string,
    data: { name?: string; color?: string; description?: string }
  ): Promise<Tag> {
    const tag = await this.tagRepository.findOne({
      where: { id: tagId, organizationId },
    });
    if (!tag) {
      throw new NotFoundError('Tag');
    }

    if (data.name && data.name !== tag.name) {
      const duplicate = await this.tagRepository.findOne({
        where: { organizationId, name: data.name },
      });
      if (duplicate) {
        throw new ConflictError('A tag with this name already exists');
      }
    }

    Object.assign(tag, data);
    return this.tagRepository.save(tag);
  }

  async deleteTag(organizationId: string, tagId: string): Promise<void> {
    const tag = await this.tagRepository.findOne({
      where: { id: tagId, organizationId },
    });
    if (!tag) {
      throw new NotFoundError('Tag');
    }

    await this.assignmentRepository.delete({ tagId });
    await this.tagRepository.remove(tag);
  }

  async applyTag(
    organizationId: string,
    userId: string,
    tagId: string,
    resourceType: string,
    resourceId: string
  ): Promise<TagAssignment> {
    const tag = await this.tagRepository.findOne({
      where: { id: tagId, organizationId },
    });
    if (!tag) {
      throw new NotFoundError('Tag');
    }

    const existing = await this.assignmentRepository.findOne({
      where: { tagId, resourceType, resourceId },
    });
    if (existing) {
      return existing;
    }

    const assignment = this.assignmentRepository.create({
      tagId,
      resourceType,
      resourceId,
      assignedBy: userId,
    });
    return this.assignmentRepository.save(assignment);
  }

  async removeTag(
    organizationId: string,
    tagId: string,
    resourceType: string,
    resourceId: string
  ): Promise<void> {
    const tag = await this.tagRepository.findOne({
      where: { id: tagId, organizationId },
    });
    if (!tag) {
      throw new NotFoundError('Tag');
    }

    await this.assignmentRepository.delete({ tagId, resourceType, resourceId });
  }

  async getPopularTags(
    organizationId: string,
    limit: number = 10
  ): Promise<Array<{ tag: Tag; usageCount: number }>> {
    const results = await this.tagRepository
      .createQueryBuilder('tag')
      .leftJoin('tag.assignments', 'assignment')
      .addSelect('COUNT(assignment.id)', 'usageCount')
      .where('tag.organizationId = :organizationId', { organizationId })
      .groupBy('tag.id')
      .orderBy('"usageCount"', 'DESC')
      .take(limit)
      .getRawAndEntities();

    return results.entities.map((tag, index) => ({
      tag,
      usageCount: parseInt(results.raw[index]?.usageCount ?? '0', 10),
    }));
  }
}

