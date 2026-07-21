import { describe, expect, it } from '@jest/globals';

import { ParticipantRole, type ActivityParticipant } from '../../models/Activity';
import {
  JobApplicationStatus,
  JobApplicationType,
  type JobApplication,
} from '../../models/JobApplication';
import type { PublicJobListing } from '../../models/PublicJobListing';
import type { TeamMember } from '../../models/TeamMember';
import { ActivityService } from '../../services/activity/ActivityService';
import { JobApplicationService } from '../../services/organization/JobApplicationService';
import { PublicJobListingService } from '../../services/organization/PublicJobListingService';
import {
  LFGSessionService,
  LFGSessionStatus,
  type LFGSession,
} from '../../services/social/LFGSessionService';
import { SocialGroupService } from '../../services/social/SocialGroupService';
import { TeamService } from '../../services/team/TeamService';
import type { LFGPost } from '../../types';

describe('Phase 1 shared ParticipantInfo adapters', () => {
  it('maps team member to canonical participant info', () => {
    const member = {
      userId: 'user-team-1',
      organizationId: 'org-1',
      role: 'leader',
      status: 'active',
      teamId: 'team-1',
      createdAt: new Date('2026-03-11T10:00:00.000Z'),
      joinedAt: new Date('2026-03-11T10:00:00.000Z'),
      lastActiveAt: new Date('2026-03-11T12:00:00.000Z'),
      user: {
        username: 'squadleader',
        displayName: 'Squad Leader',
      },
    } as TeamMember;

    const participant = TeamService.toParticipantInfo(member);

    expect(participant.userId).toBe('user-team-1');
    expect(participant.roles).toContain('ORG_LEADER');
    expect(participant.roles).toContain('ADMIN');
    expect(participant.status).toBe('active');
  });

  it('maps activity participant to canonical participant info', () => {
    const participant = {
      userId: 'user-activity-1',
      userName: 'pilot-one',
      organizationId: 'org-1',
      role: ParticipantRole.PILOT,
      status: 'accepted',
      joinedAt: new Date('2026-03-11T11:00:00.000Z'),
    } as ActivityParticipant;

    const mapped = ActivityService.toParticipantInfo(participant);

    expect(mapped.userId).toBe('user-activity-1');
    expect(mapped.roles).toContain('ACTIVITY_PARTICIPANT');
    expect(mapped.status).toBe('active');
  });

  it('maps social LFG post participant to canonical participant info', () => {
    const post = {
      id: 'lfg-post-1',
      activity: 'Bounty Hunting',
      description: 'Need one gunner',
      creatorId: 'host-1',
      creatorName: 'Host User',
      currentPlayers: 2,
      maxPlayers: 4,
      members: ['host-1', 'member-1'],
      createdAt: new Date('2026-03-11T12:00:00.000Z'),
      expiresAt: new Date('2026-03-11T13:00:00.000Z'),
      guildId: 'guild-1',
      channelId: 'channel-1',
      status: 'open',
    } as LFGPost;

    const mapped = SocialGroupService.toParticipantInfo('member-1', post, {
      username: 'member-one',
      displayName: 'Member One',
    });

    expect(mapped.userId).toBe('member-1');
    expect(mapped.roles).toContain('LFG_MEMBER');
    expect(mapped.source).toBe('manual');
  });

  it('maps redis-backed LFG session participant to canonical participant info', () => {
    const session = {
      id: 'session-1',
      hostUserId: 'host-1',
      organizationId: 'org-1',
      activityType: 'bounty',
      title: 'Bounty Run',
      maxPlayers: 4,
      currentPlayers: ['host-1', 'member-1'],
      status: LFGSessionStatus.OPEN,
      createdAt: new Date('2026-03-11T12:10:00.000Z'),
      expiresAt: new Date('2026-03-11T14:10:00.000Z'),
      updatedAt: new Date('2026-03-11T12:10:00.000Z'),
      metadata: { presenceDerived: true },
    } as LFGSession;

    const mapped = LFGSessionService.toParticipantInfo('member-1', session, {
      username: 'member-one',
      displayName: 'Member One',
    });

    expect(mapped.userId).toBe('member-1');
    expect(mapped.roles).toContain('LFG_MEMBER');
    expect(mapped.source).toBe('discord_presence');
  });

  it('maps job listing owner and applicant to canonical participant info', () => {
    const listing = {
      id: 'listing-1',
      organizationId: 'org-1',
      createdBy: 'provider-1',
      postedAt: new Date('2026-03-11T09:00:00.000Z'),
      isActive: true,
      expiresAt: new Date('2026-03-20T09:00:00.000Z'),
    } as PublicJobListing;

    const application = {
      id: 'app-1',
      jobListingId: 'listing-1',
      applicantUserId: 'applicant-1',
      applicantDisplayName: 'Applicant One',
      applicationType: JobApplicationType.CREW,
      status: JobApplicationStatus.PENDING,
      createdAt: new Date('2026-03-11T09:30:00.000Z'),
    } as JobApplication;

    const provider = PublicJobListingService.toParticipantInfo(listing, {
      username: 'provider-one',
      displayName: 'Provider One',
    });
    const applicant = JobApplicationService.toParticipantInfo(application);

    expect(provider.roles).toContain('JOB_PROVIDER');
    expect(applicant.roles).toContain('JOB_APPLICANT');
    expect(applicant.status).toBe('pending');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
