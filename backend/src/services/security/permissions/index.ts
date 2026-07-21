/**
 * Permissions Services
 *
 * RBAC, roles, and permission management functionality
 */

export { PermissionService } from './PermissionService';

export { PermissionManagerService } from './PermissionManagerService';
export type {
  BatchPermissionResult,
  PermissionCacheStats,
  PermissionCheck,
  PermissionCheckResult,
} from './PermissionManagerService';

export { PermissionTemplateService } from './PermissionTemplateService';

export { AccountPermissionService } from './AccountPermissionService';

export { PermissionCacheService } from './PermissionCacheService';

export {
  PermissionChangeEventService,
  permissionChangeEventService,
} from './PermissionChangeEventService';
export type {
  PermissionChangeProcessingMetrics,
  PermissionChangeType,
} from './PermissionChangeEventService';

