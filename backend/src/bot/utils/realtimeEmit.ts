/**
 * Bot-side websocket emit helper.
 *
 * Wraps `emitToOrganization` so command handlers can fire realtime events
 * to the connected web frontend without worrying about exceptions or
 * boilerplate. All failures are logged and swallowed — emitting a realtime
 * notification must never break a Discord interaction response.
 */
import { logger } from '../../utils/logger';
import { emitToOrganization } from '../../websocket/websocketServer';

export function emitRealtimeToOrg(
  organizationId: string,
  event: string,
  payload: Record<string, unknown>
): void {
  try {
    emitToOrganization(organizationId, event, {
      ...payload,
      source: 'discord-bot',
      emittedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Failed to emit realtime event to organization', {
      organizationId,
      event,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
