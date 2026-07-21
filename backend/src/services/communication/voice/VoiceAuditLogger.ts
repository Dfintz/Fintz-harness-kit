/**
 * VoiceAuditLogger — Audit logger for voice server configuration changes.
 *
 * Logs: config creation/updates, access grants/revokes, server status changes.
 * Follows DomainAuditLogger pattern (singleton, circular buffer + AuditService).
 */

import { AuditCategory } from '../../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../../shared/DomainAuditLogger';

// ─── Action Enum ──────────────────────────────────────────────

export enum VoiceAuditAction {
  CONFIG_CREATED = 'VOICE_CONFIG_CREATED',
  CONFIG_UPDATED = 'VOICE_CONFIG_UPDATED',
  CONFIG_DELETED = 'VOICE_CONFIG_DELETED',
  ACCESS_GRANTED = 'VOICE_ACCESS_GRANTED',
  ACCESS_DENIED = 'VOICE_ACCESS_DENIED',
  SERVER_QUERIED = 'VOICE_SERVER_QUERIED',
}

// ─── Entry Interface ──────────────────────────────────────────

export interface VoiceAuditEntry extends BaseDomainAuditEntry<VoiceAuditAction> {
  /** Organization or federation ID that owns the voice config */
  entityId: string;
  /** Scope of the voice config */
  entityType: 'organization' | 'federation';
  /** Server type (mumble, teamspeak, etc.) */
  serverType?: string;
  /** Server host:port for log context */
  serverAddress?: string;
}

// ─── Logger Implementation ────────────────────────────────────

export class VoiceAuditLogger extends DomainAuditLogger<VoiceAuditAction, VoiceAuditEntry> {
  private static instance: VoiceAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.VOICE,
      domainLabel: 'Voice',
    });
  }

  public static getInstance(): VoiceAuditLogger {
    if (!VoiceAuditLogger.instance) {
      VoiceAuditLogger.instance = new VoiceAuditLogger();
    }
    return VoiceAuditLogger.instance;
  }

  protected buildMessage(entry: VoiceAuditEntry): string {
    const address = entry.serverAddress ? ` (${entry.serverAddress})` : '';
    return `Voice ${entry.action}: ${entry.entityType}/${entry.entityId}${address}`;
  }

  protected buildResource(entry: VoiceAuditEntry): string {
    return `voice/${entry.entityType}/${entry.entityId}`;
  }

  // ─── Convenience Methods ──────────────────────────────────

  logConfigCreated(
    entityId: string,
    entityType: 'organization' | 'federation',
    orgId: string,
    userId: string,
    serverType: string,
    host: string,
    port: number
  ): void {
    this.log({
      action: VoiceAuditAction.CONFIG_CREATED,
      entityId,
      entityType,
      organizationId: orgId,
      performedById: userId,
      serverType,
      serverAddress: `${host}:${port}`,
      details: { serverType, host, port },
    });
  }

  logConfigUpdated(
    entityId: string,
    entityType: 'organization' | 'federation',
    orgId: string,
    userId: string,
    changes: Record<string, unknown>
  ): void {
    this.log({
      action: VoiceAuditAction.CONFIG_UPDATED,
      entityId,
      entityType,
      organizationId: orgId,
      performedById: userId,
      details: changes,
    });
  }

  logConfigDeleted(
    entityId: string,
    entityType: 'organization' | 'federation',
    orgId: string,
    userId: string
  ): void {
    this.log({
      action: VoiceAuditAction.CONFIG_DELETED,
      entityId,
      entityType,
      organizationId: orgId,
      performedById: userId,
      details: {},
    });
  }

  logAccessDenied(
    entityId: string,
    entityType: 'organization' | 'federation',
    orgId: string,
    userId: string,
    reason: string
  ): void {
    this.log({
      action: VoiceAuditAction.ACCESS_DENIED,
      entityId,
      entityType,
      organizationId: orgId,
      performedById: userId,
      details: { reason },
    });
  }
}

export const voiceAuditLogger = VoiceAuditLogger.getInstance();

