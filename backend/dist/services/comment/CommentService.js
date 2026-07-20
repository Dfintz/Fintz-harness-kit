"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentService = void 0;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const Comment_1 = require("../../models/Comment");
const CommentLike_1 = require("../../models/CommentLike");
const apiErrors_1 = require("../../utils/apiErrors");
class CommentService {
    commentRepository = database_1.AppDataSource.getRepository(Comment_1.Comment);
    likeRepository = database_1.AppDataSource.getRepository(CommentLike_1.CommentLike);
    async listComments(organizationId, filters) {
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const sortOrder = filters.sortOrder ?? 'DESC';
        const [data, total] = await this.commentRepository.findAndCount({
            where: {
                organizationId,
                resourceType: filters.resourceType,
                resourceId: filters.resourceId,
                parentId: (0, typeorm_1.IsNull)(),
            },
            order: { createdAt: sortOrder },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { data, total };
    }
    async getComment(organizationId, commentId) {
        return this.commentRepository.findOne({
            where: { id: commentId, organizationId },
        });
    }
    async createComment(organizationId, userId, userName, data) {
        const comment = this.commentRepository.create({
            content: data.content,
            resourceType: data.resourceType,
            resourceId: data.resourceId,
            organizationId,
            createdBy: userId,
            createdByName: userName,
        });
        return this.commentRepository.save(comment);
    }
    async updateComment(organizationId, userId, commentId, content) {
        const comment = await this.commentRepository.findOne({
            where: { id: commentId, organizationId },
        });
        if (!comment) {
            throw new apiErrors_1.NotFoundError('Comment');
        }
        if (comment.createdBy !== userId) {
            throw new apiErrors_1.ForbiddenError('You can only edit your own comments');
        }
        comment.content = content;
        comment.isEdited = true;
        comment.editedAt = new Date();
        return this.commentRepository.save(comment);
    }
    async deleteComment(organizationId, userId, commentId) {
        const comment = await this.commentRepository.findOne({
            where: { id: commentId, organizationId },
        });
        if (!comment) {
            throw new apiErrors_1.NotFoundError('Comment');
        }
        if (comment.createdBy !== userId) {
            throw new apiErrors_1.ForbiddenError('You can only delete your own comments');
        }
        await this.commentRepository.softRemove(comment);
    }
    async replyToComment(organizationId, userId, userName, parentId, content) {
        const parent = await this.commentRepository.findOne({
            where: { id: parentId, organizationId },
        });
        if (!parent) {
            throw new apiErrors_1.NotFoundError('Parent comment');
        }
        const reply = this.commentRepository.create({
            content,
            resourceType: parent.resourceType,
            resourceId: parent.resourceId,
            organizationId,
            createdBy: userId,
            createdByName: userName,
            parentId,
        });
        const saved = await this.commentRepository.save(reply);
        parent.replyCount += 1;
        await this.commentRepository.save(parent);
        return saved;
    }
    async likeComment(organizationId, userId, commentId) {
        const comment = await this.commentRepository.findOne({
            where: { id: commentId, organizationId },
        });
        if (!comment) {
            throw new apiErrors_1.NotFoundError('Comment');
        }
        const existing = await this.likeRepository.findOne({
            where: { commentId, userId },
        });
        if (existing) {
            return;
        }
        await this.likeRepository.save(this.likeRepository.create({ commentId, userId }));
        comment.likeCount += 1;
        await this.commentRepository.save(comment);
    }
    async unlikeComment(organizationId, userId, commentId) {
        const comment = await this.commentRepository.findOne({
            where: { id: commentId, organizationId },
        });
        if (!comment) {
            throw new apiErrors_1.NotFoundError('Comment');
        }
        const result = await this.likeRepository.delete({ commentId, userId });
        if (result.affected && result.affected > 0) {
            comment.likeCount = Math.max(0, comment.likeCount - 1);
            await this.commentRepository.save(comment);
        }
    }
    async getReplies(organizationId, commentId) {
        return this.commentRepository.find({
            where: { parentId: commentId, organizationId },
            order: { createdAt: 'ASC' },
        });
    }
}
exports.CommentService = CommentService;
//# sourceMappingURL=CommentService.js.map