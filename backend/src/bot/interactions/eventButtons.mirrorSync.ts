import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { publishMirrorSync } from '../mirrorSyncPublisher';

import { getActivityService } from './eventButtons.services';

const MIRROR_SYNC_ACTIONS = new Set(['join', 'tentative', 'decline', 'leave']);

function triggerMirrorSync(
  activityId: string,
  userId: string,
  userName: string,
  action: string
): void {
  if (!MIRROR_SYNC_ACTIONS.has(action)) {
    return;
  }

  getActivityService()
    .getActivityById(activityId)
    .then(activity =>
      publishMirrorSync({
        activityId,
        userId,
        action: action as 'join' | 'tentative' | 'decline' | 'leave',
        currentParticipants: activity?.currentParticipants ?? 0,
        maxParticipants: activity?.maxParticipants ?? undefined,
      })
    )
    .catch(err => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logAuditEvent({
        eventType: AuditEventType.ACTIVITY_ACTION,
        userId,
        username: userName,
        resource: `mirror-sync/${activityId}`,
        action: 'MIRROR_SYNC_FAILED',
        message: `Mirror sync failed: ${errorMsg}`,
        metadata: { activityId, action },
      });
    });
}

export { triggerMirrorSync };
