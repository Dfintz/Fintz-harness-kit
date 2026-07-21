/**
 * IntelVaultService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - access / clearance / permission guards → ForbiddenError (statusCode 403)
 * - missing intel entry                     → NotFoundError (statusCode 404)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * (via IntelVaultController.executeAndReturn) maps to the HTTP response. Every
 * ForbiddenError path previously threw a bare Error whose message carried no
 * status token, so it fell through to 500 — these guard the 500→403 fixes.
 */
import { IntelAuditLog } from '../../../models/IntelAuditLog';
import { IntelCategory, IntelClassification, IntelEntry } from '../../../models/IntelEntry';
import { IntelOfficer, IntelOfficerRank } from '../../../models/IntelOfficer';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { ForbiddenError, NotFoundError } from '../../../utils/apiErrors';

const mockIntelEntryRepo = {
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};
const mockIntelOfficerRepo = { findOne: jest.fn() };
const mockAuditLogRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};
const mockUserOrgRepo = { findOne: jest.fn() };

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === IntelEntry) return mockIntelEntryRepo;
      if (entity === IntelOfficer) return mockIntelOfficerRepo;
      if (entity === IntelAuditLog) return mockAuditLogRepo;
      if (entity === OrganizationMembership) return mockUserOrgRepo;
      return {};
    }),
  },
}));

jest.mock('../../../services/intel/IntelEncryptionService', () => ({
  IntelEncryptionService: {
    encryptContent: jest.fn((c: string) => c),
    encryptMetadata: jest.fn((m: unknown) => m),
    decryptContent: jest.fn((c: string) => c),
    decryptMetadata: jest.fn((m: unknown) => m),
    requiresEncryption: jest.fn(() => false),
  },
}));

// Import after mocks
import {
  CreateIntelEntryInput,
  IntelVaultService,
} from '../../../services/intel/IntelVaultService';

type AccessResult = {
  hasAccess: boolean;
  isOwner?: boolean;
  isIntelOfficer?: boolean;
  accessLevel?: string;
  officerRank?: IntelOfficerRank;
};

describe('IntelVaultService — typed error contract', () => {
  let service: IntelVaultService;

  const orgId = 'org-1';
  const userId = 'user-1';
  const entryId = 'entry-1';

  const mockAccess = (result: AccessResult): void => {
    jest.spyOn(service, 'checkAccess').mockResolvedValue(result);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new IntelVaultService();
  });

  const baseInput = (classification: IntelClassification): CreateIntelEntryInput => ({
    organizationId: orgId,
    title: 'T',
    content: 'C',
    category: IntelCategory.STRATEGIC,
    classification,
  });

  describe('createEntry', () => {
    it('throws ForbiddenError (403) when the user has no vault access', async () => {
      mockAccess({ hasAccess: false });

      await expect(
        service.createEntry(baseInput(IntelClassification.PUBLIC), userId)
      ).rejects.toMatchObject({ name: 'ForbiddenError', statusCode: 403 });
      await expect(
        service.createEntry(baseInput(IntelClassification.PUBLIC), userId)
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('throws ForbiddenError (403) when clearance is insufficient for the classification', async () => {
      mockAccess({
        hasAccess: true,
        isOwner: false,
        isIntelOfficer: true,
        officerRank: IntelOfficerRank.JUNIOR,
      });

      await expect(
        service.createEntry(baseInput(IntelClassification.CONFIDENTIAL), userId)
      ).rejects.toMatchObject({ name: 'ForbiddenError', statusCode: 403 });
    });

    it('throws ForbiddenError (403) when the user lacks write permission', async () => {
      mockAccess({
        hasAccess: true,
        isOwner: false,
        isIntelOfficer: true,
        officerRank: IntelOfficerRank.CHIEF,
        accessLevel: 'read',
      });

      await expect(
        service.createEntry(baseInput(IntelClassification.PUBLIC), userId)
      ).rejects.toMatchObject({ name: 'ForbiddenError', statusCode: 403 });
    });
  });

  describe('getEntry', () => {
    it('throws NotFoundError (404) when the entry does not exist', async () => {
      mockIntelEntryRepo.findOne.mockResolvedValue(null);

      await expect(service.getEntry(entryId, userId, orgId)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'Intel entry not found',
      });
      await expect(service.getEntry(entryId, userId, orgId)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ForbiddenError (403) when the user has no vault access', async () => {
      mockIntelEntryRepo.findOne.mockResolvedValue({
        id: entryId,
        classification: IntelClassification.PUBLIC,
      });
      mockAccess({ hasAccess: false });

      await expect(service.getEntry(entryId, userId, orgId)).rejects.toMatchObject({
        name: 'ForbiddenError',
        statusCode: 403,
      });
    });
  });

  describe('updateEntry', () => {
    it('throws NotFoundError (404) when the entry does not exist', async () => {
      mockIntelEntryRepo.findOne.mockResolvedValue(null);

      await expect(service.updateEntry(entryId, userId, orgId, {})).rejects.toBeInstanceOf(
        NotFoundError
      );
    });
  });

  describe('deleteEntry', () => {
    it('throws NotFoundError (404) when the entry does not exist', async () => {
      mockIntelEntryRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteEntry(entryId, userId, orgId)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });

    it('throws ForbiddenError (403) when the user lacks delete permission', async () => {
      mockIntelEntryRepo.findOne.mockResolvedValue({
        id: entryId,
        classification: IntelClassification.PUBLIC,
      });
      mockAccess({
        hasAccess: true,
        isOwner: false,
        isIntelOfficer: true,
        officerRank: IntelOfficerRank.CHIEF,
        accessLevel: 'read',
      });

      await expect(service.deleteEntry(entryId, userId, orgId)).rejects.toMatchObject({
        name: 'ForbiddenError',
        statusCode: 403,
        message: 'User does not have delete permission',
      });
    });
  });

  describe('getAuditLogs', () => {
    it('throws ForbiddenError (403) when the user is neither owner nor highest-ranking officer', async () => {
      mockUserOrgRepo.findOne.mockResolvedValue({ role: 'member' });
      jest.spyOn(service, 'getHighestRankingOfficer').mockResolvedValue(null);

      await expect(service.getAuditLogs(orgId, userId)).rejects.toMatchObject({
        name: 'ForbiddenError',
        statusCode: 403,
      });
    });
  });
});
