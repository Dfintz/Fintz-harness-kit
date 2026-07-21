/**
 * RoleGatingService Tests
 *
 * Tests for Role Gating Service:
 * - Checking gates with required roles
 * - Checking gates with restricted roles
 * - Pass-through when no gate configured
 */

jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../services/discord/DiscordSettingsService', () => {
  const mockGetSettings = jest.fn();
  class MockDiscordSettingsService {
    getSettingsByGuildId = mockGetSettings;
    static getInstance() {
      return new MockDiscordSettingsService();
    }
  }
  return {
    DiscordSettingsService: MockDiscordSettingsService,
    __mockGetSettings: mockGetSettings,
  };
});

import { RoleGatingService } from '../../../services/discord/RoleGatingService';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockGetSettings } = require('../../../services/discord/DiscordSettingsService');

function getService(): RoleGatingService {
  (RoleGatingService as any).instance = undefined;
  return RoleGatingService.getInstance();
}

function createMockMember(roleIds: string[]) {
  const cache = new Map(roleIds.map(id => [id, { id, name: `Role-${id}` }]));
  return {
    roles: { cache },
  };
}

describe('RoleGatingService', () => {
  let service: RoleGatingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = getService();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const a = RoleGatingService.getInstance();
      const b = RoleGatingService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('checkGate', () => {
    it('should pass when settings are null', async () => {
      __mockGetSettings.mockResolvedValue(null);
      const member = createMockMember(['role-1']);
      const result = await service.checkGate('guild-1', member as any, 'create_lfg');
      expect(result.allowed).toBe(true);
    });

    it('should pass when gating is disabled', async () => {
      __mockGetSettings.mockResolvedValue([
        {
          roleGatingSettings: { enabled: false, rules: [] },
        },
      ]);
      const member = createMockMember(['role-1']);
      const result = await service.checkGate('guild-1', member as any, 'apply');
      expect(result.allowed).toBe(true);
    });

    it('should pass when no rule matches the action', async () => {
      __mockGetSettings.mockResolvedValue([
        {
          roleGatingSettings: {
            enabled: true,
            rules: [{ action: 'giveaway', requiredRoleIds: ['required-1'], restrictedRoleIds: [] }],
          },
        },
      ]);
      const member = createMockMember(['role-1']);
      const result = await service.checkGate('guild-1', member as any, 'create_lfg');
      expect(result.allowed).toBe(true);
    });

    it('should deny when member lacks required role', async () => {
      __mockGetSettings.mockResolvedValue([
        {
          roleGatingSettings: {
            enabled: true,
            rules: [{ action: 'apply', requiredRoleIds: ['vip-role'], restrictedRoleIds: [] }],
          },
        },
      ]);
      const member = createMockMember(['other-role']);
      const result = await service.checkGate('guild-1', member as any, 'apply');
      expect(result.allowed).toBe(false);
    });

    it('should allow when member has a required role', async () => {
      __mockGetSettings.mockResolvedValue([
        {
          roleGatingSettings: {
            enabled: true,
            rules: [{ action: 'apply', requiredRoleIds: ['vip-role'], restrictedRoleIds: [] }],
          },
        },
      ]);
      const member = createMockMember(['vip-role']);
      const result = await service.checkGate('guild-1', member as any, 'apply');
      expect(result.allowed).toBe(true);
    });

    it('should deny when member has a restricted role', async () => {
      __mockGetSettings.mockResolvedValue([
        {
          roleGatingSettings: {
            enabled: true,
            rules: [
              { action: 'giveaway', requiredRoleIds: [], restrictedRoleIds: ['banned-role'] },
            ],
          },
        },
      ]);
      const member = createMockMember(['banned-role']);
      const result = await service.checkGate('guild-1', member as any, 'giveaway');
      expect(result.allowed).toBe(false);
    });
  });
});
