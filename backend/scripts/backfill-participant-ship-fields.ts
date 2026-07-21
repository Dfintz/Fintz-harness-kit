/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
/**
 * Backfill activity_participants.shipName / shipType for activities created
 * before the ActivityService fix that started writing these fields in
 * addShip and joinShipAsCrew.
 *
 * Symptom this repairs: duplicate ship cards on the activity detail page,
 * plus crew members appearing as both "on ship" and "unassigned".
 *
 * Strategy: walk every activity, iterate shipAssignments, and for each ship:
 *   - ensure the owner's participant row has shipName/shipType matching the assignment
 *   - ensure every crewMember.userId has shipName/shipType matching the assignment
 *
 * Run: npx ts-node backend/scripts/backfill-participant-ship-fields.ts [--dry-run] [--activity <id>]
 */
import { AppDataSource } from '../src/config/database';
import { Activity } from '../src/models/Activity';
import { ActivityParticipant } from '../src/models/ActivityParticipant';

interface CliArgs {
  dryRun: boolean;
  activityId?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const idx = args.indexOf('--activity');
  const activityId = idx >= 0 ? args[idx + 1] : undefined;
  return { dryRun, activityId };
}

async function run() {
  const { dryRun, activityId } = parseArgs();

  await AppDataSource.initialize();
  console.log(`Database connected${dryRun ? ' (DRY RUN — no writes)' : ''}`);

  const activityRepo = AppDataSource.getRepository(Activity);
  const participantRepo = AppDataSource.getRepository(ActivityParticipant);

  const activities = activityId
    ? await activityRepo.find({ where: { id: activityId } })
    : await activityRepo.find();

  console.log(`Scanning ${activities.length} activit(y/ies)`);

  let activitiesTouched = 0;
  let participantsUpdated = 0;
  let assignmentsAvatarPatched = 0;
  const errors: Array<{ activityId: string; error: string }> = [];

  for (const activity of activities) {
    const assignments = activity.shipAssignments ?? [];
    if (assignments.length === 0) continue;

    // Load avatarUrl per participant for this activity (used for both the
    // participant-row backfill and the shipAssignments.crewMembers backfill).
    const participantsForAvatar = await participantRepo.find({
      where: { activityId: activity.id },
    });
    const avatarByUser = new Map<string, string | undefined>();
    for (const p of participantsForAvatar) {
      avatarByUser.set(p.userId, p.avatarUrl);
    }

    // Patch missing avatarUrl on every crewMember in every assignment.
    let assignmentAvatarChanged = false;
    for (const a of assignments) {
      for (const cm of a.crewMembers ?? []) {
        if (cm.avatarUrl) continue;
        const want = avatarByUser.get(cm.userId);
        if (!want) continue;
        console.log(
          `  [${activity.id}] assignment ship=${a.shipName ?? a.shipType} crew user=${cm.userId}: avatarUrl <missing> -> ${JSON.stringify(want)}`
        );
        cm.avatarUrl = want;
        assignmentAvatarChanged = true;
      }
    }
    if (assignmentAvatarChanged && !dryRun) {
      try {
        // Spread-and-replace so TypeORM detects the JSONB change.
        // See /memories/repo/typeorm-jsonb-pitfall.md
        activity.shipAssignments = [...assignments];
        await activityRepo.save(activity);
        assignmentsAvatarPatched++;
      } catch (err) {
        errors.push({
          activityId: activity.id,
          error: `avatar patch: ${(err as Error).message}`,
        });
      }
    } else if (assignmentAvatarChanged) {
      assignmentsAvatarPatched++;
    }

    // Build desired shipName/shipType per userId from the assignments.
    // Last-write-wins if a user appears in multiple ships (shouldn't happen
    // but is defensive). Crew members win over owners only for non-loaner
    // ships — owners always pilot their own ships.
    const desired = new Map<string, { shipName?: string; shipType?: string }>();

    for (const a of assignments) {
      // Owner is always the pilot of their own ship (unless it's a pure loaner
      // with no crew yet, in which case the loaner is not flying it).
      if (a.ownerId && !a.isLoaner) {
        desired.set(a.ownerId, { shipName: a.shipName, shipType: a.shipType });
      }
      for (const cm of a.crewMembers ?? []) {
        if (!cm.userId) continue;
        // Only overwrite owner mapping for crew assignments on other ships;
        // owner-as-pilot-of-own-ship already set above takes precedence.
        if (!desired.has(cm.userId)) {
          desired.set(cm.userId, { shipName: a.shipName, shipType: a.shipType });
        }
      }
    }

    if (desired.size === 0) continue;

    const participants = participantsForAvatar;

    let touchedThisActivity = 0;

    for (const p of participants) {
      const want = desired.get(p.userId);
      if (!want) continue;

      const needsShipName = (p.shipName ?? null) !== (want.shipName ?? null);
      const needsShipType = (p.shipType ?? null) !== (want.shipType ?? null);
      if (!needsShipName && !needsShipType) continue;

      const before = { shipName: p.shipName, shipType: p.shipType };
      const after = { shipName: want.shipName, shipType: want.shipType };

      console.log(
        `  [${activity.id}] user=${p.userId}: shipName ${JSON.stringify(before.shipName)} -> ${JSON.stringify(after.shipName)}, shipType ${JSON.stringify(before.shipType)} -> ${JSON.stringify(after.shipType)}`
      );

      if (!dryRun) {
        try {
          await participantRepo.update(
            { activityId: activity.id, userId: p.userId },
            { shipName: want.shipName, shipType: want.shipType }
          );
        } catch (err) {
          errors.push({
            activityId: activity.id,
            error: `user ${p.userId}: ${(err as Error).message}`,
          });
          continue;
        }
      }

      touchedThisActivity++;
      participantsUpdated++;
    }

    if (touchedThisActivity > 0) {
      activitiesTouched++;
      console.log(`  -> ${touchedThisActivity} participant(s) updated for ${activity.id}`);
    }
  }

  console.log('');
  console.log('=== Backfill summary ===');
  console.log(`Activities scanned:        ${activities.length}`);
  console.log(`Activities touched:        ${activitiesTouched}`);
  console.log(`Participants updated:      ${participantsUpdated}`);
  console.log(`Assignments avatar-patched: ${assignmentsAvatarPatched}`);
  console.log(`Errors:                    ${errors.length}`);
  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`  - ${e.activityId}: ${e.error}`);
    }
  }
  if (dryRun) {
    console.log('(dry run — no rows were actually modified)');
  }

  await AppDataSource.destroy();
}

run().catch(e => {
  console.error('Backfill failed:', e);
  process.exit(1);
});
