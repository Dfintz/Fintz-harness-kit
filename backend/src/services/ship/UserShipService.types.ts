/**
 * UserShipService types (E5 decomposition).
 *
 * The filter/DTO/result types for individual ship ownership produced and consumed
 * by {@link UserShipService}, extracted into a sibling module so the service file
 * holds orchestration logic only. Re-exported from `./UserShipService` so every
 * import path (incl. `userShipController`) is preserved.
 */

import type {
  ShipCondition,
  ShipOwnershipStatus,
  ShipSharingLevel,
  UserShip,
} from '../../models/UserShip';

export interface UserShipFilters {
  userId?: string;
  shipId?: string;
  shipName?: string;
  status?: ShipOwnershipStatus | ShipOwnershipStatus[];
  condition?: ShipCondition | ShipCondition[];
  isLoaned?: boolean;
  needsInsurance?: boolean;
  location?: string;
  tags?: string[];
  search?: string;
  /** Filter by sharing level */
  sharingLevel?: ShipSharingLevel | ShipSharingLevel[];
  /** Filter ships accessible to a specific user (based on sharing settings) */
  accessibleToUser?: string;
  /** Filter ships shared with a specific organization */
  sharedWithOrg?: string;
}

export interface CreateUserShipDto {
  userId: string;
  shipId?: string;
  shipName: string;
  customName?: string;
  status?: ShipOwnershipStatus;
  condition?: ShipCondition;
  acquiredDate?: Date;
  acquiredPrice?: number;
  acquiredCurrency?: string;
  insuranceLevel?: string;
  insuranceExpires?: Date;
  location?: string;
  hangar?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  /** Sharing level for this ship */
  sharingLevel?: ShipSharingLevel;
  /** Users this ship is shared with */
  sharedWithUsers?: string[];
  /** Erkul.games loadout URL */
  erkulLoadoutUrl?: string;
}

export interface UpdateUserShipDto {
  customName?: string;
  status?: ShipOwnershipStatus;
  condition?: ShipCondition;
  location?: string;
  hangar?: string;
  insuranceLevel?: string;
  insuranceExpires?: Date;
  loanedFrom?: string;
  loanedTo?: string;
  loanExpires?: Date;
  description?: string;
  notes?: string;
  tags?: string[];
  isActive?: boolean;
  modifications?: Record<string, unknown>;
  flightHours?: number;
  missionsCompleted?: number;
  totalEarnings?: number;
  /** Update sharing level */
  sharingLevel?: ShipSharingLevel;
  /** Update users this ship is shared with */
  sharedWithUsers?: string[];
  /** Update organizations this ship is shared with */
  sharedWithOrgs?: string[];
  /** Update Erkul.games loadout URL */
  erkulLoadoutUrl?: string;
}

export interface ShipInsuranceStatus {
  /** Days until insurance expires (negative if already expired) */
  daysUntilExpiration: number;
  /** All UserShip properties */
  ship: UserShip;
}

/** V2 API filter shape for the current user's ship listing */
export interface UserShipListFilters {
  status?: string;
  condition?: string;
  manufacturer?: string;
  sharingLevel?: string;
  search?: string;
  /** Filter by Ship catalog production status (e.g. 'flight_ready', 'in_concept') */
  productionStatus?: string;
}

/** V2 API pagination/sort options */
export interface UserShipListOptions {
  limit: number;
  offset: number;
  sortField?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/** Result from V2 ship listing */
export interface UserShipListResult {
  data: Array<UserShip & { productionStatus?: string }>;
  total: number;
}

