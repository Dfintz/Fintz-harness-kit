import { RecruitmentService } from '../../services/organization/recruitment/RecruitmentService';
import { Activity, ActivityType, ActivityStatus, ActivityVisibility, ApplicationStatus } from '../../models/Activity';

// Mock dependencies
jest.mock('../../config/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(() => ({
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            create: jest.fn((data: any) => data),
            save: jest.fn((data: any) => Promise.resolve(data)),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getMany: jest.fn().mockResolvedValue([]),
                getManyAndCount: jest.fn().mockResolvedValue([[], 0])
            }))
        }))
    }
}));

jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    default: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    },
logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock TenantService base class
jest.mock('../../services/base/TenantService', () => {
    return {
        TenantService: class MockTenantService<T> {
            protected repository: {
                find: jest.Mock;
                findOne: jest.Mock;
                save: jest.Mock;
                create: jest.Mock;
                createQueryBuilder: jest.Mock;
            };
            
            constructor(repository: MockTenantService<T>['repository']) {
                this.repository = repository;
            }
            
            async create(orgId: string, data: Partial<T>): Promise<T & { id: string; organizationId: string }> {
                return { id: 'mock-id', ...data, organizationId: orgId } as T & { id: string; organizationId: string };
            }
        }
    };
});

describe('RecruitmentService - Dashboard and Pipeline', () => {
    let service: RecruitmentService;
    let mockRepository: {
        find: jest.Mock;
        findOne: jest.Mock;
        save: jest.Mock;
        create: jest.Mock;
        createQueryBuilder: jest.Mock;
    };

    const createMockRecruitment = (overrides: Partial<Activity> = {}): Activity => ({
        id: 'recruitment-1',
        organizationId: 'org-123',
        title: 'Test Recruitment',
        description: 'Test description',
        activityType: ActivityType.RECRUITMENT,
        status: ActivityStatus.RECRUITING,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: 'user-1',
        creatorName: 'Test User',
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
        applications: [],
        tags: [],
        rolesNeeded: [],
        invitedOrgs: [],
        alliedOrgs: [],
        ...overrides
    } as Activity);

    const createMockApplication = (overrides: any = {}) => ({
        id: 'app-1',
        applicantId: 'user-1',
        applicantName: 'Test Applicant',
        appliedAt: new Date(),
        status: ApplicationStatus.PENDING,
        screeningScore: 75,
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();
        (RecruitmentService as any).instance = null;
        service = RecruitmentService.getInstance();
        mockRepository = (service as any).repository;
    });

    describe('getRecruitmentDashboard', () => {
        it('should return dashboard summary with correct counts', async () => {
            const now = new Date();
            const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
            
            const mockRecruitments = [
                createMockRecruitment({
                    status: ActivityStatus.RECRUITING,
                    createdAt: recentDate,
                    applications: [
                        createMockApplication({ appliedAt: recentDate, status: ApplicationStatus.PENDING }),
                        createMockApplication({ id: 'app-2', appliedAt: recentDate, status: ApplicationStatus.ACCEPTED, reviewedAt: now })
                    ]
                }),
                createMockRecruitment({
                    id: 'recruitment-2',
                    status: ActivityStatus.COMPLETED,
                    createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const dashboard = await service.getRecruitmentDashboard('org-123');

            expect(dashboard).toBeDefined();
            expect(dashboard.summary).toBeDefined();
            expect(dashboard.summary.totalRecruitments).toBe(2);
            expect(dashboard.summary.activeRecruitments).toBe(1);
            expect(dashboard.trends).toBeDefined();
            expect(dashboard.efficiency).toBeDefined();
            expect(dashboard.urgentItems).toBeDefined();
            expect(dashboard.insights).toBeDefined();
            expect(Array.isArray(dashboard.insights)).toBe(true);
        });

        it('should calculate efficiency metrics', async () => {
            const now = new Date();
            const applyDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
            
            const mockRecruitments = [
                createMockRecruitment({
                    applications: [
                        createMockApplication({
                            appliedAt: applyDate,
                            status: ApplicationStatus.ACCEPTED,
                            reviewedAt: now
                        })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const dashboard = await service.getRecruitmentDashboard('org-123');

            expect(dashboard.efficiency.avgTimeToHire).toBeGreaterThan(0);
            expect(dashboard.efficiency.avgTimeToFirstReview).toBeDefined();
        });

        it('should identify urgent items', async () => {
            const now = new Date();
            const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
            
            const mockRecruitments = [
                createMockRecruitment({
                    createdAt: oldDate,
                    applications: [] // No applicants for 30 days
                }),
                createMockRecruitment({
                    id: 'recruitment-2',
                    applications: [
                        createMockApplication({
                            appliedAt: oldDate, // Old pending application
                            status: ApplicationStatus.PENDING
                        })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const dashboard = await service.getRecruitmentDashboard('org-123');

            expect(dashboard.urgentItems.recruitmentWithNoApplicants).toBeGreaterThanOrEqual(1);
            expect(dashboard.urgentItems.applicationsPendingOver7Days).toBeGreaterThanOrEqual(1);
        });

        it('should generate insights based on metrics', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    applications: []
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const dashboard = await service.getRecruitmentDashboard('org-123');

            expect(dashboard.insights).toBeDefined();
            // Should have at least one insight about no applicants
            const visibilityInsight = dashboard.insights.find(i => i.category === 'visibility');
            expect(visibilityInsight).toBeDefined();
        });
    });

    describe('getCandidatePipeline', () => {
        it('should return pipeline with all stages', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    applications: [
                        createMockApplication({ status: ApplicationStatus.PENDING }),
                        createMockApplication({ id: 'app-2', status: ApplicationStatus.UNDER_REVIEW }),
                        createMockApplication({ id: 'app-3', status: ApplicationStatus.INTERVIEW_SCHEDULED }),
                        createMockApplication({ id: 'app-4', status: ApplicationStatus.ACCEPTED })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const pipeline = await service.getCandidatePipeline('org-123');

            expect(pipeline).toBeDefined();
            expect(pipeline.stages).toHaveLength(6); // applied, screening, review, interview, offer, accepted
            expect(pipeline.stages[0].id).toBe('applied');
            expect(pipeline.stages[5].id).toBe('accepted');
        });

        it('should correctly categorize candidates by stage', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    applications: [
                        createMockApplication({ status: ApplicationStatus.PENDING }),
                        createMockApplication({ id: 'app-2', status: ApplicationStatus.PENDING }),
                        createMockApplication({ id: 'app-3', status: ApplicationStatus.ACCEPTED })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const pipeline = await service.getCandidatePipeline('org-123');

            const appliedStage = pipeline.stages.find(s => s.id === 'applied');
            const acceptedStage = pipeline.stages.find(s => s.id === 'accepted');

            expect(appliedStage?.metrics.count).toBe(2);
            expect(acceptedStage?.metrics.count).toBe(1);
        });

        it('should calculate stage metrics', async () => {
            const now = new Date();
            const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
            
            const mockRecruitments = [
                createMockRecruitment({
                    applications: [
                        createMockApplication({ appliedAt: oldDate, status: ApplicationStatus.PENDING }),
                        createMockApplication({ id: 'app-2', appliedAt: oldDate, status: ApplicationStatus.PENDING })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const pipeline = await service.getCandidatePipeline('org-123');

            const appliedStage = pipeline.stages.find(s => s.id === 'applied');
            expect(appliedStage?.metrics.avgDaysInStage).toBeGreaterThan(0);
        });

        it('should include pipeline summary', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    applications: [
                        createMockApplication({ status: ApplicationStatus.PENDING }),
                        createMockApplication({ id: 'app-2', status: ApplicationStatus.ACCEPTED })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const pipeline = await service.getCandidatePipeline('org-123');

            expect(pipeline.summary).toBeDefined();
            expect(pipeline.summary.totalCandidates).toBe(2);
            expect(pipeline.summary.overallConversionRate).toBeDefined();
        });

        it('should calculate stage transitions', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    applications: [
                        createMockApplication({ status: ApplicationStatus.ACCEPTED })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const pipeline = await service.getCandidatePipeline('org-123');

            expect(pipeline.transitions).toBeDefined();
            expect(Array.isArray(pipeline.transitions)).toBe(true);
        });

        it('should filter by recruitment ID when provided', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    id: 'specific-recruitment',
                    applications: [createMockApplication()]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const pipeline = await service.getCandidatePipeline('org-123', 'specific-recruitment');

            expect(pipeline.recruitmentId).toBe('specific-recruitment');
        });
    });

    describe('getPipelineHistory', () => {
        it('should return daily snapshots for specified period', async () => {
            const now = new Date();
            const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
            
            const mockRecruitments = [
                createMockRecruitment({
                    applications: [
                        createMockApplication({ appliedAt: recentDate }),
                        createMockApplication({ id: 'app-2', appliedAt: now })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const history = await service.getPipelineHistory('org-123', 30);

            expect(history).toBeDefined();
            expect(history.dailySnapshots).toBeDefined();
            expect(Array.isArray(history.dailySnapshots)).toBe(true);
            expect(history.periodDays).toBe(30);
        });

        it('should calculate stage velocity', async () => {
            const mockRecruitments = [createMockRecruitment()];
            mockRepository.find.mockResolvedValue(mockRecruitments);

            const history = await service.getPipelineHistory('org-123', 30);

            expect(history.stageVelocity).toBeDefined();
            expect(history.stageVelocity.applied).toBeDefined();
            expect(history.stageVelocity.accepted).toBeDefined();
        });
    });

    describe('getRecruitmentAnalytics', () => {
        it('should calculate basic analytics metrics', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    status: ActivityStatus.RECRUITING,
                    applications: [
                        createMockApplication({ status: ApplicationStatus.ACCEPTED }),
                        createMockApplication({ id: 'app-2', status: ApplicationStatus.PENDING })
                    ],
                    rolesNeeded: ['Pilot', 'Engineer'],
                    metadata: {
                        customData: {
                            skillMatchCriteria: {
                                requiredSkills: ['Flying', 'Combat']
                            }
                        }
                    }
                }),
                createMockRecruitment({
                    id: 'recruitment-2',
                    status: ActivityStatus.COMPLETED
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const analytics = await service.getRecruitmentAnalytics('org-123');

            expect(analytics).toBeDefined();
            expect(analytics.totalRecruitments).toBe(2);
            expect(analytics.activeRecruitments).toBe(1);
            expect(analytics.closedRecruitments).toBe(1);
            expect(analytics.totalApplications).toBe(2);
            expect(analytics.acceptedApplications).toBe(1);
            expect(analytics.pendingApplications).toBe(1);
        });

        it('should calculate conversion funnel', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    applications: [
                        createMockApplication({ status: ApplicationStatus.ACCEPTED }),
                        createMockApplication({ id: 'app-2', status: ApplicationStatus.UNDER_REVIEW }),
                        createMockApplication({ id: 'app-3', status: ApplicationStatus.PENDING })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const analytics = await service.getRecruitmentAnalytics('org-123');

            expect(analytics.conversionFunnel).toBeDefined();
            expect(analytics.conversionFunnel.applied).toBe(3);
            expect(analytics.conversionFunnel.accepted).toBe(1);
        });

        it('should track top skills needed', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    metadata: {
                        customData: {
                            skillMatchCriteria: {
                                requiredSkills: ['Flying', 'Combat']
                            }
                        }
                    }
                }),
                createMockRecruitment({
                    id: 'recruitment-2',
                    metadata: {
                        customData: {
                            skillMatchCriteria: {
                                requiredSkills: ['Flying', 'Mining']
                            }
                        }
                    }
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const analytics = await service.getRecruitmentAnalytics('org-123');

            expect(analytics.topSkillsNeeded).toBeDefined();
            expect(Array.isArray(analytics.topSkillsNeeded)).toBe(true);
        });
    });

    describe('Stage Mapping', () => {
        it('should correctly map all application statuses to pipeline stages', async () => {
            const mockRecruitments = [
                createMockRecruitment({
                    applications: [
                        createMockApplication({ status: ApplicationStatus.PENDING }),
                        createMockApplication({ id: 'app-2', status: ApplicationStatus.UNDER_REVIEW }),
                        createMockApplication({ id: 'app-3', status: ApplicationStatus.INTERVIEW_SCHEDULED }),
                        createMockApplication({ id: 'app-4', status: ApplicationStatus.WAITLISTED }),
                        createMockApplication({ id: 'app-5', status: ApplicationStatus.ACCEPTED }),
                        createMockApplication({ id: 'app-6', status: ApplicationStatus.COMPLETED })
                    ]
                })
            ];

            mockRepository.find.mockResolvedValue(mockRecruitments);

            const pipeline = await service.getCandidatePipeline('org-123');

            // Verify stages have correct candidates
            const appliedStage = pipeline.stages.find(s => s.id === 'applied');
            const screeningStage = pipeline.stages.find(s => s.id === 'screening');
            const interviewStage = pipeline.stages.find(s => s.id === 'interview');
            const offerStage = pipeline.stages.find(s => s.id === 'offer');
            const acceptedStage = pipeline.stages.find(s => s.id === 'accepted');

            expect(appliedStage?.metrics.count).toBe(1); // PENDING
            expect(screeningStage?.metrics.count).toBe(1); // UNDER_REVIEW
            expect(interviewStage?.metrics.count).toBe(1); // INTERVIEW_SCHEDULED
            expect(offerStage?.metrics.count).toBe(1); // WAITLISTED
            expect(acceptedStage?.metrics.count).toBe(2); // ACCEPTED + COMPLETED
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
