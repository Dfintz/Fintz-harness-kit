import { AuditCategory } from '../audit/AuditService';
import { BaseDomainAuditEntry, DomainAuditLogger } from '../shared/DomainAuditLogger';

/**
 * Audit actions for team voice channel operations.
 */
export enum TeamVoiceAuditAction {
  CHANNELS_CREATED = 'TEAM_VOICE_CHANNELS_CREATED',
  CHANNELS_DELETED = 'TEAM_VOICE_CHANNELS_DELETED',
  MEMBER_ADDED = 'TEAM_VOICE_MEMBER_ADDED',
  MEMBER_REMOVED = 'TEAM_VOICE_MEMBER_REMOVED',
}

/**
 * Audit log entry for team voice operations.
 */
export interface TeamVoiceAuditEntry extends BaseDomainAuditEntry<TeamVoiceAuditAction> {
  teamId: string;
  teamName?: string;
  guildId?: string;
}

/**
 * TeamVoiceAuditLogger
 *
 * Domain-specific audit logger for team voice channel operations.
 * Logged events: channel creation/deletion, member role assignment/removal.
 */
export class TeamVoiceAuditLogger extends DomainAuditLogger<
  TeamVoiceAuditAction,
  TeamVoiceAuditEntry
> {
  private static instance: TeamVoiceAuditLogger;

  private constructor() {
    super({
      category: AuditCategory.DISCORD,
      domainLabel: 'TeamVoice',
    });
  }

  static getInstance(): TeamVoiceAuditLogger {
    if (!TeamVoiceAuditLogger.instance) {
      TeamVoiceAuditLogger.instance = new TeamVoiceAuditLogger();
    }
    return TeamVoiceAuditLogger.instance;
  }

  protected buildMessage(entry: TeamVoiceAuditEntry): string {
    return `TeamVoice ${entry.action}: team ${entry.teamName ?? entry.teamId}`;
  }

  protected buildResource(entry: TeamVoiceAuditEntry): string {
    return `teamVoice/${entry.teamId}`;
  }

  logChannelsCreated(
    organizationId: string,
    teamId: string,
    teamName: string,
    guildId: string,
    performedById: string
  ): void {
    this.log({
      action: TeamVoiceAuditAction.CHANNELS_CREATED,
      organizationId,
      teamId,
      teamName,
      guildId,
      performedById,
      details: { guildId, teamName },
    });
  }

  logChannelsDeleted(organizationId: string, teamId: string, guildId: string): void {
    this.log({
      action: TeamVoiceAuditAction.CHANNELS_DELETED,
      organizationId,
      teamId,
      guildId,
      details: { guildId },
    });
  }

  logMemberAdded(
    organizationId: string,
    teamId: string,
    userId: string,
    memberRole?: string
  ): void {
    this.log({
      action: TeamVoiceAuditAction.MEMBER_ADDED,
      organizationId,
      teamId,
      details: { userId, memberRole },
    });
  }

  logMemberRemoved(organizationId: string, teamId: string, userId: string): void {
    this.log({
      action: TeamVoiceAuditAction.MEMBER_REMOVED,
      organizationId,
      teamId,
      details: { userId },
    });
  }
}

export const teamVoiceAuditLogger = TeamVoiceAuditLogger.getInstance();

