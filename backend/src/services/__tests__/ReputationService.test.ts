import { Repository } from 'typeorm';

import { LFGReputationRating } from '../../models/LFGReputationRating';
import { LFGUserReputation } from '../../models/LFGUserReputation';
import { OrganizationRelationship } from '../../models/OrganizationRelationship';
import { ReputationService } from '../social/ReputationService';
import { SocialGroupService } from '../social/SocialGroupService';

// Mock the SocialGroupService
const mockSocialGroupService = {
    getInstance: jest.fn(),
    getSession: jest.fn(),
    getUserHistory: jest.fn(),
    getUserActivityStats: jest.fn()
};

jest.mock('../social/SocialGroupService', () => ({
    SocialGroupService: {
        getInstance: () => mockSocialGroupService
    }
}));

jest.mock('../../data-source', () => ({
    AppDataSource: {
        getRepository: jest.fn()
    }
}));

jest.mock('../../utils/redis', () => ({
    cache: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        del: jest.fn().mockResolvedValue(undefined),
        delPattern: jest.fn().mockResolvedValue(0),
        exists: jest.fn().mockResolvedValue(false),
        ttl: jest.fn().mockResolvedValue(-1)
    }
}));

describe('ReputationService', () => {
    let reputationService: ReputationService;
    let mockRatingRepo: jest.Mocked<Repository<LFGReputationRating>>;
    let mockUserReputationRepo: jest.Mocked<Repository<LFGUserReputation>>;
    let mockRelationshipRepo: jest.Mocked<Repository<OrganizationRelationship>>;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Create mocked repositories
        mockRatingRepo = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn()
        } as any;

        mockUserReputationRepo = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            createQueryBuilder: jest.fn()
        } as any;

        mockRelationshipRepo = {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn()
        } as any;

        // Create service instance with injected repositories
        reputationService = new ReputationService(
            mockRatingRepo,
            mockUserReputationRepo,
            mockRelationshipRepo
        );
    });

    describe('getUnifiedReputation', () => {
        it('should combine LFG and organization trust scores correctly', async () => {
            // Arrange
            const userId = 'user-123';
            const organizationId = 'org-456';

            const mockReputation = {
                id: 'rep-1',
                userId,
                overallScore: 80,
                totalSessions: 50,
                successRate: 90,
                averageRating: 4.5,
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Reliable', icon: '⭐' })
            };

            const mockRelationships = [
                {
                    id: 'rel-1',
                    organizationId,
                    targetOrganizationId: 'target-1',
                    trustScore: 75,
                    interactionCount: 20,
                    positiveInteractions: 15,
                    negativeInteractions: 2,
                    getTrustLevel: jest.fn().mockReturnValue('Trusted')
                }
            ];

            mockUserReputationRepo.findOne.mockResolvedValue(mockReputation as any);
            mockRelationshipRepo.find.mockResolvedValue(mockRelationships as any);

            // Act
            const result = await reputationService.getUnifiedReputation(userId, organizationId);

            // Assert
            expect(result).toBeDefined();
            expect(result.userId).toBe(userId);
            expect(result.userReputation.overallScore).toBe(80);
            expect(result.userReputation.tier).toContain('Reliable');
            expect(result.organizationTrust).toHaveLength(1);
            expect(result.organizationTrust![0].trustScore).toBe(75);
            expect(result.combinedScore).toBeGreaterThan(0);
            expect(result.reliability).toBeDefined();
        });

        it('should handle missing organization ID gracefully', async () => {
            // Arrange
            const userId = 'user-123';

            const mockReputation = {
                id: 'rep-1',
                userId,
                overallScore: 85,
                totalSessions: 60,
                successRate: 92,
                averageRating: 4.7,
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Elite', icon: '🌟' })
            };

            mockUserReputationRepo.findOne.mockResolvedValue(mockReputation as any);

            // Act
            const result = await reputationService.getUnifiedReputation(userId);

            // Assert
            expect(result).toBeDefined();
            expect(result.userId).toBe(userId);
            expect(result.userReputation.overallScore).toBe(85);
            expect(result.organizationTrust).toBeUndefined();
            // Combined score should be mostly based on user reputation (60% weight)
            expect(result.combinedScore).toBeCloseTo(71, 0); // (85 * 0.6) + (50 * 0.4) = 51 + 20 = 71
            expect(result.reliability).toBe('High');
            expect(mockRelationshipRepo.find).not.toHaveBeenCalled();
        });

        it('should calculate combined score with correct weights', async () => {
            // Arrange
            const userId = 'user-123';
            const organizationId = 'org-456';

            const mockReputation = {
                id: 'rep-1',
                userId,
                overallScore: 100, // Perfect score
                totalSessions: 100,
                successRate: 100,
                averageRating: 5.0,
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Legend', icon: '👑' })
            };

            const mockRelationships = [
                {
                    id: 'rel-1',
                    organizationId,
                    targetOrganizationId: 'target-1',
                    trustScore: 50, // Average trust
                    interactionCount: 10,
                    positiveInteractions: 5,
                    negativeInteractions: 2,
                    getTrustLevel: jest.fn().mockReturnValue('Neutral')
                }
            ];

            mockUserReputationRepo.findOne.mockResolvedValue(mockReputation as any);
            mockRelationshipRepo.find.mockResolvedValue(mockRelationships as any);

            // Act
            const result = await reputationService.getUnifiedReputation(userId, organizationId);

            // Assert
            // Combined score: (100 * 0.6) + (50 * 0.4) = 60 + 20 = 80
            expect(result.combinedScore).toBe(80);
            expect(result.reliability).toBe('Excellent'); // >= 80
        });

        it('should determine correct reliability levels', async () => {
            // Test different combined score thresholds
            const testCases = [
                { overallScore: 100, expectedReliability: 'Excellent' }, // Combined: 80
                { overallScore: 80, expectedReliability: 'High' },       // Combined: 68
                { overallScore: 60, expectedReliability: 'Medium' },     // Combined: 56
                { overallScore: 50, expectedReliability: 'Medium' },     // Combined: 50
                { overallScore: 30, expectedReliability: 'Low' },        // Combined: 38
                { overallScore: 20, expectedReliability: 'Low' }         // Combined: 32
            ];

            for (const testCase of testCases) {
                const mockReputation = {
                    id: 'rep-1',
                    userId: 'test-user',
                    overallScore: testCase.overallScore,
                    totalSessions: 50,
                    successRate: 80,
                    averageRating: 4.0,
                    getReputationTier: jest.fn().mockReturnValue({ tier: 'Test', icon: '🔧' })
                };

                mockUserReputationRepo.findOne.mockResolvedValue(mockReputation as any);

                const result = await reputationService.getUnifiedReputation('test-user');
                expect(result.reliability).toBe(testCase.expectedReliability);
            }
        });
    });

    describe('getReputationReport', () => {
        it('should generate comprehensive reputation report', async () => {
            // Arrange
            const userId = 'user-123';

            const mockReputation = {
                id: 'rep-1',
                userId,
                overallScore: 85,
                totalSessions: 60,
                successRate: 90,
                averageRating: 4.5,
                positiveRatings: 54,
                negativeRatings: 6,
                leadershipSuccessRate: 80,
                currentSuccessStreak: 8,
                longestSuccessStreak: 10,
                categoryAverages: {},
                activityStats: {},
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Elite', icon: '🌟' })
            };

            mockUserReputationRepo.findOne.mockResolvedValue(mockReputation as any);
            mockRatingRepo.createQueryBuilder.mockReturnValue({
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            } as any);

            // Act
            const result = await reputationService.getReputationReport(userId);

            // Assert
            expect(result).toBeDefined();
            expect(result.unifiedScore).toBeDefined();
            expect(result.recentActivity).toBeDefined();
            expect(result.strengths).toBeInstanceOf(Array);
            expect(result.weaknesses).toBeInstanceOf(Array);
            expect(result.recommendations).toBeInstanceOf(Array);
            expect(result.trend).toMatch(/improving|stable|declining/);
            
            // Should identify high success rate as strength
            expect(result.strengths.some(s => s.includes('success rate'))).toBe(true);
        });

        it('should identify high success rate as strength', async () => {
            // Arrange
            const userId = 'user-123';

            const mockReputation = {
                id: 'rep-1',
                userId,
                overallScore: 90,
                totalSessions: 80,
                successRate: 92, // High success rate
                averageRating: 4.6,
                positiveRatings: 70,
                negativeRatings: 5,
                leadershipSuccessRate: 85,
                currentSuccessStreak: 12,
                longestSuccessStreak: 15,
                categoryAverages: {},
                activityStats: {},
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Elite', icon: '🌟' })
            };

            mockUserReputationRepo.findOne.mockResolvedValue(mockReputation as any);
            mockRatingRepo.createQueryBuilder.mockReturnValue({
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            } as any);

            // Act
            const result = await reputationService.getReputationReport(userId);

            // Assert
            expect(result.strengths.some(s => s.includes('Excellent success rate'))).toBe(true);
            expect(result.strengths.some(s => s.includes('Outstanding peer ratings'))).toBe(true);
            expect(result.strengths.some(s => s.includes('Strong leadership record'))).toBe(true);
            expect(result.strengths.some(s => s.includes('Active success streak'))).toBe(true);
        });

        it('should identify low metrics as weaknesses', async () => {
            // Arrange
            const userId = 'user-123';

            const mockReputation = {
                id: 'rep-1',
                userId,
                overallScore: 35,
                totalSessions: 20,
                successRate: 40, // Low success rate
                averageRating: 2.5, // Low rating
                positiveRatings: 8,
                negativeRatings: 12,
                leadershipSuccessRate: 30,
                currentSuccessStreak: 0,
                longestSuccessStreak: 3,
                categoryAverages: {},
                activityStats: {},
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Developing', icon: '📈' })
            };

            mockUserReputationRepo.findOne.mockResolvedValue(mockReputation as any);
            mockRatingRepo.createQueryBuilder.mockReturnValue({
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([])
            } as any);

            // Act
            const result = await reputationService.getReputationReport(userId);

            // Assert
            expect(result.weaknesses.some(w => w.includes('Low success rate'))).toBe(true);
            expect(result.weaknesses.some(w => w.includes('Low peer ratings'))).toBe(true);
            expect(result.recommendations).toContain('Focus on completing sessions successfully');
            expect(result.recommendations).toContain('Review feedback and improve collaboration skills');
            expect(result.recommendations).toContain('Consider taking a break to review and improve');
        });
    });

    describe('compareReputations', () => {
        it('should compare two users reputations', async () => {
            // Arrange
            const userId1 = 'user-1';
            const userId2 = 'user-2';

            const mockRep1 = {
                id: 'rep-1',
                userId: userId1,
                overallScore: 85,
                totalSessions: 60,
                successRate: 90,
                averageRating: 4.5,
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Elite', icon: '🌟' })
            };

            const mockRep2 = {
                id: 'rep-2',
                userId: userId2,
                overallScore: 70,
                totalSessions: 40,
                successRate: 75,
                averageRating: 4.0,
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Reliable', icon: '⭐' })
            };

            mockUserReputationRepo.findOne
                .mockResolvedValueOnce(mockRep1 as any)
                .mockResolvedValueOnce(mockRep2 as any);

            // Act
            const result = await reputationService.compareReputations(userId1, userId2);

            // Assert
            expect(result).toBeDefined();
            expect(result.user1).toBeDefined();
            expect(result.user2).toBeDefined();
            expect(result.comparison).toBeDefined();
            expect(result.comparison.betterUser).toBe(userId1); // user1 has higher score
            expect(result.comparison.scoreDifference).toBeGreaterThan(0);
            expect(result.comparison.categories).toBeInstanceOf(Array);
        });

        it('should handle equal scores', async () => {
            // Arrange
            const userId1 = 'user-1';
            const userId2 = 'user-2';

            const mockRep1 = {
                id: 'rep-1',
                userId: userId1,
                overallScore: 80,
                totalSessions: 50,
                successRate: 85,
                averageRating: 4.3,
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Reliable', icon: '⭐' })
            };

            const mockRep2 = {
                id: 'rep-2',
                userId: userId2,
                overallScore: 80,
                totalSessions: 50,
                successRate: 85,
                averageRating: 4.3,
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Reliable', icon: '⭐' })
            };

            mockUserReputationRepo.findOne
                .mockResolvedValueOnce(mockRep1 as any)
                .mockResolvedValueOnce(mockRep2 as any);

            // Act
            const result = await reputationService.compareReputations(userId1, userId2);

            // Assert
            expect(result.comparison.scoreDifference).toBe(0);
            // Either user could be "betterUser" since scores are equal
            expect([userId1, userId2]).toContain(result.comparison.betterUser);
        });
    });

    describe('LFG Reputation Methods', () => {
        it('should get user reputation', async () => {
            // Arrange
            const userId = 'user-123';
            const mockReputation = {
                id: 'rep-1',
                userId,
                overallScore: 80
            };

            mockUserReputationRepo.findOne.mockResolvedValue(mockReputation as any);

            // Act
            const result = await reputationService.getUserReputation(userId);

            // Assert
            expect(result).toBeDefined();
            expect(result.userId).toBe(userId);
        });

        it('should create new reputation profile if not found', async () => {
            // Arrange
            const userId = 'new-user';
            const newReputation = { userId };

            mockUserReputationRepo.findOne.mockResolvedValue(null);
            mockUserReputationRepo.create.mockReturnValue(newReputation as any);
            mockUserReputationRepo.save.mockResolvedValue(newReputation as any);

            // Act
            const result = await reputationService.getUserReputation(userId);

            // Assert
            expect(mockUserReputationRepo.create).toHaveBeenCalledWith({ userId });
            expect(mockUserReputationRepo.save).toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle user with no reputation data', async () => {
            // Arrange
            const userId = 'new-user';

            mockUserReputationRepo.findOne.mockResolvedValue({
                id: 'rep-new',
                userId,
                overallScore: 0,
                totalSessions: 0,
                successRate: 0,
                averageRating: 0,
                getReputationTier: jest.fn().mockReturnValue({ tier: 'New', icon: '🆕' })
            } as any);

            // Act
            const result = await reputationService.getUnifiedReputation(userId);

            // Assert
            expect(result).toBeDefined();
            expect(result.userReputation.overallScore).toBe(0);
            expect(result.combinedScore).toBeLessThanOrEqual(50); // Should be low with no data
        });

        it('should handle errors gracefully', async () => {
            // Arrange
            const userId = 'error-user';

            mockUserReputationRepo.findOne.mockRejectedValue(new Error('Database error'));

            // Act & Assert
            await expect(reputationService.getUnifiedReputation(userId))
                .rejects.toThrow('Database error');
        });

        it('should handle organization with no relationships', async () => {
            // Arrange
            const userId = 'user-123';
            const organizationId = 'org-empty';

            const mockReputation = {
                id: 'rep-1',
                userId,
                overallScore: 75,
                totalSessions: 30,
                successRate: 80,
                averageRating: 4.0,
                getReputationTier: jest.fn().mockReturnValue({ tier: 'Reliable', icon: '⭐' })
            };

            mockUserReputationRepo.findOne.mockResolvedValue(mockReputation as any);
            mockRelationshipRepo.find.mockResolvedValue([]); // No relationships

            // Act
            const result = await reputationService.getUnifiedReputation(userId, organizationId);

            // Assert
            expect(result).toBeDefined();
            expect(result.organizationTrust).toEqual([]);
            // Combined score should use default trust score of 50
            expect(result.combinedScore).toBeCloseTo(65, 0); // (75 * 0.6) + (50 * 0.4) = 45 + 20 = 65
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});

