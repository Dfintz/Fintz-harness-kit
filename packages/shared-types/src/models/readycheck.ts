/**
 * Ready Check types — shared between frontend and backend
 *
 * A ready check is a time-limited poll sent to all participants of an activity
 * asking them to confirm they are ready. Designed to be voice-command friendly
 * (Wingman AI integration) with simple endpoints.
 */

/**
 * Overall ready check status
 */
export type ReadyCheckStatus = 'pending' | 'completed' | 'expired' | 'cancelled';

/**
 * Individual participant response
 */
export type ReadyCheckResponse = 'ready' | 'not_ready' | 'pending';

/**
 * A participant's response entry in a ready check
 */
export interface ReadyCheckParticipantResponse {
  userId: string;
  userName: string;
  response: ReadyCheckResponse;
  respondedAt?: string;
}

/**
 * Full ready check object returned by the API
 */
export interface ReadyCheck {
  id: string;
  activityId: string;
  organizationId: string;
  initiatedBy: string;
  initiatedByName: string;
  status: ReadyCheckStatus;
  expiresAt: string;
  /** Duration in seconds before the check expires */
  durationSeconds: number;
  responses: ReadyCheckParticipantResponse[];
  /** Counts for quick display */
  totalParticipants: number;
  readyCount: number;
  notReadyCount: number;
  pendingCount: number;
  createdAt: string;
  completedAt?: string;
}

/**
 * Request to initiate a new ready check
 */
export interface InitiateReadyCheckRequest {
  /** Duration in seconds (default 120 = 2 minutes) */
  durationSeconds?: number;
}

/**
 * Request to respond to a ready check
 */
export interface RespondReadyCheckRequest {
  response: 'ready' | 'not_ready';
}

/**
 * Summary returned after initiating or responding
 */
export interface ReadyCheckSummary {
  readyCheckId: string;
  activityId: string;
  status: ReadyCheckStatus;
  totalParticipants: number;
  readyCount: number;
  notReadyCount: number;
  pendingCount: number;
  expiresAt: string;
  allReady: boolean;
}
