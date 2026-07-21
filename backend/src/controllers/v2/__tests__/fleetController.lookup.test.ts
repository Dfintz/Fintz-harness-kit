const mockGetRepository = jest.fn();

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: (...args: unknown[]) => mockGetRepository(...args),
  },
}));

import { ApiErrorCode } from '../../../types/api';

import { loadFleetInOrganization } from '../fleetController.lookup';

describe('fleetController.lookup', () => {
  const mockFindOne = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRepository.mockReturnValue({ findOne: mockFindOne });
  });

  it('returns fleet when found in organization', async () => {
    const fleet = { id: 'fleet-1', organizationId: 'org-1' };
    mockFindOne.mockResolvedValue(fleet);

    await expect(loadFleetInOrganization('fleet-1', 'org-1')).resolves.toBe(fleet);
    expect(mockFindOne).toHaveBeenCalledWith({
      where: { id: 'fleet-1', organizationId: 'org-1' },
    });
  });

  it('throws default not found error when fleet does not exist', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(loadFleetInOrganization('fleet-1', 'org-1')).rejects.toMatchObject({
      code: ApiErrorCode.NOT_FOUND,
      statusCode: 404,
      message: 'Fleet not found',
    });
  });

  it('throws caller-provided not-found semantics when configured', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(
      loadFleetInOrganization('fleet-1', 'org-1', {
        notFoundCode: ApiErrorCode.FLEET_NOT_FOUND,
        notFoundMessage: 'Missing fleet for operation',
      })
    ).rejects.toMatchObject({
      code: ApiErrorCode.FLEET_NOT_FOUND,
      statusCode: 404,
      message: 'Missing fleet for operation',
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
