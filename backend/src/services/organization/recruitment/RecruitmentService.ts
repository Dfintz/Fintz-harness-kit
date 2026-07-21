import { AppDataSource } from '../../../data-source';
import {
  Activity,
  ActivityApplication,
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  ApplicationStatus,
} from '../../../models/Activity';
import { logger } from '../../../utils/logger';
import { PaginatedResponse } from '../../../utils/pagination';
import { TenantService } from '../../base/TenantService';

/**
 * Skill matching criteria for candidate evaluation
 */
export interface SkillMatchCriteria {
  requiredSkills: string[];
  preferredSkills?: string[];
  minimumExperience?: number; // In months
  requiredRoles?: string[];
  timezone?: string;
  languages?: string[];
}

/**
 * Recruitment metadata structure for type-safe access
 */
interface RecruitmentMetadata {
  customData?: {
    skillMatchCriteria?: SkillMatchCriteria;
  };
}

/**
 * Helper function to extract skill match criteria from activity metadata
 */
function getSkillMatchCriteria(activity: Activity): SkillMatchCriteria | undefined {
  const metadata = activity.metadata as RecruitmentMetadata | undefined;
  return metadata?.customData?.skillMatchCriteria;
}

/**
 * Candidate profile for matching
 */
export interface CandidateProfile {
  userId: string;
  skills: string[];
  experience: number;
  preferredRoles: string[];
  timezone?: string;
  languages?: string[];
  availability?: string[];
  reputation?: number;
}

/**
 * Skill match result
 */
export interface SkillMatchResult {
  candidateId: string;
  score: number;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  matchedPreferredSkills: string[];
  experienceMatch: boolean;
  timezoneMatch: boolean;
  recommendation: 'strong' | 'moderate' | 'weak' | 'not_recommended';
}

/**
 * Onboarding step for new recruits
 */
export interface OnboardingStep {
  id: string;
  name: string;
  description: string;
  order: number;
  isRequired: boolean;
  completedBy?: string;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

/**
 * Onboarding workflow for new members
 */
export interface OnboardingWorkflow {
  recruitmentId: string;
  candidateId: string;
  startedAt: Date;
  completedAt?: Date;
  steps: OnboardingStep[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  mentor?: {
    userId: string;
    userName: string;
    assignedAt: Date;
  };
}

/**
 * Recruitment analytics data
 */
export interface RecruitmentAnalytics {
  totalRecruitments: number;
  activeRecruitments: number;
  closedRecruitments: number;
  totalApplications: number;
  acceptedApplications: number;
  rejectedApplications: number;
  pendingApplications: number;
  averageTimeToFill: number; // In days
  applicationToAcceptanceRate: number;
  topSkillsNeeded: Array<{ skill: string; count: number }>;
  applicationsByRole: Record<string, number>;
  recruitmentsByMonth: Array<{ month: string; count: number }>;
  conversionFunnel: {
    applied: number;
    reviewed: number;
    interviewed: number;
    accepted: number;
  };
}

/**
 * Filter options for recruitment search
 */
export interface RecruitmentFilterOptions {
  status?: 'open' | 'closed' | 'paused';
  organizationId?: string;
  searchTerm?: string;
  skills?: string[];
  roles?: string[];
  hasOpenSlots?: boolean;
  page?: number;
  limit?: number;
}

/**
 * A single pending applicant on an organization's open recruitment posts,
 * flattened with its recruitment context. Returned by getPendingApplicantsForOrg
 * so callers never read Activity.applications directly.
 */
export interface RecruitmentPendingApplicant {
  applicationId: string;
  applicantId: string;
  applicantName?: string;
  rsiHandle?: string;
  status: ApplicationStatus;
  appliedAt: Date;
  recruitmentId: string;
  recruitmentTitle: string;
}

/**
 * RecruitmentService - Dedicated service for recruitment management
 *
 * Provides:
 * - Advanced skill matching algorithm
 * - Automated onboarding workflows
 * - Recruitment analytics dashboard
 * - Candidate evaluation and scoring
 *
 * This service extends the Activity system to provide specialized recruitment functionality.
 */
export class RecruitmentService extends TenantService<Activity> {
  private static instance: RecruitmentService;
  private onboardingWorkflows: Map<string, OnboardingWorkflow> = new Map();

  constructor() {
    super(AppDataSource.getRepository(Activity), {
      enableCache: true,
      cacheTTL: 300, // 5 minutes
      cacheCheckPeriod: 60,
    });
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RecruitmentService {
    if (!RecruitmentService.instance) {
      RecruitmentService.instance = new RecruitmentService();
    }
    return RecruitmentService.instance;
  }

  // ==================== RECRUITMENT CRUD ====================

  /**
   * Create a new recruitment posting
   */
  async createRecruitment(
    organizationId: string,
    data: {
      title: string;
      description: string;
      creatorId: string;
      creatorName: string;
      organizationName?: string;
      rolesNeeded: string[];
      requirements?: string;
      maxPositions?: number;
      skillMatchCriteria?: SkillMatchCriteria;
      visibility?: ActivityVisibility;
      expiresAt?: Date;
      tags?: string[];
    }
  ): Promise<Activity> {
    const recruitment = await this.create(organizationId, {
      title: data.title,
      description: data.description,
      activityType: ActivityType.RECRUITMENT,
      status: ActivityStatus.RECRUITING,
      visibility: data.visibility || ActivityVisibility.PUBLIC,
      creatorId: data.creatorId,
      creatorName: data.creatorName,
      organizationName: data.organizationName,
      maxParticipants: data.maxPositions,
      currentParticipants: 0,
      tags: data.tags || [],
      rolesNeeded: data.rolesNeeded,
      requirements: data.requirements,
      expiresAt: data.expiresAt,
      metadata: {
        customData: {
          skillMatchCriteria: data.skillMatchCriteria,
        },
      } as unknown as Activity['metadata'],
      participants: [],
      applications: [],
      invitedOrgs: [],
      alliedOrgs: [],
    });

    logger.info(`Created recruitment: ${recruitment.id}`, { organizationId, title: data.title });
    return recruitment;
  }

  /**
   * Get recruitments with filters
   */
  async getRecruitments(
    organizationId: string,
    filters: RecruitmentFilterOptions
  ): Promise<PaginatedResponse<Activity>> {
    const queryBuilder = this.repository
      .createQueryBuilder('activity')
      .where('activity.activityType = :type', { type: ActivityType.RECRUITMENT });

    // Filter by organization if specified
    if (filters.organizationId) {
      queryBuilder.andWhere('activity.organizationId = :orgId', { orgId: filters.organizationId });
    } else {
      // Default to public or organization's own
      queryBuilder.andWhere('(activity.organizationId = :orgId OR activity.visibility = :public)', {
        orgId: organizationId,
        public: ActivityVisibility.PUBLIC,
      });
    }

    // Filter by status
    if (filters.status) {
      const statusMap: Record<string, ActivityStatus[]> = {
        open: [ActivityStatus.OPEN, ActivityStatus.RECRUITING],
        closed: [ActivityStatus.COMPLETED, ActivityStatus.CANCELLED, ActivityStatus.EXPIRED],
        paused: [ActivityStatus.DRAFT, ActivityStatus.PLANNING],
      };
      queryBuilder.andWhere('activity.status IN (:...statuses)', {
        statuses: statusMap[filters.status] || [ActivityStatus.RECRUITING],
      });
    }

    // Search term
    if (filters.searchTerm) {
      queryBuilder.andWhere(
        '(activity.title ILIKE :search OR activity.description ILIKE :search)',
        { search: `%${filters.searchTerm}%` }
      );
    }

    // Filter by skills - use metadata customData path
    if (filters.skills && filters.skills.length > 0) {
      // Skills stored in metadata.customData.skillMatchCriteria
      queryBuilder.andWhere(
        `activity.metadata::jsonb -> 'customData' -> 'skillMatchCriteria' -> 'requiredSkills' ?| array[:...skills]`,
        { skills: filters.skills }
      );
    }

    // Filter by roles
    if (filters.roles && filters.roles.length > 0) {
      queryBuilder.andWhere('activity.rolesNeeded && :roles', { roles: filters.roles });
    }

    // Filter by open slots
    if (filters.hasOpenSlots) {
      queryBuilder.andWhere(
        '(activity.maxParticipants IS NULL OR activity.currentParticipants < activity.maxParticipants)'
      );
    }

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.orderBy('activity.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // ==================== SKILL MATCHING ====================

  /**
   * Calculate skill match score between candidate and recruitment
   */
  calculateSkillMatch(candidate: CandidateProfile, criteria: SkillMatchCriteria): SkillMatchResult {
    const result: SkillMatchResult = {
      candidateId: candidate.userId,
      score: 0,
      matchedSkills: [],
      missingRequiredSkills: [],
      matchedPreferredSkills: [],
      experienceMatch: true,
      timezoneMatch: true,
      recommendation: 'not_recommended',
    };

    // Normalize skills for comparison
    const normalizedCandidateSkills = candidate.skills.map(s => s.toLowerCase().trim());
    const normalizedRequiredSkills = criteria.requiredSkills.map(s => s.toLowerCase().trim());
    const normalizedPreferredSkills = (criteria.preferredSkills || []).map(s =>
      s.toLowerCase().trim()
    );

    // Check required skills (weighted: 60% of score)
    for (const skill of normalizedRequiredSkills) {
      if (normalizedCandidateSkills.includes(skill)) {
        result.matchedSkills.push(skill);
      } else {
        result.missingRequiredSkills.push(skill);
      }
    }

    const requiredSkillScore =
      normalizedRequiredSkills.length > 0
        ? (result.matchedSkills.length / normalizedRequiredSkills.length) * 60
        : 60;

    // Check preferred skills (weighted: 20% of score)
    for (const skill of normalizedPreferredSkills) {
      if (normalizedCandidateSkills.includes(skill)) {
        result.matchedPreferredSkills.push(skill);
      }
    }

    const preferredSkillScore =
      normalizedPreferredSkills.length > 0
        ? (result.matchedPreferredSkills.length / normalizedPreferredSkills.length) * 20
        : 20;

    // Check experience (weighted: 10% of score)
    if (criteria.minimumExperience && criteria.minimumExperience > 0) {
      result.experienceMatch = candidate.experience >= criteria.minimumExperience;
    }
    const experienceScore = result.experienceMatch ? 10 : 0;

    // Check timezone match (weighted: 5% of score)
    if (criteria.timezone && candidate.timezone) {
      result.timezoneMatch = candidate.timezone === criteria.timezone;
    }
    const timezoneScore = result.timezoneMatch ? 5 : 0;

    // Role match bonus (weighted: 5% of score)
    let roleScore = 0;
    if (criteria.requiredRoles && criteria.requiredRoles.length > 0) {
      const matchedRoles = candidate.preferredRoles.filter(r =>
        // @ts-expect-error - Strict mode compatibility
        criteria.requiredRoles.includes(r)
      );
      roleScore = matchedRoles.length > 0 ? 5 : 0;
    } else {
      roleScore = 5;
    }

    // Calculate total score
    result.score = Math.round(
      requiredSkillScore + preferredSkillScore + experienceScore + timezoneScore + roleScore
    );

    // Determine recommendation
    if (result.missingRequiredSkills.length > 0) {
      // Missing required skills
      if (result.score >= 70) {
        result.recommendation = 'moderate';
      } else {
        result.recommendation = 'not_recommended';
      }
    } else {
      // Has all required skills
      if (result.score >= 90) {
        result.recommendation = 'strong';
      } else if (result.score >= 70) {
        result.recommendation = 'moderate';
      } else {
        result.recommendation = 'weak';
      }
    }

    logger.debug('Calculated skill match', {
      candidateId: candidate.userId,
      score: result.score,
      recommendation: result.recommendation,
    });

    return result;
  }

  /**
   * Find best matching candidates for a recruitment
   */
  async findMatchingCandidates(
    recruitmentId: string,
    candidates: CandidateProfile[],
    minScore: number = 50
  ): Promise<SkillMatchResult[]> {
    const recruitment = await this.repository.findOne({
      where: { id: recruitmentId, activityType: ActivityType.RECRUITMENT },
    });

    if (!recruitment) {
      throw new Error('Recruitment not found');
    }

    const criteria = getSkillMatchCriteria(recruitment);
    if (!criteria?.requiredSkills) {
      // No criteria defined, return all candidates with base score
      return candidates.map(c => ({
        candidateId: c.userId,
        score: 50,
        matchedSkills: [],
        missingRequiredSkills: [],
        matchedPreferredSkills: [],
        experienceMatch: true,
        timezoneMatch: true,
        recommendation: 'moderate' as const,
      }));
    }

    const results = candidates
      .map(candidate => this.calculateSkillMatch(candidate, criteria))
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score);

    logger.info(`Found ${results.length} matching candidates for recruitment ${recruitmentId}`);
    return results;
  }

  // ==================== ONBOARDING WORKFLOW ====================

  /**
   * Create onboarding workflow for accepted candidate
   */
  async createOnboardingWorkflow(
    recruitmentId: string,
    candidateId: string,
    customSteps?: Partial<OnboardingStep>[]
  ): Promise<OnboardingWorkflow> {
    // Default onboarding steps
    const defaultSteps: OnboardingStep[] = [
      {
        id: 'welcome',
        name: 'Welcome & Introduction',
        description: 'Welcome new member and introduce them to the organization',
        order: 1,
        isRequired: true,
        status: 'pending',
      },
      {
        id: 'discord_verification',
        name: 'Discord Verification',
        description: 'Verify Discord account and assign roles',
        order: 2,
        isRequired: true,
        status: 'pending',
      },
      {
        id: 'org_tour',
        name: 'Organization Tour',
        description: 'Virtual tour of organization resources and channels',
        order: 3,
        isRequired: false,
        status: 'pending',
      },
      {
        id: 'skill_assessment',
        name: 'Skill Assessment',
        description: 'Assess member skills and assign appropriate roles',
        order: 4,
        isRequired: true,
        status: 'pending',
      },
      {
        id: 'team_assignment',
        name: 'Team Assignment',
        description: 'Assign member to appropriate team or squadron',
        order: 5,
        isRequired: true,
        status: 'pending',
      },
      {
        id: 'first_activity',
        name: 'First Activity',
        description: 'Participate in first organization activity',
        order: 6,
        isRequired: false,
        status: 'pending',
      },
    ];

    // Merge custom steps if provided
    const steps =
      customSteps && customSteps.length > 0
        ? customSteps.map((step, index) => ({
            id: step.id || `custom_${index}`,
            name: step.name || `Step ${index + 1}`,
            description: step.description || '',
            order: step.order ?? index + 1,
            isRequired: step.isRequired ?? true,
            status: 'pending' as const,
          }))
        : defaultSteps;

    const workflow: OnboardingWorkflow = {
      recruitmentId,
      candidateId,
      startedAt: new Date(),
      steps,
      status: 'pending',
    };

    this.onboardingWorkflows.set(`${recruitmentId}:${candidateId}`, workflow);

    logger.info(`Created onboarding workflow for candidate ${candidateId}`, {
      recruitmentId,
      stepsCount: steps.length,
    });

    return workflow;
  }

  /**
   * Get onboarding workflow status
   */
  async getOnboardingWorkflow(
    recruitmentId: string,
    candidateId: string
  ): Promise<OnboardingWorkflow | null> {
    return this.onboardingWorkflows.get(`${recruitmentId}:${candidateId}`) || null;
  }

  /**
   * Complete an onboarding step
   */
  async completeOnboardingStep(
    recruitmentId: string,
    candidateId: string,
    stepId: string,
    completedBy: string
  ): Promise<OnboardingWorkflow | null> {
    const workflow = this.onboardingWorkflows.get(`${recruitmentId}:${candidateId}`);
    if (!workflow) {
      return null;
    }

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in workflow`);
    }

    step.status = 'completed';
    step.completedBy = completedBy;
    step.completedAt = new Date();

    // Update workflow status
    workflow.status = 'in_progress';

    const allRequiredCompleted = workflow.steps
      .filter(s => s.isRequired)
      .every(s => s.status === 'completed');

    if (allRequiredCompleted) {
      workflow.status = 'completed';
      workflow.completedAt = new Date();
    }

    this.onboardingWorkflows.set(`${recruitmentId}:${candidateId}`, workflow);

    logger.info(`Completed onboarding step ${stepId} for candidate ${candidateId}`, {
      recruitmentId,
      workflowStatus: workflow.status,
    });

    return workflow;
  }

  /**
   * Assign mentor to new recruit
   */
  async assignMentor(
    recruitmentId: string,
    candidateId: string,
    mentorId: string,
    mentorName: string
  ): Promise<OnboardingWorkflow | null> {
    const workflow = this.onboardingWorkflows.get(`${recruitmentId}:${candidateId}`);
    if (!workflow) {
      return null;
    }

    workflow.mentor = {
      userId: mentorId,
      userName: mentorName,
      assignedAt: new Date(),
    };

    this.onboardingWorkflows.set(`${recruitmentId}:${candidateId}`, workflow);

    logger.info(`Assigned mentor ${mentorName} to candidate ${candidateId}`, { recruitmentId });

    return workflow;
  }

  // ==================== RECRUITMENT ANALYTICS ====================

  /**
   * Get recruitment analytics for organization
   */
  async getRecruitmentAnalytics(organizationId: string): Promise<RecruitmentAnalytics> {
    // Get all recruitments for the organization
    const recruitments = await this.repository.find({
      where: {
        organizationId,
        activityType: ActivityType.RECRUITMENT,
      },
    });

    const totalRecruitments = recruitments.length;
    const activeRecruitments = recruitments.filter(r =>
      [ActivityStatus.OPEN, ActivityStatus.RECRUITING].includes(r.status)
    ).length;
    const closedRecruitments = recruitments.filter(r =>
      [ActivityStatus.COMPLETED, ActivityStatus.CANCELLED, ActivityStatus.EXPIRED].includes(
        r.status
      )
    ).length;

    // Aggregate application stats
    let totalApplications = 0;
    let acceptedApplications = 0;
    let rejectedApplications = 0;
    let pendingApplications = 0;
    const skillCounts: Record<string, number> = {};
    const roleCounts: Record<string, number> = {};

    for (const recruitment of recruitments) {
      const applications = recruitment.applications || [];
      totalApplications += applications.length;

      for (const app of applications) {
        if (app.status === ApplicationStatus.ACCEPTED) {
          acceptedApplications++;
        } else if (app.status === ApplicationStatus.REJECTED) {
          rejectedApplications++;
        } else if (app.status === ApplicationStatus.PENDING) {
          pendingApplications++;
        }
      }

      // Count skills needed
      const criteria = getSkillMatchCriteria(recruitment);
      if (criteria?.requiredSkills) {
        for (const skill of criteria.requiredSkills) {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
        }
      }

      // Count roles
      const rolesNeeded = recruitment.rolesNeeded || [];
      for (const role of rolesNeeded) {
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      }
    }

    // Calculate average time to fill (for completed recruitments)
    const completedRecruitments = recruitments.filter(r => r.status === ActivityStatus.COMPLETED);
    let averageTimeToFill = 0;
    if (completedRecruitments.length > 0) {
      const totalDays = completedRecruitments.reduce((sum, r) => {
        const created = new Date(r.createdAt);
        const updated = new Date(r.updatedAt);
        return sum + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      averageTimeToFill = Math.round(totalDays / completedRecruitments.length);
    }

    // Application to acceptance rate
    const applicationToAcceptanceRate =
      totalApplications > 0 ? Math.round((acceptedApplications / totalApplications) * 100) : 0;

    // Top skills needed
    const topSkillsNeeded = Object.entries(skillCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));

    // Recruitments by month
    const recruitmentsByMonth = this.groupByMonth(recruitments);

    // Conversion funnel
    const conversionFunnel = {
      applied: totalApplications,
      reviewed: totalApplications - pendingApplications,
      interviewed: Math.floor((totalApplications - pendingApplications) * 0.5), // Estimate
      accepted: acceptedApplications,
    };

    const analytics: RecruitmentAnalytics = {
      totalRecruitments,
      activeRecruitments,
      closedRecruitments,
      totalApplications,
      acceptedApplications,
      rejectedApplications,
      pendingApplications,
      averageTimeToFill,
      applicationToAcceptanceRate,
      topSkillsNeeded,
      applicationsByRole: roleCounts,
      recruitmentsByMonth,
      conversionFunnel,
    };

    logger.info('Generated recruitment analytics', { organizationId, totalRecruitments });

    return analytics;
  }

  /**
   * Group recruitments by month for analytics
   */
  private groupByMonth(recruitments: Activity[]): Array<{ month: string; count: number }> {
    const monthCounts: Record<string, number> = {};

    for (const recruitment of recruitments) {
      const date = new Date(recruitment.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
    }

    return Object.entries(monthCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 months
      .map(([month, count]) => ({ month, count }));
  }

  // ==================== APPLICATION MANAGEMENT ====================

  /**
   * Automatically evaluate and score an application
   */
  async evaluateApplication(
    recruitmentId: string,
    applicationId: string,
    candidateProfile: CandidateProfile
  ): Promise<{
    application: ActivityApplication;
    matchResult: SkillMatchResult;
    autoApproved: boolean;
  }> {
    const recruitment = await this.repository.findOne({
      where: { id: recruitmentId, activityType: ActivityType.RECRUITMENT },
    });

    if (!recruitment) {
      throw new Error('Recruitment not found');
    }

    const applications = recruitment.applications || [];
    const application = applications.find(a => a.id === applicationId);

    if (!application) {
      throw new Error('Application not found');
    }

    // Calculate skill match
    const criteria = getSkillMatchCriteria(recruitment);
    const matchResult = criteria
      ? this.calculateSkillMatch(candidateProfile, criteria)
      : {
          candidateId: candidateProfile.userId,
          score: 50,
          matchedSkills: [],
          missingRequiredSkills: [],
          matchedPreferredSkills: [],
          experienceMatch: true,
          timezoneMatch: true,
          recommendation: 'moderate' as const,
        };

    // Update application with screening result
    application.screeningResults = [
      {
        criterionId: 'skill_match',
        criterionName: 'Skill Match Assessment',
        passed: matchResult.recommendation !== 'not_recommended',
        actualValue: matchResult.score,
        expectedValue: 70,
        reason: `Score: ${matchResult.score}%, Recommendation: ${matchResult.recommendation}`,
      },
    ];
    application.screeningScore = matchResult.score;
    application.screeningPassed = matchResult.recommendation !== 'not_recommended';

    // Check for auto-approval
    let autoApproved = false;
    if (recruitment.autoAcceptQualified && matchResult.recommendation === 'strong') {
      application.status = ApplicationStatus.ACCEPTED;
      application.reviewedAt = new Date();
      application.feedback = 'Auto-approved based on skill match';
      autoApproved = true;
    } else if (matchResult.recommendation === 'not_recommended') {
      application.status = ApplicationStatus.UNDER_REVIEW;
    } else {
      application.status = ApplicationStatus.UNDER_REVIEW;
    }

    // Save updated recruitment
    await this.repository.save(recruitment);

    logger.info(`Evaluated application ${applicationId}`, {
      recruitmentId,
      score: matchResult.score,
      recommendation: matchResult.recommendation,
      autoApproved,
    });

    return {
      application,
      matchResult,
      autoApproved,
    };
  }

  /**
   * Get application statistics for a recruitment
   */
  async getApplicationStats(recruitmentId: string): Promise<{
    total: number;
    byStatus: Record<ApplicationStatus, number>;
    averageScore: number;
    topCandidates: Array<{ applicantId: string; applicantName: string; score: number }>;
  }> {
    const recruitment = await this.repository.findOne({
      where: { id: recruitmentId, activityType: ActivityType.RECRUITMENT },
    });

    if (!recruitment) {
      throw new Error('Recruitment not found');
    }

    const applications = recruitment.applications || [];

    const byStatus: Record<ApplicationStatus, number> = {
      [ApplicationStatus.PENDING]: 0,
      [ApplicationStatus.UNDER_REVIEW]: 0,
      [ApplicationStatus.INTERVIEW_SCHEDULED]: 0,
      [ApplicationStatus.ACCEPTED]: 0,
      [ApplicationStatus.REJECTED]: 0,
      [ApplicationStatus.WITHDRAWN]: 0,
      [ApplicationStatus.WAITLISTED]: 0,
      [ApplicationStatus.COMPLETED]: 0,
    };

    let totalScore = 0;
    let scoreCount = 0;
    const candidates: Array<{ applicantId: string; applicantName: string; score: number }> = [];

    for (const app of applications) {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;

      if (app.screeningScore) {
        totalScore += app.screeningScore;
        scoreCount++;
        candidates.push({
          applicantId: app.applicantId,
          applicantName: app.applicantName,
          score: app.screeningScore,
        });
      }
    }

    const topCandidates = candidates.sort((a, b) => b.score - a.score).slice(0, 5);

    return {
      total: applications.length,
      byStatus,
      averageScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
      topCandidates,
    };
  }

  /**
   * Get pending applicants across all of an organization's open recruitment
   * posts, flattened with recruitment context.
   *
   * Keeps Activity.applications access inside the recruitment domain so callers
   * (e.g. MembershipIntakeService) orchestrate without touching activity rows.
   */
  async getPendingApplicantsForOrg(organizationId: string): Promise<RecruitmentPendingApplicant[]> {
    // simplify-debt: caps at the first 100 open posts; revisit if an org runs more concurrent recruitment posts
    const { data: recruitments } = await this.getRecruitments(organizationId, {
      organizationId,
      status: 'open',
      page: 1,
      limit: 100,
    });

    const pending: RecruitmentPendingApplicant[] = [];
    for (const recruitment of recruitments) {
      const applications: ActivityApplication[] = recruitment.applications ?? [];
      for (const app of applications) {
        if (app.status !== ApplicationStatus.PENDING) {
          continue;
        }
        pending.push({
          applicationId: app.applicationId ?? app.id ?? '',
          applicantId: app.applicantId ?? app.userId ?? '',
          applicantName: app.applicantName ?? app.userName,
          rsiHandle: app.rsiHandle,
          status: app.status,
          appliedAt: app.appliedAt ?? recruitment.createdAt,
          recruitmentId: recruitment.id,
          recruitmentTitle: recruitment.title,
        });
      }
    }
    return pending;
  }

  // ==================== RECRUITMENT ANALYTICS DASHBOARD ====================

  /**
   * Get comprehensive recruitment analytics dashboard data
   * Includes trends, performance metrics, and actionable insights
   */
  async getRecruitmentDashboard(organizationId: string): Promise<RecruitmentDashboard> {
    const recruitments = await this.repository.find({
      where: {
        organizationId,
        activityType: ActivityType.RECRUITMENT,
      },
      order: { createdAt: 'DESC' },
    });

    // Current metrics
    const activeRecruitments = recruitments.filter(r =>
      [ActivityStatus.OPEN, ActivityStatus.RECRUITING].includes(r.status)
    );

    // Calculate time-based metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const recentRecruitments = recruitments.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);
    const previousRecruitments = recruitments.filter(
      r => new Date(r.createdAt) >= sixtyDaysAgo && new Date(r.createdAt) < thirtyDaysAgo
    );

    // Application metrics
    let totalApplications = 0;
    let recentApplications = 0;
    let acceptedApplications = 0;
    const applicationsByDay: Map<string, number> = new Map();

    for (const recruitment of recruitments) {
      const applications = recruitment.applications || [];
      totalApplications += applications.length;

      for (const app of applications) {
        const appDate = new Date(app.appliedAt);
        if (appDate >= thirtyDaysAgo) {
          recentApplications++;
          const dayKey = appDate.toISOString().split('T')[0];
          applicationsByDay.set(dayKey, (applicationsByDay.get(dayKey) || 0) + 1);
        }
        if (app.status === ApplicationStatus.ACCEPTED) {
          acceptedApplications++;
        }
      }
    }

    // Calculate trends
    const previousApplications = this.countApplicationsInPeriod(
      recruitments.filter(r => new Date(r.createdAt) >= sixtyDaysAgo),
      sixtyDaysAgo,
      thirtyDaysAgo
    );

    const applicationTrend =
      previousApplications > 0
        ? ((recentApplications - previousApplications) / previousApplications) * 100
        : recentApplications > 0
          ? 100
          : 0;

    // Efficiency metrics
    const avgTimeToFirstReview = this.calculateAverageTimeToFirstReview(recruitments);
    const avgTimeToHire = this.calculateAverageTimeToHire(recruitments);

    // Performance by source (if tracked)
    const performanceBySource = this.calculatePerformanceBySource(recruitments);

    // Generate insights
    const insights = this.generateRecruitmentInsights(recruitments, {
      recentApplications,
      previousApplications,
      avgTimeToHire,
      acceptedApplications,
      totalApplications,
    });

    // Urgency metrics
    const urgentRecruitments = activeRecruitments.filter(r => {
      const applications = r.applications || [];
      return (
        applications.length === 0 &&
        new Date(r.createdAt) < new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
      );
    });

    const dashboard: RecruitmentDashboard = {
      summary: {
        totalRecruitments: recruitments.length,
        activeRecruitments: activeRecruitments.length,
        totalApplications,
        recentApplications,
        acceptedThisMonth: this.countAcceptedInPeriod(recruitments, thirtyDaysAgo, now),
        pendingReview: this.countPendingReview(recruitments),
      },
      trends: {
        applicationTrend: Math.round(applicationTrend * 10) / 10,
        recruitmentTrend:
          previousRecruitments.length > 0
            ? Math.round(
                ((recentRecruitments.length - previousRecruitments.length) /
                  previousRecruitments.length) *
                  100 *
                  10
              ) / 10
            : recentRecruitments.length > 0
              ? 100
              : 0,
        acceptanceRateTrend: this.calculateAcceptanceRateTrend(
          recruitments,
          thirtyDaysAgo,
          sixtyDaysAgo
        ),
      },
      efficiency: {
        avgTimeToFirstReview,
        avgTimeToHire,
        avgApplicationsPerPosition:
          activeRecruitments.length > 0
            ? Math.round(totalApplications / activeRecruitments.length)
            : 0,
        fillRate:
          recruitments.length > 0
            ? Math.round(
                (recruitments.filter(r => r.status === ActivityStatus.COMPLETED).length /
                  recruitments.length) *
                  100
              )
            : 0,
      },
      performanceBySource,
      applicationsByDay: Array.from(applicationsByDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      urgentItems: {
        recruitmentWithNoApplicants: urgentRecruitments.length,
        applicationsPendingOver7Days: this.countOldPendingApplications(recruitments, 7),
        expiringRecruitments: this.countExpiringRecruitments(activeRecruitments, 7),
      },
      insights,
      lastUpdated: new Date(),
    };

    logger.info('Generated recruitment dashboard', { organizationId });

    return dashboard;
  }

  // ==================== CANDIDATE PIPELINE VISUALIZATION ====================

  /**
   * Get candidate pipeline stages with counts and movement metrics
   * Provides visualization-ready data for candidate flow
   */
  async getCandidatePipeline(
    organizationId: string,
    recruitmentId?: string
  ): Promise<CandidatePipeline> {
    const where: Record<string, unknown> = {
      organizationId,
      activityType: ActivityType.RECRUITMENT,
    };

    if (recruitmentId) {
      where.id = recruitmentId;
    }

    const recruitments = await this.repository.find({ where });

    // Define pipeline stages
    const stages: PipelineStage[] = [
      {
        id: 'applied',
        name: 'Applied',
        order: 1,
        color: '#6366F1',
        candidates: [],
        metrics: { count: 0, avgDaysInStage: 0, conversionRate: 0 },
      },
      {
        id: 'screening',
        name: 'Screening',
        order: 2,
        color: '#8B5CF6',
        candidates: [],
        metrics: { count: 0, avgDaysInStage: 0, conversionRate: 0 },
      },
      {
        id: 'review',
        name: 'Under Review',
        order: 3,
        color: '#EC4899',
        candidates: [],
        metrics: { count: 0, avgDaysInStage: 0, conversionRate: 0 },
      },
      {
        id: 'interview',
        name: 'Interview',
        order: 4,
        color: '#F59E0B',
        candidates: [],
        metrics: { count: 0, avgDaysInStage: 0, conversionRate: 0 },
      },
      {
        id: 'offer',
        name: 'Offer Extended',
        order: 5,
        color: '#10B981',
        candidates: [],
        metrics: { count: 0, avgDaysInStage: 0, conversionRate: 0 },
      },
      {
        id: 'accepted',
        name: 'Accepted',
        order: 6,
        color: '#059669',
        candidates: [],
        metrics: { count: 0, avgDaysInStage: 0, conversionRate: 0 },
      },
    ];

    // Track stage transitions for flow visualization
    const stageTransitions: StageTransition[] = [];

    // Process all applications
    for (const recruitment of recruitments) {
      const applications = recruitment.applications || [];

      for (const app of applications) {
        const candidateInfo: PipelineCandidate = {
          // @ts-expect-error - Strict mode compatibility
          id: app.id,
          applicantId: app.applicantId,
          applicantName: app.applicantName,
          recruitmentId: recruitment.id,
          recruitmentTitle: recruitment.title,
          currentStage: this.mapStatusToStage(app.status),
          appliedAt: app.appliedAt,
          lastUpdated: app.reviewedAt || app.appliedAt,
          score: app.screeningScore,
          daysInCurrentStage: this.calculateDaysInStage(app),
        };

        // Add to appropriate stage
        const stage = stages.find(s => s.id === candidateInfo.currentStage);
        if (stage) {
          stage.candidates.push(candidateInfo);
          stage.metrics.count++;
        }
      }
    }

    // Calculate stage metrics
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const nextStage = stages[i + 1];

      // Average days in stage
      if (stage.candidates.length > 0) {
        stage.metrics.avgDaysInStage = Math.round(
          stage.candidates.reduce((sum, c) => sum + c.daysInCurrentStage, 0) /
            stage.candidates.length
        );
      }

      // Conversion rate to next stage
      if (nextStage && stage.metrics.count > 0) {
        const totalPastThisStage = stages
          .filter(s => s.order >= stage.order)
          .reduce((sum, s) => sum + s.metrics.count, 0);
        const totalPastNextStage = stages
          .filter(s => s.order >= nextStage.order)
          .reduce((sum, s) => sum + s.metrics.count, 0);

        stage.metrics.conversionRate =
          totalPastThisStage > 0 ? Math.round((totalPastNextStage / totalPastThisStage) * 100) : 0;
      }

      // Create transitions for visualization
      if (nextStage) {
        stageTransitions.push({
          fromStage: stage.id,
          toStage: nextStage.id,
          count: nextStage.metrics.count,
          conversionRate: stage.metrics.conversionRate,
        });
      }
    }

    // Calculate overall funnel metrics
    const totalApplicants = stages.reduce((sum, s) => sum + s.metrics.count, 0);
    const acceptedCount = stages.find(s => s.id === 'accepted')?.metrics.count || 0;

    const pipeline: CandidatePipeline = {
      stages,
      transitions: stageTransitions,
      summary: {
        totalCandidates: totalApplicants,
        overallConversionRate:
          totalApplicants > 0 ? Math.round((acceptedCount / totalApplicants) * 100) : 0,
        avgTimeToHire: this.calculateAverageTimeToHire(recruitments),
        bottleneckStage: this.identifyBottleneck(stages),
      },
      recruitmentId,
      organizationId,
      generatedAt: new Date(),
    };

    logger.info('Generated candidate pipeline', {
      organizationId,
      recruitmentId,
      totalCandidates: totalApplicants,
    });

    return pipeline;
  }

  /**
   * Get pipeline movement history for trend analysis
   */
  async getPipelineHistory(organizationId: string, days: number = 30): Promise<PipelineHistory> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const recruitments = await this.repository.find({
      where: {
        organizationId,
        activityType: ActivityType.RECRUITMENT,
      },
    });

    // Track daily counts by stage
    const dailyData: Map<string, Record<string, number>> = new Map();

    for (let d = 0; d <= days; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d);
      const dateKey = date.toISOString().split('T')[0];
      dailyData.set(dateKey, {
        applied: 0,
        screening: 0,
        review: 0,
        interview: 0,
        offer: 0,
        accepted: 0,
        rejected: 0,
        withdrawn: 0,
      });
    }

    // Process applications to build historical data
    for (const recruitment of recruitments) {
      const applications = recruitment.applications || [];

      for (const app of applications) {
        const appDate = new Date(app.appliedAt);
        if (appDate >= startDate) {
          const dateKey = appDate.toISOString().split('T')[0];
          const dayData = dailyData.get(dateKey);
          if (dayData) {
            dayData.applied++;
          }
        }

        // Track review date if available
        if (app.reviewedAt && new Date(app.reviewedAt) >= startDate) {
          const dateKey = new Date(app.reviewedAt).toISOString().split('T')[0];
          const dayData = dailyData.get(dateKey);
          if (dayData) {
            const stage = this.mapStatusToStage(app.status);
            if (stage !== 'applied' && dayData[stage] !== undefined) {
              dayData[stage]++;
            }
          }
        }
      }
    }

    // Convert to array format
    const history: PipelineHistory = {
      organizationId,
      periodDays: days,
      dailySnapshots: Array.from(dailyData.entries())
        .map(([date, stages]) => ({ date, stages }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      stageVelocity: this.calculateStageVelocity(recruitments, days),
      generatedAt: new Date(),
    };

    return history;
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Count applications in a time period
   */
  private countApplicationsInPeriod(recruitments: Activity[], start: Date, end: Date): number {
    let count = 0;
    for (const r of recruitments) {
      const apps = r.applications || [];
      for (const app of apps) {
        const appDate = new Date(app.appliedAt);
        if (appDate >= start && appDate < end) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Count accepted applications in a period
   */
  private countAcceptedInPeriod(recruitments: Activity[], start: Date, end: Date): number {
    let count = 0;
    for (const r of recruitments) {
      const apps = r.applications || [];
      for (const app of apps) {
        if (
          app.status === ApplicationStatus.ACCEPTED &&
          app.reviewedAt &&
          new Date(app.reviewedAt) >= start &&
          new Date(app.reviewedAt) < end
        ) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Count pending review applications
   */
  private countPendingReview(recruitments: Activity[]): number {
    let count = 0;
    for (const r of recruitments) {
      const apps = r.applications || [];
      for (const app of apps) {
        if ([ApplicationStatus.PENDING, ApplicationStatus.UNDER_REVIEW].includes(app.status)) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Calculate average time to first review
   */
  private calculateAverageTimeToFirstReview(recruitments: Activity[]): number {
    let totalDays = 0;
    let count = 0;

    for (const r of recruitments) {
      const apps = r.applications || [];
      for (const app of apps) {
        if (app.reviewedAt && app.status !== ApplicationStatus.PENDING) {
          const applied = new Date(app.appliedAt);
          const reviewed = new Date(app.reviewedAt);
          totalDays += Math.ceil((reviewed.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
          count++;
        }
      }
    }

    return count > 0 ? Math.round(totalDays / count) : 0;
  }

  /**
   * Calculate average time to hire
   */
  private calculateAverageTimeToHire(recruitments: Activity[]): number {
    let totalDays = 0;
    let count = 0;

    for (const r of recruitments) {
      const apps = r.applications || [];
      for (const app of apps) {
        if (app.status === ApplicationStatus.ACCEPTED && app.reviewedAt) {
          const applied = new Date(app.appliedAt);
          const accepted = new Date(app.reviewedAt);
          totalDays += Math.ceil((accepted.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
          count++;
        }
      }
    }

    return count > 0 ? Math.round(totalDays / count) : 0;
  }

  /**
   * Calculate performance by source
   */
  private calculatePerformanceBySource(
    recruitments: Activity[]
  ): Record<string, SourcePerformance> {
    const sources: Record<
      string,
      { applied: number; accepted: number; totalScore: number; scoreCount: number }
    > = {};

    for (const r of recruitments) {
      const apps = r.applications || [];
      for (const app of apps) {
        const source =
          ((app.screeningResults as unknown as Record<string, unknown>)?.source as string) ||
          'direct';
        if (!sources[source]) {
          sources[source] = { applied: 0, accepted: 0, totalScore: 0, scoreCount: 0 };
        }
        sources[source].applied++;
        if (app.status === ApplicationStatus.ACCEPTED) {
          sources[source].accepted++;
        }
        if (app.screeningScore) {
          sources[source].totalScore += app.screeningScore;
          sources[source].scoreCount++;
        }
      }
    }

    const result: Record<string, SourcePerformance> = {};
    for (const [source, data] of Object.entries(sources)) {
      result[source] = {
        applications: data.applied,
        acceptanceRate: data.applied > 0 ? Math.round((data.accepted / data.applied) * 100) : 0,
        avgScore: data.scoreCount > 0 ? Math.round(data.totalScore / data.scoreCount) : 0,
      };
    }

    return result;
  }

  /**
   * Calculate acceptance rate trend
   */
  private calculateAcceptanceRateTrend(
    recruitments: Activity[],
    thirtyDaysAgo: Date,
    sixtyDaysAgo: Date
  ): number {
    const now = new Date();

    let recentAccepted = 0;
    let recentTotal = 0;
    let prevAccepted = 0;
    let prevTotal = 0;

    for (const r of recruitments) {
      const apps = r.applications || [];
      for (const app of apps) {
        const appDate = new Date(app.appliedAt);
        if (appDate >= thirtyDaysAgo && appDate < now) {
          recentTotal++;
          if (app.status === ApplicationStatus.ACCEPTED) {
            recentAccepted++;
          }
        } else if (appDate >= sixtyDaysAgo && appDate < thirtyDaysAgo) {
          prevTotal++;
          if (app.status === ApplicationStatus.ACCEPTED) {
            prevAccepted++;
          }
        }
      }
    }

    const recentRate = recentTotal > 0 ? recentAccepted / recentTotal : 0;
    const prevRate = prevTotal > 0 ? prevAccepted / prevTotal : 0;

    return prevRate > 0
      ? Math.round(((recentRate - prevRate) / prevRate) * 100 * 10) / 10
      : recentRate > 0
        ? 100
        : 0;
  }

  /**
   * Count old pending applications
   */
  private countOldPendingApplications(recruitments: Activity[], days: number): number {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);
    let count = 0;

    for (const r of recruitments) {
      const apps = r.applications || [];
      for (const app of apps) {
        if (app.status === ApplicationStatus.PENDING && new Date(app.appliedAt) < threshold) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Count expiring recruitments
   */
  private countExpiringRecruitments(recruitments: Activity[], days: number): number {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + days);

    return recruitments.filter(r => r.expiresAt && new Date(r.expiresAt) <= threshold).length;
  }

  /**
   * Generate recruitment insights
   */
  private generateRecruitmentInsights(
    recruitments: Activity[],
    metrics: {
      recentApplications: number;
      previousApplications: number;
      avgTimeToHire: number;
      acceptedApplications: number;
      totalApplications: number;
    }
  ): RecruitmentInsight[] {
    const insights: RecruitmentInsight[] = [];

    // Application trend insight
    if (metrics.recentApplications > metrics.previousApplications * 1.2) {
      insights.push({
        type: 'positive',
        category: 'applications',
        message: 'Application volume is up significantly compared to last month',
        actionable: 'Consider expanding hiring capacity to handle increased interest',
      });
    } else if (metrics.recentApplications < metrics.previousApplications * 0.8) {
      insights.push({
        type: 'warning',
        category: 'applications',
        message: 'Application volume has decreased compared to last month',
        actionable: 'Review job posting visibility and consider additional promotion',
      });
    }

    // Time to hire insight
    if (metrics.avgTimeToHire > 30) {
      insights.push({
        type: 'warning',
        category: 'efficiency',
        message: `Average time to hire is ${metrics.avgTimeToHire} days`,
        actionable: 'Consider streamlining your review process to reduce time-to-hire',
      });
    } else if (metrics.avgTimeToHire > 0 && metrics.avgTimeToHire < 14) {
      insights.push({
        type: 'positive',
        category: 'efficiency',
        message: 'Your hiring process is efficient with quick turnaround times',
        actionable: 'Maintain current processes while ensuring quality standards',
      });
    }

    // Acceptance rate insight
    const acceptanceRate =
      metrics.totalApplications > 0
        ? (metrics.acceptedApplications / metrics.totalApplications) * 100
        : 0;

    if (acceptanceRate < 10 && metrics.totalApplications > 10) {
      insights.push({
        type: 'info',
        category: 'quality',
        message: `Low acceptance rate (${Math.round(acceptanceRate)}%) may indicate high standards or misaligned expectations`,
        actionable: 'Review job requirements to ensure they match candidate pool',
      });
    }

    // Active recruitment insight
    const activeWithNoApps = recruitments.filter(
      r =>
        [ActivityStatus.OPEN, ActivityStatus.RECRUITING].includes(r.status) &&
        (r.applications || []).length === 0
    );
    if (activeWithNoApps.length > 0) {
      insights.push({
        type: 'warning',
        category: 'visibility',
        message: `${activeWithNoApps.length} active recruitment(s) have no applications`,
        actionable: 'Improve visibility through Discord announcements or external job boards',
      });
    }

    return insights;
  }

  /**
   * Map application status to pipeline stage
   */
  private mapStatusToStage(status: ApplicationStatus): string {
    switch (status) {
      case ApplicationStatus.PENDING:
        return 'applied';
      case ApplicationStatus.UNDER_REVIEW:
        return 'screening';
      case ApplicationStatus.INTERVIEW_SCHEDULED:
        return 'interview';
      case ApplicationStatus.ACCEPTED:
        return 'accepted';
      case ApplicationStatus.WAITLISTED:
        return 'offer';
      case ApplicationStatus.COMPLETED:
        return 'accepted';
      default:
        return 'applied';
    }
  }

  /**
   * Calculate days in current stage
   */
  private calculateDaysInStage(app: ActivityApplication): number {
    const now = new Date();
    const lastUpdate = app.reviewedAt || app.appliedAt;
    return Math.ceil((now.getTime() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Identify pipeline bottleneck
   */
  private identifyBottleneck(stages: PipelineStage[]): string | null {
    let maxDays = 0;
    let bottleneckStage: string | null = null;

    for (const stage of stages) {
      if (stage.metrics.avgDaysInStage > maxDays && stage.metrics.count > 0) {
        maxDays = stage.metrics.avgDaysInStage;
        bottleneckStage = stage.id;
      }
    }

    // Only report if significant bottleneck
    return maxDays > 7 ? bottleneckStage : null;
  }

  /**
   * Calculate stage velocity
   */
  private calculateStageVelocity(recruitments: Activity[], days: number): Record<string, number> {
    const velocity: Record<string, number> = {
      applied: 0,
      screening: 0,
      review: 0,
      interview: 0,
      offer: 0,
      accepted: 0,
    };

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    for (const r of recruitments) {
      const apps = r.applications || [];
      for (const app of apps) {
        if (new Date(app.appliedAt) >= startDate) {
          velocity.applied++;
          const stage = this.mapStatusToStage(app.status);
          if (stage !== 'applied') {
            velocity[stage]++;
          }
        }
      }
    }

    return velocity;
  }
}

// ==================== TYPE EXPORTS ====================

/**
 * Source performance metrics
 */
export interface SourcePerformance {
  applications: number;
  acceptanceRate: number;
  avgScore: number;
}

/**
 * Recruitment insight
 */
export interface RecruitmentInsight {
  type: 'positive' | 'warning' | 'info';
  category: 'applications' | 'efficiency' | 'quality' | 'visibility';
  message: string;
  actionable: string;
}

/**
 * Recruitment dashboard data structure
 */
export interface RecruitmentDashboard {
  summary: {
    totalRecruitments: number;
    activeRecruitments: number;
    totalApplications: number;
    recentApplications: number;
    acceptedThisMonth: number;
    pendingReview: number;
  };
  trends: {
    applicationTrend: number;
    recruitmentTrend: number;
    acceptanceRateTrend: number;
  };
  efficiency: {
    avgTimeToFirstReview: number;
    avgTimeToHire: number;
    avgApplicationsPerPosition: number;
    fillRate: number;
  };
  performanceBySource: Record<string, SourcePerformance>;
  applicationsByDay: Array<{ date: string; count: number }>;
  urgentItems: {
    recruitmentWithNoApplicants: number;
    applicationsPendingOver7Days: number;
    expiringRecruitments: number;
  };
  insights: RecruitmentInsight[];
  lastUpdated: Date;
}

/**
 * Pipeline candidate information
 */
export interface PipelineCandidate {
  id: string;
  applicantId: string;
  applicantName: string;
  recruitmentId: string;
  recruitmentTitle: string;
  currentStage: string;
  appliedAt: Date;
  lastUpdated: Date;
  score?: number;
  daysInCurrentStage: number;
}

/**
 * Pipeline stage metrics
 */
export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color: string;
  candidates: PipelineCandidate[];
  metrics: {
    count: number;
    avgDaysInStage: number;
    conversionRate: number;
  };
}

/**
 * Stage transition for flow visualization
 */
export interface StageTransition {
  fromStage: string;
  toStage: string;
  count: number;
  conversionRate: number;
}

/**
 * Candidate pipeline data structure
 */
export interface CandidatePipeline {
  stages: PipelineStage[];
  transitions: StageTransition[];
  summary: {
    totalCandidates: number;
    overallConversionRate: number;
    avgTimeToHire: number;
    bottleneckStage: string | null;
  };
  recruitmentId?: string;
  organizationId: string;
  generatedAt: Date;
}

/**
 * Pipeline history for trend analysis
 */
export interface PipelineHistory {
  organizationId: string;
  periodDays: number;
  dailySnapshots: Array<{
    date: string;
    stages: Record<string, number>;
  }>;
  stageVelocity: Record<string, number>;
  generatedAt: Date;
}

