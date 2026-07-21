/**
 * CommentService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - missing comment / parent  → NotFoundError (statusCode 404)
 * - editing/deleting another user's comment → ForbiddenError (statusCode 403)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * maps to the HTTP response, so they document the intended status for each path
 * (and guard the 500→403 fix for the ownership checks, which previously threw a
 * bare Error that fell through to 500).
 */
import { Comment } from '../../../models/Comment';
import { CommentLike } from '../../../models/CommentLike';
import { CommentService } from '../../../services/comment/CommentService';
import { ForbiddenError, NotFoundError } from '../../../utils/apiErrors';

const mockCommentRepo = {
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  softRemove: jest.fn(),
};

const mockLikeRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Comment) return mockCommentRepo;
      if (entity === CommentLike) return mockLikeRepo;
      return {};
    }),
  },
}));

describe('CommentService — typed error contract', () => {
  let service: CommentService;

  const orgId = 'org-1';
  const ownerId = 'user-owner';
  const otherUserId = 'user-other';
  const commentId = 'comment-1';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CommentService();
  });

  describe('updateComment', () => {
    it('throws NotFoundError (404) when the comment does not exist', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateComment(orgId, ownerId, commentId, 'updated')
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'Comment not found',
      });
      await expect(
        service.updateComment(orgId, ownerId, commentId, 'updated')
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ForbiddenError (403) when editing another user comment', async () => {
      mockCommentRepo.findOne.mockResolvedValue({ id: commentId, createdBy: otherUserId });

      await expect(
        service.updateComment(orgId, ownerId, commentId, 'updated')
      ).rejects.toMatchObject({ name: 'ForbiddenError', statusCode: 403 });
      await expect(
        service.updateComment(orgId, ownerId, commentId, 'updated')
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('updates and saves when the requester owns the comment', async () => {
      const comment = { id: commentId, createdBy: ownerId, content: 'old', isEdited: false };
      mockCommentRepo.findOne.mockResolvedValue(comment);
      mockCommentRepo.save.mockImplementation((c: unknown) => Promise.resolve(c));

      const result = await service.updateComment(orgId, ownerId, commentId, 'new content');

      expect(result.content).toBe('new content');
      expect(result.isEdited).toBe(true);
      expect(mockCommentRepo.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteComment', () => {
    it('throws NotFoundError (404) when the comment does not exist', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteComment(orgId, ownerId, commentId)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });

    it('throws ForbiddenError (403) when deleting another user comment', async () => {
      mockCommentRepo.findOne.mockResolvedValue({ id: commentId, createdBy: otherUserId });

      await expect(service.deleteComment(orgId, ownerId, commentId)).rejects.toMatchObject({
        name: 'ForbiddenError',
        statusCode: 403,
      });
    });

    it('soft-removes when the requester owns the comment', async () => {
      const comment = { id: commentId, createdBy: ownerId };
      mockCommentRepo.findOne.mockResolvedValue(comment);

      await service.deleteComment(orgId, ownerId, commentId);

      expect(mockCommentRepo.softRemove).toHaveBeenCalledWith(comment);
    });
  });

  describe('replyToComment', () => {
    it('throws NotFoundError (404) with the parent resource name when the parent is missing', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.replyToComment(orgId, ownerId, 'Owner', commentId, 'reply')
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'Parent comment not found',
      });
    });
  });

  describe('likeComment / unlikeComment', () => {
    it('likeComment throws NotFoundError (404) when the comment does not exist', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(service.likeComment(orgId, ownerId, commentId)).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it('unlikeComment throws NotFoundError (404) when the comment does not exist', async () => {
      mockCommentRepo.findOne.mockResolvedValue(null);

      await expect(service.unlikeComment(orgId, ownerId, commentId)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });
  });
});
