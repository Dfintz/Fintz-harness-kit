/**
 * Fleet Domain Services
 * Consolidated fleet management services with multi-tenancy support
 *
 * NOTE: People/member management is handled by the Team domain (TeamService).
 *   - Fleet = Ship inventory
 *   - Team = User grouping (people organization, linked via fleet.teamId)
 *
 * For ship ownership tracking, see ship domain (UserShipService, OrganizationShipService)
 *
 * FleetViewService moved here from fleetview/ domain as part of domain consolidation
 *
 * PHASE 2 CLEANUP (Sprint 12-D):
 * - SquadronService, FleetMemberService, FleetAnalyticsService removed.
 * - FleetMember entity removed. Use Team/TeamMember instead.
 */

export {
  FleetNotFoundError as FleetInventoryNotFoundError,
  FleetInventoryService,
} from './FleetInventoryService';
export type { BulkInventoryOperationResult } from './FleetInventoryService';
export { FleetService } from './FleetService';
export { FleetTemplateService } from './FleetTemplateService';
export { FleetViewService } from './FleetViewService'; // Moved from fleetview/ domain
export { FleetVisibilityService } from './FleetVisibilityService';

// Re-export types for convenience
export type { Fleet } from '../../models/Fleet';

