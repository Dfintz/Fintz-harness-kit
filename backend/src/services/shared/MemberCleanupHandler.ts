/**
 * MemberCleanupHandler — Cascading cleanup on member:platform_left
 *
 * When a user leaves the platform (e.g. GDPR deletion), this handler:
 *  1. Removes the user from all teams in the organization
 *  2. Clears the user's availability slots
 *
 * Subscribes to the DomainEventBus `member:platform_left` event.
 */

import { logger } from '../../utils/logger';
import { AvailabilityService } from '../calendar/AvailabilityService';
import { TeamService } from '../team/TeamService';

import { domainEvents, MemberPlatformLeftPayload } from './DomainEventBus';

export class MemberCleanupHandler {
  private readonly teamService: TeamService;
  private readonly availabilityService: AvailabilityService;
  private subscribed = false;

  constructor(
    teamService?: TeamService,
    availabilityService?: AvailabilityService
  ) {
    this.teamService = teamService || new TeamService();
    this.availabilityService = availabilityService || new AvailabilityService();
  }

  /**
   * Wire up the DomainEventBus listener.
   * Idempotent — safe to call more than once.
   */
  subscribeToEvents(): void {
    if (this.subscribed) {return;}
    this.subscribed = true;

    domainEvents.on('member:platform_left', p => this.onPlatformLeft(p));

    logger.info('MemberCleanupHandler: subscribed to member:platform_left');
  }

  private async onPlatformLeft(payload: MemberPlatformLeftPayload): Promise<void> {
    const { userId, organizationId, username } = payload;

    logger.info('MemberCleanupHandler: processing platform_left', {
      userId,
      organizationId,
      username,
    });

    let teamsRemoved = 0;

    try {
      teamsRemoved = await this.teamService.removeUserFromAllTeams(organizationId, userId);
    } catch (err: unknown) {
      logger.error('MemberCleanupHandler: failed to remove user from teams', {
        userId,
        organizationId,
        error: err,
      });
    }

    try {
      await this.availabilityService.setAvailability(userId, organizationId, []);
    } catch (err: unknown) {
      logger.error('MemberCleanupHandler: failed to clear availability', {
        userId,
        organizationId,
        error: err,
      });
    }

    logger.info(
      `MemberCleanupHandler: cleaned up member ${username}: removed from ${teamsRemoved} teams, cleared availability`,
      { userId, organizationId }
    );
  }
}

/** Lazy singleton — subscribes only after the first call to getMemberCleanupHandler(). */
let _memberCleanupHandler: MemberCleanupHandler | null = null;

export function getMemberCleanupHandler(): MemberCleanupHandler {
  if (!_memberCleanupHandler) {
    _memberCleanupHandler = new MemberCleanupHandler();
    _memberCleanupHandler.subscribeToEvents();
  }
  return _memberCleanupHandler;
}

