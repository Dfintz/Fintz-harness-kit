import { Repository, Between, In, DeleteResult } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { UserActivity, ActivityAction } from '../../models/UserActivity';
import { UserActivityService, ActivityLogPayload } from '../../services/user';

// Mock dependencies
jest.mock('../../config/database');

describe('UserActivityService', () => {
    let service: UserActivityService;
    let mockActivityRepository: jest.Mocked<Repository<UserActivity>>;

    afterAll(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock activity repository
        mockActivityRepository = {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
        } as any;

        (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockActivityRepository);

        service = new UserActivityService();
    });

    describe('logActivity', () => {
        it('should log a user activity with all fields', async () => {
            const payload: ActivityLogPayload = {
                userId: 'user-123',
                action: ActivityAction.LOGIN,
                resource: '/api/auth/login',
                method: 'POST',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0',
                metadata: { deviceType: 'desktop' },
                statusCode: 200,
                duration: 150,
            };

            const mockActivity = { id: 'activity-1', ...payload };

            mockActivityRepository.create.mockReturnValue(mockActivity as any);
            mockActivityRepository.save.mockResolvedValue(mockActivity as any);

            const result = await service.logActivity(payload);

            expect(mockActivityRepository.create).toHaveBeenCalledWith(payload);
            expect(mockActivityRepository.save).toHaveBeenCalledWith(mockActivity);
            expect(result).toEqual(mockActivity);
        });

        it('should log activity with minimal fields', async () => {
            const payload: ActivityLogPayload = {
                userId: 'user-123',
                action: 'VIEW_DASHBOARD',
            };

            const mockActivity = { id: 'activity-1', ...payload };

            mockActivityRepository.create.mockReturnValue(mockActivity as any);
            mockActivityRepository.save.mockResolvedValue(mockActivity as any);

            const result = await service.logActivity(payload);

            expect(result).toEqual(mockActivity);
        });
    });

    describe('logActivitiesBatch', () => {
        it('should batch log multiple activities', async () => {
            const payloads: ActivityLogPayload[] = [
                { userId: 'user-1', action: ActivityAction.LOGIN },
                { userId: 'user-2', action: ActivityAction.LOGOUT },
                { userId: 'user-3', action: 'VIEW_PROFILE' },
            ];

            const mockActivities = payloads.map((p, i) => ({ id: `activity-${i}`, ...p }));

            mockActivityRepository.create.mockImplementation((data) => data as any);
            mockActivityRepository.save.mockResolvedValue(mockActivities as any);

            const result = await service.logActivitiesBatch(payloads);

            expect(mockActivityRepository.create).toHaveBeenCalledTimes(3);
            expect(mockActivityRepository.save).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ userId: 'user-1' }),
                    expect.objectContaining({ userId: 'user-2' }),
                    expect.objectContaining({ userId: 'user-3' }),
                ])
            );
            expect(result).toEqual(mockActivities);
        });

        it('should handle empty batch', async () => {
            mockActivityRepository.save.mockResolvedValue([] as any);

            const result = await service.logActivitiesBatch([]);

            expect(mockActivityRepository.save).toHaveBeenCalledWith([]);
            expect(result).toEqual([]);
        });
    });

    describe('getUserActivities', () => {
        it('should get paginated user activities with default pagination', async () => {
            const mockActivities = [
                { id: '1', userId: 'user-123', action: 'LOGIN', timestamp: new Date() },
                { id: '2', userId: 'user-123', action: 'VIEW_DASHBOARD', timestamp: new Date() },
            ];

            mockActivityRepository.findAndCount.mockResolvedValue([mockActivities, 2] as any);

            const result = await service.getUserActivities('user-123');

            expect(mockActivityRepository.findAndCount).toHaveBeenCalledWith({
                where: { userId: 'user-123' },
                order: { timestamp: 'DESC' },
                take: 50,
                skip: 0,
            });
            expect(result).toEqual({
                activities: mockActivities,
                total: 2,
                page: 1,
                limit: 50,
            });
        });

        it('should get paginated user activities with custom pagination', async () => {
            const mockActivities = [{ id: '1', userId: 'user-123' }];

            mockActivityRepository.findAndCount.mockResolvedValue([mockActivities, 100] as any);

            const result = await service.getUserActivities('user-123', undefined, { page: 3, limit: 20 });

            expect(mockActivityRepository.findAndCount).toHaveBeenCalledWith({
                where: { userId: 'user-123' },
                order: { timestamp: 'DESC' },
                take: 20,
                skip: 40, // (3-1) * 20
            });
            expect(result.page).toBe(3);
            expect(result.limit).toBe(20);
        });

        it('should filter user activities by action', async () => {
            mockActivityRepository.findAndCount.mockResolvedValue([[], 0] as any);

            await service.getUserActivities('user-123', { action: ActivityAction.LOGIN });

            expect(mockActivityRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-123', action: ActivityAction.LOGIN },
                })
            );
        });

        it('should filter by date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            mockActivityRepository.findAndCount.mockResolvedValue([[], 0] as any);

            await service.getUserActivities('user-123', { startDate, endDate });

            expect(mockActivityRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        userId: 'user-123',
                        timestamp: Between(startDate, endDate),
                    },
                })
            );
        });
    });

    describe('getRecentActivities', () => {
        it('should get recent activities with default limit', async () => {
            const mockActivities = [
                { id: '1', action: 'LOGIN', timestamp: new Date() },
                { id: '2', action: 'LOGOUT', timestamp: new Date() },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.getRecentActivities();

            expect(mockActivityRepository.find).toHaveBeenCalledWith({
                where: {},
                order: { timestamp: 'DESC' },
                take: 100,
                relations: ['user'],
            });
            expect(result).toEqual(mockActivities);
        });

        it('should get recent activities with custom limit', async () => {
            mockActivityRepository.find.mockResolvedValue([] as any);

            await service.getRecentActivities(50);

            expect(mockActivityRepository.find).toHaveBeenCalledWith(
                expect.objectContaining({ take: 50 })
            );
        });

        it('should filter recent activities', async () => {
            mockActivityRepository.find.mockResolvedValue([] as any);

            await service.getRecentActivities(100, { action: ActivityAction.LOGIN, resource: '/api/auth' });

            expect(mockActivityRepository.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { action: ActivityAction.LOGIN, resource: '/api/auth' },
                })
            );
        });
    });

    describe('getActivitiesByAction', () => {
        it('should get activities by single action', async () => {
            const mockActivities = [{ id: '1', action: ActivityAction.LOGIN }];

            mockActivityRepository.findAndCount.mockResolvedValue([mockActivities, 1] as any);

            const result = await service.getActivitiesByAction(ActivityAction.LOGIN);

            expect(mockActivityRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { action: ActivityAction.LOGIN },
                })
            );
            expect(result.activities).toEqual(mockActivities);
        });

        it('should get activities by multiple actions', async () => {
            const actions = [ActivityAction.LOGIN, ActivityAction.LOGOUT];

            mockActivityRepository.findAndCount.mockResolvedValue([[], 0] as any);

            await service.getActivitiesByAction(actions);

            expect(mockActivityRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { action: In(actions) },
                })
            );
        });

        it('should paginate activities by action', async () => {
            mockActivityRepository.findAndCount.mockResolvedValue([[], 50] as any);

            const result = await service.getActivitiesByAction('CUSTOM_ACTION', { page: 2, limit: 25 });

            expect(result.page).toBe(2);
            expect(result.limit).toBe(25);
        });
    });

    describe('searchActivities', () => {
        it('should search with multiple filters', async () => {
            const filters = {
                userId: 'user-123',
                action: ActivityAction.LOGIN,
                method: 'POST',
                statusCode: 200,
            };

            mockActivityRepository.findAndCount.mockResolvedValue([[], 0] as any);

            await service.searchActivities(filters);

            expect(mockActivityRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: filters,
                })
            );
        });

        it('should search with pagination', async () => {
            mockActivityRepository.findAndCount.mockResolvedValue([[], 0] as any);

            await service.searchActivities({}, { page: 5, limit: 10 });

            expect(mockActivityRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 10,
                    skip: 40,
                })
            );
        });
    });

    describe('getUserActivityCount', () => {
        it('should count user activities', async () => {
            mockActivityRepository.count.mockResolvedValue(42);

            const result = await service.getUserActivityCount('user-123');

            expect(mockActivityRepository.count).toHaveBeenCalledWith({
                where: { userId: 'user-123' },
            });
            expect(result).toBe(42);
        });

        it('should count with filters', async () => {
            mockActivityRepository.count.mockResolvedValue(10);

            const result = await service.getUserActivityCount('user-123', {
                action: ActivityAction.LOGIN,
                statusCode: 200,
            });

            expect(mockActivityRepository.count).toHaveBeenCalledWith({
                where: { userId: 'user-123', action: ActivityAction.LOGIN, statusCode: 200 },
            });
            expect(result).toBe(10);
        });
    });

    describe('getUserActivityStats', () => {
        it('should calculate user activity statistics', async () => {
            const now = new Date();
            const mockActivities = [
                { id: '1', action: ActivityAction.LOGIN, timestamp: now },
                { id: '2', action: ActivityAction.LOGIN, timestamp: now },
                { id: '3', action: ActivityAction.LOGIN_FAILED, timestamp: now },
                { id: '4', action: 'VIEW_DASHBOARD', timestamp: now },
                { id: '5', action: 'VIEW_DASHBOARD', timestamp: now },
                { id: '6', action: 'EDIT_PROFILE', timestamp: now },
            ];

            mockActivityRepository.findAndCount.mockResolvedValue([mockActivities, 6] as any);

            const result = await service.getUserActivityStats('user-123', 30);

            expect(result.totalActivities).toBe(6);
            expect(result.loginCount).toBe(2);
            expect(result.failedLoginCount).toBe(1);
            expect(result.recentActivity).toBeInstanceOf(Date);
            expect(result.mostCommonActions).toHaveLength(4);
            expect(result.mostCommonActions).toEqual(
                expect.arrayContaining([
                    { action: 'VIEW_DASHBOARD', count: 2 },
                    { action: 'auth.login', count: 2 },
                    { action: 'auth.login_failed', count: 1 },
                    { action: 'EDIT_PROFILE', count: 1 },
                ])
            );
        });

        it('should return null recent activity for users with no activities', async () => {
            mockActivityRepository.findAndCount.mockResolvedValue([[], 0] as any);

            const result = await service.getUserActivityStats('user-123');

            expect(result).toEqual({
                totalActivities: 0,
                loginCount: 0,
                failedLoginCount: 0,
                mostCommonActions: [],
                recentActivity: null,
            });
        });

        it('should use custom days parameter', async () => {
            mockActivityRepository.findAndCount.mockResolvedValue([[], 0] as any);

            await service.getUserActivityStats('user-123', 7);

            expect(mockActivityRepository.findAndCount).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: 'user-123',
                        timestamp: expect.any(Object),
                    }),
                })
            );
        });
    });

    describe('getGlobalActivityStats', () => {
        it('should calculate global activity statistics', async () => {
            const mockActivities = [
                { id: '1', userId: 'user-1', action: ActivityAction.LOGIN },
                { id: '2', userId: 'user-2', action: ActivityAction.LOGIN },
                { id: '3', userId: 'user-1', action: ActivityAction.LOGIN_FAILED },
                { id: '4', userId: 'user-3', action: 'VIEW_DASHBOARD' },
                { id: '5', userId: 'user-1', action: 'VIEW_DASHBOARD' },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.getGlobalActivityStats(7);

            expect(result).toEqual({
                totalActivities: 5,
                uniqueUsers: 3,
                topActions: [
                    { action: ActivityAction.LOGIN, count: 2 },
                    { action: 'VIEW_DASHBOARD', count: 2 },
                    { action: ActivityAction.LOGIN_FAILED, count: 1 },
                ],
                failedLogins: 1,
                successfulLogins: 2,
            });
        });

        it('should handle empty global statistics', async () => {
            mockActivityRepository.find.mockResolvedValue([]);

            const result = await service.getGlobalActivityStats();

            expect(result).toEqual({
                totalActivities: 0,
                uniqueUsers: 0,
                topActions: [],
                failedLogins: 0,
                successfulLogins: 0,
            });
        });

        it('should use custom days parameter', async () => {
            mockActivityRepository.find.mockResolvedValue([]);

            await service.getGlobalActivityStats(14);

            expect(mockActivityRepository.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        timestamp: expect.any(Object),
                    }),
                })
            );
        });
    });

    describe('detectSuspiciousActivity', () => {
        it('should detect multiple failed login attempts', async () => {
            const mockActivities = [
                { id: '1', action: ActivityAction.LOGIN_FAILED, timestamp: new Date() },
                { id: '2', action: ActivityAction.LOGIN_FAILED, timestamp: new Date() },
                { id: '3', action: ActivityAction.LOGIN_FAILED, timestamp: new Date() },
                { id: '4', action: ActivityAction.LOGIN_FAILED, timestamp: new Date() },
                { id: '5', action: ActivityAction.LOGIN_FAILED, timestamp: new Date() },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.detectSuspiciousActivity('user-123', 24);

            expect(result.isSuspicious).toBe(true);
            expect(result.indicators).toContain('5 failed login attempts in the last 24 hours');
        });

        it('should detect logins from multiple IP addresses', async () => {
            const mockActivities = [
                { id: '1', action: ActivityAction.LOGIN, ipAddress: '1.1.1.1', timestamp: new Date() },
                { id: '2', action: ActivityAction.LOGIN, ipAddress: '2.2.2.2', timestamp: new Date() },
                { id: '3', action: ActivityAction.LOGIN, ipAddress: '3.3.3.3', timestamp: new Date() },
                { id: '4', action: ActivityAction.LOGIN, ipAddress: '4.4.4.4', timestamp: new Date() },
                { id: '5', action: ActivityAction.LOGIN, ipAddress: '5.5.5.5', timestamp: new Date() },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.detectSuspiciousActivity('user-123');

            expect(result.isSuspicious).toBe(true);
            expect(result.indicators).toContain('Logins from 5 different IP addresses');
        });

        it('should detect high-frequency activity (potential bot)', async () => {
            const now = Date.now();
            const mockActivities = Array.from({ length: 10 }, (_, i) => ({
                id: `${i}`,
                action: 'VIEW_PAGE',
                timestamp: new Date(now - i * 1000), // 1 second apart = 10 seconds total
            }));

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.detectSuspiciousActivity('user-123');

            expect(result.isSuspicious).toBe(true);
            expect(result.indicators).toContain('Unusual high-frequency activity detected');
        });

        it('should detect multiple suspicious indicators', async () => {
            const now = Date.now();
            const mockActivities = [
                ...Array.from({ length: 5 }, (_, i) => ({
                    id: `failed-${i}`,
                    action: ActivityAction.LOGIN_FAILED,
                    timestamp: new Date(now - i * 1000),
                })),
                ...Array.from({ length: 5 }, (_, i) => ({
                    id: `login-${i}`,
                    action: ActivityAction.LOGIN,
                    ipAddress: `${i}.${i}.${i}.${i}`,
                    timestamp: new Date(now - i * 100),
                })),
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.detectSuspiciousActivity('user-123');

            expect(result.isSuspicious).toBe(true);
            expect(result.indicators.length).toBeGreaterThan(1);
        });

        it('should return not suspicious for normal activity', async () => {
            const mockActivities = [
                { id: '1', action: ActivityAction.LOGIN, ipAddress: '1.1.1.1', timestamp: new Date() },
                { id: '2', action: 'VIEW_DASHBOARD', ipAddress: '1.1.1.1', timestamp: new Date() },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.detectSuspiciousActivity('user-123');

            expect(result.isSuspicious).toBe(false);
            expect(result.indicators).toHaveLength(0);
        });
    });

    describe('cleanupOldActivities', () => {
        it('should delete old activities with default retention', async () => {
            const mockQueryBuilder = {
                delete: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: 150 } as DeleteResult),
            };

            mockActivityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.cleanupOldActivities();

            expect(mockQueryBuilder.delete).toHaveBeenCalled();
            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'timestamp < :cutoffDate',
                expect.objectContaining({ cutoffDate: expect.any(Date) })
            );
            expect(result).toBe(150);
        });

        it('should delete old activities with custom retention', async () => {
            const mockQueryBuilder = {
                delete: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: 50 } as DeleteResult),
            };

            mockActivityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.cleanupOldActivities(30);

            expect(result).toBe(50);
        });

        it('should return 0 when no activities deleted', async () => {
            const mockQueryBuilder = {
                delete: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: undefined } as DeleteResult),
            };

            mockActivityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.cleanupOldActivities();

            expect(result).toBe(0);
        });
    });

    describe('getUserActivityTimeline', () => {
        it('should return timeline with enriched events', async () => {
            const now = new Date();
            const mockActivities = [
                { id: '1', action: ActivityAction.LOGIN, timestamp: now, userId: 'user-123' },
                { id: '2', action: ActivityAction.PROFILE_UPDATED, timestamp: new Date(now.getTime() - 3600000), userId: 'user-123' },
                { id: '3', action: ActivityAction.ORG_JOINED, timestamp: new Date(now.getTime() - 86400000), userId: 'user-123' },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.getUserActivityTimeline('user-123', 30, 50);

            expect(result.timeline).toHaveLength(3);
            expect(result.timeline[0]).toEqual(expect.objectContaining({
                id: '1',
                type: 'action',
                category: 'authentication',
                title: 'Logged in',
                icon: '🔐',
                importance: 'low'
            }));
            expect(result.summary.totalEvents).toBe(3);
            expect(result.summary.byCategory).toBeDefined();
        });

        it('should respect the limit parameter', async () => {
            const mockActivities = Array.from({ length: 20 }, (_, i) => ({
                id: `${i}`,
                action: ActivityAction.LOGIN,
                timestamp: new Date(),
                userId: 'user-123'
            }));

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.getUserActivityTimeline('user-123', 30, 5);

            expect(result.timeline.length).toBeLessThanOrEqual(5);
        });

        it('should calculate activity streak correctly', async () => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const twoDaysAgo = new Date(today);
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

            const mockActivities = [
                { id: '1', action: ActivityAction.LOGIN, timestamp: today, userId: 'user-123' },
                { id: '2', action: ActivityAction.LOGIN, timestamp: yesterday, userId: 'user-123' },
                { id: '3', action: ActivityAction.LOGIN, timestamp: twoDaysAgo, userId: 'user-123' },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.getUserActivityTimeline('user-123', 30, 50);

            expect(result.summary.streak).toBe(3);
        });

        it('should return empty timeline for user with no activities', async () => {
            mockActivityRepository.find.mockResolvedValue([]);

            const result = await service.getUserActivityTimeline('user-123', 30, 50);

            expect(result.timeline).toHaveLength(0);
            expect(result.summary.totalEvents).toBe(0);
            expect(result.summary.firstActivity).toBeNull();
            expect(result.summary.lastActivity).toBeNull();
            expect(result.summary.streak).toBe(0);
        });

        it('should map unknown actions with generic format', async () => {
            const mockActivities = [
                { id: '1', action: 'CUSTOM_UNKNOWN_ACTION', timestamp: new Date(), userId: 'user-123', resource: '/api/custom' },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.getUserActivityTimeline('user-123', 30, 50);

            expect(result.timeline[0]).toEqual(expect.objectContaining({
                category: 'general',
                title: 'Custom unknown action',
                icon: '📌',
                importance: 'low'
            }));
        });
    });

    describe('getActivityHeatmap', () => {
        it('should return daily activity counts', async () => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const mockActivities = [
                { timestamp: today },
                { timestamp: today },
                { timestamp: today },
                { timestamp: yesterday },
                { timestamp: yesterday },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.getActivityHeatmap('user-123', 12);

            expect(result.length).toBe(2);
            expect(result.find(d => d.date === today.toISOString().split('T')[0])?.count).toBe(3);
            expect(result.find(d => d.date === yesterday.toISOString().split('T')[0])?.count).toBe(2);
        });

        it('should return sorted dates', async () => {
            const today = new Date();
            const twoDaysAgo = new Date(today);
            twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const mockActivities = [
                { timestamp: today },
                { timestamp: twoDaysAgo },
                { timestamp: yesterday },
            ];

            mockActivityRepository.find.mockResolvedValue(mockActivities as any);

            const result = await service.getActivityHeatmap('user-123', 12);

            const dates = result.map(d => d.date);
            const sortedDates = [...dates].sort();
            expect(dates).toEqual(sortedDates);
        });

        it('should return empty array for user with no activities', async () => {
            mockActivityRepository.find.mockResolvedValue([]);

            const result = await service.getActivityHeatmap('user-123', 12);

            expect(result).toHaveLength(0);
        });

        it('should query with correct time range', async () => {
            mockActivityRepository.find.mockResolvedValue([]);

            await service.getActivityHeatmap('user-123', 6);

            expect(mockActivityRepository.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: 'user-123',
                        timestamp: expect.any(Object)
                    }),
                    select: ['timestamp']
                })
            );
        });
    });
});
