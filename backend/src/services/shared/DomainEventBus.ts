/**
 * DomainEventBus — Centralized, typed event bus for cross-domain communication.
 *
 * Motivation:
 * - The codebase handles Discord / RSI / moderation events inline in
 *   moderationEventHandler.ts and botApp.ts.  Wave 2.1 (Membership Audit &
 *   Intel) needs to react to events from 6+ sources without tight coupling.
 * - A lightweight publish-subscribe bus lets event *producers* (moderation
 *   handler, RSI sync, Discord events …) emit domain events, while
 *   *consumers* (MemberAuditService, analytics, notifications …) subscribe
 *   independently.
 *
 * Design decisions:
 * - Built on Node.js EventEmitter (matches SecurityEventService,
 *   SagaOrchestrator, JobStatusDashboardService and 6+ other services).
 * - Fully typed via DomainEventMap — each event name maps to a payload type,
 *   so emit() and on() are type-checked at compile time.
 * - Async-safe: listeners can be async; errors in one listener are caught and
 *   logged without affecting other listeners or the emitter.
 * - Singleton pattern (matches project convention).
 * - maxListeners set to 50 (safe default for a shared bus).
 *
 * Usage:
 *   // Producer (e.g. moderationEventHandler.ts)
 *   import { domainEvents } from '../services/shared/DomainEventBus';
 *   domainEvents.emit('member:moderation_action', { ... });
 *
 *   // Consumer (e.g. MemberAuditService)
 *   import { domainEvents } from '../services/shared/DomainEventBus';
 *   domainEvents.on('member:moderation_action', async (payload) => { ... });
 */

import { EventEmitter } from 'node:events';

import { logger } from '../../utils/logger';
import { AuditCategory, auditService } from '../audit/AuditService';

/* ------------------------------------------------------------------ */
/*  Domain Event Payloads                                              */
/* ------------------------------------------------------------------ */

/** Base fields present on every domain event. */
export interface DomainEventBase {
  /** ISO-8601 timestamp of when the event occurred. */
  readonly timestamp: string;
  /** Correlation / trace ID (optional). */
  readonly correlationId?: string;
}

/* ---------- Member lifecycle events ---------- */

export interface MemberDiscordLeftPayload extends DomainEventBase {
  readonly userId: string;
  readonly discordId: string;
  readonly discordUsername: string;
  readonly guildId: string;
  readonly guildName: string;
  readonly organizationId: string;
  /** 'kick' | 'ban' | 'leave' — null when unknown */
  readonly reason: 'kick' | 'ban' | 'leave' | null;
}

export interface MemberDiscordRoleChangedPayload extends DomainEventBase {
  readonly userId: string;
  readonly discordId: string;
  readonly guildId: string;
  readonly organizationId: string;
  readonly addedRoles: readonly string[];
  readonly removedRoles: readonly string[];
}

export interface MemberDiscordTimeoutPayload extends DomainEventBase {
  readonly userId: string;
  readonly discordId: string;
  readonly guildId: string;
  readonly guildName: string;
  readonly organizationId: string;
  readonly durationMinutes: number;
  readonly moderatorDiscordId?: string;
  readonly reason?: string;
}

/* ---------- RSI sync events ---------- */

export interface RsiOrgLeftPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly rsiHandle: string;
  readonly rsiOrgSid: string;
  readonly rsiOrgName: string;
}

export interface RsiOrgJoinedPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly rsiHandle: string;
  readonly rsiOrgSid: string;
  readonly rsiOrgName: string;
  /** True if the joined org is on the platform watchlist / blacklist. */
  readonly isHostile: boolean;
  /** True if the joined org is redacted / hidden. */
  readonly isRedacted: boolean;
}

export interface RsiRankChangedPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly rsiHandle: string;
  readonly rsiOrgSid: string;
  readonly oldRank: string;
  readonly newRank: string;
}

export interface RsiSyncFailedPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly rsiHandle: string;
  readonly failureReason: string;
  readonly consecutiveFailures: number;
}

export interface RsiHandleChangedPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly oldHandle: string;
  readonly newHandle: string;
  readonly rsiOrgSid: string;
}

export interface RsiOrgDissolvedPayload extends DomainEventBase {
  readonly organizationId: string;
  readonly rsiOrgSid: string;
  readonly rsiOrgName: string;
  /** User IDs of members who had verified links to this org */
  readonly affectedUserIds: readonly string[];
}

/* ---------- Discord events (extended) ---------- */

export interface MemberDiscordUnlinkedPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly discordId: string;
  readonly discordUsername?: string;
}

/* ---------- Moderation events ---------- */

export interface ModerationActionPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly incidentId: string;
  readonly incidentType: string;
  readonly severity: number;
  readonly moderatorId: string;
  readonly reason?: string;
  /** True when this action was shared from an allied org. */
  readonly isShared: boolean;
}

/* ---------- Organization membership events ---------- */

export interface PrimaryOrgSwitchedPayload extends DomainEventBase {
  readonly userId: string;
  readonly previousOrgId: string | null;
  readonly newOrgId: string;
}

export interface PrimaryOrgClearedPayload extends DomainEventBase {
  readonly userId: string;
  readonly previousOrgId: string;
  readonly reason: 'manual_clear' | 'system_stale_membership';
  readonly staleOrganizationId?: string;
  readonly path?: string;
}

export interface MemberPlatformLeftPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly username: string;
}

/**
 * Emitted when a member's platform role is changed by an org admin via the
 * web UI / API (NOT by Discord). Bot-side listeners use this to mirror the
 * change into Discord (additive only — see roleSyncListener).
 */
export interface MemberPlatformRoleChangedPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly previousRoleName: string;
  readonly newRoleName: string;
  readonly performedById: string;
}

/* ---------- Team events (Wave 2.6) ---------- */

export interface TeamCreatedPayload extends DomainEventBase {
  readonly teamId: string;
  readonly organizationId: string;
  readonly teamName: string;
  readonly teamType: string;
  readonly parentTeamId?: string;
  readonly createdBy?: string;
}

export interface TeamDeletedPayload extends DomainEventBase {
  readonly teamId: string;
  readonly organizationId: string;
  readonly teamName: string;
  readonly memberCount: number;
}

export interface TeamMemberAddedPayload extends DomainEventBase {
  readonly teamId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly role: string;
  readonly teamName: string;
}

export interface TeamMemberRemovedPayload extends DomainEventBase {
  readonly teamId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly teamName: string;
  readonly reason?: string;
}

/* ---------- Activity events (Wave 2.3) ---------- */

export interface ActivityCreatedPayload extends DomainEventBase {
  readonly activityId: string;
  readonly organizationId: string;
  readonly activityType: string;
  readonly title: string;
  readonly hostUserId: string;
  readonly scheduledAt?: string;
  readonly maxParticipants?: number;
  readonly timezone?: string;
  readonly description?: string;
  readonly location?: string;
  readonly estimatedDuration?: number;
  readonly voiceChannelMode?: 'none' | 'current' | 'temp';
  readonly voiceChannelLimit?: number;
  /** Present when the activity was created from a Discord bot wizard. */
  readonly discordServerId?: string;
}

export interface ActivityCompletedPayload extends DomainEventBase {
  readonly activityId: string;
  readonly organizationId: string;
  readonly participantCount: number;
}

export interface ActivityCancelledPayload extends DomainEventBase {
  readonly activityId: string;
  readonly organizationId: string;
  readonly reason?: string;
  readonly participantCount: number;
}

export interface ActivityRescheduledPayload extends DomainEventBase {
  readonly activityId: string;
  readonly organizationId: string;
  readonly previousStartDate?: string;
  readonly newStartDate: string;
  readonly newEndDate?: string;
  readonly reason?: string;
}

export interface ActivityUpdatedPayload extends DomainEventBase {
  readonly activityId: string;
  readonly organizationId: string;
  /** Names of the activity fields that changed in this update. */
  readonly updatedFields: string[];
  readonly title?: string;
  readonly description?: string;
  readonly scheduledAt?: string;
  readonly timezone?: string;
  readonly estimatedDuration?: number;
  readonly location?: string;
}

export interface ActivityDeletedPayload extends DomainEventBase {
  readonly activityId: string;
  readonly organizationId: string;
  readonly discordEventId?: string;
}

/* ---------- Team member status events ---------- */

export interface TeamMemberStatusChangedPayload extends DomainEventBase {
  readonly teamId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly memberName?: string;
  readonly previousStatus: string;
  readonly newStatus: string;
}

/** Emitted when a team's emblem is created or updated. */
export interface TeamEmblemUpdatedPayload extends DomainEventBase {
  readonly teamId: string;
  readonly organizationId: string;
  readonly emblemUrl: string | null;
}

/* ---------- Availability events (Wave 2.4) ---------- */

export interface AvailabilityUpdatedPayload extends DomainEventBase {
  readonly userId: string;
  readonly organizationId: string;
  readonly slotCount: number;
}

/* ------------------------------------------------------------------ */
/*  Domain Event Map (compile-time type safety)                        */
/* ------------------------------------------------------------------ */

/**
 * Maps every domain event name → its typed payload.
 *
 * To add a new event:
 *  1. Define a Payload interface above.
 *  2. Add a key here.
 *  3. Producers call `domainEvents.emit('your:event', payload)`.
 *  4. Consumers call `domainEvents.on('your:event', handler)`.
 */
export interface DomainEventMap {
  /* Discord member events */
  'member:discord_left': MemberDiscordLeftPayload;
  'member:discord_role_changed': MemberDiscordRoleChangedPayload;
  'member:discord_timeout': MemberDiscordTimeoutPayload;

  /* RSI sync events */
  'member:rsi_org_left': RsiOrgLeftPayload;
  'member:rsi_org_joined': RsiOrgJoinedPayload;
  'member:rsi_rank_changed': RsiRankChangedPayload;
  'member:rsi_sync_failed': RsiSyncFailedPayload;
  'member:rsi_handle_changed': RsiHandleChangedPayload;
  'member:rsi_org_dissolved': RsiOrgDissolvedPayload;

  /* Moderation events */
  'member:moderation_action': ModerationActionPayload;

  /* Org membership events */
  'member:primary_org_switched': PrimaryOrgSwitchedPayload;
  'member:primary_org_cleared': PrimaryOrgClearedPayload;
  'member:platform_left': MemberPlatformLeftPayload;
  'member:platform_role_changed': MemberPlatformRoleChangedPayload;

  /* Discord account events (extended) */
  'member:discord_unlinked': MemberDiscordUnlinkedPayload;

  /* Team events (Wave 2.6) */
  'team:created': TeamCreatedPayload;
  'team:deleted': TeamDeletedPayload;
  'team:member_added': TeamMemberAddedPayload;
  'team:member_removed': TeamMemberRemovedPayload;
  'team:member_status_changed': TeamMemberStatusChangedPayload;
  'team:emblem_updated': TeamEmblemUpdatedPayload;

  /* Activity events (Wave 2.3) */
  'activity:created': ActivityCreatedPayload;
  'activity:completed': ActivityCompletedPayload;
  'activity:cancelled': ActivityCancelledPayload;
  'activity:rescheduled': ActivityRescheduledPayload;
  'activity:updated': ActivityUpdatedPayload;
  'activity:deleted': ActivityDeletedPayload;

  /* Availability events (Wave 2.4) */
  'availability:updated': AvailabilityUpdatedPayload;

  /* Analytics events (CAS — Composite Activity Score) */
  'analytics:cas_updated': {
    organizationId: string;
    score: number;
    previousScore: number;
    tier: string;
    previousTier: string;
    breakdown: Record<string, number>;
    computedAt: string;
  };
}

/** Union of all domain event names. */
export type DomainEventName = keyof DomainEventMap;

/* ------------------------------------------------------------------ */
/*  Typed Event Bus                                                    */
/* ------------------------------------------------------------------ */

/**
 * Typed listener signature — async-friendly.
 */
type DomainEventListener<T> = (payload: T) => void | Promise<void>;

/**
 * Lightweight, typed domain event bus.
 *
 * Wraps Node.js EventEmitter with:
 *  - Compile-time checked event names and payload types
 *  - Async error isolation per listener
 *  - Winston logging for emitted events and errors
 */
export class DomainEventBus {
  private readonly emitter: EventEmitter;
  private static instance: DomainEventBus | null = null;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  /* ---------- Singleton ---------- */

  static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
      logger.info('📡 DomainEventBus initialized');
    }
    return DomainEventBus.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    if (DomainEventBus.instance) {
      DomainEventBus.instance.removeAllListeners();
      DomainEventBus.instance = null;
    }
  }

  /* ---------- Publish ---------- */

  /**
   * Emit a domain event.  All registered listeners are invoked
   * asynchronously.  Errors in individual listeners do NOT propagate
   * thanks to the safe wrappers applied in on() and once().
   */
  emit<K extends DomainEventName>(event: K, payload: DomainEventMap[K]): void {
    const meta = payload as unknown as Record<string, unknown>;
    logger.debug(`DomainEventBus: emit ${event}`, {
      event,
      organizationId: meta.organizationId,
      userId: meta.userId,
    });

    this.emitter.emit(event, payload);
  }

  /* ---------- Subscribe ---------- */

  /**
   * Wrap a listener so sync throws and async rejections are caught and logged
   * without breaking other listeners.
   */
  private safeWrap<K extends DomainEventName>(
    event: K,
    listener: DomainEventListener<DomainEventMap[K]>
  ): (...args: unknown[]) => void {
    const wrapped = (payload: DomainEventMap[K]) => {
      try {
        const result = listener(payload);
        if (result && typeof result.catch === 'function') {
          result.catch((err: unknown) => {
            logger.error(`DomainEventBus: async listener error on '${event}'`, err);
          });
        }
      } catch (err: unknown) {
        logger.error(`DomainEventBus: sync listener error on '${event}'`, err);
      }
    };
    // Preserve original reference for off()
    (wrapped as unknown as Record<string, unknown>).__original = listener;
    return wrapped as (...args: unknown[]) => void;
  }

  /**
   * Register a listener for a domain event.
   * Returns `this` for chaining.
   */
  on<K extends DomainEventName>(event: K, listener: DomainEventListener<DomainEventMap[K]>): this {
    logger.info('DomainEventBus listener registered', { eventType: event });

    this.emitter.on(event, this.safeWrap(event, listener));

    auditService.log({
      category: AuditCategory.ADMIN,
      action: 'DOMAIN_EVENT_LISTENER_REGISTERED',
      message: `Domain event listener registered: ${event}`,
      resource: `domain-event/${event}/listener`,
      metadata: {
        eventType: event,
        registeredAt: new Date().toISOString(),
      },
    });

    return this;
  }

  /**
   * Register a one-time listener.
   */
  once<K extends DomainEventName>(
    event: K,
    listener: DomainEventListener<DomainEventMap[K]>
  ): this {
    this.emitter.once(event, this.safeWrap(event, listener));
    return this;
  }

  /**
   * Remove a previously registered listener.
   */
  off<K extends DomainEventName>(event: K, listener: DomainEventListener<DomainEventMap[K]>): this {
    // Find the safe-wrapped version that matches the original
    const allListeners = this.emitter.listeners(event);
    for (const wrapped of allListeners) {
      if ((wrapped as unknown as Record<string, unknown>).__original === listener) {
        logger.info('DomainEventBus listener removed', { eventType: event });

        this.emitter.off(event, wrapped as (...args: unknown[]) => void);

        auditService.log({
          category: AuditCategory.ADMIN,
          action: 'DOMAIN_EVENT_LISTENER_REMOVED',
          message: `Domain event listener removed: ${event}`,
          resource: `domain-event/${event}/listener`,
          metadata: {
            eventType: event,
            removedAt: new Date().toISOString(),
          },
        });

        return this;
      }
    }
    return this;
  }

  /**
   * Remove all listeners (optionally for a single event).
   */
  removeAllListeners(event?: DomainEventName): this {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
    return this;
  }

  /* ---------- Introspection ---------- */

  /**
   * Number of listeners for a given event.
   */
  listenerCount(event: DomainEventName): number {
    return this.emitter.listenerCount(event);
  }

  /**
   * All event names that have at least one listener.
   */
  activeEvents(): DomainEventName[] {
    return this.emitter.eventNames() as DomainEventName[];
  }
}

/* ------------------------------------------------------------------ */
/*  Convenience singleton export                                       */
/* ------------------------------------------------------------------ */

/** Pre-instantiated singleton — import this in most files. */
export const domainEvents = DomainEventBus.getInstance();
