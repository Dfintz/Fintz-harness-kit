/**
 * ActivityAuditLogger Tests
 * 
 * Tests for the centralized activity audit logging system.
 * Verifies audit logging functionality across all Activity domain services.
 * 
 * @since December 2025 - Comprehensive Audit Logging Enhancement
 */

import { ActivityAuditLogger, ActivityAuditAction, ActivityAuditEntry, activityAuditLogger } from '../../services/activity/ActivityAuditLogger';
import { ActivityType } from '../../models/Activity';

describe('ActivityAuditLogger', () => {
    let testLogger: ActivityAuditLogger;

    beforeEach(() => {
        // Get a fresh instance for testing
        testLogger = ActivityAuditLogger.getInstance();
        // Clear the audit log for clean tests
        testLogger.clearAuditLog();
    });

    afterEach(() => {
        // Ensure clean state after each test
        testLogger.clearAuditLog();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = ActivityAuditLogger.getInstance();
            const instance2 = ActivityAuditLogger.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should share state between instances', () => {
            const instance1 = ActivityAuditLogger.getInstance();
            const instance2 = ActivityAuditLogger.getInstance();

            instance1.log({
                action: ActivityAuditAction.ACTIVITY_CREATED,
                activityId: 'test-1',
                activityTitle: 'Test Activity',
                activityType: ActivityType.MISSION,
                organizationId: 'org-1',
                performedById: 'user-1',
                performedByName: 'Test User',
                details: {}
            });

            expect(instance2.getEntryCount()).toBe(1);
        });
    });

    describe('log()', () => {
        it('should add audit entry with timestamp', () => {
            const beforeLog = new Date();
            
            testLogger.log({
                action: ActivityAuditAction.ACTIVITY_CREATED,
                activityId: 'test-1',
                activityTitle: 'Test Activity',
                activityType: ActivityType.MISSION,
                organizationId: 'org-1',
                performedById: 'user-1',
                performedByName: 'Test User',
                details: { key: 'value' }
            });

            const afterLog = new Date();
            const entries = testLogger.getAuditLog();
            
            expect(entries.length).toBe(1);
            expect(entries[0].timestamp).toBeInstanceOf(Date);
            expect(entries[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeLog.getTime());
            expect(entries[0].timestamp.getTime()).toBeLessThanOrEqual(afterLog.getTime());
        });

        it('should store all audit entry fields', () => {
            testLogger.log({
                action: ActivityAuditAction.PARTICIPANT_JOINED,
                activityId: 'test-1',
                activityTitle: 'Mining Operation',
                activityType: ActivityType.OPERATION,
                organizationId: 'org-123',
                performedById: 'user-456',
                performedByName: 'John Doe',
                details: {
                    role: 'PILOT',
                    shipType: 'MOLE'
                },
                metadata: {
                    ipAddress: '192.168.1.1',
                    previousValue: null,
                    newValue: 'PILOT'
                }
            });

            const entries = testLogger.getAuditLog();
            expect(entries.length).toBe(1);
            
            const entry = entries[0];
            expect(entry.action).toBe(ActivityAuditAction.PARTICIPANT_JOINED);
            expect(entry.activityId).toBe('test-1');
            expect(entry.activityTitle).toBe('Mining Operation');
            expect(entry.activityType).toBe(ActivityType.OPERATION);
            expect(entry.organizationId).toBe('org-123');
            expect(entry.performedById).toBe('user-456');
            expect(entry.performedByName).toBe('John Doe');
            expect(entry.details).toEqual({ role: 'PILOT', shipType: 'MOLE' });
            expect(entry.metadata?.ipAddress).toBe('192.168.1.1');
        });

        it('should handle multiple log entries', () => {
            for (let i = 0; i < 5; i++) {
                testLogger.log({
                    action: ActivityAuditAction.ACTIVITY_CREATED,
                    activityId: `test-${i}`,
                    activityTitle: `Activity ${i}`,
                    activityType: ActivityType.MISSION,
                    organizationId: 'org-1',
                    performedById: 'user-1',
                    performedByName: 'User',
                    details: { index: i }
                });
            }

            expect(testLogger.getEntryCount()).toBe(5);
        });
    });

    describe('getAuditLog() - Filtering', () => {
        beforeEach(() => {
            // Add test entries
            testLogger.log({
                action: ActivityAuditAction.ACTIVITY_CREATED,
                activityId: 'activity-1',
                activityTitle: 'Activity 1',
                activityType: ActivityType.MISSION,
                organizationId: 'org-1',
                performedById: 'user-1',
                performedByName: 'User 1',
                details: {}
            });

            testLogger.log({
                action: ActivityAuditAction.PARTICIPANT_JOINED,
                activityId: 'activity-1',
                activityTitle: 'Activity 1',
                activityType: ActivityType.MISSION,
                organizationId: 'org-1',
                performedById: 'user-2',
                performedByName: 'User 2',
                details: {}
            });

            testLogger.log({
                action: ActivityAuditAction.ACTIVITY_CREATED,
                activityId: 'activity-2',
                activityTitle: 'Activity 2',
                activityType: ActivityType.BOUNTY,
                organizationId: 'org-2',
                performedById: 'user-3',
                performedByName: 'User 3',
                details: {}
            });
        });

        it('should filter by activityId', () => {
            const entries = testLogger.getAuditLog({ activityId: 'activity-1' });
            expect(entries.length).toBe(2);
            entries.forEach(e => expect(e.activityId).toBe('activity-1'));
        });

        it('should filter by organizationId', () => {
            const entries = testLogger.getAuditLog({ organizationId: 'org-2' });
            expect(entries.length).toBe(1);
            expect(entries[0].organizationId).toBe('org-2');
        });

        it('should filter by performedById', () => {
            const entries = testLogger.getAuditLog({ performedById: 'user-2' });
            expect(entries.length).toBe(1);
            expect(entries[0].performedById).toBe('user-2');
        });

        it('should filter by action', () => {
            const entries = testLogger.getAuditLog({ action: ActivityAuditAction.ACTIVITY_CREATED });
            expect(entries.length).toBe(2);
            entries.forEach(e => expect(e.action).toBe(ActivityAuditAction.ACTIVITY_CREATED));
        });

        it('should filter by multiple actions', () => {
            const entries = testLogger.getAuditLog({ 
                actions: [ActivityAuditAction.ACTIVITY_CREATED, ActivityAuditAction.PARTICIPANT_JOINED] 
            });
            expect(entries.length).toBe(3);
        });

        it('should apply limit', () => {
            const entries = testLogger.getAuditLog({ limit: 2 });
            expect(entries.length).toBe(2);
        });

        it('should sort by timestamp descending', () => {
            const entries = testLogger.getAuditLog();
            for (let i = 0; i < entries.length - 1; i++) {
                expect(entries[i].timestamp.getTime()).toBeGreaterThanOrEqual(entries[i + 1].timestamp.getTime());
            }
        });

        it('should combine multiple filters', () => {
            const entries = testLogger.getAuditLog({
                activityId: 'activity-1',
                action: ActivityAuditAction.PARTICIPANT_JOINED
            });
            expect(entries.length).toBe(1);
            expect(entries[0].performedById).toBe('user-2');
        });
    });

    describe('getActivityAuditStats()', () => {
        beforeEach(() => {
            // Add test entries for stats
            testLogger.log({
                action: ActivityAuditAction.ACTIVITY_CREATED,
                activityId: 'activity-1',
                activityTitle: 'Test Activity',
                activityType: ActivityType.MISSION,
                organizationId: 'org-1',
                performedById: 'user-1',
                performedByName: 'User 1',
                details: {}
            });

            testLogger.log({
                action: ActivityAuditAction.PARTICIPANT_JOINED,
                activityId: 'activity-1',
                activityTitle: 'Test Activity',
                activityType: ActivityType.MISSION,
                organizationId: 'org-1',
                performedById: 'user-2',
                performedByName: 'User 2',
                details: {}
            });

            testLogger.log({
                action: ActivityAuditAction.PARTICIPANT_JOINED,
                activityId: 'activity-1',
                activityTitle: 'Test Activity',
                activityType: ActivityType.MISSION,
                organizationId: 'org-1',
                performedById: 'user-3',
                performedByName: 'User 3',
                details: {}
            });
        });

        it('should return correct total events', () => {
            const stats = testLogger.getActivityAuditStats('activity-1');
            expect(stats.totalEvents).toBe(3);
        });

        it('should return correct breakdown by action', () => {
            const stats = testLogger.getActivityAuditStats('activity-1');
            expect(stats.byAction[ActivityAuditAction.ACTIVITY_CREATED]).toBe(1);
            expect(stats.byAction[ActivityAuditAction.PARTICIPANT_JOINED]).toBe(2);
        });

        it('should return correct unique users count', () => {
            const stats = testLogger.getActivityAuditStats('activity-1');
            expect(stats.uniqueUsers).toBe(3);
        });

        it('should return last activity timestamp', () => {
            const stats = testLogger.getActivityAuditStats('activity-1');
            expect(stats.lastActivity).toBeInstanceOf(Date);
        });

        it('should return recent events limited to 10', () => {
            const stats = testLogger.getActivityAuditStats('activity-1');
            expect(stats.recentEvents.length).toBeLessThanOrEqual(10);
        });

        it('should return null lastActivity for non-existent activity', () => {
            const stats = testLogger.getActivityAuditStats('non-existent');
            expect(stats.totalEvents).toBe(0);
            expect(stats.lastActivity).toBeNull();
        });
    });

    describe('getOrganizationAuditStats()', () => {
        beforeEach(() => {
            // Add test entries for org stats
            testLogger.log({
                action: ActivityAuditAction.ACTIVITY_CREATED,
                activityId: 'activity-1',
                activityTitle: 'Activity 1',
                activityType: ActivityType.MISSION,
                organizationId: 'org-1',
                performedById: 'user-1',
                performedByName: 'User 1',
                details: {}
            });

            testLogger.log({
                action: ActivityAuditAction.ACTIVITY_CREATED,
                activityId: 'activity-2',
                activityTitle: 'Activity 2',
                activityType: ActivityType.BOUNTY,
                organizationId: 'org-1',
                performedById: 'user-2',
                performedByName: 'User 2',
                details: {}
            });
        });

        it('should return correct total events for org', () => {
            const stats = testLogger.getOrganizationAuditStats('org-1');
            expect(stats.totalEvents).toBe(2);
        });

        it('should return correct active activities count', () => {
            const stats = testLogger.getOrganizationAuditStats('org-1');
            expect(stats.activeActivities).toBe(2);
        });

        it('should return correct unique users count', () => {
            const stats = testLogger.getOrganizationAuditStats('org-1');
            expect(stats.uniqueUsers).toBe(2);
        });

        it('should return time range', () => {
            const stats = testLogger.getOrganizationAuditStats('org-1');
            expect(stats.timeRange.earliest).toBeInstanceOf(Date);
            expect(stats.timeRange.latest).toBeInstanceOf(Date);
        });
    });

    describe('Audit Actions Coverage', () => {
        it('should support all activity lifecycle actions', () => {
            const lifecycleActions = [
                ActivityAuditAction.ACTIVITY_CREATED,
                ActivityAuditAction.ACTIVITY_UPDATED,
                ActivityAuditAction.ACTIVITY_DELETED,
                ActivityAuditAction.ACTIVITY_STATUS_CHANGED,
                ActivityAuditAction.ACTIVITY_STARTED,
                ActivityAuditAction.ACTIVITY_COMPLETED,
                ActivityAuditAction.ACTIVITY_CANCELLED,
                ActivityAuditAction.ACTIVITY_RESCHEDULED
            ];

            lifecycleActions.forEach(action => {
                testLogger.log({
                    action,
                    activityId: 'test',
                    activityTitle: 'Test',
                    activityType: ActivityType.MISSION,
                    organizationId: 'org-1',
                    performedById: 'user-1',
                    performedByName: 'User',
                    details: {}
                });
            });

            expect(testLogger.getEntryCount()).toBe(lifecycleActions.length);
        });

        it('should support all participant actions', () => {
            const participantActions = [
                ActivityAuditAction.PARTICIPANT_JOINED,
                ActivityAuditAction.PARTICIPANT_LEFT,
                ActivityAuditAction.PARTICIPANT_REMOVED,
                ActivityAuditAction.PARTICIPANT_ROLE_CHANGED
            ];

            participantActions.forEach(action => {
                testLogger.log({
                    action,
                    activityId: 'test',
                    activityTitle: 'Test',
                    activityType: ActivityType.MISSION,
                    organizationId: 'org-1',
                    performedById: 'user-1',
                    performedByName: 'User',
                    details: {}
                });
            });

            expect(testLogger.getEntryCount()).toBe(participantActions.length);
        });

        it('should support all ship/crew actions', () => {
            const shipActions = [
                ActivityAuditAction.SHIP_ASSIGNED,
                ActivityAuditAction.SHIP_UNASSIGNED,
                ActivityAuditAction.CREW_JOINED,
                ActivityAuditAction.CREW_LEFT
            ];

            shipActions.forEach(action => {
                testLogger.log({
                    action,
                    activityId: 'test',
                    activityTitle: 'Test',
                    activityType: ActivityType.MISSION,
                    organizationId: 'org-1',
                    performedById: 'user-1',
                    performedByName: 'User',
                    details: {}
                });
            });

            expect(testLogger.getEntryCount()).toBe(shipActions.length);
        });

        it('should support all application/job actions', () => {
            const applicationActions = [
                ActivityAuditAction.APPLICATION_SUBMITTED,
                ActivityAuditAction.APPLICATION_REVIEWED,
                ActivityAuditAction.APPLICATION_ACCEPTED,
                ActivityAuditAction.APPLICATION_REJECTED,
                ActivityAuditAction.CONTRACTOR_SCREENED,
                ActivityAuditAction.BOUNTY_STATUS_UPDATED
            ];

            applicationActions.forEach(action => {
                testLogger.log({
                    action,
                    activityId: 'test',
                    activityTitle: 'Test',
                    activityType: ActivityType.BOUNTY,
                    organizationId: 'org-1',
                    performedById: 'user-1',
                    performedByName: 'User',
                    details: {}
                });
            });

            expect(testLogger.getEntryCount()).toBe(applicationActions.length);
        });

        it('should support all organization actions', () => {
            const orgActions = [
                ActivityAuditAction.ORG_INVITED,
                ActivityAuditAction.ORG_INVITE_ACCEPTED,
                ActivityAuditAction.ORG_INVITE_DECLINED,
                ActivityAuditAction.ORG_JOINED,
                ActivityAuditAction.ORG_LEFT
            ];

            orgActions.forEach(action => {
                testLogger.log({
                    action,
                    activityId: 'test',
                    activityTitle: 'Test',
                    activityType: ActivityType.MISSION,
                    organizationId: 'org-1',
                    performedById: 'user-1',
                    performedByName: 'User',
                    details: {}
                });
            });

            expect(testLogger.getEntryCount()).toBe(orgActions.length);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty audit log', () => {
            const entries = testLogger.getAuditLog();
            expect(entries).toEqual([]);
            expect(testLogger.getEntryCount()).toBe(0);
        });

        it('should handle date range filtering', () => {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

            testLogger.log({
                action: ActivityAuditAction.ACTIVITY_CREATED,
                activityId: 'test',
                activityTitle: 'Test',
                activityType: ActivityType.MISSION,
                organizationId: 'org-1',
                performedById: 'user-1',
                performedByName: 'User',
                details: {}
            });

            const entries = testLogger.getAuditLog({
                startDate: oneHourAgo,
                endDate: new Date(now.getTime() + 1000)
            });

            expect(entries.length).toBe(1);

            const noEntries = testLogger.getAuditLog({
                startDate: twoHoursAgo,
                endDate: oneHourAgo
            });

            expect(noEntries.length).toBe(0);
        });
    });
});

describe('activityAuditLogger singleton export', () => {
    it('should be an instance of ActivityAuditLogger', () => {
        expect(activityAuditLogger).toBeInstanceOf(ActivityAuditLogger);
    });

    it('should be the same instance as getInstance()', () => {
        expect(activityAuditLogger).toBe(ActivityAuditLogger.getInstance());
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
