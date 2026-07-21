import { Request } from 'express';

const mockGetRepository = jest.fn();
const mockGetAuthenticatedUserId = jest.fn();
const mockCheckPermission = jest.fn();

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: (...args: unknown[]) => mockGetRepository(...args),
  },
}));

jest.mock('../../../utils/tenantHelpers', () => ({
  getAuthenticatedUserId: (...args: unknown[]) => mockGetAuthenticatedUserId(...args),
}));

jest.mock('../../../services/security/permissions/PermissionManagerService', () => ({
  PermissionManagerService: jest.fn().mockImplementation(() => ({
    checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
  })),
}));

import { ApiErrorCode } from '../../../types/api';

import { loadAuthorizedFleet } from '../fleetController.authorization';

describe('fleetController.authorization', () => {
  const makeRequest = (): Request => ({ headers: {} }) as Request;

  const mockFindOne = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRepository.mockReturnValue({ findOne: mockFindOne });
    mockGetAuthenticatedUserId.mockReturnValue('user-1');
    mockCheckPermission.mockReset();
  });

  it('throws unauthorized when auth user is missing', async () => {
    mockGetAuthenticatedUserId.mockReturnValue(undefined);

    await expect(loadAuthorizedFleet(makeRequest(), 'fleet-1', 'read')).rejects.toMatchObject({
      code: ApiErrorCode.UNAUTHORIZED,
      statusCode: 401,
    });
  });

  it('throws not found when fleet does not exist', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(loadAuthorizedFleet(makeRequest(), 'fleet-1', 'read')).rejects.toMatchObject({
      code: ApiErrorCode.FLEET_NOT_FOUND,
      statusCode: 404,
    });
  });

  it('throws not found when fleet has no organization', async () => {
    mockFindOne.mockResolvedValue({ id: 'fleet-1', organizationId: null });

    await expect(loadAuthorizedFleet(makeRequest(), 'fleet-1', 'read')).rejects.toMatchObject({
      code: ApiErrorCode.FLEET_NOT_FOUND,
      statusCode: 404,
      message: 'Fleet has no organization',
    });
  });

  it('throws not found when permission is denied', async () => {
    mockFindOne.mockResolvedValue({ id: 'fleet-1', organizationId: 'org-1' });
    mockCheckPermission.mockResolvedValue({ allowed: false });

    await expect(loadAuthorizedFleet(makeRequest(), 'fleet-1', 'edit')).rejects.toMatchObject({
      code: ApiErrorCode.FLEET_NOT_FOUND,
      statusCode: 404,
    });
  });

  it('returns fleet when permission is allowed', async () => {
    const fleet = { id: 'fleet-1', organizationId: 'org-1' };
    mockFindOne.mockResolvedValue(fleet);
    mockCheckPermission.mockResolvedValue({ allowed: true });

    await expect(loadAuthorizedFleet(makeRequest(), 'fleet-1', 'delete')).resolves.toBe(fleet);
    expect(mockCheckPermission).toHaveBeenCalledWith('org-1', 'user-1', 'fleet', 'delete');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
