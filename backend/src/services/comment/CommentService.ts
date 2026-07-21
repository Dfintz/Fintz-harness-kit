import { IsNull } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Comment } from '../../models/Comment';
import { CommentLike } from '../../models/CommentLike';
import { ForbiddenError, NotFoundError } from '../../utils/apiErrors';

export interface CommentListFilters {
  resourceType: string;
  resourceId: string;
  page?: number;
  limit?: number;
  sortOrder?: 'ASC' | 'DESC';
}

export class CommentService {
  private readonly commentRepository = AppDataSource.getRepository(Comment);
  private readonly likeRepository = AppDataSource.getRepository(CommentLike);

  async listComments(
    organizationId: string,
    filters: CommentListFilters
  ): Promise<{ data: Comment[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const sortOrder = filters.sortOrder ?? 'DESC';

    const [data, total] = await this.commentRepository.findAndCount({
      where: {
        organizationId,
        resourceType: filters.resourceType,
        resourceId: filters.resourceId,
        parentId: IsNull(),
      },
      order: { createdAt: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async getComment(organizationId: string, commentId: string): Promise<Comment | null> {
    return this.commentRepository.findOne({
      where: { id: commentId, organizationId },
    });
  }

  async createComment(
    organizationId: string,
    userId: string,
    userName: string | undefined,
    data: { content: string; resourceType: string; resourceId: string }
  ): Promise<Comment> {
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

  async updateComment(
    organizationId: string,
    userId: string,
    commentId: string,
    content: string
  ): Promise<Comment> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, organizationId },
    });
    if (!comment) {
      throw new NotFoundError('Comment');
    }
    if (comment.createdBy !== userId) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();
    return this.commentRepository.save(comment);
  }

  async deleteComment(organizationId: string, userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, organizationId },
    });
    if (!comment) {
      throw new NotFoundError('Comment');
    }
    if (comment.createdBy !== userId) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    await this.commentRepository.softRemove(comment);
  }

  async replyToComment(
    organizationId: string,
    userId: string,
    userName: string | undefined,
    parentId: string,
    content: string
  ): Promise<Comment> {
    const parent = await this.commentRepository.findOne({
      where: { id: parentId, organizationId },
    });
    if (!parent) {
      throw new NotFoundError('Parent comment');
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

  async likeComment(organizationId: string, userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, organizationId },
    });
    if (!comment) {
      throw new NotFoundError('Comment');
    }

    const existing = await this.likeRepository.findOne({
      where: { commentId, userId },
    });
    if (existing) {
      return; // Already liked
    }

    await this.likeRepository.save(this.likeRepository.create({ commentId, userId }));

    comment.likeCount += 1;
    await this.commentRepository.save(comment);
  }

  async unlikeComment(organizationId: string, userId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, organizationId },
    });
    if (!comment) {
      throw new NotFoundError('Comment');
    }

    const result = await this.likeRepository.delete({ commentId, userId });
    if (result.affected && result.affected > 0) {
      comment.likeCount = Math.max(0, comment.likeCount - 1);
      await this.commentRepository.save(comment);
    }
  }

  async getReplies(organizationId: string, commentId: string): Promise<Comment[]> {
    return this.commentRepository.find({
      where: { parentId: commentId, organizationId },
      order: { createdAt: 'ASC' },
    });
  }
}

