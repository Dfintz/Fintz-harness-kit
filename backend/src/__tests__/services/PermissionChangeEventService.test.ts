import { PermissionCacheService } from '../../services/security/permissions/PermissionCacheService';
import { PermissionChangeEventService } from '../../services/security/permissions/PermissionChangeEventService';
import { PermissionManagerService } from '../../services/security/permissions/PermissionManagerService';
import { logAuditEvent } from '../../utils/auditLogger';
import { getIO } from '../../websocket/websocketServer';

jest.mock('../../services/security/permissions/PermissionManagerService');
jest.mock('../../services/security/permissions/PermissionCacheService');
jest.mock('../../websocket/websocketServer', () => ({
  getIO: jest.fn(),
}));
jest.mock('../../utils/auditLogger', () => ({
  AuditEventType: {
    SENSITIVE_DATA_ACCESS: 'SENSITIVE_DATA_ACCESS',
  },
  logAuditEvent: jest.fn(),
}));

describe('PermissionChangeEventService', () => {
  const mockPermissionManager = {
    invalidateUserPermissionCacheForUser: jest.fn(),
    clearOrganizationPermissionCache: jest.fn(),
  };

  const mockPermissionCacheService = {
    invalidate: jest.fn(),
    invalidateOrganization: jest.fn(),
  };

  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });

  beforeEach(() => {
    jest.clearAllMocks();

    (PermissionManagerService as jest.Mock).mockImplementation(() => mockPermissionManager);
    (PermissionCacheService.getInstance as jest.Mock).mockReturnValue(mockPermissionCacheService);
    (getIO as jest.Mock).mockReturnValue({ to });

    delete process.env.PERMISSION_REFRESH_ORG_FALLBACK_THRESHOLD;
    delete process.env.PERMISSION_REFRESH_BATCH_SIZE;

    (PermissionChangeEventService as unknown as { instance?: unknown }).instance = undefined;
  });

  it('emits per-user refresh for targeted users', async () => {
    const service = PermissionChangeEventService.getInstance();

    const result = await service.onRolePermissionChanged(
      'org-1',
      ['user-1', 'user-2', 'user-2'],
      'permission_added',
      'actor-1'
    );

    expect(mockPermissionManager.invalidateUserPermissionCacheForUser).toHaveBeenCalledTimes(2);
    expect(mockPermissionCacheService.invalidate).toHaveBeenCalledTimes(2);
    expect(mockPermissionManager.clearOrganizationPermissionCache).not.toHaveBeenCalled();
    expect(mockPermissionCacheService.invalidateOrganization).not.toHaveBeenCalled();

    expect(to).toHaveBeenCalledWith('user:user-1');
    expect(to).toHaveBeenCalledWith('user:user-2');
    expect(emit).toHaveBeenCalledWith(
      'session:refresh',
      expect.objectContaining({
        orgId: 'org-1',
        changeType: 'permission_added',
        emissionMode: 'per_user',
        refreshVersion: 1,
      })
    );

    expect(logAuditEvent).toHaveBeenCalled();
    expect(result).toEqual({
      invalidatedCount: 2,
      emittedCount: 2,
      failedEmitCount: 0,
      emissionMode: 'per_user',
    });
  });

  it('falls back to org-wide refresh when affected set is unknown', async () => {
    const service = PermissionChangeEventService.getInstance();

    const result = await service.onRolePermissionChanged('org-2', [], 'role_updated', 'actor-2');

    expect(mockPermissionManager.clearOrganizationPermissionCache).toHaveBeenCalledWith('org-2');
    expect(mockPermissionCacheService.invalidateOrganization).toHaveBeenCalledWith('org-2');
    expect(to).toHaveBeenCalledWith('org:org-2');
    expect(emit).toHaveBeenCalledWith(
      'session:refresh',
      expect.objectContaining({
        orgId: 'org-2',
        emissionMode: 'org_fallback',
        refreshVersion: 1,
      })
    );

    expect(result.emissionMode).toBe('org_fallback');
  });

  it('falls back to org-wide refresh when threshold is exceeded', async () => {
    process.env.PERMISSION_REFRESH_ORG_FALLBACK_THRESHOLD = '2';
    (PermissionChangeEventService as unknown as { instance?: unknown }).instance = undefined;

    const service = PermissionChangeEventService.getInstance();

    const result = await service.onRolePermissionChanged(
      'org-3',
      ['user-1', 'user-2', 'user-3'],
      'role_deleted',
      'actor-3'
    );

    expect(mockPermissionManager.clearOrganizationPermissionCache).toHaveBeenCalledWith('org-3');
    expect(mockPermissionCacheService.invalidateOrganization).toHaveBeenCalledWith('org-3');
    expect(result.emissionMode).toBe('org_fallback');
    expect(result.emittedCount).toBe(1);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
