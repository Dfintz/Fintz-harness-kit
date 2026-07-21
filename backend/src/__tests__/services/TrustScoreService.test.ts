import { OrganizationRelationship, RelationshipType } from '../../models/OrganizationRelationship';
import { InteractionSentiment, ChangeType } from '../../models/RelationshipHistory';
import { RelationshipService } from '../../services/social';

/**
 * TrustScoreService functionality is now consolidated into RelationshipService.
 * These tests verify the trust score related methods on RelationshipService.
 */
describe('TrustScoreService (via RelationshipService)', () => {
    let service: RelationshipService;
    let mockRelationshipRepository: any;
    let mockHistoryRepository: any;

    beforeEach(() => {
        mockRelationshipRepository = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn((rel) => Promise.resolve(rel)),
            createQueryBuilder: jest.fn()
        };

        mockHistoryRepository = {
            create: jest.fn((data) => data),
            save: jest.fn((data) => Promise.resolve({ id: 'hist-1', ...data })),
            createQueryBuilder: jest.fn()
        };

        service = new RelationshipService(mockRelationshipRepository, mockHistoryRepository);
    });

    describe('calculateTrustScore', () => {
        it('should calculate base score for neutral relationship', () => {
            const score = service.calculateTrustScore({
                currentTrust: 50,
                relationshipType: RelationshipType.NEUTRAL,
                interactionHistory: { positive: 0, negative: 0, total: 0 },
                durationDays: 0,
                recentActivity: 0
            });

            expect(score).toBe(50);
        });

        it('should add bonus for allied relationship', () => {
            const score = service.calculateTrustScore({
                currentTrust: 50,
                relationshipType: RelationshipType.ALLIED,
                interactionHistory: { positive: 0, negative: 0, total: 0 },
                durationDays: 0,
                recentActivity: 0
            });

            expect(score).toBeGreaterThan(50);
        });

        it('should reduce score for hostile relationship', () => {
            const score = service.calculateTrustScore({
                currentTrust: 50,
                relationshipType: RelationshipType.HOSTILE,
                interactionHistory: { positive: 0, negative: 0, total: 0 },
                durationDays: 0,
                recentActivity: 0
            });

            expect(score).toBeLessThan(50);
        });

        it('should increase score with positive interactions', () => {
            const score = service.calculateTrustScore({
                currentTrust: 50,
                relationshipType: RelationshipType.NEUTRAL,
                interactionHistory: { positive: 10, negative: 0, total: 10 },
                durationDays: 0,
                recentActivity: 0
            });

            expect(score).toBeGreaterThan(50);
        });

        it('should decrease score with negative interactions', () => {
            const score = service.calculateTrustScore({
                currentTrust: 50,
                relationshipType: RelationshipType.NEUTRAL,
                interactionHistory: { positive: 0, negative: 10, total: 10 },
                durationDays: 0,
                recentActivity: 0
            });

            expect(score).toBeLessThan(50);
        });

        it('should add duration bonus for long relationships', () => {
            const scoreShort = service.calculateTrustScore({
                currentTrust: 50,
                relationshipType: RelationshipType.NEUTRAL,
                interactionHistory: { positive: 0, negative: 0, total: 0 },
                durationDays: 0,
                recentActivity: 0
            });

            const scoreLong = service.calculateTrustScore({
                currentTrust: 50,
                relationshipType: RelationshipType.NEUTRAL,
                interactionHistory: { positive: 0, negative: 0, total: 0 },
                durationDays: 180,
                recentActivity: 0
            });

            expect(scoreLong).toBeGreaterThan(scoreShort);
        });

        it('should clamp score between 0 and 100', () => {
            const lowScore = service.calculateTrustScore({
                currentTrust: 0,
                relationshipType: RelationshipType.WAR,
                interactionHistory: { positive: 0, negative: 100, total: 100 },
                durationDays: 0,
                recentActivity: 0
            });

            const highScore = service.calculateTrustScore({
                currentTrust: 100,
                relationshipType: RelationshipType.ALLIED,
                interactionHistory: { positive: 100, negative: 0, total: 100 },
                durationDays: 365,
                recentActivity: 100
            });

            expect(lowScore).toBeGreaterThanOrEqual(0);
            expect(highScore).toBeLessThanOrEqual(100);
        });
    });

    describe('updateTrustScore', () => {
        let mockRelationship: any;

        beforeEach(() => {
            mockRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                trustScore: 50,
                relationshipType: RelationshipType.NEUTRAL
            };
        });

        it('should update trust score with positive delta', async () => {
            const newScore = await service.updateTrustScore(
                mockRelationship,
                { reason: 'Good cooperation', delta: 10 },
                'user-1',
                'Admin'
            );

            expect(newScore).toBe(60);
            expect(mockRelationship.trustScore).toBe(60);
        });

        it('should update trust score with negative delta', async () => {
            const newScore = await service.updateTrustScore(
                mockRelationship,
                { reason: 'Dispute', delta: -15 },
                'user-1',
                'Admin'
            );

            expect(newScore).toBe(35);
            expect(mockRelationship.trustScore).toBe(35);
        });

        it('should apply decay factor for high scores', async () => {
            mockRelationship.trustScore = 85;

            const newScore = await service.updateTrustScore(
                mockRelationship,
                { reason: 'Major alliance', delta: 20 },
                'user-1',
                'Admin'
            );

            // Should be less than 105 due to decay factor
            expect(newScore).toBeLessThan(105);
            expect(newScore).toBeLessThanOrEqual(100);
        });

        it('should apply decay factor for low scores', async () => {
            mockRelationship.trustScore = 15;

            const newScore = await service.updateTrustScore(
                mockRelationship,
                { reason: 'Major conflict', delta: -20 },
                'user-1',
                'Admin'
            );

            // Should be greater than -5 due to decay factor
            expect(newScore).toBeGreaterThan(-5);
            expect(newScore).toBeGreaterThanOrEqual(0);
        });

        it('should save relationship to repository', async () => {
            await service.updateTrustScore(
                mockRelationship,
                { reason: 'Test', delta: 5 }
            );

            expect(mockRelationshipRepository.save).toHaveBeenCalledWith(mockRelationship);
        });

        it('should create history entry', async () => {
            await service.updateTrustScore(
                mockRelationship,
                { reason: 'Test interaction', delta: 5, sentiment: InteractionSentiment.POSITIVE },
                'user-1',
                'Admin'
            );

            // The consolidated service creates history entries via historyRepository
            expect(mockHistoryRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    changeType: ChangeType.TRUST_UPDATED,
                    description: 'Test interaction',
                    previousValue: 50,
                    newValue: 55
                })
            );
            expect(mockHistoryRepository.save).toHaveBeenCalled();
        });
    });

    describe('recordInteraction (via RelationshipService.recordInteraction)', () => {
        let mockRelationship: any;

        beforeEach(() => {
            mockRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                trustScore: 50,
                interactionCount: 0,
                positiveInteractions: 0,
                negativeInteractions: 0,
                relationshipStrength: 50,
                lastInteractionDate: new Date()
            };
            mockRelationshipRepository.findOne.mockResolvedValue(mockRelationship);
            mockRelationshipRepository.save.mockImplementation((rel: any) => Promise.resolve(rel));
        });

        it('should increment interaction count', async () => {
            await service.recordInteraction({
                relationshipId: 'rel-1',
                sentiment: InteractionSentiment.POSITIVE,
                description: 'Good meeting',
                actorId: 'user-1',
                actorName: 'Admin'
            });

            expect(mockRelationship.interactionCount).toBe(1);
        });

        it('should increment positive interactions for positive sentiment', async () => {
            await service.recordInteraction({
                relationshipId: 'rel-1',
                sentiment: InteractionSentiment.POSITIVE,
                description: 'Successful trade',
                actorId: 'user-1',
                actorName: 'Admin'
            });

            expect(mockRelationship.positiveInteractions).toBe(1);
        });

        it('should increment negative interactions for negative sentiment', async () => {
            await service.recordInteraction({
                relationshipId: 'rel-1',
                sentiment: InteractionSentiment.NEGATIVE,
                description: 'Failed negotiation',
                actorId: 'user-1',
                actorName: 'Admin'
            });

            expect(mockRelationship.negativeInteractions).toBe(1);
        });

        it('should not increment positive/negative for neutral sentiment', async () => {
            await service.recordInteraction({
                relationshipId: 'rel-1',
                sentiment: InteractionSentiment.NEUTRAL,
                description: 'Standard communication',
                actorId: 'user-1',
                actorName: 'Admin'
            });

            expect(mockRelationship.positiveInteractions).toBe(0);
            expect(mockRelationship.negativeInteractions).toBe(0);
        });

        it('should handle very positive sentiment', async () => {
            await service.recordInteraction({
                relationshipId: 'rel-1',
                sentiment: InteractionSentiment.VERY_POSITIVE,
                description: 'Major alliance formed',
                actorId: 'user-1',
                actorName: 'Admin'
            });

            expect(mockRelationship.positiveInteractions).toBe(1);
        });

        it('should create interaction history entry', async () => {
            await service.recordInteraction({
                relationshipId: 'rel-1',
                sentiment: InteractionSentiment.POSITIVE,
                description: 'Test interaction',
                actorId: 'user-1',
                actorName: 'Admin',
                metadata: { type: 'meeting' }
            });

            expect(mockHistoryRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    changeType: ChangeType.INTERACTION_RECORDED,
                    description: 'Test interaction'
                })
            );
            expect(mockHistoryRepository.save).toHaveBeenCalled();
        });
    });

    describe('getTrustTrend', () => {
        it('should return trust trend from history', async () => {
            const mockHistory = [
                {
                    createdAt: new Date('2025-01-01'),
                    newValue: 40,
                    changeDetails: { trustScoreDelta: -10 }
                },
                {
                    createdAt: new Date('2025-01-15'),
                    newValue: 55,
                    changeDetails: { trustScoreDelta: 15 }
                },
                {
                    createdAt: new Date('2025-02-01'),
                    newValue: 60,
                    changeDetails: { trustScoreDelta: 5 }
                }
            ];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };
            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder);

            const trend = await service.getTrustTrend('rel-1', 90);

            expect(trend).toHaveLength(3);
            expect(trend[0].trust).toBe(60); // Most recent first, reversed to oldest first
            expect(trend[2].trust).toBe(40);
        });

        it('should filter out entries without newValue', async () => {
            const mockHistory = [
                { createdAt: new Date(), newValue: 50, changeDetails: {} },
                { createdAt: new Date(), newValue: undefined, changeDetails: {} },
                { createdAt: new Date(), newValue: 60, changeDetails: {} }
            ];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockHistory)
            };
            mockHistoryRepository.createQueryBuilder = jest.fn(() => mockQueryBuilder);

            const trend = await service.getTrustTrend('rel-1');

            expect(trend).toHaveLength(2);
        });
    });

    describe('getTrustRecommendations', () => {
        it('should provide critical recommendations for low trust', async () => {
            const mockRelationship = {
                id: 'rel-1',
                trustScore: 25,
                getTrustLevel: () => 'Critical',
                positiveInteractions: 2,
                negativeInteractions: 8,
                lastInteractionDate: new Date()
            } as any;

            const recommendations = await service.getTrustRecommendations(mockRelationship);

            expect(recommendations.currentLevel).toBe('Critical');
            expect(recommendations.riskFactors.length).toBeGreaterThan(0);
            expect(recommendations.suggestedActions.some(action => action.includes('diplomatic meeting'))).toBe(true);
        });

        it('should suggest improvement actions for moderate trust', async () => {
            const mockRelationship = {
                id: 'rel-1',
                trustScore: 45,
                getTrustLevel: () => 'Low',
                positiveInteractions: 5,
                negativeInteractions: 3,
                lastInteractionDate: new Date()
            } as any;

            const recommendations = await service.getTrustRecommendations(mockRelationship);

            expect(recommendations.opportunities.length).toBeGreaterThan(0);
            expect(recommendations.suggestedActions.some(action => action.includes('communication'))).toBe(true);
        });

        it('should highlight opportunities for high trust', async () => {
            const mockRelationship = {
                id: 'rel-1',
                trustScore: 75,
                getTrustLevel: () => 'High',
                positiveInteractions: 20,
                negativeInteractions: 2,
                lastInteractionDate: new Date()
            } as any;

            const recommendations = await service.getTrustRecommendations(mockRelationship);

            expect(recommendations.opportunities.some(opp => /foundation/i.test(opp))).toBe(true);
            expect(recommendations.suggestedActions.some(action => action.includes('alliance'))).toBe(true);
        });

        it('should flag dormant relationships', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 100);

            const mockRelationship = {
                id: 'rel-1',
                trustScore: 50,
                getTrustLevel: () => 'Moderate',
                positiveInteractions: 5,
                negativeInteractions: 5,
                lastInteractionDate: oldDate
            } as any;

            const recommendations = await service.getTrustRecommendations(mockRelationship);

            expect(recommendations.riskFactors.some(risk => risk.includes('dormant'))).toBe(true);
        });

        it('should flag predominantly negative interactions', async () => {
            const mockRelationship = {
                id: 'rel-1',
                trustScore: 40,
                getTrustLevel: () => 'Low',
                positiveInteractions: 2,
                negativeInteractions: 10,
                lastInteractionDate: new Date()
            } as any;

            const recommendations = await service.getTrustRecommendations(mockRelationship);

            expect(recommendations.riskFactors.some(risk => risk.includes('predominantly negative') || risk.includes('Recent interactions predominantly negative'))).toBe(true);
        });

        it('should set appropriate review dates based on trust level', async () => {
            const criticalRel = {
                id: 'rel-1',
                trustScore: 25,
                getTrustLevel: () => 'Critical',
                positiveInteractions: 1,
                negativeInteractions: 5,
                lastInteractionDate: new Date()
            } as any;

            const highRel = {
                id: 'rel-2',
                trustScore: 80,
                getTrustLevel: () => 'High',
                positiveInteractions: 20,
                negativeInteractions: 1,
                lastInteractionDate: new Date()
            } as any;

            const criticalRec = await service.getTrustRecommendations(criticalRel);
            const highRec = await service.getTrustRecommendations(highRel);

            const daysDiffCritical = Math.floor((criticalRec.nextReviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            const daysDiffHigh = Math.floor((highRec.nextReviewDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            expect(daysDiffCritical).toBeLessThan(daysDiffHigh);
        });
    });

    describe('applyTrustDecay', () => {
        it('should not apply decay for recent interactions', async () => {
            const mockRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                trustScore: 50,
                lastInteractionDate: new Date()
            } as any;

            await service.applyTrustDecay(mockRelationship);

            expect(mockRelationshipRepository.save).not.toHaveBeenCalled();
        });

        it('should apply decay for inactive relationships', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 90);

            const mockRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                trustScore: 50,
                lastInteractionDate: oldDate
            } as any;

            await service.applyTrustDecay(mockRelationship);

            expect(mockRelationshipRepository.save).toHaveBeenCalled();
        });

        it('should not apply decay without lastInteractionDate', async () => {
            const mockRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                trustScore: 50,
                lastInteractionDate: null
            } as any;

            await service.applyTrustDecay(mockRelationship);

            expect(mockRelationshipRepository.save).not.toHaveBeenCalled();
        });
    });

    describe('applyDecayToAll', () => {
        it('should apply decay to all relationships for organization', async () => {
            const oldDate = new Date();
            oldDate.setDate(oldDate.getDate() - 60);

            const mockRelationships = [
                {
                    id: 'rel-1',
                    organizationId: 'org-1',
                    targetOrganizationId: 'org-2',
                    trustScore: 50,
                    lastInteractionDate: oldDate
                },
                {
                    id: 'rel-2',
                    organizationId: 'org-1',
                    targetOrganizationId: 'org-3',
                    trustScore: 60,
                    lastInteractionDate: new Date()
                }
            ];

            mockRelationshipRepository.find.mockResolvedValue(mockRelationships);
            mockRelationshipRepository.findOne.mockImplementation(({ where }: any) => {
                const rel = mockRelationships.find(r => r.id === where.id);
                return Promise.resolve(rel ? { ...rel, trustScore: rel.trustScore - 2 } : null);
            });

            const decayed = await service.applyDecayToAll('org-1');

            expect(decayed).toBeGreaterThan(0);
        });

        it('should return 0 when no relationships need decay', async () => {
            const mockRelationships = [
                {
                    id: 'rel-1',
                    organizationId: 'org-1',
                    targetOrganizationId: 'org-2',
                    trustScore: 50,
                    lastInteractionDate: new Date()
                }
            ];

            mockRelationshipRepository.find.mockResolvedValue(mockRelationships);
            mockRelationshipRepository.findOne.mockImplementation(({ where }: any) => {
                const rel = mockRelationships.find(r => r.id === where.id);
                return Promise.resolve(rel);
            });

            const decayed = await service.applyDecayToAll('org-1');

            expect(decayed).toBe(0);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
