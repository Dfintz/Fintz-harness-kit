/**
 * Crew avatar enrichment for the Activity Controller V2.
 *
 * Extracted from `activityController.ts` (E5 large-file decomposition) to give the
 * ship-assignment crew avatar-enrichment logic its own ownership boundary, separate from
 * the controller endpoints.
 *
 * `enrichActivityWithAvatars` is the entry point: it gathers the user IDs referenced by
 * an activity's ship-assignment crews, bulk-loads their current avatars from the `User`
 * table, and writes them back onto the activity in place. The `forEachCrewMember` /
 * `collectCrewUserIds` / `applyCrewAvatars` helpers stay private to this module.
 * `activityController.ts` imports `enrichActivityWithAvatars` back for internal use.
 *
 * The module depends only on the data layer and the `Activity` / `User` models — it never
 * imports `activityController.ts`, keeping the import graph acyclic (one-way: controller →
 * avatar enrichment).
 */
import { AppDataSource } from '../../config/database';
import { Activity } from '../../models/Activity';
import { User } from '../../models/User';

/** Iterate over crew arrays in a ship assignment, calling fn for each member. */
function forEachCrewMember(
  assignments: Activity['shipAssignments'],
  fn: (member: { userId: string; avatarUrl?: string }) => void
): void {
  for (const sa of assignments ?? []) {
    for (const c of sa.crew ?? []) {
      fn(c);
    }
    for (const c of sa.crewMembers ?? []) {
      fn(c);
    }
  }
}

/** Collect user IDs from ship assignment crews. */
function collectCrewUserIds(assignments: Activity['shipAssignments'], ids: Set<string>): void {
  forEachCrewMember(assignments, c => {
    if (c.userId) {
      ids.add(c.userId);
    }
  });
}

/** Apply avatar URLs to ship assignment crews. */
function applyCrewAvatars(
  assignments: Activity['shipAssignments'],
  avatarMap: Map<string, string | undefined>
): void {
  forEachCrewMember(assignments, c => {
    const avatar = avatarMap.get(c.userId);
    if (avatar) {
      c.avatarUrl = avatar;
    }
  });
}

/**
 * Enrich activity ship-assignment crew with current avatar URLs from the User table.
 * Mutates the activity object in place for efficiency.
 *
 * Note: participant avatars are enriched separately in the `getParticipants`
 * endpoint, sourced from the normalized `activity_participants` table. The
 * deprecated `participants` JSON column is no longer read here.
 */
export async function enrichActivityWithAvatars(activity: Activity): Promise<void> {
  const hasAssignments = (activity.shipAssignments?.length ?? 0) > 0;
  const hasShips = (activity.ships?.length ?? 0) > 0;

  if (!hasAssignments && !hasShips) {
    return;
  }

  const userIds = new Set<string>();
  collectCrewUserIds(activity.shipAssignments, userIds);
  collectCrewUserIds(activity.ships, userIds);

  if (userIds.size === 0) {
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  const users = await userRepo
    .createQueryBuilder('user')
    .select(['user.id', 'user.avatar'])
    .where('user.id IN (:...userIds)', { userIds: [...userIds] })
    .getMany();

  const avatarMap = new Map(users.map(u => [u.id, u.avatar]));

  applyCrewAvatars(activity.shipAssignments, avatarMap);
  applyCrewAvatars(activity.ships, avatarMap);
}
