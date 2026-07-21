import { logger } from '../../utils/logger';

import { getUserService } from './eventButtons.services';

/**
 * Translate a Discord snowflake ID to the internal user UUID.
 *
 * Hangar and fleet entries are keyed by the internal user UUID, not the
 * Discord ID, so any bot path that touches user-owned records must translate
 * first.
 *
 * Returns `null` if the Discord user has not linked their account on the
 * web app yet.
 */
export async function resolveInternalUserId(discordId: string): Promise<string | null> {
  try {
    const user = await getUserService().getUserByDiscordId(discordId);
    return user?.id ?? null;
  } catch (err) {
    logger.warn('Failed to resolve internal user ID from Discord ID', {
      discordId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
