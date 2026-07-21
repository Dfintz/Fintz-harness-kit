/**
 * Identity Lifecycle Event tests — P0/P1/P2 flag auto-creation.
 *
 * Verifies MemberAuditService handlers for:
 *  - P0: RSI sync failure (with 3-failure threshold)
 *  - P0: RSI handle change
 *  - P1: RSI org dissolution (multi-user fan-out)
 *  - P2: Discord unlinked
 *
 * Also verifies the new MemberFlagType enum values and default severities.
 *
 * Database calls are mocked (no real DB connection needed).
 */

import {
  DEFAULT_FLAG_SEVERITY,
  FlagSeverity,
  MemberFlagType,
} from '@sc-fleet-manager/shared-types';

/* ------------------------------------------------------------------ */
/*  Mocks — must be defined BEFORE imports that use them               */
/* ------------------------------------------------------------------ */

const mockFlagRepo = {
  create: jest.fn((data: Record<string, unknown>) => ({ id: 'flag-1', ...data })),
  save: jest.fn((entity: Record<string, unknown>) =>
    Promise.resolve({ ...entity, id: entity.id ?? 'flag-1' })
  ),
  findOne: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockWatchlistRepo = {
  findOne: jest.fn(),
};

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: { name?: string } | (new () => unknown)) => {
      const name = typeof entity === 'function' ? entity.name : entity?.name;
      if (name === 'MemberAuditEvent') return mockFlagRepo;
      if (name === 'OrgWatchlistEntry') return mockWatchlistRepo;
      return {};
    }),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../services/shared/DomainEventBus', () => {
  const actual = jest.requireActual('../../../services/shared/DomainEventBus');
  actual.DomainEventBus.resetInstance();
  const bus = actual.DomainEventBus.getInstance();
  return {
    ...actual,
    domainEvents: bus,
  };
});

/* ------------------------------------------------------------------ */
/*  Imports (after mocks)                                              */
/* ------------------------------------------------------------------ */

import { MemberAuditService } from '../../../services/intel/MemberAuditService';
import { domainEvents } from '../../../services/shared/DomainEventBus';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ORG_ID = 'org-lifecycle-001';
const USER_ID = 'user-lifecycle-001';

/** Flush microtask queue so async event handlers complete. */
const flushAsync = () => new Promise<void>(r => setTimeout(r, 10));

/* ------------------------------------------------------------------ */
/*  Test Suite                                                         */
/* ------------------------------------------------------------------ */

describe('Identity Lifecycle Events', () => {
  let service: MemberAuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    domainEvents.removeAllListeners();
    service = new MemberAuditService();
    service.subscribeToEvents();
  });

  // ──────────── Enum values & defaults ────────────────────────

  describe('MemberFlagType enum coverage', () => {
    it('should include new identity lifecycle flag types', () => {
      expect(MemberFlagType.RSI_HANDLE_CHANGED).toBe('rsi_handle_changed');
      expect(MemberFlagType.IMPERSONATION_SUSPECTED).toBe('impersonation_suspected');
      expect(MemberFlagType.RSI_SYNC_FAILED).toBe('rsi_sync_failed');
      expect(MemberFlagType.RSI_ORG_DISSOLVED).toBe('rsi_org_dissolved');
      expect(MemberFlagType.DISCORD_UNLINKED).toBe('discord_unlinked');
    });

    it('should have correct default severities', () => {
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.RSI_HANDLE_CHANGED]).toBe(FlagSeverity.HIGH);
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.IMPERSONATION_SUSPECTED]).toBe(
        FlagSeverity.CRITICAL
      );
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.RSI_SYNC_FAILED]).toBe(FlagSeverity.HIGH);
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.RSI_ORG_DISSOLVED]).toBe(FlagSeverity.MEDIUM);
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.DISCORD_UNLINKED]).toBe(FlagSeverity.MEDIUM);
    });
  });

  // ──────────── P0: RSI Sync Failure ──────────────────────────

  describe('member:rsi_sync_failed', () => {
    it('should NOT create flag when consecutiveFailures < 3', async () => {
      domainEvents.emit('member:rsi_sync_failed', {
        timestamp: new Date().toISOString(),
        userId: USER_ID,
        organizationId: ORG_ID,
        rsiHandle: 'testpilot',
        failureReason: 'timeout',
        consecutiveFailures: 2,
      });
      await flushAsync();

      expect(mockFlagRepo.create).not.toHaveBeenCalled();
    });

    it('should create RSI_SYNC_FAILED flag at 3 consecutive failures', async () => {
      domainEvents.emit('member:rsi_sync_failed', {
        timestamp: new Date().toISOString(),
        userId: USER_ID,
        organizationId: ORG_ID,
        rsiHandle: 'testpilot',
        failureReason: 'network_error',
        consecutiveFailures: 3,
      });
      await flushAsync();

      expect(mockFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          flagType: MemberFlagType.RSI_SYNC_FAILED,
          userId: USER_ID,
          organizationId: ORG_ID,
          severity: FlagSeverity.HIGH,
        })
      );
    });

    it('should escalate to CRITICAL for account_not_found reason', async () => {
      domainEvents.emit('member:rsi_sync_failed', {
        timestamp: new Date().toISOString(),
        userId: USER_ID,
        organizationId: ORG_ID,
        rsiHandle: 'deleted_account',
        failureReason: 'account_not_found',
        consecutiveFailures: 3,
      });
      await flushAsync();

      expect(mockFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          flagType: MemberFlagType.RSI_SYNC_FAILED,
          severity: FlagSeverity.CRITICAL,
        })
      );
    });

    it('should include failure metadata', async () => {
      domainEvents.emit('member:rsi_sync_failed', {
        timestamp: new Date().toISOString(),
        userId: USER_ID,
        organizationId: ORG_ID,
        rsiHandle: 'testpilot',
        failureReason: 'rate_limited',
        consecutiveFailures: 5,
      });
      await flushAsync();

      expect(mockFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            rsiHandle: 'testpilot',
            failureReason: 'rate_limited',
            consecutiveFailures: 5,
          }),
        })
      );
    });
  });

  // ──────────── P0: RSI Handle Change ─────────────────────────

  describe('member:rsi_handle_changed', () => {
    it('should create RSI_HANDLE_CHANGED flag with old/new handles', async () => {
      domainEvents.emit('member:rsi_handle_changed', {
        timestamp: new Date().toISOString(),
        userId: USER_ID,
        organizationId: ORG_ID,
        oldHandle: 'OldPilot',
        newHandle: 'NewPilot',
        rsiOrgSid: 'TESTORG',
      });
      await flushAsync();

      expect(mockFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          flagType: MemberFlagType.RSI_HANDLE_CHANGED,
          userId: USER_ID,
          organizationId: ORG_ID,
          severity: DEFAULT_FLAG_SEVERITY[MemberFlagType.RSI_HANDLE_CHANGED],
          description: expect.stringContaining('OldPilot'),
        })
      );
    });

    it('should include both handles in metadata', async () => {
      domainEvents.emit('member:rsi_handle_changed', {
        timestamp: new Date().toISOString(),
        userId: USER_ID,
        organizationId: ORG_ID,
        oldHandle: 'Alpha',
        newHandle: 'Bravo',
        rsiOrgSid: 'ORG1',
      });
      await flushAsync();

      expect(mockFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            oldHandle: 'Alpha',
            newHandle: 'Bravo',
          }),
        })
      );
    });
  });

  // ──────────── P1: RSI Org Dissolution ───────────────────────

  describe('member:rsi_org_dissolved', () => {
    it('should create one flag per affected user', async () => {
      const affectedUsers = ['user-a', 'user-b', 'user-c'];

      domainEvents.emit('member:rsi_org_dissolved', {
        timestamp: new Date().toISOString(),
        organizationId: ORG_ID,
        rsiOrgSid: 'DEADORG',
        rsiOrgName: 'Disbanded Fleet',
        affectedUserIds: affectedUsers,
      });
      await flushAsync();

      expect(mockFlagRepo.create).toHaveBeenCalledTimes(3);

      // Each call should have the correct userId
      for (let i = 0; i < affectedUsers.length; i++) {
        expect(mockFlagRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({
            flagType: MemberFlagType.RSI_ORG_DISSOLVED,
            userId: affectedUsers[i],
            organizationId: ORG_ID,
            severity: DEFAULT_FLAG_SEVERITY[MemberFlagType.RSI_ORG_DISSOLVED],
          })
        );
      }
    });

    it('should handle empty affectedUserIds gracefully', async () => {
      domainEvents.emit('member:rsi_org_dissolved', {
        timestamp: new Date().toISOString(),
        organizationId: ORG_ID,
        rsiOrgSid: 'EMPTYORG',
        rsiOrgName: 'Ghost Town',
        affectedUserIds: [],
      });
      await flushAsync();

      expect(mockFlagRepo.create).not.toHaveBeenCalled();
    });

    it('should include org info in description and metadata', async () => {
      domainEvents.emit('member:rsi_org_dissolved', {
        timestamp: new Date().toISOString(),
        organizationId: ORG_ID,
        rsiOrgSid: 'GONEORG',
        rsiOrgName: 'Dissolved Fleet',
        affectedUserIds: [USER_ID],
      });
      await flushAsync();

      expect(mockFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('GONEORG'),
          metadata: expect.objectContaining({
            rsiOrgSid: 'GONEORG',
            rsiOrgName: 'Dissolved Fleet',
          }),
        })
      );
    });
  });

  // ──────────── P2: Discord Unlinked ──────────────────────────

  describe('member:discord_unlinked', () => {
    it('should create DISCORD_UNLINKED flag', async () => {
      domainEvents.emit('member:discord_unlinked', {
        timestamp: new Date().toISOString(),
        userId: USER_ID,
        organizationId: ORG_ID,
        discordId: '999888777',
        discordUsername: 'testuser#1234',
      });
      await flushAsync();

      expect(mockFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          flagType: MemberFlagType.DISCORD_UNLINKED,
          userId: USER_ID,
          organizationId: ORG_ID,
          severity: DEFAULT_FLAG_SEVERITY[MemberFlagType.DISCORD_UNLINKED],
        })
      );
    });

    it('should include discord metadata', async () => {
      domainEvents.emit('member:discord_unlinked', {
        timestamp: new Date().toISOString(),
        userId: USER_ID,
        organizationId: ORG_ID,
        discordId: '111222333',
      });
      await flushAsync();

      expect(mockFlagRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            discordId: '111222333',
          }),
        })
      );
    });
  });
});
