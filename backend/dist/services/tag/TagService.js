"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagService = void 0;
const database_1 = require("../../config/database");
const Tag_1 = require("../../models/Tag");
const TagAssignment_1 = require("../../models/TagAssignment");
const apiErrors_1 = require("../../utils/apiErrors");
class TagService {
    tagRepository = database_1.AppDataSource.getRepository(Tag_1.Tag);
    assignmentRepository = database_1.AppDataSource.getRepository(TagAssignment_1.TagAssignment);
    async listTags(organizationId, filters) {
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
    async getTag(organizationId, tagId) {
        return this.tagRepository.findOne({
            where: { id: tagId, organizationId },
        });
    }
    async createTag(organizationId, userId, data) {
        const existing = await this.tagRepository.findOne({
            where: { organizationId, name: data.name },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('A tag with this name already exists');
        }
        const tag = this.tagRepository.create({
            ...data,
            organizationId,
            createdBy: userId,
        });
        return this.tagRepository.save(tag);
    }
    async updateTag(organizationId, tagId, data) {
        const tag = await this.tagRepository.findOne({
            where: { id: tagId, organizationId },
        });
        if (!tag) {
            throw new apiErrors_1.NotFoundError('Tag');
        }
        if (data.name && data.name !== tag.name) {
            const duplicate = await this.tagRepository.findOne({
                where: { organizationId, name: data.name },
            });
            if (duplicate) {
                throw new apiErrors_1.ConflictError('A tag with this name already exists');
            }
        }
        Object.assign(tag, data);
        return this.tagRepository.save(tag);
    }
    async deleteTag(organizationId, tagId) {
        const tag = await this.tagRepository.findOne({
            where: { id: tagId, organizationId },
        });
        if (!tag) {
            throw new apiErrors_1.NotFoundError('Tag');
        }
        await this.assignmentRepository.delete({ tagId });
        await this.tagRepository.remove(tag);
    }
    async applyTag(organizationId, userId, tagId, resourceType, resourceId) {
        const tag = await this.tagRepository.findOne({
            where: { id: tagId, organizationId },
        });
        if (!tag) {
            throw new apiErrors_1.NotFoundError('Tag');
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
    async removeTag(organizationId, tagId, resourceType, resourceId) {
        const tag = await this.tagRepository.findOne({
            where: { id: tagId, organizationId },
        });
        if (!tag) {
            throw new apiErrors_1.NotFoundError('Tag');
        }
        await this.assignmentRepository.delete({ tagId, resourceType, resourceId });
    }
    async getPopularTags(organizationId, limit = 10) {
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
exports.TagService = TagService;
//# sourceMappingURL=TagService.js.map