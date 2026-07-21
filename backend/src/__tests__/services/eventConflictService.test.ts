/**
 * Event Conflict Service Tests
 * 
 * Tests to verify conflict detection functionality:
 * - Time overlap detection
 * - Conflict type classification
 * - Alternative time suggestions
 * - Multi-tenant isolation
 */

import { mockAppDataSource, clearEntityStorage } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
    AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
    AppDataSource: mockAppDataSource,
}));

import { AppDataSource } from '../../config/database';
import { Activity, ActivityType, ActivityStatus, ActivityVisibility } from '../../models/Activity';
import { Organization } from '../../models/Organization';
import { EventConflictService } from '../../services/event/EventConflictService';
import { Like } from 'typeorm';

describe('EventConflictService', () => {
    let conflictService: EventConflictService;
    let testOrg: Organization;

    beforeAll(async () => {
        // Initialize database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
        conflictService = new EventConflictService();
    }, 30000); // Increase timeout for database initialization

    afterAll(async () => {
        // Clean up all test data before destroying connection
        try {
            if (AppDataSource.isInitialized) {
                const activityRepo = AppDataSource.getRepository(Activity);
                const orgRepo = AppDataSource.getRepository(Organization);
                
                // Delete all test data to avoid orphaned resources
                await activityRepo.delete({});
                await orgRepo.delete({ id: Like('test-org-%') });
                
                await AppDataSource.destroy();
            }
        } catch (error) {
            // Ensure destroy is called even if cleanup fails
            if (AppDataSource.isInitialized) {
                await AppDataSource.destroy();
            }
        } finally {
            // Always clear entity storage at the end
            clearEntityStorage();
        }
    }, 30000); // Increase timeout for cleanup

    beforeEach(async () => {
        // Clear entity storage before each test to ensure clean slate
        clearEntityStorage();
        
        // Create test organization
        // Note: Using 'as any' to bypass strict type checking in test setup
        // This is acceptable for test fixtures where we control the data
        const orgRepo = AppDataSource.getRepository(Organization);
        
        testOrg = await orgRepo.save(orgRepo.create({
            id: 'test-org-conflicts',
            name: 'Test Conflict Organization',
            members: [],
            type: 'root',
            status: 'active',
            level: 0,
            path: 'test-org-conflicts'
        } as any) as any);
    });

    afterEach(async () => {
        // Clean up test data
        const activityRepo = AppDataSource.getRepository(Activity);
        const orgRepo = AppDataSource.getRepository(Organization);
        
        await activityRepo.delete({ organizationId: testOrg.id });
        await orgRepo.delete({ id: testOrg.id });
        
        // Clear all entity storage to prevent memory leaks
        clearEntityStorage();
    });

    describe('checkConflicts', () => {
        it('should return no conflicts for empty schedule', async () => {
            const startDate = new Date('2025-12-10T10:00:00Z');
            const endDate = new Date('2025-12-10T12:00:00Z');

            const result = await conflictService.checkConflicts(
                testOrg.id,
                startDate,
                endDate
            );

            expect(result.hasConflicts).toBe(false);
            expect(result.conflicts).toHaveLength(0);
            expect(result.totalConflicts).toBe(0);
        });

        it('should detect full overlap conflict', async () => {
            // Create an existing activity
            const activityRepo = AppDataSource.getRepository(Activity);
            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Existing Event',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T10:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T12:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            // Check for conflicts with overlapping time
            const startDate = new Date('2025-12-10T10:30:00Z');
            const endDate = new Date('2025-12-10T11:30:00Z');

            const result = await conflictService.checkConflicts(
                testOrg.id,
                startDate,
                endDate
            );

            expect(result.hasConflicts).toBe(true);
            expect(result.conflicts).toHaveLength(1);
            expect(result.conflicts[0].activityTitle).toBe('Existing Event');
            expect(result.conflicts[0].conflictType).toBe('full');
        });

        it('should detect partial overlap conflict', async () => {
            // Create an existing activity
            const activityRepo = AppDataSource.getRepository(Activity);
            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Morning Mission',
                activityType: ActivityType.MISSION,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T09:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T11:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            // Check for conflicts with partially overlapping time
            const startDate = new Date('2025-12-10T10:00:00Z');
            const endDate = new Date('2025-12-10T12:00:00Z');

            const result = await conflictService.checkConflicts(
                testOrg.id,
                startDate,
                endDate
            );

            expect(result.hasConflicts).toBe(true);
            expect(result.conflicts).toHaveLength(1);
            expect(result.conflicts[0].conflictType).toBe('partial');
        });

        it('should exclude cancelled activities from conflicts', async () => {
            // Create a cancelled activity
            const activityRepo = AppDataSource.getRepository(Activity);
            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Cancelled Event',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.CANCELLED,
                scheduledStartDate: new Date('2025-12-10T10:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T12:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            // Check for conflicts at the same time
            const startDate = new Date('2025-12-10T10:00:00Z');
            const endDate = new Date('2025-12-10T12:00:00Z');

            const result = await conflictService.checkConflicts(
                testOrg.id,
                startDate,
                endDate
            );

            expect(result.hasConflicts).toBe(false);
            expect(result.conflicts).toHaveLength(0);
        });

        it('should exclude specified activity when checking for update', async () => {
            // Create an activity
            const activityRepo = AppDataSource.getRepository(Activity);
            const activity = await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Event to Update',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T10:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T12:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            // Check for conflicts excluding this activity (update scenario)
            const startDate = new Date('2025-12-10T10:00:00Z');
            const endDate = new Date('2025-12-10T12:00:00Z');

            const result = await conflictService.checkConflicts(
                testOrg.id,
                startDate,
                endDate,
                activity.id
            );

            expect(result.hasConflicts).toBe(false);
            expect(result.conflicts).toHaveLength(0);
        });

        it('should apply buffer time when checking conflicts', async () => {
            // Create an activity
            const activityRepo = AppDataSource.getRepository(Activity);
            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Morning Event',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T09:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T10:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            // Check for conflicts with 30-minute buffer
            const startDate = new Date('2025-12-10T10:15:00Z');
            const endDate = new Date('2025-12-10T11:00:00Z');

            const result = await conflictService.checkConflicts(
                testOrg.id,
                startDate,
                endDate,
                undefined,
                { bufferMinutes: 30 }
            );

            expect(result.hasConflicts).toBe(true);
            expect(result.conflicts).toHaveLength(1);
        });
    });

    describe('getActivityConflicts', () => {
        it('should get conflicts for a specific activity', async () => {
            const activityRepo = AppDataSource.getRepository(Activity);
            
            // Create first activity
            const activity1 = await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Main Event',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T10:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T12:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            // Create conflicting activity
            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Conflicting Mission',
                activityType: ActivityType.MISSION,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T11:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T13:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            const result = await conflictService.getActivityConflicts(
                testOrg.id,
                activity1.id
            );

            expect(result.hasConflicts).toBe(true);
            expect(result.conflicts).toHaveLength(1);
            expect(result.conflicts[0].activityTitle).toBe('Conflicting Mission');
        });

        it('should return empty result for activity without schedule', async () => {
            const activityRepo = AppDataSource.getRepository(Activity);
            
            // Create activity without scheduled times
            const activity = await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Unscheduled Event',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.DRAFT,
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            const result = await conflictService.getActivityConflicts(
                testOrg.id,
                activity.id
            );

            expect(result.hasConflicts).toBe(false);
            expect(result.conflicts).toHaveLength(0);
        });
    });

    describe('getConflictsInRange', () => {
        it('should find all conflicts in date range', async () => {
            const activityRepo = AppDataSource.getRepository(Activity);
            
            // Create multiple overlapping activities
            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Event 1',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T10:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T11:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Event 2',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T10:30:00Z'),
                scheduledEndDate: new Date('2025-12-10T11:30:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Event 3',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T11:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T12:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            const conflicts = await conflictService.getConflictsInRange(
                testOrg.id,
                new Date('2025-12-10T00:00:00Z'),
                new Date('2025-12-11T00:00:00Z')
            );

            // Should find conflicts between all three overlapping events
            expect(conflicts.length).toBeGreaterThan(0);
        });

        it('should return empty array for non-overlapping activities', async () => {
            const activityRepo = AppDataSource.getRepository(Activity);
            
            // Create non-overlapping activities
            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Morning Event',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T09:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T10:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'Afternoon Event',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T14:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T15:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            const conflicts = await conflictService.getConflictsInRange(
                testOrg.id,
                new Date('2025-12-10T00:00:00Z'),
                new Date('2025-12-11T00:00:00Z')
            );

            expect(conflicts).toHaveLength(0);
        });
    });

    describe('Multi-tenant isolation', () => {
        it('should not detect conflicts across different organizations', async () => {
            // Create another organization
            const orgRepo = AppDataSource.getRepository(Organization);
            const otherOrg = await orgRepo.save(orgRepo.create({
                id: 'test-org-other',
                name: 'Other Organization',
                members: [],
                type: 'root',
                status: 'active',
                level: 0,
                path: 'test-org-other'
            } as any) as any);

            const activityRepo = AppDataSource.getRepository(Activity);
            
            // Create activity in testOrg
            await activityRepo.save(activityRepo.create({
                organizationId: testOrg.id,
                title: 'TestOrg Event',
                activityType: ActivityType.EVENT,
                status: ActivityStatus.OPEN,
                scheduledStartDate: new Date('2025-12-10T10:00:00Z'),
                scheduledEndDate: new Date('2025-12-10T12:00:00Z'),
                creatorId: 'test-user',
                creatorName: 'Test User'
            }));

            // Check for conflicts in otherOrg at the same time
            const result = await conflictService.checkConflicts(
                otherOrg.id,
                new Date('2025-12-10T10:00:00Z'),
                new Date('2025-12-10T12:00:00Z')
            );

            expect(result.hasConflicts).toBe(false);
            expect(result.conflicts).toHaveLength(0);

            // Clean up
            await orgRepo.delete({ id: otherOrg.id });
        });
    });
});
