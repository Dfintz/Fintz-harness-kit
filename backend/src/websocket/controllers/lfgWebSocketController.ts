import { logger } from '../../utils/logger';
import { emitToOrganization } from '../websocketServer';

/**
 * LFG WebSocket Controller
 *
 * Handles real-time events for LFG session operations:
 * - Session member joined / left
 * - Session created / cancelled / started / completed
 */

export interface LfgSessionEvent {
  type:
    | 'lfg:session-created'
    | 'lfg:session-updated'
    | 'lfg:session-cancelled'
    | 'lfg:member-joined'
    | 'lfg:member-left';
  organizationId: string;
  sessionId: string;
  userId?: string;
  timestamp: number;
}

export const emitLfgSessionCreated = (
  organizationId: string,
  sessionId: string,
  userId?: string
): void => {
  const event: LfgSessionEvent = {
    type: 'lfg:session-created',
    organizationId,
    sessionId,
    userId,
    timestamp: Date.now(),
  };

  emitToOrganization(organizationId, 'lfg:session-created', event);
  logger.debug(`Emitted lfg:session-created for session ${sessionId} in org ${organizationId}`);
};

export const emitLfgMemberJoined = (
  organizationId: string,
  sessionId: string,
  userId?: string
): void => {
  const event: LfgSessionEvent = {
    type: 'lfg:member-joined',
    organizationId,
    sessionId,
    userId,
    timestamp: Date.now(),
  };

  emitToOrganization(organizationId, 'lfg:member-joined', event);
  logger.debug(`Emitted lfg:member-joined for session ${sessionId} in org ${organizationId}`);
};

export const emitLfgMemberLeft = (
  organizationId: string,
  sessionId: string,
  userId?: string
): void => {
  const event: LfgSessionEvent = {
    type: 'lfg:member-left',
    organizationId,
    sessionId,
    userId,
    timestamp: Date.now(),
  };

  emitToOrganization(organizationId, 'lfg:member-left', event);
  logger.debug(`Emitted lfg:member-left for session ${sessionId} in org ${organizationId}`);
};

export const emitLfgSessionUpdated = (
  organizationId: string,
  sessionId: string,
  userId?: string
): void => {
  const event: LfgSessionEvent = {
    type: 'lfg:session-updated',
    organizationId,
    sessionId,
    userId,
    timestamp: Date.now(),
  };

  emitToOrganization(organizationId, 'lfg:session-updated', event);
  logger.debug(`Emitted lfg:session-updated for session ${sessionId} in org ${organizationId}`);
};

export const emitLfgSessionCancelled = (
  organizationId: string,
  sessionId: string,
  userId?: string
): void => {
  const event: LfgSessionEvent = {
    type: 'lfg:session-cancelled',
    organizationId,
    sessionId,
    userId,
    timestamp: Date.now(),
  };

  emitToOrganization(organizationId, 'lfg:session-cancelled', event);
  logger.debug(`Emitted lfg:session-cancelled for session ${sessionId} in org ${organizationId}`);
};
