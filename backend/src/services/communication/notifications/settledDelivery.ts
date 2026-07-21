import { logger } from '../../../utils/logger';

import type { NotificationResult } from './NotificationService';

/**
 * Reduce settled notification-dispatch results to the subset that actually
 * delivered (PERF-02 — correct settled-delivery accounting for notification
 * fanout).
 *
 * `NotificationService.create` swallows errors internally and resolves with
 * `{ success: false }` instead of rejecting, so a *fulfilled* promise is not by
 * itself a delivered notification — only `result.value.success === true` counts.
 * Counting fulfilled promises (the prior fanout behaviour) over-reports delivery
 * because every attempt, including failures, resolves fulfilled.
 *
 * This helper returns only the delivered results (so callers can report an
 * accurate count) and logs every non-delivery — both a rejected promise and a
 * fulfilled `{ success: false }` result.
 *
 * @param results - Settled results from `Promise.allSettled` over `create()` calls
 * @param recipientIds - Recipient user IDs in the SAME order as `results`
 * @param label - Short notification label for failure logs (e.g. `'fleet creation'`)
 * @returns The delivered notification results (`success === true` only)
 */
export function collectDeliveredNotifications(
  results: PromiseSettledResult<NotificationResult>[],
  recipientIds: readonly string[],
  label: string
): NotificationResult[] {
  const delivered: NotificationResult[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      delivered.push(result.value);
      return;
    }

    const error =
      result.status === 'fulfilled'
        ? (result.value.error ?? 'Notification service reported failure')
        : result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);

    logger.warn(`Failed to send ${label} notification`, {
      userId: recipientIds[index],
      error,
    });
  });

  return delivered;
}

