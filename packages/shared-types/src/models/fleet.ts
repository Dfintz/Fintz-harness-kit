/**
 * Fleet entity - represents a group of ships within an organization
 */
export interface Fleet {
  id: string;
  name: string;
  description?: string;
  /** URL to fleet emblem/logo (synced from team emblem) */
  emblem?: string;
  organizationId: string;
  status?: string;
  type?: string;
  maxCapacity?: number;
  /** User ID of the fleet commander/leader. */
  leaderId?: string;
  /** User ID of the fleet's second-in-command. */
  secondInCommandId?: string;
  /** Optional team/squad this fleet is assigned to */
  teamId?: string;
  /** Populated team summary (when joined) */
  team?: { id: string; name: string; type?: string };
  /** Parent fleet ID for hierarchy (null = root fleet) */
  parentFleetId?: string | null;
  /** Depth level in hierarchy (0 = root) */
  level?: number;
  /** Sort position among siblings */
  sortOrder?: number;
  /** Materialized path for efficient subtree queries (e.g., "rootId.parentId.thisId") */
  hierarchyPath?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Extended fleet entity with computed fields (v2)
 */
export interface FleetV2 extends Fleet {
  memberCount: number;
  shipCount: number;
  totalCrewCapacity: number;
  totalCargoCapacity: number;
  isActive: boolean;
}

/**
 * Fleet tree node with nested children for hierarchical display
 */
export interface FleetTreeNode extends FleetV2 {
  children: FleetTreeNode[];
}

/**
 * Request to move a fleet to a new parent
 */
export interface MoveFleetRequest {
  /** Target parent fleet ID, or null to move to root */
  parentFleetId: string | null;
}

/**
 * Request to reorder fleets within the same parent
 */
export interface ReorderFleetsRequest {
  /** Fleet IDs in the desired display order */
  orderedIds: string[];
  /** Parent context for the reorder (null = root level) */
  parentFleetId?: string | null;
}

/**
 * Fleet statistics for an organization
 */
export interface FleetStatistics {
  totalFleets: number;
  totalMembers: number;
  totalShips: number;
  totalValue?: number;
  shipsByRole?: Record<string, number>;
  fleetsBySize?: Record<string, number>;
}

/**
 * Fleet composition analysis
 */
export interface FleetComposition {
  fleetId: string;
  totalShips: number;
  totalCrew: number;
  totalCargo: number;
  byManufacturer: Array<{
    manufacturer: string;
    count: number;
    percentage: number;
  }>;
  byRole: Array<{
    role: string;
    count: number;
    percentage: number;
  }>;
  bySize: Array<{
    size: ShipSize;
    count: number;
    percentage: number;
  }>;
}

/**
 * Canonical ship-size values (runtime source set for {@link ShipSize}).
 *
 * Per ADR-004, exposed as a runtime-introspectable `as const` array plus a derived
 * union type, with exact parity to the backend `Ship.ShipSize` enum (no client-only
 * exclusions). Enables runtime iteration for size filters, colour maps, and selectors.
 */
export const SHIP_SIZE_VALUES = [
  'vehicle',
  'snub',
  'small',
  'medium',
  'large',
  'sub_capital',
  'capital',
] as const;

/**
 * Ship size categories.
 */
export type ShipSize = (typeof SHIP_SIZE_VALUES)[number];

// ─── Fleet Visibility ──────────────────────────────────────────

/**
 * Visibility scope for a fleet visibility rule.
 * - `organization`: Visible based on member rank/security level within the owning org
 * - `alliance`: Visible to a specific allied organization
 * - `federation`: Visible to all members of a specific federation
 */
export type FleetVisibilityScope = 'organization' | 'alliance' | 'federation';

/**
 * Access level granted by a visibility rule.
 * - `summary`: Basic fleet info (name, type, ship count)
 * - `composition`: Summary + ship breakdown by role/manufacturer
 * - `full`: Complete fleet details including individual ships
 */
export type FleetVisibilityAccessLevel = 'summary' | 'composition' | 'full';

/**
 * A single visibility rule controlling who can see a fleet and at what detail level.
 */
export interface FleetVisibilityRule {
  id: string;
  fleetId: string;
  organizationId: string;
  scope: FleetVisibilityScope;
  /** For 'organization' scope: minimum security level required */
  minSecurityLevel?: number;
  /** For 'alliance' scope: the allied organization's ID (from AllianceDiplomacy) */
  targetAllianceOrgId?: string;
  /** For 'federation' scope: the federation ID */
  targetFederationId?: string;
  /** Level of detail visible under this rule */
  accessLevel: FleetVisibilityAccessLevel;
  /** Whether this rule is currently active */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to create a fleet visibility rule.
 */
export interface CreateFleetVisibilityRuleRequest {
  scope: FleetVisibilityScope;
  accessLevel: FleetVisibilityAccessLevel;
  /** Required when scope is 'organization' */
  minSecurityLevel?: number;
  /** Required when scope is 'alliance' */
  targetAllianceOrgId?: string;
  /** Required when scope is 'federation' */
  targetFederationId?: string;
}

/**
 * Request to update a fleet visibility rule.
 */
export interface UpdateFleetVisibilityRuleRequest {
  accessLevel?: FleetVisibilityAccessLevel;
  minSecurityLevel?: number;
  isActive?: boolean;
}

/**
 * Request to create a new fleet
 */
export interface CreateFleetRequest {
  name: string;
  description?: string;
  maxCapacity?: number;
}

/**
 * Request to update an existing fleet
 */
export interface UpdateFleetRequest extends Partial<CreateFleetRequest> {}
