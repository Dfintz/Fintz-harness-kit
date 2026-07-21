import { ActivityService } from '../../services/activity/ActivityService';

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

import { AppDataSource } from '../../data-source';

jest.mock('../../services/communication', () => ({
  VoiceChannelService: {
    getInstance: jest.fn().mockReturnValue({}),
  },
}));

const mockQueryBuilder = {
  connection: { options: { type: 'postgres' } },
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getCount: jest.fn().mockResolvedValue(0),
  getMany: jest.fn().mockResolvedValue([]),
};

const mockRepository = {
  metadata: { name: 'Activity' },
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

describe('ActivityService.searchActivities ordering', () => {
  let service: ActivityService;

  beforeEach(() => {
    jest.clearAllMocks();
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
    service = new ActivityService();

    jest.spyOn(service as any, 'applyEnumAndOwnershipFilters').mockImplementation(() => undefined);
    jest.spyOn(service as any, 'applyParticipatingOrgsFilter').mockImplementation(() => undefined);
    jest.spyOn(service as any, 'applyMiscFilters').mockImplementation(() => undefined);
  });

  it('should preserve ts_rank ordering for search and append scheduledStart/created ordering', async () => {
    await service.searchActivities({ searchTerm: 'pilot' } as any, 1, 20);

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      "ts_rank(activity.search_vector, to_tsquery('english', :tsquery_actSearch))",
      'DESC'
    );
    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('activity.scheduledStartDate', 'ASC');
    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('activity.createdAt', 'DESC');
    expect(mockQueryBuilder.orderBy).not.toHaveBeenCalledWith('activity.scheduledStartDate', 'ASC');
  });

  it('should keep direct scheduledStart ordering when search is absent', async () => {
    await service.searchActivities({} as any, 1, 20);

    expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('activity.scheduledStartDate', 'ASC');
    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('activity.createdAt', 'DESC');
  });
});
