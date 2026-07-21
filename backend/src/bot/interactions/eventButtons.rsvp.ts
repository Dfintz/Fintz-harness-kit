/**
 * RSVP action mapping and execution for the event interaction handlers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the RSVP
 * action table and its execution-with-auto-join-fallback their own ownership boundary,
 * separate from the Discord interaction handlers.
 *
 * `RSVP_ACTIONS` maps a button action (`join` / `tentative` / `decline`) to the
 * resulting participant status and role; `handleRSVPAction` applies it, falling back to
 * `joinActivity` when the participant row does not yet exist (then re-applying the
 * post-join status for tentative/decline). `eventButtons.ts` imports both back for
 * internal use; they are not re-exported (no external or test consumers).
 *
 * The module depends only on the `Activity` model, the error helper, and the activity
 * service locator — it never imports `eventButtons.ts`, keeping the import graph acyclic
 * (one-way: handlers → RSVP logic).
 */
import { ParticipantRole } from '../../models/Activity';
import { getErrorMessage } from '../../utils/errorHandler';

import { getActivityService } from './eventButtons.services';

type RSVPStatus = 'accepted' | 'declined' | 'standby';

export const RSVP_ACTIONS: Record<
  string,
  { status: RSVPStatus; role: ParticipantRole; postStatus?: RSVPStatus }
> = {
  join: { status: 'accepted', role: ParticipantRole.MEMBER },
  tentative: { status: 'standby', role: ParticipantRole.ANY, postStatus: 'standby' },
  decline: { status: 'declined', role: ParticipantRole.ANY, postStatus: 'declined' },
};

export async function handleRSVPAction(
  activityId: string,
  userId: string,
  userName: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const config = RSVP_ACTIONS[action];
  if (!config) {
    return;
  }

  try {
    await getActivityService().updateRSVPStatus(
      activityId,
      userId,
      config.status,
      action === 'join' ? config.role : undefined
    );
  } catch (err: unknown) {
    const msg = getErrorMessage(err).toLowerCase();
    if (msg.includes('not found') || msg.includes('participant')) {
      await getActivityService().joinActivity(activityId, {
        userId,
        userName,
        role: config.role,
        metadata,
      });
      if (config.postStatus) {
        await getActivityService().updateRSVPStatus(activityId, userId, config.postStatus);
      }
    } else {
      throw err;
    }
  }
}
