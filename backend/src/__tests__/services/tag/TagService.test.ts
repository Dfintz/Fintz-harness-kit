/**
 * TagService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - duplicate tag name (create / update)            → ConflictError (statusCode 409)
 * - missing tag (update / delete / apply / remove)   → NotFoundError (statusCode 404)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * maps to the HTTP response (TagService is reached via TagController, which
 * extends BaseController). The duplicate-name throws previously fell through to
 * 500, so they guard the 500→409 fixes.
 */
import { Tag } from '../../../models/Tag';
import { TagAssignment } from '../../../models/TagAssignment';
import { ConflictError, NotFoundError } from '../../../utils/apiErrors';

const mockTagRepo = {
  findOne: jest.fn(),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve(data)),
  remove: jest.fn(),
};

const mockAssignmentRepo = {
  findOne: jest.fn(),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve(data)),
  delete: jest.fn(),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Tag) return mockTagRepo;
      if (entity === TagAssignment) return mockAssignmentRepo;
      return {};
    }),
  },
}));

// Import after mocks
import { TagService } from '../../../services/tag/TagService';

describe('TagService — typed error contract', () => {
  let service: TagService;

  const orgId = 'org-1';
  const userId = 'user-1';
  const tagId = 'tag-1';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TagService();
  });

  describe('createTag', () => {
    it('throws ConflictError (409) when a tag with the same name exists', async () => {
      mockTagRepo.findOne.mockResolvedValue({ id: 'existing', name: 'Priority' });

      const error = await service
        .createTag(orgId, userId, { name: 'Priority' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });

  describe('updateTag', () => {
    it('throws NotFoundError (404) when the tag does not exist', async () => {
      mockTagRepo.findOne.mockResolvedValue(null);

      const error = await service
        .updateTag(orgId, tagId, { name: 'New Name' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('throws ConflictError (409) when renaming to an existing tag name', async () => {
      mockTagRepo.findOne
        .mockResolvedValueOnce({ id: tagId, name: 'Priority' }) // the tag being updated
        .mockResolvedValueOnce({ id: 'other', name: 'Urgent' }); // duplicate name check

      const error = await service
        .updateTag(orgId, tagId, { name: 'Urgent' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });

  describe('deleteTag', () => {
    it('throws NotFoundError (404) when the tag does not exist', async () => {
      mockTagRepo.findOne.mockResolvedValue(null);

      const error = await service.deleteTag(orgId, tagId).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });

  describe('applyTag', () => {
    it('throws NotFoundError (404) when the tag does not exist', async () => {
      mockTagRepo.findOne.mockResolvedValue(null);

      const error = await service
        .applyTag(orgId, userId, tagId, 'fleet', 'fleet-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });

  describe('removeTag', () => {
    it('throws NotFoundError (404) when the tag does not exist', async () => {
      mockTagRepo.findOne.mockResolvedValue(null);

      const error = await service
        .removeTag(orgId, tagId, 'fleet', 'fleet-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });
});
