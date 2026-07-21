import { StarCommsFederationService } from '../../../../services/communication/starcomms/StarCommsFederationService';

describe('StarCommsFederationService', () => {
  const integrationQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const fedQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };

  const fedMemberQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  };

  const orgQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const fedRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const fedMemberRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const orgRepo = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const integrationRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const integrationService = {
    createIntegration: jest.fn(),
    updateIntegration: jest.fn(),
  };

  let service: StarCommsFederationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StarCommsFederationService(
      fedRepo as never,
      fedMemberRepo as never,
      orgRepo as never,
      integrationRepo as never,
      integrationService as never
    );

    integrationRepo.createQueryBuilder.mockReturnValue(integrationQb);
    fedRepo.createQueryBuilder.mockReturnValue(fedQb);
    fedMemberRepo.createQueryBuilder.mockReturnValue(fedMemberQb);
    orgRepo.createQueryBuilder.mockReturnValue(orgQb);

    fedRepo.findOne.mockResolvedValue({ id: 'fed-1' });
    fedMemberRepo.findOne.mockResolvedValue({ id: 'member-1', organizationName: 'Org One' });
    fedQb.getOne.mockResolvedValue({ id: 'fed-1' });
    fedMemberQb.getOne.mockResolvedValue({ id: 'member-1', organizationName: 'Org One' });
  });

  it('should return federation config if present', async () => {
    integrationQb.getOne.mockResolvedValue({ id: 'integration-1' });

    const result = await service.getFederationConfig('fed-1');

    expect(result).toEqual({ id: 'integration-1' });
    expect(integrationQb.where).toHaveBeenCalled();
  });

  it('should create federation config if missing', async () => {
    integrationQb.getOne.mockResolvedValue(null);
    integrationService.createIntegration.mockResolvedValue({ id: 'new-integration' });

    const result = await service.updateFederationConfig('fed-1', 'org-1', 'user-1', {
      starCommsConfig: {
        baseUrl: 'https://starcomms.example.test',
        sharing: { enabled: true, whitelist: [] },
      },
    });

    expect(result).toEqual({ id: 'new-integration' });
    expect(integrationService.createIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerType: 'federation',
        ownerId: 'fed-1',
        createdBy: 'user-1',
      })
    );
  });

  it('should update federation config if it exists', async () => {
    integrationQb.getOne.mockResolvedValue({ id: 'integration-1' });
    integrationService.updateIntegration.mockResolvedValue({ id: 'integration-1' });

    const result = await service.updateFederationConfig('fed-1', 'org-1', 'user-1', {
      name: 'Updated name',
      starCommsConfig: {
        baseUrl: 'https://starcomms.example.test',
        sharing: { enabled: true, whitelist: [] },
      },
    });

    expect(result).toEqual({ id: 'integration-1' });
    expect(integrationService.updateIntegration).toHaveBeenCalledWith(
      'integration-1',
      expect.objectContaining({ ownerType: 'federation', ownerId: 'fed-1' })
    );
  });

  it('should return federation sharing suggestions from memberships', async () => {
    fedMemberQb.getMany
      .mockResolvedValueOnce([
        { organizationId: 'org-1', organizationName: 'Org One' },
        { organizationId: 'org-2', organizationName: 'Org Two' },
      ])
      .mockResolvedValueOnce([{ federationId: 'fed-2', organizationId: 'org-1' }]);
    fedQb.getMany.mockResolvedValue([{ id: 'fed-2', name: 'Other Federation' }]);
    orgQb.getMany.mockResolvedValue([
      { id: 'org-1', name: 'Org One' },
      { id: 'org-2', name: 'Org Two' },
    ]);

    const suggestions = await service.getFederationWhitelistSuggestions('fed-1');

    expect(suggestions.some(entry => entry.targetId === 'org-1')).toBe(true);
    expect(suggestions.some(entry => entry.targetId === 'fed-2')).toBe(true);
  });
});
