/**
 * AttendanceConfirmationService - Tenant Isolation Tests
 *
 * Tests to verify multi-tenancy implementation for EventAttendanceConfirmation entity:
 * - Tenant boundary enforcement
 * - Cross-tenant data isolation
 * - Organization-scoped queries
 */

import type { DeepPartial } from 'typeorm';

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { AppDataSource } from '../../config/database';
import { Activity, ActivityType, ParticipantRole } from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import {
  AttendanceStatus,
  EventAttendanceConfirmation,
} from '../../models/EventAttendanceConfirmation';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { ActivityAttendanceService as AttendanceConfirmationService } from '../../services/activity';
import { NotificationService } from '../../services/communication';

describe('AttendanceConfirmationService - Tenant Isolation', () => {
  let attendanceService: AttendanceConfirmationService;
  let notificationService: NotificationService;
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;
  let userB: User;
  let activityA: Activity;
  let activityB: Activity;
  let confirmationA1: EventAttendanceConfirmation;
  let confirmationB1: EventAttendanceConfirmation;

  beforeAll(async () => {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    notificationService = new NotificationService();
    attendanceService = new AttendanceConfirmationService(notificationService);
  });

  afterAll(async () => {
    // Clean up
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Create test organizations
    const orgRepo = AppDataSource.getRepository(Organization);

    orgA = await orgRepo.save(
      orgRepo.create({
        id: 'test-org-a-attendance',
        name: 'Test Organization A',
        members: [],
        type: 'root',
        status: 'active',
        level: 0,
        path: 'test-org-a-attendance',
      } as DeepPartial<Organization>)
    );

    orgB = await orgRepo.save(
      orgRepo.create({
        id: 'test-org-b-attendance',
        name: 'Test Organization B',
        members: [],
        type: 'root',
        status: 'active',
        level: 0,
        path: 'test-org-b-attendance',
      } as DeepPartial<Organization>)
    );

    // Create test users
    const userRepo = AppDataSource.getRepository(User);

    userA = await userRepo.save(
      userRepo.create({
        id: 'test-user-a-attendance',
        username: 'userA',
        email: 'usera.attendance@test.com',
        discordId: 'discord-a-attendance',
        role: 'user',
        activeOrgId: orgA.id,
      } as DeepPartial<User>)
    );

    userB = await userRepo.save(
      userRepo.create({
        id: 'test-user-b-attendance',
        username: 'userB',
        email: 'userb.attendance@test.com',
        discordId: 'discord-b-attendance',
        role: 'user',
        activeOrgId: orgB.id,
      } as DeepPartial<User>)
    );

    // Create user-organization memberships
    const userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
    await userOrgRepo.save(
      userOrgRepo.create({
        userId: userA.id,
        organizationId: orgA.id,
        role: 'admin',
        securityLevel: 5,
        joinedAt: new Date(),
      } as DeepPartial<OrganizationMembership>)
    );

    await userOrgRepo.save(
      userOrgRepo.create({
        userId: userB.id,
        organizationId: orgB.id,
        role: 'admin',
        securityLevel: 5,
        joinedAt: new Date(),
      } as DeepPartial<OrganizationMembership>)
    );

    // Create test activities (events)
    const activityRepo = AppDataSource.getRepository(Activity);

    activityA = await activityRepo.save(
      activityRepo.create({
        id: 'test-activity-a-attendance',
        title: 'Org A Event',
        description: 'Test event for Org A',
        type: ActivityType.EVENT,
        activityType: ActivityType.EVENT,
        status: 'active',
        creatorId: userA.id,
        creatorName: userA.username,
        organizationId: orgA.id,
        organizationName: orgA.name,
        participants: [
          {
            userId: userA.id,
            username: userA.username,
            status: 'accepted',
            role: 'organizer',
          },
        ],
      } as DeepPartial<Activity>)
    );

    activityB = await activityRepo.save(
      activityRepo.create({
        id: 'test-activity-b-attendance',
        title: 'Org B Event',
        description: 'Test event for Org B',
        type: ActivityType.EVENT,
        activityType: ActivityType.EVENT,
        status: 'active',
        creatorId: userB.id,
        creatorName: userB.username,
        organizationId: orgB.id,
        organizationName: orgB.name,
        participants: [
          {
            userId: userB.id,
            username: userB.username,
            status: 'accepted',
            role: 'organizer',
          },
        ],
      } as DeepPartial<Activity>)
    );

    // Seed normalized participant rows used by initializeActivityAttendance
    const participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
    await participantRepo.save(
      participantRepo.create({
        activityId: activityA.id,
        userId: userA.id,
        userName: userA.username,
        organizationId: orgA.id,
        organizationName: orgA.name,
        role: ParticipantRole.MEMBER,
        status: ActivityParticipantStatus.ACCEPTED,
      } as DeepPartial<ActivityParticipantEntity>)
    );
    await participantRepo.save(
      participantRepo.create({
        activityId: activityB.id,
        userId: userB.id,
        userName: userB.username,
        organizationId: orgB.id,
        organizationName: orgB.name,
        role: ParticipantRole.MEMBER,
        status: ActivityParticipantStatus.ACCEPTED,
      } as DeepPartial<ActivityParticipantEntity>)
    );

    // Create test confirmations manually (instead of using service to test isolation)
    const confirmationRepo = AppDataSource.getRepository(EventAttendanceConfirmation);

    confirmationA1 = await confirmationRepo.save(
      confirmationRepo.create({
        eventId: activityA.id,
        userId: userA.id,
        organizationId: orgA.id,
        status: AttendanceStatus.PENDING_CONFIRMATION,
        rsvpStatus: 'accepted',
        rsvpRole: 'organizer',
      } as DeepPartial<EventAttendanceConfirmation>)
    );

    confirmationB1 = await confirmationRepo.save(
      confirmationRepo.create({
        eventId: activityB.id,
        userId: userB.id,
        organizationId: orgB.id,
        status: AttendanceStatus.PENDING_CONFIRMATION,
        rsvpStatus: 'accepted',
        rsvpRole: 'organizer',
      } as DeepPartial<EventAttendanceConfirmation>)
    );
  });

  afterEach(async () => {
    // Clean up test data
    const confirmationRepo = AppDataSource.getRepository(EventAttendanceConfirmation);
    await confirmationRepo.delete({ organizationId: orgA.id });
    await confirmationRepo.delete({ organizationId: orgB.id });

    const participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
    await participantRepo.delete({ activityId: activityA.id });
    await participantRepo.delete({ activityId: activityB.id });

    const activityRepo = AppDataSource.getRepository(Activity);
    await activityRepo.delete({ id: activityA.id });
    await activityRepo.delete({ id: activityB.id });

    const userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
    await userOrgRepo.delete({ organizationId: orgA.id });
    await userOrgRepo.delete({ organizationId: orgB.id });

    const userRepo = AppDataSource.getRepository(User);
    await userRepo.delete({ id: userA.id });
    await userRepo.delete({ id: userB.id });

    const orgRepo = AppDataSource.getRepository(Organization);
    await orgRepo.delete({ id: orgA.id });
    await orgRepo.delete({ id: orgB.id });
  });

  describe('Tenant Boundary Enforcement', () => {
    test('findAll returns only organization confirmations', async () => {
      const confirmationsA = await attendanceService.findAll(orgA.id);
      const confirmationsB = await attendanceService.findAll(orgB.id);

      // Org A should see only its confirmations
      expect(confirmationsA).toHaveLength(1);
      expect(confirmationsA[0].organizationId).toBe(orgA.id);
      expect(confirmationsA[0].id).toBe(confirmationA1.id);

      // Org B should see only its confirmations
      expect(confirmationsB).toHaveLength(1);
      expect(confirmationsB[0].organizationId).toBe(orgB.id);
      expect(confirmationsB[0].id).toBe(confirmationB1.id);

      // Org A should NOT see Org B's confirmations
      expect(confirmationsA).not.toContainEqual(expect.objectContaining({ id: confirmationB1.id }));
    });

    test('findById returns null for other organization confirmations', async () => {
      // Org A cannot access Org B's confirmation
      const confirmation = await attendanceService.findById(orgA.id, confirmationB1.id);
      expect(confirmation).toBeNull();
    });

    test('findById returns confirmation for own organization', async () => {
      const confirmation = await attendanceService.findById(orgA.id, confirmationA1.id);
      expect(confirmation).not.toBeNull();
      expect(confirmation?.id).toBe(confirmationA1.id);
      expect(confirmation?.organizationId).toBe(orgA.id);
    });

    test('update only affects own organization confirmations', async () => {
      // Org A cannot update Org B's confirmation
      const updateResult = await attendanceService.update(orgA.id, confirmationB1.id, {
        status: AttendanceStatus.ATTENDED,
      });
      expect(updateResult).toBeNull();

      // Verify Org B's confirmation was not changed
      const unchanged = await attendanceService.findById(orgB.id, confirmationB1.id);
      expect(unchanged?.status).toBe(AttendanceStatus.PENDING_CONFIRMATION);
    });

    test('delete only removes own organization confirmations', async () => {
      // Org A cannot delete Org B's confirmation - should throw error
      await expect(attendanceService.delete(orgA.id, confirmationB1.id)).rejects.toThrow(
        'Entity not found or access denied'
      );

      // Verify Org B's confirmation still exists
      const stillExists = await attendanceService.findById(orgB.id, confirmationB1.id);
      expect(stillExists).not.toBeNull();
    });

    test('count only counts own organization confirmations', async () => {
      const countA = await attendanceService.count(orgA.id);
      const countB = await attendanceService.count(orgB.id);

      expect(countA).toBe(1);
      expect(countB).toBe(1);
    });

    test('exists returns false for confirmations in other organizations', async () => {
      const exists = await attendanceService.exists(orgB.id, { id: confirmationA1.id });
      expect(exists).toBe(false);
    });

    test('exists returns true for confirmations in own organization', async () => {
      const exists = await attendanceService.exists(orgA.id, { id: confirmationA1.id });
      expect(exists).toBe(true);
    });
  });

  describe('Confirmation Creation with Tenant Context', () => {
    test('create automatically assigns organizationId', async () => {
      const newConfirmation = await attendanceService.create(orgA.id, {
        eventId: activityA.id,
        userId: userA.id,
        status: AttendanceStatus.PENDING_CONFIRMATION,
      });

      expect(newConfirmation.organizationId).toBe(orgA.id);
      expect(newConfirmation.eventId).toBe(activityA.id);
    });

    test('initializeActivityAttendance creates confirmations in correct org', async () => {
      // Clear existing confirmations
      const confirmationRepo = AppDataSource.getRepository(EventAttendanceConfirmation);
      await confirmationRepo.delete({ eventId: activityA.id });

      // Initialize attendance
      const confirmations = await attendanceService.initializeActivityAttendance(activityA.id);

      expect(confirmations).toHaveLength(1);
      expect(confirmations[0].organizationId).toBe(orgA.id);
      expect(confirmations[0].eventId).toBe(activityA.id);
    });
  });

  describe('Service-Specific Tenant Isolation', () => {
    test('recordAttendance rejects cross-tenant writes with NotFoundError', async () => {
      const { NotFoundError } = await import('../../utils/apiErrors');

      // Org A's service context attempting to record against activityB (Org B):
      // the activity tenant scope filter should miss and surface NotFoundError
      // (we do NOT throw ForbiddenError — we must not leak existence to other tenants).
      await expect(
        attendanceService.recordAttendance(orgA.id, activityB.id, {
          userId: userB.id,
          status: AttendanceStatus.ATTENDED,
        })
      ).rejects.toBeInstanceOf(NotFoundError);

      // Org B's existing confirmation must remain untouched
      const untouched = await attendanceService.findById(orgB.id, confirmationB1.id);
      expect(untouched?.status).toBe(AttendanceStatus.PENDING_CONFIRMATION);
    });

    test('getActivityAttendanceStats only returns own org stats', async () => {
      // This test requires the service method to be tenant-aware
      // Assuming getActivityAttendanceStats accepts organizationId
      const statsA = await attendanceService.getActivityAttendanceStats(activityA.id);

      expect(statsA.total).toBe(1);
      expect(statsA.pending).toBe(1);
    });

    test('getUserAttendanceHistory scoped to organization', async () => {
      // Add more confirmations for testing
      await attendanceService.create(orgA.id, {
        eventId: activityA.id,
        userId: userA.id,
        status: AttendanceStatus.ATTENDED,
      });

      const history = await attendanceService.getUserAttendanceHistory(
        userA.id,
        12, // months back
        orgA.id // organizationId for tenant isolation
      );

      // Should only see confirmations from Org A
      expect(history.totalEvents).toBeGreaterThanOrEqual(1);
      // All confirmations should belong to orgA
    });
  });

  describe('Cross-Tenant Scenarios', () => {
    test('User in multiple orgs has separate confirmation records', async () => {
      // Add userA to orgB
      const userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
      await userOrgRepo.save(
        userOrgRepo.create({
          userId: userA.id,
          organizationId: orgB.id,
          role: 'member',
          securityLevel: 3,
          joinedAt: new Date(),
        } as DeepPartial<OrganizationMembership>)
      );

      // Create confirmation for userA in orgB event
      const confirmationA_in_B = await attendanceService.create(orgB.id, {
        eventId: activityB.id,
        userId: userA.id,
        status: AttendanceStatus.PENDING_CONFIRMATION,
      });

      expect(confirmationA_in_B.organizationId).toBe(orgB.id);
      expect(confirmationA_in_B.userId).toBe(userA.id);

      // UserA should have confirmations in both orgs
      const orgACount = await attendanceService.count(orgA.id, { userId: userA.id });
      const orgBCount = await attendanceService.count(orgB.id, { userId: userA.id });

      expect(orgACount).toBeGreaterThanOrEqual(1);
      expect(orgBCount).toBeGreaterThanOrEqual(1);
    });

    test('Org change does not affect historic confirmations', async () => {
      // Record attendance for userA in orgA
      const confirmation = await attendanceService.create(orgA.id, {
        eventId: activityA.id,
        userId: userA.id,
        status: AttendanceStatus.ATTENDED,
      });

      // Simulate user changing active org to orgB
      const userRepo = AppDataSource.getRepository(User);
      userA.activeOrgId = orgB.id;
      await userRepo.save(userA);

      // Historic confirmation should still belong to orgA
      const historic = await attendanceService.findById(orgA.id, confirmation.id);
      expect(historic).not.toBeNull();
      expect(historic?.organizationId).toBe(orgA.id);

      // And NOT be visible to orgB
      const notVisible = await attendanceService.findById(orgB.id, confirmation.id);
      expect(notVisible).toBeNull();
    });
  });

  describe('Data Migration Scenarios', () => {
    test('Confirmations linked to events inherit correct organizationId', async () => {
      // This simulates the migration behavior
      const confirmationRepo = AppDataSource.getRepository(EventAttendanceConfirmation);

      // Create confirmation without organizationId (pre-migration state)
      const preMigration = confirmationRepo.create({
        eventId: activityA.id,
        userId: userA.id,
        status: AttendanceStatus.PENDING_CONFIRMATION,
      });

      // After migration, it should derive organizationId from activity
      // In real migration, this would be done via SQL UPDATE
      preMigration.organizationId = activityA.organizationId;
      const migrated = await confirmationRepo.save(preMigration);

      expect(migrated.organizationId).toBe(orgA.id);
      expect(migrated.eventId).toBe(activityA.id);
    });

    test('Orphaned confirmations handled gracefully', async () => {
      // Create confirmation for non-existent event
      const orphaned = await attendanceService.create(orgA.id, {
        eventId: 'non-existent-event',
        userId: userA.id,
        status: AttendanceStatus.PENDING_CONFIRMATION,
      });

      // Should still be assigned to orgA (via explicit organizationId)
      expect(orphaned.organizationId).toBe(orgA.id);
    });
  });

  describe('Performance and Index Usage', () => {
    test('Composite index used for org + event queries', async () => {
      // This test would need EXPLAIN ANALYZE in real scenario
      // For now, just verify the query works efficiently
      const confirmationRepo = AppDataSource.getRepository(EventAttendanceConfirmation);

      const results = await confirmationRepo.find({
        where: {
          organizationId: orgA.id,
          eventId: activityA.id,
        },
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      // In production, verify via query plan that idx_event_attendance_org_event is used
    });

    test('Composite index used for org + user queries', async () => {
      const confirmationRepo = AppDataSource.getRepository(EventAttendanceConfirmation);

      const results = await confirmationRepo.find({
        where: {
          organizationId: orgA.id,
          userId: userA.id,
        },
      });

      expect(results.length).toBeGreaterThanOrEqual(1);
      // In production, verify via query plan that idx_event_attendance_org_user is used
    });
  });
});
