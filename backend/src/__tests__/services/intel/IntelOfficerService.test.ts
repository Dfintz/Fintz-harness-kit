/**
 * IntelOfficerService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - owner-only / access guards     → ForbiddenError (statusCode 403)
 * - missing officer                → NotFoundError (statusCode 404)
 * - duplicate officer / one-chief  → ConflictError (statusCode 409)
 * - target user not a member       → ValidationError (statusCode 400)
 *
 * The statusCode assertions matter: IntelVaultController consumes this service
 * via BaseController.executeAndReturn / execute, so handleError maps each typed
 * error to the right HTTP status. Every guard previously threw a bare Error that
 * fell through to 500 — these tests guard the 500→{403,404,409,400} fixes.
 */
import { IntelAuditLog } from '../../../models/IntelAuditLog';
import { IntelAccessLevel } from '../../../models/IntelEntry';
import { IntelOfficer, IntelOfficerRank } from '../../../models/IntelOfficer';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../utils/apiErrors';

const mockIntelOfficerRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};
const mockAuditLogRepo = { create: jest.fn(), save: jest.fn() };
const mockUserOrgRepo = { findOne: jest.fn() };

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === IntelOfficer) return mockIntelOfficerRepo;
      if (entity === IntelAuditLog) return mockAuditLogRepo;
      if (entity === OrganizationMembership) return mockUserOrgRepo;
      return {};
    }),
  },
}));

// Import after mocks
import {
  AppointOfficerInput,
  IntelOfficerService,
} from '../../../services/intel/IntelOfficerService';

describe('IntelOfficerService — typed error contract', () => {
  let service: IntelOfficerService;

  const orgId = 'org-1';
  const ownerId = 'user-owner';
  const officerId = 'officer-1';
  const targetUserId = 'user-target';

  const appointInput: AppointOfficerInput = {
    organizationId: orgId,
    userId: targetUserId,
    rank: IntelOfficerRank.OFFICER,
    accessLevel: IntelAccessLevel.READ,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IntelOfficerService();
  });

  describe('appointOfficer', () => {
    it('throws ForbiddenError (403) when the appointer is not the org owner', async () => {
      jest.spyOn(service, 'canManageOfficers').mockResolvedValue(false);

      await expect(service.appointOfficer(appointInput, ownerId)).rejects.toMatchObject({
        name: 'ForbiddenError',
        statusCode: 403,
      });
      await expect(service.appointOfficer(appointInput, ownerId)).rejects.toBeInstanceOf(
        ForbiddenError
      );
    });

    it('throws ValidationError (400) when the target user is not an org member', async () => {
      jest.spyOn(service, 'canManageOfficers').mockResolvedValue(true);
      mockUserOrgRepo.findOne.mockResolvedValue(null); // target not a member

      await expect(service.appointOfficer(appointInput, ownerId)).rejects.toMatchObject({
        name: 'ValidationError',
        statusCode: 400,
      });
      await expect(service.appointOfficer(appointInput, ownerId)).rejects.toBeInstanceOf(
        ValidationError
      );
    });

    it('throws ConflictError (409) when the user is already an active Intel officer', async () => {
      jest.spyOn(service, 'canManageOfficers').mockResolvedValue(true);
      mockUserOrgRepo.findOne.mockResolvedValue({ userId: targetUserId, organizationId: orgId });
      mockIntelOfficerRepo.findOne.mockResolvedValue({ id: officerId, isActive: true });

      await expect(service.appointOfficer(appointInput, ownerId)).rejects.toMatchObject({
        name: 'ConflictError',
        statusCode: 409,
        message: 'User is already an active Intel officer',
      });
      await expect(service.appointOfficer(appointInput, ownerId)).rejects.toBeInstanceOf(
        ConflictError
      );
    });
  });

  describe('updateOfficer', () => {
    it('throws NotFoundError (404) when the officer does not exist', async () => {
      mockIntelOfficerRepo.findOne.mockResolvedValue(null);

      await expect(service.updateOfficer(officerId, ownerId, orgId, {})).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'Intel officer not found',
      });
    });

    it('throws ForbiddenError (403) when a non-owner tries to update', async () => {
      mockIntelOfficerRepo.findOne.mockResolvedValue({
        id: officerId,
        rank: IntelOfficerRank.OFFICER,
      });
      jest.spyOn(service, 'canManageOfficers').mockResolvedValue(false);

      await expect(service.updateOfficer(officerId, ownerId, orgId, {})).rejects.toMatchObject({
        name: 'ForbiddenError',
        statusCode: 403,
      });
    });
  });

  describe('removeOfficer', () => {
    it('throws NotFoundError (404) when the officer does not exist', async () => {
      mockIntelOfficerRepo.findOne.mockResolvedValue(null);

      await expect(service.removeOfficer(officerId, ownerId, orgId)).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it('throws ForbiddenError (403) when a non-owner tries to remove', async () => {
      mockIntelOfficerRepo.findOne.mockResolvedValue({ id: officerId });
      jest.spyOn(service, 'canManageOfficers').mockResolvedValue(false);

      await expect(service.removeOfficer(officerId, ownerId, orgId)).rejects.toMatchObject({
        name: 'ForbiddenError',
        statusCode: 403,
        message: 'Only organization owner can remove Intel officers',
      });
    });
  });

  describe('getOfficers / getOfficer', () => {
    it('getOfficers throws ForbiddenError (403) when the user is neither owner nor officer', async () => {
      mockUserOrgRepo.findOne.mockResolvedValue({ role: 'member' });
      mockIntelOfficerRepo.findOne.mockResolvedValue(null); // not an officer

      await expect(service.getOfficers(orgId, 'user-x')).rejects.toMatchObject({
        name: 'ForbiddenError',
        statusCode: 403,
      });
    });

    it('getOfficer throws NotFoundError (404) when the officer does not exist', async () => {
      mockIntelOfficerRepo.findOne.mockResolvedValue(null);

      await expect(service.getOfficer(officerId, 'user-x', orgId)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });
  });
});
