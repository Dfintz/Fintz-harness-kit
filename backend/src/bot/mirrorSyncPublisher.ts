import { logger } from '../utils/logger';

import { BotIPCService } from './BotIPCService';

/** IPC action name for mirror RSVP sync */
export const MIRROR_RSVP_SYNC_ACTION = 'mirror:rsvp:sync';

/**
 * Payload for a mirror RSVP sync IPC message.
 *
 * `'refresh'` is a generic re-render signal used when the source embed changes
 * for any non-RSVP reason (ship/crew updates, ship requests, edits, cancellation).
 * The handler re-renders the mirror embed from current DB state, so action-specific
 * fields are not required for `'refresh'`.
 */
export interface MirrorSyncPayload {
  /** The source activity ID that was RSVP'd to */
  activityId: string;
  /** Discord user ID who changed RSVP (or 'system' for refresh) */
  userId: string;
  /** The RSVP action, or 'refresh' for a generic embed update */
  action: 'join' | 'tentative' | 'decline' | 'leave' | 'refresh';
  /** Updated participant count after the RSVP */
  currentParticipants: number;
  /** Max participants (if set) */
  maxParticipants?: number;
}

/**
 * Publish a mirror RSVP sync event via IPC.
 *
 * Called by RSVP handlers (event buttons, /events join, etc.) when a
 * participant changes their RSVP status on a mirrored event.
 */
export async function publishMirrorSync(payload: MirrorSyncPayload): Promise<void> {
  const ipcService = BotIPCService.getInstance();

  if (!ipcService.isAvailable()) {
    logger.debug('MirrorSync: IPC not available, skipping sync');
    return;
  }

  await ipcService.request(MIRROR_RSVP_SYNC_ACTION, payload as unknown as Record<string, unknown>);
}

/**
 * Fire-and-forget mirror refresh for non-RSVP embed changes.
 *
 * Use this after ship/crew/edit/cancel mutations so mirrors re-render
 * to match the source embed. Never throws — errors are swallowed.
 */
export function publishMirrorRefresh(activityId: string, userId: string = 'system'): void {
  publishMirrorSync({
    activityId,
    userId,
    action: 'refresh',
    currentParticipants: 0,
  }).catch(err => {
    logger.debug('MirrorSync: refresh publish failed (non-critical)', {
      activityId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
