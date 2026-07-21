import { SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { Fleet } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { ApiErrorCode } from '../../types/api';

export interface FleetLookupOptions {
  notFoundCode?: ApiErrorCode;
  notFoundMessage?: string;
}

/** Load a fleet by id/org with configurable not-found error semantics. */
export async function loadFleetInOrganization(
  fleetId: string,
  organizationId: string,
  options?: FleetLookupOptions
): Promise<Fleet> {
  const fleetRepo = AppDataSource.getRepository(Fleet);
  const fleet = await fleetRepo.findOne({ where: { id: fleetId, organizationId } });

  if (!fleet) {
    throw new ApiError(
      options?.notFoundCode ?? ApiErrorCode.NOT_FOUND,
      options?.notFoundMessage ?? 'Fleet not found',
      404
    );
  }

  return fleet;
}

/** Load a fleet assignment by id/fleet with configurable not-found error semantics. */
export async function loadFleetAssignmentInFleet(
  assignmentId: string,
  fleetId: string,
  options?: FleetLookupOptions
): Promise<FleetShip> {
  const fleetShipRepo = AppDataSource.getRepository(FleetShip);
  const assignment = await fleetShipRepo.findOne({ where: { id: assignmentId, fleetId } });

  if (!assignment) {
    throw new ApiError(
      options?.notFoundCode ?? ApiErrorCode.NOT_FOUND,
      options?.notFoundMessage ?? 'Assignment not found',
      404
    );
  }

  return assignment;
}

/** Build the common FleetShip -> Ship query for a single fleet. */
export function buildFleetShipWithShipQuery(fleetId: string): SelectQueryBuilder<FleetShip> {
  return AppDataSource.getRepository(FleetShip)
    .createQueryBuilder('fleetShip')
    .innerJoinAndSelect('fleetShip.ship', 'ship')
    .where('fleetShip.fleetId = :fleetId', { fleetId });
}
