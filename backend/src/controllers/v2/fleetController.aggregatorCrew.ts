import { Request, Response } from 'express';

import { ApiError } from '../../middleware/errorHandlerV2';
import { FleetAggregatorService } from '../../services/aggregators/FleetAggregatorService';
import { FleetTeamService } from '../../services/fleet/FleetTeamService';
import { ApiErrorCode } from '../../types/api';
import { getAuthenticatedUserId, getOrganizationId } from '../../utils/tenantHelpers';

import { requireAuthenticatedUser } from './fleetController.bulkGuards';
import {
  normalizeApiError,
  sendFleetLoggedErrorResponse,
  throwIfFleetAggregatorFailed,
} from './fleetController.errors';
import { loadFleetInOrganization } from './fleetController.lookup';

export async function createFleetWithAssetsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params;
    const userId = requireAuthenticatedUser(getAuthenticatedUserId(req));

    type CreateFleetWithAssetsInput = Parameters<
      FleetAggregatorService['createFleetWithAssets']
    >[0];
    const {
      fleetData,
      shipIds,
      squadronData,
      inventoryItems,
      notifyMembers,
      postToDiscord,
      discordChannelId,
    } = req.body as CreateFleetWithAssetsInput;

    const aggregator = new FleetAggregatorService();
    const result = await aggregator.createFleetWithAssets({
      organizationId: orgId,
      fleetData: { ...fleetData, leaderId: fleetData.leaderId ?? userId },
      shipIds,
      squadronData,
      inventoryItems,
      notifyMembers,
      postToDiscord,
      discordChannelId,
    });

    throwIfFleetAggregatorFailed(result, 'Failed to create fleet with assets');

    res.status(201).success(result.data);
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to create fleet with assets');
  }
}

export async function deployFleetHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = requireAuthenticatedUser(getAuthenticatedUserId(req));

    type DeployFleetInput = Parameters<FleetAggregatorService['deployFleet']>[0];
    const body = req.body as Omit<DeployFleetInput['deploymentData'], 'deployedById'> &
      Pick<DeployFleetInput, 'notifyMembers'>;

    const organizationId = getOrganizationId(req);
    const fleet = await loadFleetInOrganization(id, organizationId, {
      notFoundCode: ApiErrorCode.NOT_FOUND,
    });

    const aggregator = new FleetAggregatorService();
    const result = await aggregator.deployFleet({
      organizationId: fleet.organizationId,
      fleetId: id,
      deploymentData: {
        location: body.location,
        mission: body.mission,
        objectives: body.objectives,
        estimatedDuration: body.estimatedDuration,
        deployedById: userId,
      },
      notifyMembers: body.notifyMembers,
    });

    res.success(result);
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to deploy fleet');
  }
}

export async function dissolveFleetHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = requireAuthenticatedUser(getAuthenticatedUserId(req));

    type DissolveFleetInput = Parameters<FleetAggregatorService['dissolveFleet']>[0];
    const { reason, reassignShipsToFleetId, notifyMembers } = req.body as Omit<
      DissolveFleetInput,
      'organizationId' | 'fleetId' | 'dissolvedById'
    >;

    const organizationId = getOrganizationId(req);
    const fleet = await loadFleetInOrganization(id, organizationId, {
      notFoundCode: ApiErrorCode.NOT_FOUND,
    });

    const aggregator = new FleetAggregatorService();
    const result = await aggregator.dissolveFleet({
      organizationId: fleet.organizationId,
      fleetId: id,
      dissolvedById: userId,
      reason,
      reassignShipsToFleetId,
      notifyMembers,
    });

    throwIfFleetAggregatorFailed(result, 'Failed to dissolve fleet');

    res.success(result.data);
  } catch (error: unknown) {
    throw normalizeApiError(error, 'Failed to dissolve fleet');
  }
}

export async function selectCrewPositionHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id: fleetId } = req.params;
    const { shipId, role } = req.body as {
      shipId?: string;
      role?: string;
    };

    if (!shipId || !role) {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'Ship ID and role are required', 400);
    }

    const organizationId = getOrganizationId(req);
    const userId = requireAuthenticatedUser(getAuthenticatedUserId(req));

    const fleetTeamService = FleetTeamService.getInstance();
    const result = await fleetTeamService.selectCrewPosition(
      organizationId,
      fleetId,
      userId,
      shipId,
      role
    );

    res.success(result);
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    sendFleetLoggedErrorResponse(res, error, 'Crew position selection failed', req.path);
  }
}
