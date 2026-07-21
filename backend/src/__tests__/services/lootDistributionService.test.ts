/**
 * LootDistributionService Tests
 *
 * Covers the core distribution outcomes: need/greed rolls, even-split payouts,
 * and aUEC bid settlement, plus claim eligibility guards.
 */

jest.mock('../../data-source', () => ({
  AppDataSource: { getRepository: jest.fn(), transaction: jest.fn() },
}));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../utils/auditLogger', () => ({
  AuditEventType: { SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS' },
  logAuditEvent: jest.fn(),
}));
jest.mock('../../websocket/websocketServer', () => ({
  emitToOrganization: jest.fn(),
  emitToUser: jest.fn(),
}));

const mockTransferCredits = jest.fn().mockResolvedValue({ id: 'txn' });
const mockEarnCredits = jest.fn().mockResolvedValue({ id: 'txn' });
const mockSpendCredits = jest.fn().mockResolvedValue({ id: 'txn' });
jest.mock('../../services/treasury/TreasuryService', () => ({
  getTreasuryService: jest.fn(() => ({
    transferCredits: (...args: unknown[]) => mockTransferCredits(...args),
    earnCredits: (...args: unknown[]) => mockEarnCredits(...args),
    spendCredits: (...args: unknown[]) => mockSpendCredits(...args),
  })),
  TreasuryService: jest.fn(),
}));

import { AppDataSource } from '../../data-source';
import { Activity } from '../../models/Activity';
import { ActivityParticipantEntity } from '../../models/ActivityParticipant';
import { LootClaim } from '../../models/LootClaim';
import { LootItem } from '../../models/LootItem';
import { LootPoolAssistant } from '../../models/LootPoolAssistant';
import { LootPool } from '../../models/LootPool';
import { LootDistributionService } from '../../services/loot/LootDistributionService';

const chainableQB = (repo: Record<string, jest.Mock>): Record<string, jest.Mock> => {
  const qb: Record<string, jest.Mock> = {};
  ['select', 'update', 'set', 'where', 'andWhere', 'orderBy'].forEach(m => {
    qb[m] = jest.fn().mockReturnValue(qb);
  });
  qb.getOne = jest.fn().mockImplementation(async () => repo.findOne());
  qb.getMany = jest.fn().mockImplementation(async () => repo.find());
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
  qb.getRawOne = jest.fn().mockResolvedValue({ total: '0' });
  return qb;
};

describe('LootDistributionService', () => {
  const orgId = 'org-1';
  const leaderId = 'leader-1';

  let poolRepo: Record<string, jest.Mock>;
  let itemRepo: Record<string, jest.Mock>;
  let claimRepo: Record<string, jest.Mock>;
  let assistantRepo: Record<string, jest.Mock>;
  let participantRepo: Record<string, jest.Mock>;
  let activityRepo: Record<string, jest.Mock>;

  const makeRepo = (name: string): Record<string, jest.Mock> => ({
    metadata: { name } as unknown as jest.Mock,
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn(d => d),
    save: jest.fn(d => Promise.resolve(d)),
    remove: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    poolRepo = makeRepo('LootPool');
    itemRepo = makeRepo('LootItem');
    claimRepo = makeRepo('LootClaim');
    assistantRepo = makeRepo('LootPoolAssistant');
    participantRepo = makeRepo('ActivityParticipant');
    activityRepo = makeRepo('Activity');

    poolRepo.createQueryBuilder.mockImplementation(() => chainableQB(poolRepo));
    itemRepo.createQueryBuilder.mockImplementation(() => chainableQB(itemRepo));
    claimRepo.createQueryBuilder.mockImplementation(() => chainableQB(claimRepo));
    assistantRepo.createQueryBuilder.mockImplementation(() => chainableQB(assistantRepo));
    participantRepo.createQueryBuilder.mockImplementation(() => chainableQB(participantRepo));
    activityRepo.createQueryBuilder.mockImplementation(() => chainableQB(activityRepo));

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      switch (entity) {
        case LootPool:
          return poolRepo;
        case LootItem:
          return itemRepo;
        case LootClaim:
          return claimRepo;
        case LootPoolAssistant:
          return assistantRepo;
        case ActivityParticipantEntity:
          return participantRepo;
        case Activity:
          return activityRepo;
        default:
          return makeRepo('Unknown');
      }
    });

    (AppDataSource.transaction as jest.Mock).mockImplementation(async callback =>
      callback({
        getRepository: (entity: unknown) => {
          switch (entity) {
            case LootClaim:
              return claimRepo;
            case LootItem:
              return itemRepo;
            case LootPoolAssistant:
              return assistantRepo;
            default:
              return makeRepo('Unknown');
          }
        },
      })
    );
  });

  const lockedPool = (overrides: Partial<LootPool> = {}): LootPool =>
    ({
      id: 'pool-1',
      organizationId: orgId,
      name: 'Test Pool',
      activityId: 'act-1',
      status: 'locked',
      distributionMethod: 'need_greed',
      currency: 'aUEC',
      leaderId,
      createdBy: leaderId,
      totalValue: 100,
      ...overrides,
    }) as LootPool;

  it('need/greed: NEED claim beats GREED claim', async () => {
    const pool = lockedPool();
    poolRepo.findOne.mockResolvedValue(pool);
    itemRepo.find.mockResolvedValue([
      {
        id: 'item-1',
        name: 'Helmet',
        totalValue: 100,
        lootPoolId: 'pool-1',
        status: 'available',
      },
    ]);
    claimRepo.find.mockResolvedValue([
      {
        id: 'c-greed',
        lootItemId: 'item-1',
        userId: 'uB',
        userName: 'B',
        claimType: 'greed',
        status: 'pending',
      },
      {
        id: 'c-need',
        lootItemId: 'item-1',
        userId: 'uA',
        userName: 'A',
        claimType: 'need',
        status: 'pending',
      },
    ]);
    participantRepo.find.mockResolvedValue([
      { userId: 'uA', userName: 'A', role: 'member', status: 'accepted' },
      { userId: 'uB', userName: 'B', role: 'member', status: 'accepted' },
    ]);

    const service = new LootDistributionService();
    const result = await service.distribute(orgId, 'pool-1', leaderId);

    expect(result.awards).toHaveLength(1);
    expect(result.awards[0].userId).toBe('uA');
    expect(pool.status).toBe('distributed');
  });

  it('even split: shares total value across participants and pays out when configured', async () => {
    const pool = lockedPool({
      distributionMethod: 'even_split',
      rules: { shareTotalPayout: true },
    });
    poolRepo.findOne.mockResolvedValue(pool);
    itemRepo.find.mockResolvedValue([
      { id: 'item-1', name: 'Cargo', totalValue: 100, lootPoolId: 'pool-1' },
    ]);
    claimRepo.find.mockResolvedValue([]);
    participantRepo.find.mockResolvedValue([
      { userId: 'uA', userName: 'A', role: 'member', status: 'accepted' },
      { userId: 'uB', userName: 'B', role: 'member', status: 'accepted' },
    ]);

    const service = new LootDistributionService();
    const result = await service.distribute(orgId, 'pool-1', leaderId);

    expect(result.payouts).toHaveLength(2);
    expect(result.payouts?.every(p => p.amount === 50)).toBe(true);
    expect(mockTransferCredits).toHaveBeenCalledTimes(2);
  });

  it('aUEC bid: highest bidder wins and pays into the org pool', async () => {
    const pool = lockedPool({ distributionMethod: 'auec_bid' });
    poolRepo.findOne.mockResolvedValue(pool);
    itemRepo.find.mockResolvedValue([
      { id: 'item-1', name: 'Rifle', totalValue: 0, lootPoolId: 'pool-1', status: 'available' },
    ]);
    claimRepo.find.mockResolvedValue([
      {
        id: 'b1',
        lootItemId: 'item-1',
        userId: 'uA',
        userName: 'A',
        claimType: 'bid',
        bidAmount: 100,
        status: 'pending',
      },
      {
        id: 'b2',
        lootItemId: 'item-1',
        userId: 'uB',
        userName: 'B',
        claimType: 'bid',
        bidAmount: 250,
        status: 'pending',
      },
    ]);
    participantRepo.find.mockResolvedValue([]);

    const service = new LootDistributionService();
    const result = await service.distribute(orgId, 'pool-1', leaderId);

    expect(result.awards).toHaveLength(1);
    expect(result.awards[0].userId).toBe('uB');
    expect(result.awards[0].amount).toBe(250);
    expect(mockEarnCredits).toHaveBeenCalledTimes(1);
  });

  it('aUEC bid: marks pool partially distributed when settlement fails', async () => {
    const pool = lockedPool({ distributionMethod: 'auec_bid' });
    poolRepo.findOne.mockResolvedValue(pool);
    itemRepo.find.mockResolvedValue([
      { id: 'item-1', name: 'Rifle', totalValue: 0, lootPoolId: 'pool-1', status: 'available' },
    ]);
    claimRepo.find.mockResolvedValue([
      {
        id: 'b1',
        lootItemId: 'item-1',
        userId: 'uA',
        userName: 'A',
        claimType: 'bid',
        bidAmount: 100,
        status: 'pending',
      },
    ]);
    participantRepo.find.mockResolvedValue([]);
    mockEarnCredits.mockRejectedValueOnce(new Error('Insufficient funds'));

    const service = new LootDistributionService();
    const result = await service.distribute(orgId, 'pool-1', leaderId);

    expect(result.awards).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures?.[0].stage).toBe('settlement');
    expect(pool.status).toBe('partially_distributed');
  });

  it('aUEC bid: retries a partially distributed pool and finalizes remaining available items', async () => {
    const pool = lockedPool({
      distributionMethod: 'auec_bid',
      status: 'partially_distributed',
    });
    poolRepo.findOne.mockResolvedValue(pool);
    itemRepo.find.mockResolvedValue([
      { id: 'item-1', name: 'Rifle', totalValue: 0, lootPoolId: 'pool-1', status: 'available' },
    ]);
    claimRepo.find.mockResolvedValue([
      {
        id: 'b1',
        lootItemId: 'item-1',
        userId: 'uA',
        userName: 'A',
        claimType: 'bid',
        bidAmount: 175,
        status: 'pending',
      },
    ]);
    participantRepo.find.mockResolvedValue([]);

    const service = new LootDistributionService();
    const result = await service.retryDistribution(orgId, 'pool-1', leaderId);

    expect(result.awards).toHaveLength(1);
    expect(result.awards[0].amount).toBe(175);
    expect(result.failures).toHaveLength(0);
    expect(pool.status).toBe('distributed');
  });

  it('aUEC bid: compensates treasury when post-settlement persistence fails', async () => {
    const pool = lockedPool({ distributionMethod: 'auec_bid' });
    poolRepo.findOne.mockResolvedValue(pool);
    itemRepo.find.mockResolvedValue([
      { id: 'item-1', name: 'Rifle', totalValue: 0, lootPoolId: 'pool-1', status: 'available' },
    ]);
    claimRepo.find.mockResolvedValue([
      {
        id: 'b1',
        lootItemId: 'item-1',
        userId: 'uA',
        userName: 'A',
        claimType: 'bid',
        bidAmount: 100,
        status: 'pending',
      },
    ]);
    participantRepo.find.mockResolvedValue([]);
    itemRepo.save.mockRejectedValueOnce(new Error('Failed to persist awarded item'));

    const service = new LootDistributionService();
    const result = await service.distribute(orgId, 'pool-1', leaderId);

    expect(mockEarnCredits).toHaveBeenCalledTimes(1);
    expect(mockSpendCredits).toHaveBeenCalledTimes(1);
    expect(result.awards).toHaveLength(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures?.[0].stage).toBe('settlement');
    expect(pool.status).toBe('partially_distributed');
  });

  it('allows assigned assistant to manage distribution for a specific loot pool', async () => {
    const pool = lockedPool({
      distributionMethod: 'leader_assign',
      leaderId: 'leader-owner',
      createdBy: 'creator-owner',
      metadata: { assistantUserIds: ['assistant-1'] },
    });
    poolRepo.findOne.mockResolvedValue(pool);
    itemRepo.find.mockResolvedValue([]);
    claimRepo.find.mockResolvedValue([]);
    participantRepo.find.mockResolvedValue([]);

    const service = new LootDistributionService();
    await expect(service.distribute(orgId, 'pool-1', 'assistant-1')).resolves.toMatchObject({
      poolId: 'pool-1',
      distributionMethod: 'leader_assign',
    });
    expect(pool.status).toBe('distributed');
  });

  it('rejects distribution by a non-leader', async () => {
    poolRepo.findOne.mockResolvedValue(lockedPool());
    const service = new LootDistributionService();
    await expect(service.distribute(orgId, 'pool-1', 'someone-else')).rejects.toThrow();
  });

  it('rejects a claim from a non-participant', async () => {
    poolRepo.findOne.mockResolvedValue(lockedPool());
    participantRepo.findOne.mockResolvedValue(null); // not a participant

    const service = new LootDistributionService();
    await expect(
      service.claimItem(
        orgId,
        'pool-1',
        'item-1',
        { id: 'outsider', name: 'X' },
        {
          claimType: 'need',
        }
      )
    ).rejects.toThrow();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
