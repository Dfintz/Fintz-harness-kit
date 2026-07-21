import { Request, Response } from 'express';

import { AppDataSource } from '../../config/database';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks } from '../../middleware/queryParser';
import { Fleet } from '../../models/Fleet';
import { ApiErrorCode } from '../../types/api';
import { getOrganizationId } from '../../utils/tenantHelpers';

import { normalizeApiError } from './fleetController.errors';
import { loadFleetInOrganization } from './fleetController.lookup';

export async function getFleetSharingHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId } = req.params;
    const organizationId = getOrganizationId(req);

    const fleet = await loadFleetInOrganization(fleetId, organizationId, {
      notFoundCode: ApiErrorCode.RESOURCE_NOT_FOUND,
    });

    const sharing = {
      visibility: fleet.visibility ?? 'private',
      allowedOrganizations: fleet.allowedOrganizations ?? [],
      publicViewEnabled: fleet.publicViewEnabled ?? false,
      allowJoinRequests: fleet.allowJoinRequests ?? false,
    };

    res.success(sharing);
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to get fleet sharing settings');
  }
}

export async function updateFleetSharingHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId } = req.params;
    const settings = req.body as {
      visibility?: string;
      allowedOrganizations?: string[];
      publicViewEnabled?: boolean;
      allowJoinRequests?: boolean;
    };
    const organizationId = getOrganizationId(req);

    const fleetRepo = AppDataSource.getRepository(Fleet);
    const fleet = await loadFleetInOrganization(fleetId, organizationId, {
      notFoundCode: ApiErrorCode.RESOURCE_NOT_FOUND,
    });

    const updatedSharing = {
      visibility: settings.visibility ?? fleet.visibility ?? 'private',
      allowedOrganizations: Array.isArray(settings.allowedOrganizations)
        ? settings.allowedOrganizations
        : (fleet.allowedOrganizations ?? []),
      publicViewEnabled:
        typeof settings.publicViewEnabled === 'boolean'
          ? settings.publicViewEnabled
          : (fleet.publicViewEnabled ?? false),
      allowJoinRequests:
        typeof settings.allowJoinRequests === 'boolean'
          ? settings.allowJoinRequests
          : (fleet.allowJoinRequests ?? false),
    };

    fleet.visibility = updatedSharing.visibility;
    fleet.allowedOrganizations = updatedSharing.allowedOrganizations;
    fleet.publicViewEnabled = updatedSharing.publicViewEnabled;
    fleet.allowJoinRequests = updatedSharing.allowJoinRequests;

    await fleetRepo.save(fleet);

    res.success(updatedSharing);
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to update fleet sharing settings');
  }
}

export async function getFleetScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId } = req.params;
    const queryParams = (req.queryParams as unknown as Record<string, unknown>) ?? {};
    const { startDate: _startDate, endDate: _endDate, limit = 50, offset = 0 } = queryParams;
    const organizationId = getOrganizationId(req);

    await loadFleetInOrganization(fleetId, organizationId, {
      notFoundCode: ApiErrorCode.RESOURCE_NOT_FOUND,
    });

    const schedules = [
      {
        id: 'schedule1',
        fleetId,
        operation: 'Patrol',
        scheduledAt: new Date(),
        status: 'upcoming',
      },
      {
        id: 'schedule2',
        fleetId,
        operation: 'Training',
        scheduledAt: new Date(),
        status: 'upcoming',
      },
    ];

    const total = schedules.length;
    const links = buildHateoasLinks(
      `/api/v2/fleets/${fleetId}/schedule`,
      Number(offset),
      Number(limit),
      total
    );

    res.paginated(
      schedules.slice(Number(offset), Number(offset) + Number(limit)),
      {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < total,
      },
      links
    );
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to get fleet schedule');
  }
}

export async function createFleetScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId } = req.params;
    const { operation, scheduledAt, description, participants } = req.body as {
      operation?: string;
      scheduledAt?: string | Date;
      description?: string;
      participants?: unknown[];
    };

    if (!operation || !scheduledAt) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'Operation name and scheduled time are required',
        400
      );
    }

    await loadFleetInOrganization(fleetId, getOrganizationId(req), {
      notFoundCode: ApiErrorCode.RESOURCE_NOT_FOUND,
    });

    const schedule = {
      id: `schedule_${Date.now()}`,
      fleetId,
      operation,
      scheduledAt,
      description,
      participants: participants ?? [],
      status: 'upcoming',
      createdAt: new Date(),
    };

    res.status(201).success(schedule);
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to create fleet schedule');
  }
}

export async function updateFleetScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId, scheduleId } = req.params;
    const updates = req.body as Record<string, unknown>;
    const organizationId = getOrganizationId(req);

    await loadFleetInOrganization(fleetId, organizationId, {
      notFoundCode: ApiErrorCode.RESOURCE_NOT_FOUND,
    });

    const schedule = {
      id: scheduleId,
      fleetId,
      ...updates,
      updatedAt: new Date(),
    };

    res.success(schedule);
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to update fleet schedule');
  }
}

export async function deleteFleetScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId, scheduleId: _scheduleId } = req.params;
    const organizationId = getOrganizationId(req);

    await loadFleetInOrganization(fleetId, organizationId, {
      notFoundCode: ApiErrorCode.RESOURCE_NOT_FOUND,
    });

    res.status(204).success({ message: 'Fleet operation cancelled successfully' });
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to delete fleet schedule');
  }
}
