import { Repository } from 'typeorm';

import { ApiError } from '../../middleware/errorHandlerV2';
import { FleetShip } from '../../models/FleetShip';
import { ApiErrorCode } from '../../types/api';

export interface BulkMemberUpdateInput {
  fleetId?: string;
  shipId?: string;
  role?: string;
  notes?: string;
}

export interface BulkMemberDeleteInput {
  fleetId?: string;
  shipId?: string;
}

export interface BulkMemberUpdateMutation {
  fleetId: string;
  shipId: string;
  role?: string;
  notes?: string;
}

export interface BulkMemberDeleteMutation {
  fleetId: string;
  shipId: string;
}

/** Validate bulk-update payload entries. */
export function validateBulkUpdates(updates: BulkMemberUpdateInput[]): void {
  for (const update of updates) {
    if (!update?.fleetId || !update?.shipId) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'Each update must include fleetId and shipId',
        400
      );
    }
    if (update.role === undefined && update.notes === undefined) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'Each update must include at least one of role or notes',
        400
      );
    }
  }
}

/** Validate bulk-delete payload entries. */
export function validateBulkDeleteItems(items: BulkMemberDeleteInput[]): void {
  for (const item of items) {
    if (!item?.fleetId || !item?.shipId) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'Each item must include fleetId and shipId',
        400
      );
    }
  }
}

/** Apply a single tenant-scoped update to a FleetShip row. */
export async function applyBulkUpdate(
  txRepo: Repository<FleetShip>,
  organizationId: string,
  update: BulkMemberUpdateMutation
): Promise<{ updated: boolean }> {
  const assignment = await txRepo.findOne({
    where: { fleetId: update.fleetId, shipId: update.shipId, organizationId },
  });
  if (!assignment) {
    return { updated: false };
  }
  if (update.role !== undefined) {
    assignment.role = update.role;
  }
  if (update.notes !== undefined) {
    assignment.notes = update.notes;
  }
  await txRepo.save(assignment);
  return { updated: true };
}

/** Apply a single tenant-scoped delete on a FleetShip row. */
export async function applyBulkDelete(
  txRepo: Repository<FleetShip>,
  organizationId: string,
  item: BulkMemberDeleteMutation
): Promise<boolean> {
  const assignment = await txRepo.findOne({
    where: { fleetId: item.fleetId, shipId: item.shipId, organizationId },
  });
  if (!assignment) {
    return false;
  }
  await txRepo.remove(assignment);
  return true;
}
