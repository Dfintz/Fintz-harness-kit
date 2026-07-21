import { In } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Fleet } from '../../models/Fleet';
import { FleetTeamService } from '../../services/fleet/FleetTeamService';
import { logger } from '../../utils/logger';
import { emitFleetUpdated } from '../../websocket/controllers/fleetWebSocketController';

/** Emit fleet-updated events for a set of fleets the user just modified (best-effort, tenant-scoped). */
export async function emitTouchedFleetUpdates(
  organizationId: string,
  userId: string,
  fleetIds: Set<string>
): Promise<Fleet[]> {
  if (fleetIds.size === 0) {
    return [];
  }

  const fleetRepo = AppDataSource.getRepository(Fleet);
  const fleets = await fleetRepo.find({
    where: { id: In([...fleetIds]), organizationId },
  });

  for (const fleet of fleets) {
    emitFleetUpdated(organizationId, { ...fleet }, userId);
  }

  return fleets;
}

/** Sync team capacity for a list of fleets after a bulk membership change (best-effort). */
export async function syncTeamCapacityForFleets(
  organizationId: string,
  fleets: Fleet[]
): Promise<void> {
  if (fleets.length === 0) {
    return;
  }

  const fleetTeamService = FleetTeamService.getInstance();
  for (const fleet of fleets) {
    try {
      await fleetTeamService.syncTeamCapacity(organizationId, fleet.id);
    } catch (syncError: unknown) {
      logger.warn('Failed to sync team capacity after bulk fleet change', {
        fleetId: fleet.id,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }
}
