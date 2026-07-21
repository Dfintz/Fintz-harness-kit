import { describe, expect, it } from '@jest/globals';

import type { ParticipantInfo, SessionData, SessionMetadata } from '../models/participation';
import {
  isSessionOpen,
  mapActivityRoleToSystemRoles,
  mapActivityStatusToParticipantStatus,
  mapTeamsRoleToSystemRoles,
  mapTeamStatusToParticipantStatus,
  SessionStatus,
  SystemRole,
} from '../models/participation';

function assertType<T>(_value: T): void {
  // compile-time helper
}

describe('participation shared models', () => {
  it('maps team roles to system roles', () => {
    expect(mapTeamsRoleToSystemRoles('leader')).toEqual([SystemRole.ORG_LEADER, SystemRole.ADMIN]);
    expect(mapTeamsRoleToSystemRoles('officer')).toEqual([
      SystemRole.ORG_OFFICER,
      SystemRole.MODERATOR,
    ]);
    expect(mapTeamsRoleToSystemRoles('member')).toEqual([SystemRole.ORG_MEMBER]);
  });

  it('maps activity roles to system roles', () => {
    expect(mapActivityRoleToSystemRoles('leader')).toEqual([SystemRole.ACTIVITY_HOST]);
    expect(mapActivityRoleToSystemRoles('commander')).toEqual([SystemRole.ACTIVITY_HOST]);
    expect(mapActivityRoleToSystemRoles('pilot')).toEqual([SystemRole.ACTIVITY_PARTICIPANT]);
  });

  it('maps legacy statuses to participant lifecycle statuses', () => {
    expect(mapTeamStatusToParticipantStatus('pending')).toBe('pending');
    expect(mapTeamStatusToParticipantStatus('removed')).toBe('removed');
    expect(mapActivityStatusToParticipantStatus('invited')).toBe('invited');
    expect(mapActivityStatusToParticipantStatus('standby')).toBe('waitlisted');
  });

  it('accepts ParticipantInfo shape', () => {
    const participant: ParticipantInfo = {
      userId: 'user-1',
      organizationId: 'org-1',
      username: 'pilot-one',
      displayName: 'Pilot One',
      roles: [SystemRole.LFG_MEMBER, SystemRole.ACTIVITY_PARTICIPANT],
      primaryRole: 'pilot',
      status: 'active',
      joinedAt: '2026-03-11T10:00:00Z',
      lastActiveAt: '2026-03-11T10:05:00Z',
      trustScore: 81,
      source: 'discord_voice',
      metadata: { consentedPresence: true },
    };

    assertType<ParticipantInfo>(participant);
    expect(participant.source).toBe('discord_voice');
  });

  it('accepts SessionData shape for Discord-backed LFG', () => {
    const metadata: SessionMetadata = {
      systemType: 'social',
      tags: ['lfg', 'discord'],
      discordGuildId: 'guild-1',
      discordChannelId: 'channel-1',
      discordVoiceChannelId: 'voice-1',
      presenceDerived: true,
    };

    const session: SessionData = {
      id: 'session-1',
      organizationId: 'org-1',
      title: 'Bounty crew forming',
      initiatedBy: 'user-1',
      participants: [
        {
          userId: 'user-1',
          username: 'pilot-one',
          roles: [SystemRole.LFG_INITIATOR],
          joinedAt: '2026-03-11T10:00:00Z',
        },
      ],
      maxParticipants: 5,
      startedAt: '2026-03-11T10:00:00Z',
      status: SessionStatus.ACTIVE,
      metadata,
    };

    assertType<SessionData>(session);
    expect(isSessionOpen(session.status)).toBe(true);
    expect(session.metadata.presenceDerived).toBe(true);
  });

  it('treats completed sessions as closed', () => {
    expect(isSessionOpen(SessionStatus.COMPLETED)).toBe(false);
    expect(isSessionOpen(SessionStatus.CANCELLED)).toBe(false);
  });
});
