/**
 * User Controller V2 - Organization listing regression tests
 * Guards against stale request-scoped active org values.
 */

import { Request, Response } from 'express';

import { UserControllerV2 } from '../../../controllers/v2/userController';
import { OrganizationMembership } from '../../../models/OrganizationMembership';

const getRepositoryMock = jest.fn();
const membershipRepo = {
  findAndCount: jest.fn(),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: (...args: unknown[]) => getRepositoryMock(...args),
  },
}));

jest.mock('../../../data-source');
jest.mock('../../../services/authentication/AuthenticationService');
jest.mock('../../../services/user/UserAuthenticationService');
jest.mock('../../../services/user/ExportRequestService');
jest.mock('../../../services/user/GdprDataDeletionService');
jest.mock('../../../services/security/access/AccountAccessLogService');
jest.mock('../../../services/security/access/TrustedDeviceService', () => {
  const mockTrustedDeviceService = {
    getUserDevices: jest.fn(),
    revokeDevice: jest.fn(),
    revokeAllDevices: jest.fn(),
  };

  return {
    TrustedDeviceService: jest.fn(() => mockTrustedDeviceService),
    getTrustedDeviceService: jest.fn(() => mockTrustedDeviceService),
  };
});
jest.mock('../../../utils/logger');

jest.mock('../../../utils/authHelpers', () => ({
  getAuthenticatedUserId: jest.fn((req: Request) => req.user?.id || 'user-123'),
}));

describe('UserControllerV2 - getUserOrganizations', () => {
  let controller: UserControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    getRepositoryMock.mockImplementation(entity => {
      if (entity === OrganizationMembership) {
        return membershipRepo;
      }
      throw new Error(`Unexpected repository requested: ${String(entity)}`);
    });

    controller = new UserControllerV2();

    mockRequest = {
      user: {
        id: 'user-123',
        username: 'pilot',
        role: 'user',
        // Intentionally stale value; regression guard ensures this is ignored.
        activeOrgId: 'org-stale',
      } as Request['user'],
      queryParams: {
        limit: 25,
        offset: 0,
      },
    };

    mockResponse = {
      paginated: jest.fn(),
      success: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('should set isActive from persisted user activeOrgId instead of request-scoped user field', async () => {
    membershipRepo.findAndCount.mockResolvedValue([
      [
        {
          organizationId: 'org-stale',
          role: 'member',
          joinedAt: new Date('2026-06-01T00:00:00.000Z'),
          organization: { name: 'Stale Org' },
        },
        {
          organizationId: 'org-db-active',
          role: 'admin',
          joinedAt: new Date('2026-06-02T00:00:00.000Z'),
          organization: { name: 'DB Active Org' },
        },
      ],
      2,
    ]);

    jest.spyOn(controller as any, 'findUserById').mockResolvedValue({
      id: 'user-123',
      activeOrgId: 'org-db-active',
    });

    await controller.getUserOrganizations(mockRequest as Request, mockResponse as Response);

    expect(membershipRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-123', isActive: true },
        skip: 0,
        take: 25,
      })
    );

    const [organizations] = (mockResponse.paginated as jest.Mock).mock.calls[0];

    expect(organizations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'org-stale', isActive: false }),
        expect.objectContaining({ id: 'org-db-active', isActive: true }),
      ])
    );
  });

  it('should mark all organizations as inactive when persisted activeOrgId is missing', async () => {
    membershipRepo.findAndCount.mockResolvedValue([
      [
        {
          organizationId: 'org-1',
          role: 'member',
          joinedAt: new Date('2026-06-01T00:00:00.000Z'),
          organization: { name: 'Org One' },
        },
        {
          organizationId: 'org-2',
          role: 'admin',
          joinedAt: new Date('2026-06-02T00:00:00.000Z'),
          organization: { name: 'Org Two' },
        },
      ],
      2,
    ]);

    jest.spyOn(controller as any, 'findUserById').mockResolvedValue({
      id: 'user-123',
      activeOrgId: undefined,
    });

    await controller.getUserOrganizations(mockRequest as Request, mockResponse as Response);

    const [organizations] = (mockResponse.paginated as jest.Mock).mock.calls[0];

    expect(organizations).toHaveLength(2);
    expect(organizations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'org-1', isActive: false }),
        expect.objectContaining({ id: 'org-2', isActive: false }),
      ])
    );
  });
});
