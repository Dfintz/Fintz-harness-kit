import { Request, Response } from 'express';

import { FleetAuditAction, fleetAuditLogger } from '../../services/fleet/FleetAuditLogger';
import { getOrganizationId } from '../../utils/tenantHelpers';

import { sendFleetInternalErrorResponse } from './fleetController.errors';

export async function getFleetAuditLogHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId } = req.params;
    const organizationId = getOrganizationId(req);
    const { action, limit } = req.query;

    const entries = await fleetAuditLogger.getFleetAuditLog({
      fleetId,
      organizationId,
      action: action as FleetAuditAction | undefined,
      limit: Math.min(limit ? Number.parseInt(limit as string, 10) : 100, 200),
    });

    res.success(entries);
  } catch (error: unknown) {
    sendFleetInternalErrorResponse(res, error, 'Fleet audit log query failed', req.path);
  }
}
