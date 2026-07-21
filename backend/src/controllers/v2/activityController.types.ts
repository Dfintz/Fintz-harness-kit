/**
 * Request-body DTOs for the Activity Controller V2.
 *
 * Extracted from `activityController.ts` (E5 large-file decomposition) to give the
 * `req.body` shape interfaces their own ownership boundary, separate from the controller
 * logic. Each interface describes the expected body of one endpoint and is consumed only
 * via `req.body as <Body>` casts inside the controller, so these types are imported back
 * there for internal use and are not re-exported.
 *
 * Type-only dependencies on the `Activity` model (`ParticipantRole`, `ActivityStatus`)
 * keep this module free of runtime imports.
 */
import type { ActivityStatus, ParticipantRole } from '../../models/Activity';

/** Shape of req.body for createActivity */
export interface CreateActivityBody {
  organizationId?: string;
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  visibility?: string;
  maxParticipants?: number;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  location?: string;
  requirements?: string;
  estimatedDuration?: number;
  metadata?: Record<string, unknown>;
  shipRequirementType?: string;
  voiceChannelMode?: 'none' | 'current' | 'temp';
  voiceChannelLimit?: number;
  requiredShips?: ReadonlyArray<{
    requirementType: string;
    count: number;
    crewPerShip?: number;
    avgCrewPerShip?: number;
  }>;
  crewSpotsTotal?: number;
}

/** Shape of req.body for joinActivity */
export interface JoinActivityBody {
  role?: ParticipantRole;
  shipId?: string;
  shipType?: string;
  shipName?: string;
  crewPosition?: string;
  crewShipId?: string;
  notes?: string;
}

/** Shape of req.body for updateParticipant */
export interface UpdateParticipantBody {
  role?: ParticipantRole;
  status?: 'accepted' | 'invited' | 'declined' | 'standby';
  shipId?: string;
  notes?: string;
}

export interface UpdateActivityBody {
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  visibility?: string;
  maxParticipants?: number;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  location?: string;
  requirements?: string;
  estimatedDuration?: number;
  metadata?: Record<string, unknown>;
  shipRequirementType?: string;
  voiceChannelMode?: 'none' | 'current' | 'temp';
  voiceChannelLimit?: number;
  requiredShips?: ReadonlyArray<{
    requirementType: string;
    count: number;
    crewPerShip?: number;
    avgCrewPerShip?: number;
  }>;
  crewSpotsTotal?: number;
}

/** Shape of req.body for joinActivityByToken */
export interface JoinByTokenBody {
  role?: ParticipantRole;
  shipId?: string;
  shipType?: string;
  shipName?: string;
  notes?: string;
}

/** Shape of req.body for updateActivityStatus */
export interface UpdateStatusBody {
  status: ActivityStatus;
  notes?: string;
}

/** Shape of req.body for completeActivity */
export interface CompleteActivityBody {
  report?: string;
  attendanceCount?: number;
  notes?: string;
}

/** Shape of req.body for cancelActivity */
export interface CancelActivityBody {
  notes?: string;
}

/** Shape of req.body for addShip */
export interface AddShipBody {
  shipId?: string;
  shipType?: string;
  shipName?: string;
  role?: 'combat' | 'mining' | 'cargo' | 'medical' | 'support' | 'scout' | 'other';
  crewCapacity?: number;
  capabilities?: string[];
  parentShipId?: string;
  transportType?: string;
}

/** Shape of req.body for loanShips */
export interface LoanShipsBody {
  ships?: Array<{
    shipId?: string;
    shipType: string;
    shipName?: string;
    crewCapacity?: number;
  }>;
}

/** Shape of req.body for inviteOrganization */
export interface InviteOrgBody {
  organizationId?: string;
  organizationName?: string;
  role?: 'co_host' | 'participant' | 'allied' | 'contracted';
}

/** Shape of req.body for batchCreateActivities */
export interface BatchCreateBody {
  activities?: Array<Record<string, unknown> & { status?: string }>;
}

/** Shape of req.body for batchUpdateActivities */
export interface BatchUpdateBody {
  updates?: Array<{ id?: string; [key: string]: unknown }>;
}

/** Shape of req.body for batchDeleteActivities */
export interface BatchDeleteBody {
  activityIds?: string[];
}
