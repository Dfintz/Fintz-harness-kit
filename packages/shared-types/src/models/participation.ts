import type { ParticipantRole, ParticipationStatus } from './activity.js';
import type { TeamMemberRole, TeamMemberStatus } from './team.js';

export type ParticipantPresenceSource = 'manual' | 'discord_presence' | 'discord_voice' | 'system';

export type ParticipantLifecycleStatus =
  | 'active'
  | 'pending'
  | 'invited'
  | 'waitlisted'
  | 'inactive'
  | 'completed'
  | 'removed';

export enum SystemRole {
  ORG_LEADER = 'ORG_LEADER',
  ORG_OFFICER = 'ORG_OFFICER',
  ORG_MEMBER = 'ORG_MEMBER',
  ACTIVITY_HOST = 'ACTIVITY_HOST',
  ACTIVITY_PARTICIPANT = 'ACTIVITY_PARTICIPANT',
  LFG_INITIATOR = 'LFG_INITIATOR',
  LFG_MEMBER = 'LFG_MEMBER',
  JOB_PROVIDER = 'JOB_PROVIDER',
  JOB_APPLICANT = 'JOB_APPLICANT',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR',
}

export interface TrustScoreSnapshot {
  overall: number;
  lfg?: number;
  trading?: number;
  activity?: number;
  jobs?: number;
  updatedAt?: string | Date;
}

export interface ParticipantInfo {
  userId: string;
  organizationId?: string;
  username: string;
  displayName?: string;
  avatar?: string;
  roles: SystemRole[];
  primaryRole?: string;
  status?: ParticipantLifecycleStatus;
  joinedAt: string | Date;
  lastActiveAt?: string | Date;
  trustScore?: number;
  trustSnapshot?: TrustScoreSnapshot;
  source?: ParticipantPresenceSource;
  metadata?: Record<string, unknown>;
}

export type SessionSystemType = 'social' | 'activity' | 'job' | 'team';

export enum SessionStatus {
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  FULL = 'FULL',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED',
}

export interface SessionMetadata {
  systemType: SessionSystemType;
  tags: string[];
  linkedSessions?: string[];
  customData?: Record<string, unknown>;
  discordGuildId?: string;
  discordChannelId?: string;
  discordVoiceChannelId?: string;
  presenceDerived?: boolean;
}

export interface SessionData<
  TParticipant = ParticipantInfo,
  TMetadata extends SessionMetadata = SessionMetadata,
> {
  id: string;
  organizationId?: string;
  title: string;
  description?: string;
  initiatedBy: string;
  participants: TParticipant[];
  maxParticipants?: number;
  startedAt: string | Date;
  scheduledEndAt?: string | Date;
  status: SessionStatus;
  metadata: TMetadata;
}

export function mapTeamsRoleToSystemRoles(teamRole: TeamMemberRole): SystemRole[] {
  switch (teamRole) {
    case 'leader':
      return [SystemRole.ORG_LEADER, SystemRole.ADMIN];
    case 'officer':
      return [SystemRole.ORG_OFFICER, SystemRole.MODERATOR];
    default:
      return [SystemRole.ORG_MEMBER];
  }
}

export function mapTeamStatusToParticipantStatus(
  status: TeamMemberStatus
): ParticipantLifecycleStatus {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'inactive':
    case 'on_leave':
    case 'probation':
      return 'inactive';
    case 'removed':
      return 'removed';
    default:
      return 'active';
  }
}

export function mapActivityRoleToSystemRoles(role: ParticipantRole): SystemRole[] {
  return role === 'leader' || role === 'co_leader' || role === 'commander'
    ? [SystemRole.ACTIVITY_HOST]
    : [SystemRole.ACTIVITY_PARTICIPANT];
}

export function mapActivityStatusToParticipantStatus(
  status: ParticipationStatus
): ParticipantLifecycleStatus {
  switch (status) {
    case 'invited':
      return 'invited';
    case 'standby':
      return 'waitlisted';
    case 'declined':
      return 'inactive';
    default:
      return 'active';
  }
}

export function isSessionOpen(status: SessionStatus): boolean {
  return status === SessionStatus.SCHEDULED || status === SessionStatus.ACTIVE;
}

// ── Unified Participation API Types (Sprint 20-E) ──────────────────────

export type ParticipationSystemType = 'team' | 'activity' | 'job' | 'lfg';

export interface SystemParticipation {
  system: ParticipationSystemType;
  participants: ParticipantInfo[];
  error?: string;
}

export interface ParticipationSummary {
  userId: string;
  totalParticipations: number;
  systems: SystemParticipation[];
  activeCount: number;
  pendingCount: number;
  allRoles: SystemRole[];
}

export interface ParticipationQuery {
  userId: string;
  organizationId?: string;
  organizationIds?: string[];
  systems?: ParticipationSystemType[];
}
