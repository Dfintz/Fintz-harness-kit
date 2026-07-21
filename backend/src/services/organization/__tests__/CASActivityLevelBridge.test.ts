import type { DomainEventMap } from '../../shared/DomainEventBus';

import { ActivityLevel } from '../../../models/PublicOrgProfile';
import { domainEvents } from '../../shared/DomainEventBus';
import { CASActivityLevelBridge, mapCasTierToActivityLevel } from '../CASActivityLevelBridge';

jest.mock('../../shared/DomainEventBus', () => ({
  domainEvents: {
    on: jest.fn(),
    off: jest.fn(),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('CASActivityLevelBridge', () => {
  const ORG_ID = '11111111-1111-4111-8111-111111111111';

  const createMockRepo = () => {
    const selectQueryBuilder = {
      select: jest.fn(),
      where: jest.fn(),
      getOne: jest.fn(),
    };
    selectQueryBuilder.select.mockReturnValue(selectQueryBuilder);
    selectQueryBuilder.where.mockReturnValue(selectQueryBuilder);

    const updateQueryBuilder = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    updateQueryBuilder.update.mockReturnValue(updateQueryBuilder);
    updateQueryBuilder.set.mockReturnValue(updateQueryBuilder);
    updateQueryBuilder.where.mockReturnValue(updateQueryBuilder);

    const createQueryBuilder = jest.fn((alias?: string) => {
      if (alias) {
        return selectQueryBuilder;
      }
      return updateQueryBuilder;
    });

    return {
      repo: {
        createQueryBuilder,
      },
      createQueryBuilder,
      selectQueryBuilder,
      updateQueryBuilder,
    };
  };

  const getRegisteredCasListener = (): ((
    payload: DomainEventMap['analytics:cas_updated']
  ) => Promise<void>) => {
    const calls = (domainEvents.on as jest.Mock).mock.calls;
    const listener = calls.find(call => call[0] === 'analytics:cas_updated')?.[1];

    if (!listener) {
      throw new Error('CAS listener was not registered');
    }

    return listener as (payload: DomainEventMap['analytics:cas_updated']) => Promise<void>;
  };

  const makePayload = (
    overrides: Partial<DomainEventMap['analytics:cas_updated']> = {}
  ): DomainEventMap['analytics:cas_updated'] => ({
    organizationId: ORG_ID,
    score: 70,
    previousScore: 60,
    tier: 'ACTIVE',
    previousTier: 'MODERATE',
    breakdown: {
      onlinePresence: 70,
      engagement: 68,
      consistency: 72,
      voiceActivity: 64,
      siteActivity: 58,
    },
    computedAt: '2026-06-08T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mapCasTierToActivityLevel', () => {
    it('maps all CAS tiers to public directory activity levels', () => {
      expect(mapCasTierToActivityLevel('VERY_ACTIVE')).toBe(ActivityLevel.VERY_HIGH);
      expect(mapCasTierToActivityLevel('ACTIVE')).toBe(ActivityLevel.HIGH);
      expect(mapCasTierToActivityLevel('MODERATE')).toBe(ActivityLevel.MODERATE);
      expect(mapCasTierToActivityLevel('QUIET')).toBe(ActivityLevel.LOW);
      expect(mapCasTierToActivityLevel('DORMANT')).toBe(ActivityLevel.INACTIVE);
    });
  });

  describe('subscribeToEvents', () => {
    it('registers CAS listener only once', () => {
      const { repo } = createMockRepo();
      const bridge = new CASActivityLevelBridge(repo as never);

      bridge.subscribeToEvents();
      bridge.subscribeToEvents();

      expect(domainEvents.on).toHaveBeenCalledTimes(1);
      expect(domainEvents.on).toHaveBeenCalledWith('analytics:cas_updated', expect.any(Function));
    });
  });

  describe('CAS event handling', () => {
    it('updates profile activity level when CAS tier changes', async () => {
      const { repo, createQueryBuilder, selectQueryBuilder, updateQueryBuilder } = createMockRepo();
      selectQueryBuilder.getOne.mockResolvedValue({
        id: 'profile-1',
        organizationId: ORG_ID,
        activityLevel: ActivityLevel.MODERATE,
      });

      const bridge = new CASActivityLevelBridge(repo as never);
      bridge.subscribeToEvents();

      const listener = getRegisteredCasListener();
      await listener(makePayload());

      expect(createQueryBuilder).toHaveBeenCalledWith('publicOrgProfile');
      expect(selectQueryBuilder.where).toHaveBeenCalledWith(
        'publicOrgProfile.organizationId = :organizationId',
        { organizationId: ORG_ID }
      );
      expect(createQueryBuilder).toHaveBeenCalledWith();
      expect(updateQueryBuilder.where).toHaveBeenCalledWith('organizationId = :organizationId', {
        organizationId: ORG_ID,
      });
      expect(updateQueryBuilder.set).toHaveBeenCalledWith({
        activityLevel: ActivityLevel.HIGH,
      });
      expect(updateQueryBuilder.execute).toHaveBeenCalled();
    });

    it('processes initial CAS sync event even when tier is unchanged', async () => {
      const { repo, selectQueryBuilder, updateQueryBuilder } = createMockRepo();
      selectQueryBuilder.getOne.mockResolvedValue({
        id: 'profile-1',
        organizationId: ORG_ID,
        activityLevel: ActivityLevel.MODERATE,
      });

      const bridge = new CASActivityLevelBridge(repo as never);
      bridge.subscribeToEvents();

      const listener = getRegisteredCasListener();
      await listener(
        makePayload({
          tier: 'QUIET',
          previousTier: 'QUIET',
          score: 40,
          previousScore: 40,
        })
      );

      expect(updateQueryBuilder.set).toHaveBeenCalledWith({ activityLevel: ActivityLevel.LOW });
      expect(updateQueryBuilder.execute).toHaveBeenCalled();
    });

    it('skips non-initial same-tier score updates', async () => {
      const { repo, createQueryBuilder } = createMockRepo();
      const bridge = new CASActivityLevelBridge(repo as never);
      bridge.subscribeToEvents();

      const listener = getRegisteredCasListener();
      await listener(
        makePayload({
          tier: 'ACTIVE',
          previousTier: 'ACTIVE',
          score: 71,
          previousScore: 70,
        })
      );

      expect(createQueryBuilder).not.toHaveBeenCalled();
    });

    it('skips event when organization id is not a UUID', async () => {
      const { repo, createQueryBuilder } = createMockRepo();
      const bridge = new CASActivityLevelBridge(repo as never);
      bridge.subscribeToEvents();

      const listener = getRegisteredCasListener();
      await listener(makePayload({ organizationId: 'org-1' }));

      expect(createQueryBuilder).not.toHaveBeenCalled();
    });

    it('skips update when profile does not exist', async () => {
      const { repo, selectQueryBuilder, updateQueryBuilder } = createMockRepo();
      selectQueryBuilder.getOne.mockResolvedValue(null);

      const bridge = new CASActivityLevelBridge(repo as never);
      bridge.subscribeToEvents();

      const listener = getRegisteredCasListener();
      await listener(makePayload());

      expect(updateQueryBuilder.execute).not.toHaveBeenCalled();
    });

    it('skips update when activity level already matches CAS tier mapping', async () => {
      const { repo, selectQueryBuilder, updateQueryBuilder } = createMockRepo();
      selectQueryBuilder.getOne.mockResolvedValue({
        id: 'profile-1',
        organizationId: ORG_ID,
        activityLevel: ActivityLevel.HIGH,
      });

      const bridge = new CASActivityLevelBridge(repo as never);
      bridge.subscribeToEvents();

      const listener = getRegisteredCasListener();
      await listener(makePayload());

      expect(updateQueryBuilder.execute).not.toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

