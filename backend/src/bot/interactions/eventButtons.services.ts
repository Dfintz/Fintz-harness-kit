/**
 * Lazy service locators for the event interaction handlers.
 *
 * Extracted from `eventButtons.ts` (E5 large-file decomposition) to give the lazy
 * service-singleton accessors their own ownership boundary, separate from the Discord
 * interaction handlers. Each service is constructed on first use rather than at module
 * load, so importing the handlers never triggers import-time database metadata access.
 *
 * The singletons are module-level state here, which preserves the original
 * one-instance-per-process semantics (ES modules are themselves cached singletons).
 * `eventButtons.ts` imports the four `get*Service` accessors back for internal use;
 * they are not re-exported (no external or test consumers). The import graph stays
 * acyclic — none of these services import the bot interaction handlers.
 */
import { ActivityService } from '../../services/activity';
import { ActivityParticipantService } from '../../services/activity/ActivityParticipantService';
import { ActivityReminderService } from '../../services/activity/ActivityReminderService';
import { NotificationService } from '../../services/communication';
import { FleetService } from '../../services/fleet/FleetService';
import { UserService } from '../../services/user/UserService';

// Lazy-initialise to avoid import-time database metadata access
let _activityService: ActivityService | null = null;
export function getActivityService(): ActivityService {
  if (!_activityService) {
    _activityService = new ActivityService();
  }
  return _activityService;
}

let _userService: UserService | null = null;
export function getUserService(): UserService {
  _userService ??= new UserService();
  return _userService;
}

let _participantService: ActivityParticipantService | null = null;
export function getParticipantService(): ActivityParticipantService {
  _participantService ??= new ActivityParticipantService();
  return _participantService;
}

let _fleetService: FleetService | null = null;
export function getFleetService(): FleetService {
  _fleetService ??= new FleetService();
  return _fleetService;
}

let _reminderService: ActivityReminderService | null = null;
export function getReminderService(): ActivityReminderService {
  _reminderService ??= new ActivityReminderService(new NotificationService());
  return _reminderService;
}
