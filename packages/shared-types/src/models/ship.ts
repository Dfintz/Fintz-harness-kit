import type { ShipSize } from './fleet.js';

/**
 * Ship roles
 */
export type ShipRole =
  | 'Combat'
  | 'Transport'
  | 'Mining'
  | 'Exploration'
  | 'Industrial'
  | 'Support'
  | 'Racing'
  | 'Multi-role';

/**
 * Ship status
 */
export type ShipStatus = 'ACTIVE' | 'MAINTENANCE' | 'DESTROYED' | 'LOANED' | 'STORED';

/**
 * Insurance types
 */
export type InsuranceType = 'LTI' | '10Y' | '6M' | '3M' | 'NONE';

/**
 * Ship entity
 */
export interface Ship {
  id: string;
  name?: string;
  manufacturer: string;
  model: string;
  role?: ShipRole;
  size?: ShipSize;
  crewMin?: number;
  crewMax?: number;
  cargoCapacity?: number;
  ownerId: string;
  organizationId?: string;
  fleetId?: string;
  status: ShipStatus;
  location?: string;
  purchaseDate?: Date | string;
  value?: number;
  imageUrl?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Extended ship entity with insurance info (v2)
 */
export interface ShipV2 extends Ship {
  insurance?: ShipInsurance;
  loadout?: ShipLoadout;
}

/**
 * Ship insurance information
 */
export interface ShipInsurance {
  type: InsuranceType;
  expiresAt?: Date | string;
}

/**
 * Ship loadout configuration
 */
export interface ShipLoadout {
  weapons?: string[];
  shields?: string[];
  components?: string[];
}

/**
 * Ship catalog entry (game data)
 */
export interface ShipCatalogEntry {
  manufacturer: string;
  model: string;
  role: ShipRole;
  size: ShipSize;
  crewMin: number;
  crewMax: number;
  cargoCapacity: number;
  msrp?: number;
  imageUrl?: string;
}

/**
 * Request to add a new ship
 */
export interface CreateShipRequest {
  name?: string;
  manufacturer: string;
  model: string;
  fleetId?: string;
  status?: ShipStatus;
}

/**
 * Request to update a ship
 */
export interface UpdateShipRequest extends Partial<CreateShipRequest> {
  location?: string;
}
