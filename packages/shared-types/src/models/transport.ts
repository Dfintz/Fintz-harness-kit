/**
 * Transport and logistics types — shared between frontend and backend.
 *
 * Includes interfaces for passenger slots, transport methods, and related types
 * used across Activity, PublicJobListing, and other ship management features.
 */

/**
 * Passenger slot for vehicles that transport non-crew personnel (e.g., marines in an APC).
 * Passengers are NOT counted toward crew totals.
 *
 * Used in:
 * - Activity.ShipAssignment.passengers
 * - PublicJobListing.ShipCrewBreakdownEntry.passengers
 * - EventEmbed.EmbedShipAssignment.passengers
 */
export interface PassengerSlot {
  role: string;
  capacity: number;
  filled: number;
  /**
   * Display names of assigned passengers. Kept index-aligned with
   * `assignedUserIds` so a passenger can be removed by position.
   */
  assignedUserNames?: string[];
  /**
   * User IDs of assigned passengers, index-aligned with `assignedUserNames`.
   * Required to identify who occupies a slot for leave/removal operations.
   */
  assignedUserIds?: string[];
}

/**
 * Transport method for nested ships/vehicles.
 *
 * - 'hangar': Ship stored in hangar bay (e.g., P52 Merlin in Carrack hangar)
 * - 'cargo': Vehicle stored in cargo hold (e.g., Ursa Rover in Carrack cargo)
 * - 'tractor_beam': Ship held by tractor beam (e.g., salvage operations)
 * - 'docking_collar': Ship docked via docking collar (e.g., Constellation to station)
 */
export type TransportType = 'hangar' | 'cargo' | 'tractor_beam' | 'docking_collar';

/**
 * Transport type constants for type-safe usage.
 *
 * @example
 * ```typescript
 * const ship = {
 *   transportType: TRANSPORT_TYPES.HANGAR,
 *   isTransported: true
 * };
 * ```
 */
export const TRANSPORT_TYPES = {
  HANGAR: 'hangar' as const,
  CARGO: 'cargo' as const,
  TRACTOR_BEAM: 'tractor_beam' as const,
  DOCKING_COLLAR: 'docking_collar' as const,
} as const;

/**
 * Base ship information — core fields shared across all ship representations.
 *
 * Composable interface that can be extended by specific ship types.
 * Used as foundation for ShipAssignment, ShipCrewBreakdownEntry, etc.
 */
export interface BaseShipInfo {
  shipType: string;
  shipName?: string;
  ownerId: string;
  ownerName: string;
  crewCapacity: number;
  crewAssigned?: number;
}

/**
 * Ship transport information — fields for nested transport and passengers.
 *
 * Composable interface for ships that can be transported or carry passengers.
 * Combine with BaseShipInfo for full transport-capable ship representation.
 */
export interface ShipTransportInfo {
  /** Whether this ship is a loaner (contributed by someone not personally crewing it) */
  isLoaner?: boolean;
  /** Display name of person who contributed/provided this ship */
  contributedBy?: string;
  /** User ID of the ship contributor */
  contributedByUserId?: string;
  /** ID of parent ship if this is transported inside another ship */
  parentShipId?: string;
  /** Whether this entry is nested inside a parent ship */
  isTransported?: boolean;
  /** Transport method: how this ship/vehicle is being transported */
  transportType?: TransportType;
  /** Passengers (NOT counted toward crew totals) */
  passengers?: PassengerSlot[];
}

/**
 * Carrier capability descriptor for a Star Citizen ship that can transport
 * other ships or vehicles internally (snub hangars, vehicle bays, etc.).
 */
export interface CarrierCapability {
  /** Lowercase substring matched against ship type name (case-insensitive). */
  match: string;
  /** Internal hangar size category, if the ship has one. */
  hangar?: 'Snub' | 'Small' | 'Medium' | 'Large';
  /** Whether the ship has a vehicle bay capable of carrying ground vehicles. */
  vehicleBay?: boolean;
}

/**
 * Curated list of Star Citizen ships with internal hangars or vehicle bays.
 * Source of truth for both the Discord bot's ship-nesting flow and the
 * web app's nested-ship picker.
 *
 * Match is performed via case-insensitive `includes()` against the ship type.
 */
export const CARRIER_SHIPS: readonly CarrierCapability[] = [
  // Ships with internal hangars
  { match: 'constellation', hangar: 'Snub' },
  { match: '890 jump', hangar: 'Small' },
  { match: 'carrack', hangar: 'Snub', vehicleBay: true },
  { match: 'idris', hangar: 'Medium' },
  { match: 'javelin', hangar: 'Medium' },
  { match: 'kraken', hangar: 'Medium' },
  { match: 'polaris', hangar: 'Small' },
  { match: 'odyssey', hangar: 'Small' },
  { match: 'endeavor', hangar: 'Small' },
  { match: 'liberator', hangar: 'Medium', vehicleBay: true },
  // Ships with vehicle bays only
  { match: 'valkyrie', vehicleBay: true },
  { match: 'c2 hercules', vehicleBay: true },
  { match: 'm2 hercules', vehicleBay: true },
  { match: 'a2 hercules', vehicleBay: true },
  { match: 'cutlass steel', vehicleBay: true },
  { match: 'galaxy', vehicleBay: true },
  { match: 'ironclad', vehicleBay: true },
  { match: 'caterpillar', vehicleBay: true },
  { match: 'genesis', vehicleBay: true },
  { match: 'prowler', vehicleBay: true },
] as const;

/**
 * Look up the carrier capability for a given ship type name.
 * Returns `undefined` if the ship is not a known carrier.
 */
export function getCarrierCapability(shipType: string): CarrierCapability | undefined {
  if (!shipType) return undefined;
  const lower = shipType.toLowerCase();
  return CARRIER_SHIPS.find(c => lower.includes(c.match));
}
