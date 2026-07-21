import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { RelationshipHistory, ChangeType, InteractionSentiment } from '../../models/RelationshipHistory';
import { RelationshipService } from '../../services/social';

jest.mock('../../data-source');

/**
 * RelationshipHistoryService functionality is now consolidated into RelationshipService.
 * These tests verify the history-related methods on RelationshipService.
 */
describe('RelationshipHistoryService (via RelationshipService)', () => {
    let service: RelationshipService;
    let mockRelationshipRepository: any;
    let mockHistoryRepository: any;

    beforeEach(() => {
        mockRelationshipRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn()
        };

        mockHistoryRepository = {
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn()
        };

        // Create service with both repositories
        service = new RelationshipService(mockRelationshipRepository, mockHistoryRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createHistoryEntry', () => {
        it('should create a history entry with all params', async () => {
            const params = {
                relationshipId: 'rel-123',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                changeType: 'STATUS_CHANGED' as ChangeType,
                description: 'Changed to allied',
                previousValue: 'NEUTRAL',
                newValue: 'ALLIED',
                changeDetails: { reason: 'treaty signed' },
                actorId: 'user-1',
                actorName: 'Admiral Smith',
                actorRole: 'Diplomat',
                reason: 'Diplomatic success',
                notes: 'Historic moment',
                tags: ['diplomatic', 'alliance'],
                metadata: { importance: 'high' },
                isSystemGenerated: false,
                isSignificant: true,
                requiresNotification: true
            };

            const mockEntry = { id: 'hist-1', ...params };
            mockHistoryRepository.create.mockReturnValue(mockEntry);
            mockHistoryRepository.save.mockResolvedValue(mockEntry);

            const result = await service.createHistoryEntry(params);

            expect(mockHistoryRepository.create).toHaveBeenCalledWith(params);
            expect(mockHistoryRepository.save).toHaveBeenCalledWith(mockEntry);
            expect(result).toEqual(mockEntry);
        });

        it('should set defaults for optional boolean flags', async () => {
            const params = {
                relationshipId: 'rel-123',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                changeType: 'INTERACTION_RECORDED' as ChangeType,
                description: 'Trade interaction'
            };

            const mockEntry = { id: 'hist-1' };
            mockHistoryRepository.create.mockReturnValue(mockEntry);
            mockHistoryRepository.save.mockResolvedValue(mockEntry);

            await service.createHistoryEntry(params);

            expect(mockHistoryRepository.create).toHaveBeenCalledWith({
                ...params,
                isSystemGenerated: false,
                isSignificant: false,
                requiresNotification: false
            });
        });
    });

    describe('getRelationshipHistory', () => {
        it('should get all history for a relationship', async () => {
            const mockHistory = [
                { id: 'h1', relationshipId: 'rel-1' },
                { id: 'h2', relationshipId: 'rel-1' }
            ] as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getRelationshipHistory('rel-1');

            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'history.relationshipId = :relationshipId',
                { relationshipId: 'rel-1' }
            );
            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('history.createdAt', 'DESC');
            expect(result).toEqual(mockHistory);
        });

        it('should filter by change types', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            await service.getRelationshipHistory('rel-1', {
                changeTypes: ['STATUS_CHANGED' as ChangeType, 'TRUST_UPDATED' as ChangeType]
            });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'history.changeType IN (:...changeTypes)',
                { changeTypes: ['STATUS_CHANGED', 'TRUST_UPDATED'] }
            );
        });

        it('should filter by actorId', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            await service.getRelationshipHistory('rel-1', { actorId: 'user-123' });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'history.actorId = :actorId',
                { actorId: 'user-123' }
            );
        });

        it('should filter by date range', async () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-12-31');

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            await service.getRelationshipHistory('rel-1', { startDate, endDate });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'history.createdAt >= :startDate',
                { startDate }
            );
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'history.createdAt <= :endDate',
                { endDate }
            );
        });

        it('should filter by isSignificant', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            await service.getRelationshipHistory('rel-1', { isSignificant: true });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'history.isSignificant = :isSignificant',
                { isSignificant: true }
            );
        });

        it('should apply limit and offset', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            await service.getRelationshipHistory('rel-1', { limit: 10, offset: 5 });

            expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
            expect(mockQueryBuilder.skip).toHaveBeenCalledWith(5);
        });

        it('should filter for only positive changes', async () => {
            const mockHistory = [
                { id: 'h1', isPositiveChange: () => true },
                { id: 'h2', isPositiveChange: () => false },
                { id: 'h3', isPositiveChange: () => true }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getRelationshipHistory('rel-1', { onlyPositive: true });

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('h1');
            expect(result[1].id).toBe('h3');
        });

        it('should filter for only negative changes', async () => {
            const mockHistory = [
                { id: 'h1', isNegativeChange: () => false },
                { id: 'h2', isNegativeChange: () => true },
                { id: 'h3', isNegativeChange: () => false }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getRelationshipHistory('rel-1', { onlyNegative: true });

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('h2');
        });
    });

    describe('getOrganizationHistory', () => {
        it('should get history where organization is source or target', async () => {
            const mockHistory = [{ id: 'h1' }] as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                orWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getOrganizationHistory('org-1');

            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'history.organizationId = :organizationId',
                { organizationId: 'org-1' }
            );
            expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
                'history.targetOrganizationId = :organizationId',
                { organizationId: 'org-1' }
            );
            expect(result).toEqual(mockHistory);
        });

        it('should respect limit parameter', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                orWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            await service.getOrganizationHistory('org-1', { limit: 20 });

            expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
        });
    });

    describe('getRelationshipTimeline', () => {
        it('should transform history into timeline format', async () => {
            const mockHistory = [
                {
                    id: 'h1',
                    createdAt: new Date('2024-01-15'),
                    changeType: 'STATUS_CHANGED' as ChangeType,
                    actorName: 'Admiral Smith',
                    description: 'Changed to allied',
                    getChangeSummary: () => 'Status changed to ALLIED',
                    getImpactLevel: () => 'high' as const,
                    getSentimentScore: () => 0.8
                },
                {
                    id: 'h2',
                    createdAt: new Date('2024-01-10'),
                    changeType: 'INTERACTION_RECORDED' as ChangeType,
                    actorName: null,
                    description: 'Trade completed',
                    getChangeSummary: () => 'Trade interaction',
                    getImpactLevel: () => 'low' as const,
                    getSentimentScore: () => 0.2
                }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getRelationshipTimeline('rel-1');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                date: new Date('2024-01-15'),
                type: 'STATUS_CHANGED',
                summary: 'Status changed to ALLIED',
                impact: 'high',
                sentiment: 0.8,
                actor: 'Admiral Smith',
                details: 'Changed to allied'
            });
            expect(result[1]).toEqual({
                date: new Date('2024-01-10'),
                type: 'INTERACTION_RECORDED',
                summary: 'Trade interaction',
                impact: 'low',
                sentiment: 0.2,
                actor: 'System',
                details: 'Trade completed'
            });
        });

        it('should only fetch significant changes with limit 100', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            await service.getRelationshipTimeline('rel-1');

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'history.isSignificant = :isSignificant',
                { isSignificant: true }
            );
            expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
        });
    });

    describe('analyzeRelationshipHistory', () => {
        it('should analyze empty history', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.analyzeRelationshipHistory('rel-1', 30);

            expect(result).toEqual({
                totalChanges: 0,
                positiveChanges: 0,
                negativeChanges: 0,
                neutralChanges: 0,
                averageSentiment: 0,
                changesByType: {},
                recentTrend: 'stable',
                significantChanges: 0
            });
        });

        it('should calculate comprehensive analytics', async () => {
            const mockHistory = [
                {
                    id: 'h1',
                    changeType: 'STATUS_CHANGED' as ChangeType,
                    isSignificant: true,
                    actorId: 'user-1',
                    actorName: 'Admiral Smith',
                    isPositiveChange: () => true,
                    isNegativeChange: () => false,
                    getSentimentScore: () => 0.8
                },
                {
                    id: 'h2',
                    changeType: 'TRUST_UPDATED' as ChangeType,
                    isSignificant: false,
                    actorId: 'user-1',
                    actorName: 'Admiral Smith',
                    isPositiveChange: () => true,
                    isNegativeChange: () => false,
                    getSentimentScore: () => 0.6
                },
                {
                    id: 'h3',
                    changeType: 'INTERACTION_RECORDED' as ChangeType,
                    isSignificant: false,
                    actorId: 'user-2',
                    actorName: 'Captain Jones',
                    isPositiveChange: () => false,
                    isNegativeChange: () => true,
                    getSentimentScore: () => -0.5
                },
                {
                    id: 'h4',
                    changeType: 'STATUS_CHANGED' as ChangeType,
                    isSignificant: true,
                    actorId: null,
                    actorName: null,
                    isPositiveChange: () => false,
                    isNegativeChange: () => false,
                    getSentimentScore: () => 0
                }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.analyzeRelationshipHistory('rel-1', 30);

            expect(result.totalChanges).toBe(4);
            expect(result.positiveChanges).toBe(2);
            expect(result.negativeChanges).toBe(1);
            expect(result.neutralChanges).toBe(1);
            expect(result.averageSentiment).toBeCloseTo(0.225, 2); // (0.8 + 0.6 - 0.5 + 0) / 4
            expect(result.changesByType).toEqual({
                'STATUS_CHANGED': 2,
                'TRUST_UPDATED': 1,
                'INTERACTION_RECORDED': 1
            });
            expect(result.significantChanges).toBe(2);
            expect(result.mostActiveActor).toEqual({
                id: 'user-1',
                name: 'Admiral Smith',
                changeCount: 2
            });
        });

        it('should detect improving trend from recent changes', async () => {
            const mockHistory = [
                { id: 'h1', getSentimentScore: () => 0.9, isPositiveChange: () => true, isNegativeChange: () => false },
                { id: 'h2', getSentimentScore: () => 0.8, isPositiveChange: () => true, isNegativeChange: () => false },
                { id: 'h3', getSentimentScore: () => 0.7, isPositiveChange: () => true, isNegativeChange: () => false },
                { id: 'h4', getSentimentScore: () => 0.6, isPositiveChange: () => true, isNegativeChange: () => false },
                { id: 'h5', getSentimentScore: () => 0.5, isPositiveChange: () => true, isNegativeChange: () => false },
                { id: 'h6', getSentimentScore: () => 0.1, isPositiveChange: () => true, isNegativeChange: () => false }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.analyzeRelationshipHistory('rel-1');

            expect(result.recentTrend).toBe('improving'); // First 5 average > 0.5
        });

        it('should detect declining trend from recent changes', async () => {
            const mockHistory = [
                { id: 'h1', getSentimentScore: () => -0.9, isPositiveChange: () => false, isNegativeChange: () => true },
                { id: 'h2', getSentimentScore: () => -0.8, isPositiveChange: () => false, isNegativeChange: () => true },
                { id: 'h3', getSentimentScore: () => -0.7, isPositiveChange: () => false, isNegativeChange: () => true },
                { id: 'h4', getSentimentScore: () => -0.6, isPositiveChange: () => false, isNegativeChange: () => true },
                { id: 'h5', getSentimentScore: () => -0.5, isPositiveChange: () => false, isNegativeChange: () => true },
                { id: 'h6', getSentimentScore: () => 0.8, isPositiveChange: () => true, isNegativeChange: () => false }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.analyzeRelationshipHistory('rel-1');

            expect(result.recentTrend).toBe('declining'); // First 5 average < -0.5
        });
    });

    describe('getSentimentTrend', () => {
        it('should group by day and calculate average sentiment', async () => {
            const mockHistory = [
                {
                    id: 'h1',
                    createdAt: new Date('2024-01-15T10:00:00'),
                    getSentimentScore: () => 0.8
                },
                {
                    id: 'h2',
                    createdAt: new Date('2024-01-15T14:00:00'),
                    getSentimentScore: () => 0.6
                },
                {
                    id: 'h3',
                    createdAt: new Date('2024-01-16T10:00:00'),
                    getSentimentScore: () => -0.4
                }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getSentimentTrend('rel-1', 90, 'day');

            expect(result).toHaveLength(2);
            expect(result[0].period).toBe('2024-01-15');
            expect(result[0].sentiment).toBeCloseTo(0.7, 2); // (0.8 + 0.6) / 2
            expect(result[0].changeCount).toBe(2);
            expect(result[1].period).toBe('2024-01-16');
            expect(result[1].sentiment).toBe(-0.4);
            expect(result[1].changeCount).toBe(1);
        });

        it('should group by week', async () => {
            const mockHistory = [
                {
                    id: 'h1',
                    createdAt: new Date('2024-01-15'), // Week 3
                    getSentimentScore: () => 0.5
                },
                {
                    id: 'h2',
                    createdAt: new Date('2024-01-22'), // Week 4
                    getSentimentScore: () => 0.3
                }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getSentimentTrend('rel-1', 90, 'week');

            expect(result).toHaveLength(2);
            expect(result[0].period).toMatch(/2024-W0[34]/); // Week 3 or 4
            expect(result[1].period).toMatch(/2024-W0[34]/);
        });

        it('should group by month', async () => {
            const mockHistory = [
                {
                    id: 'h1',
                    createdAt: new Date('2024-01-15'),
                    getSentimentScore: () => 0.5
                },
                {
                    id: 'h2',
                    createdAt: new Date('2024-01-25'),
                    getSentimentScore: () => 0.3
                },
                {
                    id: 'h3',
                    createdAt: new Date('2024-02-10'),
                    getSentimentScore: () => -0.2
                }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getSentimentTrend('rel-1', 90, 'month');

            expect(result).toHaveLength(2);
            expect(result[0].period).toBe('2024-01');
            expect(result[0].sentiment).toBeCloseTo(0.4, 2); // (0.5 + 0.3) / 2
            expect(result[0].changeCount).toBe(2);
            expect(result[1].period).toBe('2024-02');
            expect(result[1].sentiment).toBe(-0.2);
            expect(result[1].changeCount).toBe(1);
        });

        it('should sort results by period chronologically', async () => {
            const mockHistory = [
                {
                    id: 'h1',
                    createdAt: new Date('2024-02-01'),
                    getSentimentScore: () => 0.5
                },
                {
                    id: 'h2',
                    createdAt: new Date('2024-01-01'),
                    getSentimentScore: () => 0.3
                }
            ] as unknown as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getSentimentTrend('rel-1', 90, 'month');

            expect(result[0].period).toBe('2024-01');
            expect(result[1].period).toBe('2024-02');
        });
    });

    describe('getRecentSignificantChanges', () => {
        it('should get significant changes for organization', async () => {
            const mockHistory = [
                { id: 'h1', isSignificant: true },
                { id: 'h2', isSignificant: true }
            ] as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getRecentSignificantChanges('org-1', 5);

            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'history.organizationId = :organizationId',
                { organizationId: 'org-1' }
            );
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'history.isSignificant = :isSignificant',
                { isSignificant: true }
            );
            expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
            expect(result).toEqual(mockHistory);
        });

        it('should default to limit 10', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            await service.getRecentSignificantChanges('org-1');

            expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
        });
    });

    describe('getChangesByActor', () => {
        it('should get all changes by actor', async () => {
            const mockHistory = [
                { id: 'h1', actorId: 'user-1' },
                { id: 'h2', actorId: 'user-1' }
            ] as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getChangesByActor('user-1');

            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'history.actorId = :actorId',
                { actorId: 'user-1' }
            );
            expect(result).toEqual(mockHistory);
        });

        it('should respect limit parameter', async () => {
            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            await service.getChangesByActor('user-1', { limit: 20 });

            expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
        });
    });

    describe('markNotificationSent', () => {
        it('should update notificationSent flag', async () => {
            mockHistoryRepository.update.mockResolvedValue({ affected: 1 });

            await service.markNotificationSent('hist-123');

            expect(mockHistoryRepository.update).toHaveBeenCalledWith('hist-123', {
                notificationSent: true
            });
        });
    });

    describe('getPendingNotifications', () => {
        it('should get entries requiring notification that were not sent', async () => {
            const mockHistory = [
                { id: 'h1', requiresNotification: true, notificationSent: false }
            ] as RelationshipHistory[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };

            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder as any);

            const result = await service.getPendingNotifications('org-1');

            expect(mockQueryBuilder.where).toHaveBeenCalledWith(
                'history.organizationId = :organizationId',
                { organizationId: 'org-1' }
            );
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'history.requiresNotification = :requiresNotification',
                { requiresNotification: true }
            );
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'history.notificationSent = :notificationSent',
                { notificationSent: false }
            );
            expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('history.createdAt', 'ASC');
            expect(result).toEqual(mockHistory);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
