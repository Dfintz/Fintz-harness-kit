/**
 * DomainEventBridge — Cross-process event propagation via Redis Pub/Sub
 *
 * When the bot runs in a separate process (P5), DomainEventBus events emitted
 * in one process need to reach listeners in another. This bridge:
 *
 * 1. Subscribes to the local DomainEventBus
 * 2. Publishes events to a Redis channel
 * 3. Subscribes to the Redis channel
 * 4. Re-emits received events on the local DomainEventBus
 *
 * Deduplication via event ID prevents echo loops (event emitted locally →
 * published to Redis → received back → would re-emit locally without guard).
 *
 * @see docs/MEGA_ORG_SCALE_PLAN.md — Architecture Roadmap → P5
 */

import crypto from 'node:crypto';

import Redis from 'ioredis';

import { logger } from '../../utils/logger';
import {
  attachRedisErrorObserver,
  getRedisConfigAsync,
  sanitizeRedisErrorForLogging,
  setupEntraTokenRefreshForClient,
  type EntraTokenRefreshHandle,
} from '../../utils/redis';

import { domainEvents, type DomainEventName } from './DomainEventBus';

const CHANNEL = 'domain-events:bridge';
const PROCESS_ID = crypto.randomUUID();

// Track recently published event IDs to prevent echo loops
const recentEventIds = new Set<string>();
const MAX_RECENT_IDS = 1000;
type DomainEventPayload = Parameters<(typeof domainEvents)['emit']>[1];
type BridgeListener = (payload: DomainEventPayload) => void;
const bridgeListeners = new Map<DomainEventName, BridgeListener>();

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let initialized = false;
let pubTokenRefreshHandle: EntraTokenRefreshHandle | null = null;
let subTokenRefreshHandle: EntraTokenRefreshHandle | null = null;

/** Events to bridge across processes. Only events that cross the API↔Bot boundary. */
const BRIDGED_EVENTS: DomainEventName[] = [
  'member:discord_left',
  'member:discord_role_changed',
  'member:discord_timeout',
  'member:discord_unlinked',
  'member:moderation_action',
  'member:primary_org_switched',
  'member:platform_left',
  'member:rsi_org_left',
  'member:rsi_org_joined',
  'member:rsi_rank_changed',
  'member:rsi_handle_changed',
  'activity:created',
  'activity:completed',
  'activity:cancelled',
  'activity:rescheduled',
  'activity:updated',
  'activity:deleted',
  'team:member_added',
  'team:member_removed',
  'availability:updated',
];

interface BridgeMessage {
  /** Unique event ID for deduplication */
  id: string;
  /** Process that emitted this event */
  sourceProcessId: string;
  /** DomainEventBus event name */
  event: string;
  /** Serialized payload */
  payload: string;
}

function isBridgeMessage(value: unknown): value is BridgeMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.id === 'string' &&
    typeof record.sourceProcessId === 'string' &&
    typeof record.event === 'string' &&
    typeof record.payload === 'string'
  );
}

function detachBridgeListeners(): void {
  for (const [eventName, listener] of bridgeListeners) {
    domainEvents.off(eventName, listener);
  }
  bridgeListeners.clear();
}

/**
 * Initialize the bridge. Call once during process startup.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function initializeDomainEventBridge(): Promise<void> {
  if (initialized) {
    return;
  }

  const config = await getRedisConfigAsync();
  if (!config) {
    logger.warn('DomainEventBridge: Redis not configured, skipping bridge initialization');
    return;
  }

  try {
    // Create dedicated pub/sub clients (ioredis in subscribe mode can't do regular commands)
    pubClient = new Redis(config);
    subClient = new Redis(config);

    attachRedisErrorObserver(pubClient, 'DomainEventBridge publisher', () => {
      void pubTokenRefreshHandle?.refreshNow();
    });
    attachRedisErrorObserver(subClient, 'DomainEventBridge subscriber', () => {
      void subTokenRefreshHandle?.refreshNow();
    });

    pubTokenRefreshHandle = await setupEntraTokenRefreshForClient(
      pubClient,
      'DomainEventBridge publisher'
    );
    subTokenRefreshHandle = await setupEntraTokenRefreshForClient(
      subClient,
      'DomainEventBridge subscriber'
    );

    // Subscribe to bridge channel
    await subClient.subscribe(CHANNEL);

    subClient.on('message', (_channel: string, message: string) => {
      try {
        const parsedUnknown: unknown = JSON.parse(message);
        if (!isBridgeMessage(parsedUnknown)) {
          logger.warn('DomainEventBridge: dropped malformed bridge message');
          return;
        }

        const parsed = parsedUnknown;

        // Ignore events from this process (prevents echo loops)
        if (parsed.sourceProcessId === PROCESS_ID) {
          return;
        }

        // Ignore events we've recently seen (additional dedup)
        if (recentEventIds.has(parsed.id)) {
          return;
        }

        // Re-emit on local DomainEventBus
        const payloadUnknown: unknown = JSON.parse(parsed.payload);
        const payload = payloadUnknown as DomainEventPayload;
        domainEvents.emit(parsed.event as DomainEventName, payload);

        logger.debug('DomainEventBridge: received cross-process event', {
          event: parsed.event,
          source: parsed.sourceProcessId.slice(0, 8),
        });
      } catch (err: unknown) {
        logger.warn('DomainEventBridge: failed to process message', { error: String(err) });
      }
    });

    // Register local listeners that publish to Redis
    for (const eventName of BRIDGED_EVENTS) {
      const listener: BridgeListener = payload => {
        if (!pubClient) {
          return;
        }

        const eventId = crypto.randomUUID();

        // Track to prevent echo
        recentEventIds.add(eventId);
        if (recentEventIds.size > MAX_RECENT_IDS) {
          const firstId = recentEventIds.values().next().value;
          if (firstId) {
            recentEventIds.delete(firstId);
          }
        }

        const message: BridgeMessage = {
          id: eventId,
          sourceProcessId: PROCESS_ID,
          event: eventName,
          payload: JSON.stringify(payload),
        };

        pubClient.publish(CHANNEL, JSON.stringify(message)).catch(err => {
          logger.warn('DomainEventBridge: failed to publish event', {
            event: eventName,
            error: String(err),
          });
        });
      };

      bridgeListeners.set(eventName, listener);
      domainEvents.on(eventName, listener);
    }

    initialized = true;
    logger.info(
      `DomainEventBridge: initialized (processId=${PROCESS_ID.slice(0, 8)}, ${BRIDGED_EVENTS.length} events bridged)`
    );
  } catch (error: unknown) {
    detachBridgeListeners();
    recentEventIds.clear();
    pubTokenRefreshHandle?.stop();
    subTokenRefreshHandle?.stop();
    pubTokenRefreshHandle = null;
    subTokenRefreshHandle = null;
    logger.error('DomainEventBridge: initialization failed', {
      error: sanitizeRedisErrorForLogging(error),
    });
    // Non-fatal — processes work without bridge, just no cross-process events
  }
}

/**
 * Graceful shutdown — close Redis connections.
 */
export async function shutdownDomainEventBridge(): Promise<void> {
  detachBridgeListeners();
  recentEventIds.clear();

  pubTokenRefreshHandle?.stop();
  subTokenRefreshHandle?.stop();
  pubTokenRefreshHandle = null;
  subTokenRefreshHandle = null;

  if (subClient) {
    await subClient.unsubscribe(CHANNEL).catch(() => {});
    subClient.disconnect();
    subClient = null;
  }
  if (pubClient) {
    pubClient.disconnect();
    pubClient = null;
  }
  initialized = false;
  logger.info('DomainEventBridge: shut down');
}

