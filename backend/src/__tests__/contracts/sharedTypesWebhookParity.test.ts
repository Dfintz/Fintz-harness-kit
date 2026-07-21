/**
 * Shared-types ⇄ backend Webhook enum parity contract (ADR-004).
 *
 * Asserts the client-facing webhook event-type vocabulary exposed by
 * `@sc-fleet-manager/shared-types` (`WEBHOOK_EVENT_TYPE_VALUES`, an `as const` array) stays in
 * parity with the backend TypeORM `Webhook.WebhookEventType` enum that is the persistence source of
 * truth. See `enumUnionParity.helper.ts` for the boundary rule.
 *
 * `WebhookEventType` has exact parity with its backend enum — there are no client-only exclusions.
 */
import { WEBHOOK_EVENT_TYPE_VALUES } from '@sc-fleet-manager/shared-types';
import { WebhookEventType } from '../../models/Webhook';
import { assertEnumUnionParity } from './enumUnionParity.helper';

describe('shared-types ⇄ backend Webhook enum parity (ADR-004)', () => {
  it('WebhookEventType: shared values match backend enum exactly', () => {
    assertEnumUnionParity('WebhookEventType', WebhookEventType, WEBHOOK_EVENT_TYPE_VALUES, []);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
