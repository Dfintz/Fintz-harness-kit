/**
 * SkillService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - duplicate skill name (create / update)   → ConflictError (statusCode 409)
 * - missing skill (update / delete / endorse) → NotFoundError (statusCode 404)
 * - endorsing your own skill                  → ValidationError (statusCode 400)
 * - endorsing a skill twice                   → ConflictError (statusCode 409)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * maps to the HTTP response (SkillService is reached via SkillController, which
 * extends BaseController). All of these previously threw a bare Error that fell
 * through to 500, so they guard the 500→{409,404,400} fixes.
 */
import { Skill } from '../../../models/Skill';
import { SkillEndorsement } from '../../../models/SkillEndorsement';
import { UserSkill } from '../../../models/UserSkill';
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/apiErrors';

const mockSkillRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve(data)),
  remove: jest.fn(),
};

const mockUserSkillRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve({ id: 'us-1', ...data })),
  delete: jest.fn(),
};

const mockEndorsementRepo = {
  findOne: jest.fn(),
  create: jest.fn((data: Record<string, unknown>) => data),
  save: jest.fn((data: Record<string, unknown>) => Promise.resolve(data)),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Skill) return mockSkillRepo;
      if (entity === UserSkill) return mockUserSkillRepo;
      if (entity === SkillEndorsement) return mockEndorsementRepo;
      return {};
    }),
  },
}));

// Import after mocks
import { SkillService } from '../../../services/skill/SkillService';

describe('SkillService — typed error contract', () => {
  let service: SkillService;

  const orgId = 'org-1';
  const userId = 'user-1';
  const skillId = 'skill-1';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SkillService();
  });

  describe('createSkill', () => {
    it('throws ConflictError (409) when a skill with the same name exists', async () => {
      mockSkillRepo.findOne.mockResolvedValue({ id: 'existing', name: 'Mining' });

      const error = await service
        .createSkill(orgId, userId, { name: 'Mining' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });

  describe('updateSkill', () => {
    it('throws NotFoundError (404) when the skill does not exist', async () => {
      mockSkillRepo.findOne.mockResolvedValue(null);

      const error = await service
        .updateSkill(orgId, skillId, { name: 'New Name' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('throws ConflictError (409) when renaming to an existing skill name', async () => {
      mockSkillRepo.findOne
        .mockResolvedValueOnce({ id: skillId, name: 'Mining' }) // the skill being updated
        .mockResolvedValueOnce({ id: 'other', name: 'Trading' }); // duplicate name check

      const error = await service
        .updateSkill(orgId, skillId, { name: 'Trading' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });

  describe('deleteSkill', () => {
    it('throws NotFoundError (404) when the skill does not exist', async () => {
      mockSkillRepo.findOne.mockResolvedValue(null);

      const error = await service.deleteSkill(orgId, skillId).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });

  describe('endorseSkill', () => {
    it('throws NotFoundError (404) when the skill does not exist', async () => {
      mockSkillRepo.findOne.mockResolvedValue(null);

      const error = await service
        .endorseSkill(orgId, 'endorser-1', skillId, userId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('throws ValidationError (400) when endorsing your own skill', async () => {
      mockSkillRepo.findOne.mockResolvedValue({ id: skillId, name: 'Mining' });

      const error = await service
        .endorseSkill(orgId, userId, skillId, userId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('throws ConflictError (409) when the endorser already endorsed the skill', async () => {
      mockSkillRepo.findOne.mockResolvedValue({ id: skillId, name: 'Mining' });
      mockUserSkillRepo.findOne.mockResolvedValue({ id: 'us-1', userId, skillId });
      mockEndorsementRepo.findOne.mockResolvedValue({ id: 'end-1', endorsedBy: 'endorser-1' });

      const error = await service
        .endorseSkill(orgId, 'endorser-1', skillId, userId)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });
});
