/**
 * Ship requirement types for Activities and Job Listings.
 *
 * Supports two modes:
 * 1. Specific ship requirements (e.g., "2 Gladius, 4 Idris")
 * 2. Role-based requirements (e.g., "3 Light Fighters, 2 Mining ships")
 */

/**
 * Requirement for a specific ship model with quantity
 */
export interface SpecificShipRequirement {
  requirementType: 'specific';
  /** Ship catalogue name (e.g., "Gladius") */
  shipName: string;
  /** Ship catalogue ID for reliable lookup */
  shipId?: string;
  /** Number of this ship type needed */
  count: number;
  /** Crew capacity per ship (auto-populated from catalogue) */
  crewPerShip: number;
}

/**
 * Requirement for ships matching a role with quantity
 */
export interface RoleShipRequirement {
  requirementType: 'role';
  /** Ship role from catalogue (e.g., "Light Fighter", "Medium Mining") */
  role: string;
  /** Number of ships with this role needed */
  count: number;
  /** Average crew for ships with this role (auto-populated from catalogue) */
  avgCrewPerShip: number;
}

/**
 * Discriminated union of ship requirement types
 */
export type ShipRequirement = SpecificShipRequirement | RoleShipRequirement;

/**
 * Ship requirement mode for an Activity or Job Listing
 */
export type ShipRequirementType = 'none' | 'required' | 'preferred';
