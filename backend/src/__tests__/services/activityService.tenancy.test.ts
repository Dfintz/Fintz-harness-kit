/**
 * Activity Service - Tenant Isolation Tests
 *
 * Tests to verify multi-tenancy implementation for Activity entity:
 * - Tenant boundary enforcement
 * - Cross-tenant sharing functionality
 * - Security and permission checks
 */

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { AppDataSource } from '../../config/database';
import { Activity, ActivityType, ActivityVisibility } from '../../models/Activity';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { ActivityService } from '../../services/activity';

describe('Activity Service - Tenant Isolation', () => {
  let activityService: ActivityService;
  let orgA: Organization;
  let orgB: Organization;
  let orgC: Organization;
  let userA: User;
  let userB: User;
  let activityA1: Activity;
  let activityA2: Activity;
  let activityB1: Activity;

  beforeAll(async () => {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
    activityService = new ActivityService();
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
        id: 'test-org-a',
        name: 'Test Organization A',
        members: [],
        type: 'root',
        status: 'active',
        level: 0,
        path: 'test-org-a',
      } as any) as any
    );

    orgB = await orgRepo.save(
      orgRepo.create({
        id: 'test-org-b',
        name: 'Test Organization B',
        members: [],
        type: 'root',
        status: 'active',
        level: 0,
        path: 'test-org-b',
      } as any) as any
    );

    orgC = await orgRepo.save(
      orgRepo.create({
        id: 'test-org-c',
        name: 'Test Organization C',
        members: [],
        type: 'root',
        status: 'active',
        level: 0,
        path: 'test-org-c',
      } as any) as any
    );

    // Create test users
    const userRepo = AppDataSource.getRepository(User);

    userA = await userRepo.save(
      userRepo.create({
        id: 'test-user-a',
        username: 'userA',
        email: 'usera@test.com',
        discordId: 'discord-a',
        role: 'user',
        activeOrgId: orgA.id,
      })
    );

    userB = await userRepo.save(
      userRepo.create({
        id: 'test-user-b',
        username: 'userB',
        email: 'userb@test.com',
        discordId: 'discord-b',
        role: 'user',
        activeOrgId: orgB.id,
      })
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
      })
    );

    await userOrgRepo.save(
      userOrgRepo.create({
        userId: userB.id,
        organizationId: orgB.id,
        role: 'admin',
        securityLevel: 5,
        joinedAt: new Date(),
      })
    );

    // Create test activities
    activityA1 = await activityService.createActivity(orgA.id, {
      title: 'Org A - Mining Operation',
      description: 'Test mining operation for Org A',
      activityType: ActivityType.OPERATION,
      creatorId: userA.id,
      creatorName: userA.username,
      organizationId: orgA.id,
      organizationName: orgA.name,
      visibility: ActivityVisibility.ORGANIZATION,
    });

    activityA2 = await activityService.createActivity(orgA.id, {
      title: 'Org A - Combat Mission',
      description: 'Test combat mission for Org A',
      activityType: ActivityType.MISSION,
      creatorId: userA.id,
      creatorName: userA.username,
      organizationId: orgA.id,
      organizationName: orgA.name,
      visibility: ActivityVisibility.ORGANIZATION,
    });

    activityB1 = await activityService.createActivity(orgB.id, {
      title: 'Org B - Trading Route',
      description: 'Test trading route for Org B',
      activityType: ActivityType.OPERATION,
      creatorId: userB.id,
      creatorName: userB.username,
      organizationId: orgB.id,
      organizationName: orgB.name,
      visibility: ActivityVisibility.ORGANIZATION,
    });
  });

  afterEach(async () => {
    // Clean up test data
    const activityRepo = AppDataSource.getRepository(Activity);
    await activityRepo.delete({ organizationId: orgA.id });
    await activityRepo.delete({ organizationId: orgB.id });
    await activityRepo.delete({ organizationId: orgC.id });

    const userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
    await userOrgRepo.delete({ organizationId: orgA.id });
    await userOrgRepo.delete({ organizationId: orgB.id });

    const userRepo = AppDataSource.getRepository(User);
    await userRepo.delete({ id: userA.id });
    await userRepo.delete({ id: userB.id });

    const orgRepo = AppDataSource.getRepository(Organization);
    await orgRepo.delete({ id: orgA.id });
    await orgRepo.delete({ id: orgB.id });
    await orgRepo.delete({ id: orgC.id });
  });

  describe('Tenant Boundary Enforcement', () => {
    test('findAll returns only organization activities', async () => {
      const activitiesA = await activityService.findAll(orgA.id);
      const activitiesB = await activityService.findAll(orgB.id);

      // Org A should see only its activities
      expect(activitiesA).toHaveLength(2);
      expect(activitiesA.every(a => a.organizationId === orgA.id)).toBe(true);
      expect(activitiesA).toContainEqual(expect.objectContaining({ id: activityA1.id }));
      expect(activitiesA).toContainEqual(expect.objectContaining({ id: activityA2.id }));

      // Org B should see only its activity
      expect(activitiesB).toHaveLength(1);
      expect(activitiesB[0].organizationId).toBe(orgB.id);
      expect(activitiesB[0].id).toBe(activityB1.id);

      // Org A should NOT see Org B's activity
      expect(activitiesA).not.toContainEqual(expect.objectContaining({ id: activityB1.id }));
    });

    test('findById returns null for other organization activities', async () => {
      // Org A cannot access Org B's activity
      const activity = await activityService.findById(orgA.id, activityB1.id);
      expect(activity).toBeNull();
    });

    test('findById returns activity for own organization', async () => {
      const activity = await activityService.findById(orgA.id, activityA1.id);
      expect(activity).not.toBeNull();
      expect(activity?.id).toBe(activityA1.id);
      expect(activity?.organizationId).toBe(orgA.id);
    });

    test('update only affects own organization activities', async () => {
      const newTitle = 'Updated Title';

      // Org A cannot update Org B's activity
      const updateResult = await activityService.update(orgA.id, activityB1.id, {
        title: newTitle,
      });
      expect(updateResult).toBeNull();

      // Verify Org B's activity was not changed
      const unchanged = await activityService.findById(orgB.id, activityB1.id);
      expect(unchanged?.title).not.toBe(newTitle);
    });

    test('delete only removes own organization activities', async () => {
      // Org A cannot delete Org B's activity - should throw error
      await expect(activityService.delete(orgA.id, activityB1.id)).rejects.toThrow(
        'Entity not found or access denied'
      );

      // Verify Org B's activity still exists
      const stillExists = await activityService.findById(orgB.id, activityB1.id);
      expect(stillExists).not.toBeNull();
    });

    test('count only counts own organization activities', async () => {
      const countA = await activityService.count(orgA.id);
      const countB = await activityService.count(orgB.id);

      expect(countA).toBe(2);
      expect(countB).toBe(1);
    });
  });

  describe('Cross-Tenant Sharing', () => {
    test('shareWith makes activity visible to target organization', async () => {
      // Org A shares activity with Org B
      await activityService.shareWith(orgA.id, activityA1.id, [orgB.id]);

      // Org B can now see the shared activity
      const sharedActivities = await activityService.findAllIncludingShared(orgB.id);
      expect(sharedActivities).toContainEqual(expect.objectContaining({ id: activityA1.id }));
      expect(sharedActivities).toHaveLength(2); // Own activity + shared activity
    });

    test('shareWith adds multiple organizations', async () => {
      // Org A shares with both Org B and Org C
      await activityService.shareWith(orgA.id, activityA1.id, [orgB.id, orgC.id]);

      // Both orgs can see the shared activity
      const sharedWithB = await activityService.findAllIncludingShared(orgB.id);
      const sharedWithC = await activityService.findAllIncludingShared(orgC.id);

      expect(sharedWithB).toContainEqual(expect.objectContaining({ id: activityA1.id }));
      expect(sharedWithC).toContainEqual(expect.objectContaining({ id: activityA1.id }));
    });

    test('unshareWith removes access from target organization', async () => {
      // Share then unshare
      await activityService.shareWith(orgA.id, activityA1.id, [orgB.id]);
      await activityService.unshareWith(orgA.id, activityA1.id, [orgB.id]);

      // Org B should no longer see the activity
      const sharedActivities = await activityService.findAllIncludingShared(orgB.id);
      expect(sharedActivities).not.toContainEqual(expect.objectContaining({ id: activityA1.id }));
      expect(sharedActivities).toHaveLength(1); // Only own activity
    });

    test('findAllIncludingShared returns own and shared activities', async () => {
      // Org A shares with Org B
      await activityService.shareWith(orgA.id, activityA1.id, [orgB.id]);
      await activityService.shareWith(orgA.id, activityA2.id, [orgB.id]);

      const activities = await activityService.findAllIncludingShared(orgB.id);

      // Should include: 1 own activity + 2 shared from Org A
      expect(activities).toHaveLength(3);
      expect(activities).toContainEqual(expect.objectContaining({ id: activityB1.id }));
      expect(activities).toContainEqual(expect.objectContaining({ id: activityA1.id }));
      expect(activities).toContainEqual(expect.objectContaining({ id: activityA2.id }));
    });

    test('getSharedOrgs returns list of organizations activity is shared with', async () => {
      await activityService.shareWith(orgA.id, activityA1.id, [orgB.id, orgC.id]);

      const sharedOrgs = await activityService.getSharedOrgs(orgA.id, activityA1.id);

      expect(sharedOrgs).toHaveLength(2);
      expect(sharedOrgs).toContain(orgB.id);
      expect(sharedOrgs).toContain(orgC.id);
    });

    test('findByIdIncludingShared allows access to shared activities', async () => {
      await activityService.shareWith(orgA.id, activityA1.id, [orgB.id]);

      // Org B can access shared activity by ID
      const shared = await activityService.findByIdIncludingShared(orgB.id, activityA1.id);
      expect(shared).not.toBeNull();
      expect(shared?.id).toBe(activityA1.id);
    });

    test('findByIdIncludingShared returns null for non-shared activities', async () => {
      // Org B cannot access Org A's non-shared activity
      const notShared = await activityService.findByIdIncludingShared(orgB.id, activityA1.id);
      expect(notShared).toBeNull();
    });
  });

  describe('Activity Creation with Tenant Context', () => {
    test('create automatically assigns organizationId', async () => {
      const newActivity = await activityService.createActivity(orgA.id, {
        title: 'New Activity',
        description: 'Test',
        activityType: ActivityType.EVENT,
        creatorId: userA.id,
        creatorName: userA.username,
        organizationName: orgA.name,
      });

      expect(newActivity.organizationId).toBe(orgA.id);
    });

    test('createMany assigns organizationId to all activities', async () => {
      const activities = await activityService.createMany(orgA.id, [
        {
          title: 'Activity 1',
          description: 'Test 1',
          activityType: ActivityType.EVENT,
          creatorId: userA.id,
          creatorName: userA.username,
        },
        {
          title: 'Activity 2',
          description: 'Test 2',
          activityType: ActivityType.MISSION,
          creatorId: userA.id,
          creatorName: userA.username,
        },
      ]);

      expect(activities).toHaveLength(2);
      expect(activities.every(a => a.organizationId === orgA.id)).toBe(true);
    });
  });

  describe('Tenant Isolation Edge Cases', () => {
    test('exists returns false for activities in other organizations', async () => {
      const exists = await activityService.exists(orgB.id, { id: activityA1.id });
      expect(exists).toBe(false);
    });

    test('exists returns true for activities in own organization', async () => {
      const exists = await activityService.exists(orgA.id, { id: activityA1.id });
      expect(exists).toBe(true);
    });

    test('deleteMany only deletes own organization activities', async () => {
      const deleted = await activityService.deleteMany(orgA.id, [activityA1.id, activityB1.id]);

      // Should only delete activityA1 (belongs to orgA)
      expect(deleted).toBe(1);

      // Verify activityB1 still exists
      const stillExists = await activityService.findById(orgB.id, activityB1.id);
      expect(stillExists).not.toBeNull();
    });

    test('sharing with non-existent organization is allowed (no validation)', async () => {
      // This should not throw an error (trust the caller)
      await expect(
        activityService.shareWith(orgA.id, activityA1.id, ['non-existent-org'])
      ).resolves.not.toThrow();
    });
  });
});
