import { Repository } from 'typeorm';

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../data-source', () => ({
    AppDataSource: mockAppDataSource,
}));

jest.mock('../../config/database', () => ({
    AppDataSource: mockAppDataSource,
}));

import { AppDataSource } from '../../config/database';
import { 
    OrganizationRelationship, 
    RelationshipType, 
    RelationshipStatus 
} from '../../models/OrganizationRelationship';
import { RelationshipHistory, ChangeType, InteractionSentiment } from '../../models/RelationshipHistory';
import { RelationshipService } from '../../services/social';

// Don't mock RelationshipService itself - we want to test it!
// jest.mock('../../services/social');

describe('RelationshipService', () => {
    let service: RelationshipService;
    let mockRelationshipRepository: jest.Mocked<Repository<OrganizationRelationship>>;
    let mockHistoryRepository: jest.Mocked<Repository<RelationshipHistory>>;

    beforeEach(() => {
        // Create mock repositories with jest.fn()
        mockRelationshipRepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
            metadata: { name: 'OrganizationRelationship' },
        } as any;

        mockHistoryRepository = {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
            metadata: { name: 'RelationshipHistory' },
        } as any;

        // Default mock for history repository
        mockHistoryRepository.create.mockImplementation((data: any) => data);
        mockHistoryRepository.save.mockResolvedValue({} as any);

        // Use dependency injection to pass mocks directly to service
        service = new RelationshipService(mockRelationshipRepository, mockHistoryRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createRelationship', () => {
        const createParams = {
            organizationId: 'org-1',
            targetOrganizationId: 'org-2',
            type: RelationshipType.ALLIED,
            description: 'Test alliance',
            establishedById: 'user-1',
            establishedByName: 'Test User',
        };

        it('should create a new relationship successfully', async () => {
            mockRelationshipRepository.findOne.mockResolvedValue(null);
            
            const mockRelationship = {
                id: 'rel-1',
                ...createParams,
                status: RelationshipStatus.ACTIVE,
                trustScore: 50,
                relationshipStrength: 25,
                interactionCount: 0,
                positiveInteractions: 0,
                negativeInteractions: 0,
                isMutual: false,
                isMutuallyRecognized: false,
                isPublic: false,
                requiresApproval: false,
                autoRenew: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                calculateHealthScore: jest.fn().mockReturnValue(50),
                getRelationshipTier: jest.fn().mockReturnValue('fair'),
                needsReview: jest.fn().mockReturnValue(false),
                isExpired: jest.fn().mockReturnValue(false),
                isAboutToExpire: jest.fn().mockReturnValue(false),
                canAutoRenew: jest.fn().mockReturnValue(false),
            } as any;

            mockRelationshipRepository.create.mockReturnValue(mockRelationship);
            mockRelationshipRepository.save.mockResolvedValue(mockRelationship);

            const result = await service.createRelationship(createParams);

            expect(mockRelationshipRepository.findOne).toHaveBeenCalledWith({
                where: {
                    organizationId: createParams.organizationId,
                    targetOrganizationId: createParams.targetOrganizationId,
                },
            });
            expect(mockRelationshipRepository.create).toHaveBeenCalled();
            expect(mockRelationshipRepository.save).toHaveBeenCalled();
            expect(mockHistoryRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    relationshipId: 'rel-1',
                    changeType: ChangeType.CREATED,
                    isSignificant: true,
                })
            );
            expect(mockHistoryRepository.save).toHaveBeenCalled();
            expect(result).toEqual(mockRelationship);
        });

        it('should throw error if relationship already exists', async () => {
            const existingRelationship = {
                id: 'rel-existing',
                organizationId: createParams.organizationId,
                targetOrganizationId: createParams.targetOrganizationId,
            } as OrganizationRelationship;

            mockRelationshipRepository.findOne.mockResolvedValue(existingRelationship);

            await expect(service.createRelationship(createParams)).rejects.toThrow(
                'Relationship already exists'
            );
        });

        it('should use default values for optional fields', async () => {
            mockRelationshipRepository.findOne.mockResolvedValue(null);
            
            const minimalParams = {
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                type: RelationshipType.NEUTRAL,
            };

            const mockRelationship = {
                id: 'rel-1',
                ...minimalParams,
                status: RelationshipStatus.ACTIVE,
                trustScore: 50,
            } as OrganizationRelationship;

            mockRelationshipRepository.create.mockReturnValue(mockRelationship);
            mockRelationshipRepository.save.mockResolvedValue(mockRelationship);

            const result = await service.createRelationship(minimalParams);

            expect(result.status).toBe(RelationshipStatus.ACTIVE);
            expect(result.trustScore).toBe(50);
        });
    });

    describe('getRelationshipById', () => {
        it('should return relationship by ID', async () => {
            const mockRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
            } as OrganizationRelationship;

            mockRelationshipRepository.findOne.mockResolvedValue(mockRelationship);

            const result = await service.getRelationshipById('rel-1');

            expect(mockRelationshipRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'rel-1' },
            });
            expect(result).toEqual(mockRelationship);
        });

        it('should return null if relationship not found', async () => {
            mockRelationshipRepository.findOne.mockResolvedValue(null);

            const result = await service.getRelationshipById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('getOrganizationRelationships', () => {
        it('should get all relationships for an organization', async () => {
            const mockRelationships = [
                { id: 'rel-1', organizationId: 'org-1', type: RelationshipType.ALLIED },
                { id: 'rel-2', organizationId: 'org-1', type: RelationshipType.TRADING_PARTNER },
            ] as OrganizationRelationship[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                orWhere: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockRelationships),
            };

            mockRelationshipRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.getOrganizationRelationships('org-1');

            expect(result).toEqual(mockRelationships);
            expect(mockQueryBuilder.where).toHaveBeenCalled();
        });

        it('should filter by type', async () => {
            const mockRelationships = [
                { id: 'rel-1', type: RelationshipType.ALLIED },
            ] as OrganizationRelationship[];

            const mockQueryBuilder = {
                where: jest.fn().mockReturnThis(),
                orWhere: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue(mockRelationships),
            };

            mockRelationshipRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

            const result = await service.getOrganizationRelationships('org-1', {
                type: [RelationshipType.ALLIED],
            });

            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
                'rel.type IN (:...types)',
                { types: [RelationshipType.ALLIED] }
            );
            expect(result).toEqual(mockRelationships);
        });
    });

    describe('updateRelationship', () => {
        it('should update relationship and track changes', async () => {
            const existingRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                type: RelationshipType.NEUTRAL,
                status: RelationshipStatus.ACTIVE,
            } as OrganizationRelationship;

            mockRelationshipRepository.findOne.mockResolvedValue(existingRelationship);
            mockRelationshipRepository.save.mockResolvedValue({
                ...existingRelationship,
                type: RelationshipType.ALLIED,
            } as OrganizationRelationship);

            const result = await service.updateRelationship(
                'rel-1',
                { type: RelationshipType.ALLIED },
                'user-1',
                'Test User'
            );

            expect(result.type).toBe(RelationshipType.ALLIED);
            expect(mockHistoryRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    changeType: ChangeType.TYPE_CHANGED,
                })
            );
        });

        it('should throw error if relationship not found', async () => {
            mockRelationshipRepository.findOne.mockResolvedValue(null);

            await expect(
                service.updateRelationship('non-existent', { type: RelationshipType.ALLIED })
            ).rejects.toThrow('Relationship not found');
        });
    });

    describe('recordInteraction', () => {
        it('should record positive interaction', async () => {
            const mockRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                interactionCount: 5,
                positiveInteractions: 2,
                negativeInteractions: 1,
                relationshipStrength: 50,
                trustScore: 60,
                lastInteractionDate: new Date('2025-01-01'),
            } as any;

            mockRelationshipRepository.findOne.mockResolvedValue(mockRelationship);
            mockRelationshipRepository.save.mockResolvedValue({
                ...mockRelationship,
                interactionCount: 6,
                positiveInteractions: 3,
            } as OrganizationRelationship);

            const result = await service.recordInteraction({
                relationshipId: 'rel-1',
                sentiment: InteractionSentiment.POSITIVE,
                description: 'Successful trade',
                actorId: 'user-1',
                actorName: 'Test User',
            });

            expect(mockHistoryRepository.save).toHaveBeenCalled();
        });

        it('should record negative interaction', async () => {
            const mockRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                interactionCount: 5,
                positiveInteractions: 2,
                negativeInteractions: 1,
                relationshipStrength: 50,
                trustScore: 60,
            } as any;

            mockRelationshipRepository.findOne.mockResolvedValue(mockRelationship);
            mockRelationshipRepository.save.mockResolvedValue({
                ...mockRelationship,
                interactionCount: 6,
                negativeInteractions: 2,
            } as OrganizationRelationship);

            await service.recordInteraction({
                relationshipId: 'rel-1',
                sentiment: InteractionSentiment.NEGATIVE,
                description: 'Dispute',
                actorId: 'user-1',
            });

            expect(mockHistoryRepository.save).toHaveBeenCalled();
        });
    });

    describe('terminateRelationship', () => {
        it('should terminate relationship and record in history', async () => {
            const mockRelationship = {
                id: 'rel-1',
                organizationId: 'org-1',
                targetOrganizationId: 'org-2',
                status: RelationshipStatus.ACTIVE,
            } as any;

            mockRelationshipRepository.findOne.mockResolvedValue(mockRelationship);
            mockRelationshipRepository.save.mockResolvedValue({
                ...mockRelationship,
                status: RelationshipStatus.TERMINATED,
            } as OrganizationRelationship);

            await service.terminateRelationship(
                'rel-1',
                'No longer needed',
                'user-1',
                'Test User'
            );

            expect(mockRelationshipRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: RelationshipStatus.TERMINATED,
                })
            );
            expect(mockHistoryRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    changeType: ChangeType.TERMINATED,
                    isSignificant: true,
                })
            );
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
