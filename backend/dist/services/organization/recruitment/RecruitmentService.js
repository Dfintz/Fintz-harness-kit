"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecruitmentService = void 0;
const data_source_1 = require("../../../data-source");
const Activity_1 = require("../../../models/Activity");
const logger_1 = require("../../../utils/logger");
const TenantService_1 = require("../../base/TenantService");
function getSkillMatchCriteria(activity) {
    const metadata = activity.metadata;
    return metadata?.customData?.skillMatchCriteria;
}
class RecruitmentService extends TenantService_1.TenantService {
    static instance;
    onboardingWorkflows = new Map();
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Activity_1.Activity), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
    }
    static getInstance() {
        if (!RecruitmentService.instance) {
            RecruitmentService.instance = new RecruitmentService();
        }
        return RecruitmentService.instance;
    }
    async createRecruitment(organizationId, data) {
        const recruitment = await this.create(organizationId, {
            title: data.title,
            description: data.description,
            activityType: Activity_1.ActivityType.RECRUITMENT,
            status: Activity_1.ActivityStatus.RECRUITING,
            visibility: data.visibility || Activity_1.ActivityVisibility.PUBLIC,
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
            },
            participants: [],
            applications: [],
            invitedOrgs: [],
            alliedOrgs: [],
        });
        logger_1.logger.info(`Created recruitment: ${recruitment.id}`, { organizationId, title: data.title });
        return recruitment;
    }
    async getRecruitments(organizationId, filters) {
        const queryBuilder = this.repository
            .createQueryBuilder('activity')
            .where('activity.activityType = :type', { type: Activity_1.ActivityType.RECRUITMENT });
        if (filters.organizationId) {
            queryBuilder.andWhere('activity.organizationId = :orgId', { orgId: filters.organizationId });
        }
        else {
            queryBuilder.andWhere('(activity.organizationId = :orgId OR activity.visibility = :public)', {
                orgId: organizationId,
                public: Activity_1.ActivityVisibility.PUBLIC,
            });
        }
        if (filters.status) {
            const statusMap = {
                open: [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.RECRUITING],
                closed: [Activity_1.ActivityStatus.COMPLETED, Activity_1.ActivityStatus.CANCELLED, Activity_1.ActivityStatus.EXPIRED],
                paused: [Activity_1.ActivityStatus.DRAFT, Activity_1.ActivityStatus.PLANNING],
            };
            queryBuilder.andWhere('activity.status IN (:...statuses)', {
                statuses: statusMap[filters.status] || [Activity_1.ActivityStatus.RECRUITING],
            });
        }
        if (filters.searchTerm) {
            queryBuilder.andWhere('(activity.title ILIKE :search OR activity.description ILIKE :search)', { search: `%${filters.searchTerm}%` });
        }
        if (filters.skills && filters.skills.length > 0) {
            queryBuilder.andWhere(`activity.metadata::jsonb -> 'customData' -> 'skillMatchCriteria' -> 'requiredSkills' ?| array[:...skills]`, { skills: filters.skills });
        }
        if (filters.roles && filters.roles.length > 0) {
            queryBuilder.andWhere('activity.rolesNeeded && :roles', { roles: filters.roles });
        }
        if (filters.hasOpenSlots) {
            queryBuilder.andWhere('(activity.maxParticipants IS NULL OR activity.currentParticipants < activity.maxParticipants)');
        }
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
    calculateSkillMatch(candidate, criteria) {
        const result = {
            candidateId: candidate.userId,
            score: 0,
            matchedSkills: [],
            missingRequiredSkills: [],
            matchedPreferredSkills: [],
            experienceMatch: true,
            timezoneMatch: true,
            recommendation: 'not_recommended',
        };
        const normalizedCandidateSkills = candidate.skills.map(s => s.toLowerCase().trim());
        const normalizedRequiredSkills = criteria.requiredSkills.map(s => s.toLowerCase().trim());
        const normalizedPreferredSkills = (criteria.preferredSkills || []).map(s => s.toLowerCase().trim());
        for (const skill of normalizedRequiredSkills) {
            if (normalizedCandidateSkills.includes(skill)) {
                result.matchedSkills.push(skill);
            }
            else {
                result.missingRequiredSkills.push(skill);
            }
        }
        const requiredSkillScore = normalizedRequiredSkills.length > 0
            ? (result.matchedSkills.length / normalizedRequiredSkills.length) * 60
            : 60;
        for (const skill of normalizedPreferredSkills) {
            if (normalizedCandidateSkills.includes(skill)) {
                result.matchedPreferredSkills.push(skill);
            }
        }
        const preferredSkillScore = normalizedPreferredSkills.length > 0
            ? (result.matchedPreferredSkills.length / normalizedPreferredSkills.length) * 20
            : 20;
        if (criteria.minimumExperience && criteria.minimumExperience > 0) {
            result.experienceMatch = candidate.experience >= criteria.minimumExperience;
        }
        const experienceScore = result.experienceMatch ? 10 : 0;
        if (criteria.timezone && candidate.timezone) {
            result.timezoneMatch = candidate.timezone === criteria.timezone;
        }
        const timezoneScore = result.timezoneMatch ? 5 : 0;
        let roleScore = 0;
        if (criteria.requiredRoles && criteria.requiredRoles.length > 0) {
            const matchedRoles = candidate.preferredRoles.filter(r => criteria.requiredRoles.includes(r));
            roleScore = matchedRoles.length > 0 ? 5 : 0;
        }
        else {
            roleScore = 5;
        }
        result.score = Math.round(requiredSkillScore + preferredSkillScore + experienceScore + timezoneScore + roleScore);
        if (result.missingRequiredSkills.length > 0) {
            if (result.score >= 70) {
                result.recommendation = 'moderate';
            }
            else {
                result.recommendation = 'not_recommended';
            }
        }
        else {
            if (result.score >= 90) {
                result.recommendation = 'strong';
            }
            else if (result.score >= 70) {
                result.recommendation = 'moderate';
            }
            else {
                result.recommendation = 'weak';
            }
        }
        logger_1.logger.debug('Calculated skill match', {
            candidateId: candidate.userId,
            score: result.score,
            recommendation: result.recommendation,
        });
        return result;
    }
    async findMatchingCandidates(recruitmentId, candidates, minScore = 50) {
        const recruitment = await this.repository.findOne({
            where: { id: recruitmentId, activityType: Activity_1.ActivityType.RECRUITMENT },
        });
        if (!recruitment) {
            throw new Error('Recruitment not found');
        }
        const criteria = getSkillMatchCriteria(recruitment);
        if (!criteria?.requiredSkills) {
            return candidates.map(c => ({
                candidateId: c.userId,
                score: 50,
                matchedSkills: [],
                missingRequiredSkills: [],
                matchedPreferredSkills: [],
                experienceMatch: true,
                timezoneMatch: true,
                recommendation: 'moderate',
            }));
        }
        const results = candidates
            .map(candidate => this.calculateSkillMatch(candidate, criteria))
            .filter(result => result.score >= minScore)
            .sort((a, b) => b.score - a.score);
        logger_1.logger.info(`Found ${results.length} matching candidates for recruitment ${recruitmentId}`);
        return results;
    }
    async createOnboardingWorkflow(recruitmentId, candidateId, customSteps) {
        const defaultSteps = [
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
        const steps = customSteps && customSteps.length > 0
            ? customSteps.map((step, index) => ({
                id: step.id || `custom_${index}`,
                name: step.name || `Step ${index + 1}`,
                description: step.description || '',
                order: step.order ?? index + 1,
                isRequired: step.isRequired ?? true,
                status: 'pending',
            }))
            : defaultSteps;
        const workflow = {
            recruitmentId,
            candidateId,
            startedAt: new Date(),
            steps,
            status: 'pending',
        };
        this.onboardingWorkflows.set(`${recruitmentId}:${candidateId}`, workflow);
        logger_1.logger.info(`Created onboarding workflow for candidate ${candidateId}`, {
            recruitmentId,
            stepsCount: steps.length,
        });
        return workflow;
    }
    async getOnboardingWorkflow(recruitmentId, candidateId) {
        return this.onboardingWorkflows.get(`${recruitmentId}:${candidateId}`) || null;
    }
    async completeOnboardingStep(recruitmentId, candidateId, stepId, completedBy) {
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
        workflow.status = 'in_progress';
        const allRequiredCompleted = workflow.steps
            .filter(s => s.isRequired)
            .every(s => s.status === 'completed');
        if (allRequiredCompleted) {
            workflow.status = 'completed';
            workflow.completedAt = new Date();
        }
        this.onboardingWorkflows.set(`${recruitmentId}:${candidateId}`, workflow);
        logger_1.logger.info(`Completed onboarding step ${stepId} for candidate ${candidateId}`, {
            recruitmentId,
            workflowStatus: workflow.status,
        });
        return workflow;
    }
    async assignMentor(recruitmentId, candidateId, mentorId, mentorName) {
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
        logger_1.logger.info(`Assigned mentor ${mentorName} to candidate ${candidateId}`, { recruitmentId });
        return workflow;
    }
    async getRecruitmentAnalytics(organizationId) {
        const recruitments = await this.repository.find({
            where: {
                organizationId,
                activityType: Activity_1.ActivityType.RECRUITMENT,
            },
        });
        const totalRecruitments = recruitments.length;
        const activeRecruitments = recruitments.filter(r => [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.RECRUITING].includes(r.status)).length;
        const closedRecruitments = recruitments.filter(r => [Activity_1.ActivityStatus.COMPLETED, Activity_1.ActivityStatus.CANCELLED, Activity_1.ActivityStatus.EXPIRED].includes(r.status)).length;
        let totalApplications = 0;
        let acceptedApplications = 0;
        let rejectedApplications = 0;
        let pendingApplications = 0;
        const skillCounts = {};
        const roleCounts = {};
        for (const recruitment of recruitments) {
            const applications = recruitment.applications || [];
            totalApplications += applications.length;
            for (const app of applications) {
                if (app.status === Activity_1.ApplicationStatus.ACCEPTED) {
                    acceptedApplications++;
                }
                else if (app.status === Activity_1.ApplicationStatus.REJECTED) {
                    rejectedApplications++;
                }
                else if (app.status === Activity_1.ApplicationStatus.PENDING) {
                    pendingApplications++;
                }
            }
            const criteria = getSkillMatchCriteria(recruitment);
            if (criteria?.requiredSkills) {
                for (const skill of criteria.requiredSkills) {
                    skillCounts[skill] = (skillCounts[skill] || 0) + 1;
                }
            }
            const rolesNeeded = recruitment.rolesNeeded || [];
            for (const role of rolesNeeded) {
                roleCounts[role] = (roleCounts[role] || 0) + 1;
            }
        }
        const completedRecruitments = recruitments.filter(r => r.status === Activity_1.ActivityStatus.COMPLETED);
        let averageTimeToFill = 0;
        if (completedRecruitments.length > 0) {
            const totalDays = completedRecruitments.reduce((sum, r) => {
                const created = new Date(r.createdAt);
                const updated = new Date(r.updatedAt);
                return sum + Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
            }, 0);
            averageTimeToFill = Math.round(totalDays / completedRecruitments.length);
        }
        const applicationToAcceptanceRate = totalApplications > 0 ? Math.round((acceptedApplications / totalApplications) * 100) : 0;
        const topSkillsNeeded = Object.entries(skillCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([skill, count]) => ({ skill, count }));
        const recruitmentsByMonth = this.groupByMonth(recruitments);
        const conversionFunnel = {
            applied: totalApplications,
            reviewed: totalApplications - pendingApplications,
            interviewed: Math.floor((totalApplications - pendingApplications) * 0.5),
            accepted: acceptedApplications,
        };
        const analytics = {
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
        logger_1.logger.info('Generated recruitment analytics', { organizationId, totalRecruitments });
        return analytics;
    }
    groupByMonth(recruitments) {
        const monthCounts = {};
        for (const recruitment of recruitments) {
            const date = new Date(recruitment.createdAt);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
        }
        return Object.entries(monthCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-12)
            .map(([month, count]) => ({ month, count }));
    }
    async evaluateApplication(recruitmentId, applicationId, candidateProfile) {
        const recruitment = await this.repository.findOne({
            where: { id: recruitmentId, activityType: Activity_1.ActivityType.RECRUITMENT },
        });
        if (!recruitment) {
            throw new Error('Recruitment not found');
        }
        const applications = recruitment.applications || [];
        const application = applications.find(a => a.id === applicationId);
        if (!application) {
            throw new Error('Application not found');
        }
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
                recommendation: 'moderate',
            };
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
        let autoApproved = false;
        if (recruitment.autoAcceptQualified && matchResult.recommendation === 'strong') {
            application.status = Activity_1.ApplicationStatus.ACCEPTED;
            application.reviewedAt = new Date();
            application.feedback = 'Auto-approved based on skill match';
            autoApproved = true;
        }
        else if (matchResult.recommendation === 'not_recommended') {
            application.status = Activity_1.ApplicationStatus.UNDER_REVIEW;
        }
        else {
            application.status = Activity_1.ApplicationStatus.UNDER_REVIEW;
        }
        await this.repository.save(recruitment);
        logger_1.logger.info(`Evaluated application ${applicationId}`, {
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
    async getApplicationStats(recruitmentId) {
        const recruitment = await this.repository.findOne({
            where: { id: recruitmentId, activityType: Activity_1.ActivityType.RECRUITMENT },
        });
        if (!recruitment) {
            throw new Error('Recruitment not found');
        }
        const applications = recruitment.applications || [];
        const byStatus = {
            [Activity_1.ApplicationStatus.PENDING]: 0,
            [Activity_1.ApplicationStatus.UNDER_REVIEW]: 0,
            [Activity_1.ApplicationStatus.INTERVIEW_SCHEDULED]: 0,
            [Activity_1.ApplicationStatus.ACCEPTED]: 0,
            [Activity_1.ApplicationStatus.REJECTED]: 0,
            [Activity_1.ApplicationStatus.WITHDRAWN]: 0,
            [Activity_1.ApplicationStatus.WAITLISTED]: 0,
            [Activity_1.ApplicationStatus.COMPLETED]: 0,
        };
        let totalScore = 0;
        let scoreCount = 0;
        const candidates = [];
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
    async getPendingApplicantsForOrg(organizationId) {
        const { data: recruitments } = await this.getRecruitments(organizationId, {
            organizationId,
            status: 'open',
            page: 1,
            limit: 100,
        });
        const pending = [];
        for (const recruitment of recruitments) {
            const applications = recruitment.applications ?? [];
            for (const app of applications) {
                if (app.status !== Activity_1.ApplicationStatus.PENDING) {
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
    async getRecruitmentDashboard(organizationId) {
        const recruitments = await this.repository.find({
            where: {
                organizationId,
                activityType: Activity_1.ActivityType.RECRUITMENT,
            },
            order: { createdAt: 'DESC' },
        });
        const activeRecruitments = recruitments.filter(r => [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.RECRUITING].includes(r.status));
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const recentRecruitments = recruitments.filter(r => new Date(r.createdAt) >= thirtyDaysAgo);
        const previousRecruitments = recruitments.filter(r => new Date(r.createdAt) >= sixtyDaysAgo && new Date(r.createdAt) < thirtyDaysAgo);
        let totalApplications = 0;
        let recentApplications = 0;
        let acceptedApplications = 0;
        const applicationsByDay = new Map();
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
                if (app.status === Activity_1.ApplicationStatus.ACCEPTED) {
                    acceptedApplications++;
                }
            }
        }
        const previousApplications = this.countApplicationsInPeriod(recruitments.filter(r => new Date(r.createdAt) >= sixtyDaysAgo), sixtyDaysAgo, thirtyDaysAgo);
        const applicationTrend = previousApplications > 0
            ? ((recentApplications - previousApplications) / previousApplications) * 100
            : recentApplications > 0
                ? 100
                : 0;
        const avgTimeToFirstReview = this.calculateAverageTimeToFirstReview(recruitments);
        const avgTimeToHire = this.calculateAverageTimeToHire(recruitments);
        const performanceBySource = this.calculatePerformanceBySource(recruitments);
        const insights = this.generateRecruitmentInsights(recruitments, {
            recentApplications,
            previousApplications,
            avgTimeToHire,
            acceptedApplications,
            totalApplications,
        });
        const urgentRecruitments = activeRecruitments.filter(r => {
            const applications = r.applications || [];
            return (applications.length === 0 &&
                new Date(r.createdAt) < new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000));
        });
        const dashboard = {
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
                recruitmentTrend: previousRecruitments.length > 0
                    ? Math.round(((recentRecruitments.length - previousRecruitments.length) /
                        previousRecruitments.length) *
                        100 *
                        10) / 10
                    : recentRecruitments.length > 0
                        ? 100
                        : 0,
                acceptanceRateTrend: this.calculateAcceptanceRateTrend(recruitments, thirtyDaysAgo, sixtyDaysAgo),
            },
            efficiency: {
                avgTimeToFirstReview,
                avgTimeToHire,
                avgApplicationsPerPosition: activeRecruitments.length > 0
                    ? Math.round(totalApplications / activeRecruitments.length)
                    : 0,
                fillRate: recruitments.length > 0
                    ? Math.round((recruitments.filter(r => r.status === Activity_1.ActivityStatus.COMPLETED).length /
                        recruitments.length) *
                        100)
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
        logger_1.logger.info('Generated recruitment dashboard', { organizationId });
        return dashboard;
    }
    async getCandidatePipeline(organizationId, recruitmentId) {
        const where = {
            organizationId,
            activityType: Activity_1.ActivityType.RECRUITMENT,
        };
        if (recruitmentId) {
            where.id = recruitmentId;
        }
        const recruitments = await this.repository.find({ where });
        const stages = [
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
        const stageTransitions = [];
        for (const recruitment of recruitments) {
            const applications = recruitment.applications || [];
            for (const app of applications) {
                const candidateInfo = {
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
                const stage = stages.find(s => s.id === candidateInfo.currentStage);
                if (stage) {
                    stage.candidates.push(candidateInfo);
                    stage.metrics.count++;
                }
            }
        }
        for (let i = 0; i < stages.length; i++) {
            const stage = stages[i];
            const nextStage = stages[i + 1];
            if (stage.candidates.length > 0) {
                stage.metrics.avgDaysInStage = Math.round(stage.candidates.reduce((sum, c) => sum + c.daysInCurrentStage, 0) /
                    stage.candidates.length);
            }
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
            if (nextStage) {
                stageTransitions.push({
                    fromStage: stage.id,
                    toStage: nextStage.id,
                    count: nextStage.metrics.count,
                    conversionRate: stage.metrics.conversionRate,
                });
            }
        }
        const totalApplicants = stages.reduce((sum, s) => sum + s.metrics.count, 0);
        const acceptedCount = stages.find(s => s.id === 'accepted')?.metrics.count || 0;
        const pipeline = {
            stages,
            transitions: stageTransitions,
            summary: {
                totalCandidates: totalApplicants,
                overallConversionRate: totalApplicants > 0 ? Math.round((acceptedCount / totalApplicants) * 100) : 0,
                avgTimeToHire: this.calculateAverageTimeToHire(recruitments),
                bottleneckStage: this.identifyBottleneck(stages),
            },
            recruitmentId,
            organizationId,
            generatedAt: new Date(),
        };
        logger_1.logger.info('Generated candidate pipeline', {
            organizationId,
            recruitmentId,
            totalCandidates: totalApplicants,
        });
        return pipeline;
    }
    async getPipelineHistory(organizationId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const recruitments = await this.repository.find({
            where: {
                organizationId,
                activityType: Activity_1.ActivityType.RECRUITMENT,
            },
        });
        const dailyData = new Map();
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
        const history = {
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
    countApplicationsInPeriod(recruitments, start, end) {
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
    countAcceptedInPeriod(recruitments, start, end) {
        let count = 0;
        for (const r of recruitments) {
            const apps = r.applications || [];
            for (const app of apps) {
                if (app.status === Activity_1.ApplicationStatus.ACCEPTED &&
                    app.reviewedAt &&
                    new Date(app.reviewedAt) >= start &&
                    new Date(app.reviewedAt) < end) {
                    count++;
                }
            }
        }
        return count;
    }
    countPendingReview(recruitments) {
        let count = 0;
        for (const r of recruitments) {
            const apps = r.applications || [];
            for (const app of apps) {
                if ([Activity_1.ApplicationStatus.PENDING, Activity_1.ApplicationStatus.UNDER_REVIEW].includes(app.status)) {
                    count++;
                }
            }
        }
        return count;
    }
    calculateAverageTimeToFirstReview(recruitments) {
        let totalDays = 0;
        let count = 0;
        for (const r of recruitments) {
            const apps = r.applications || [];
            for (const app of apps) {
                if (app.reviewedAt && app.status !== Activity_1.ApplicationStatus.PENDING) {
                    const applied = new Date(app.appliedAt);
                    const reviewed = new Date(app.reviewedAt);
                    totalDays += Math.ceil((reviewed.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
                    count++;
                }
            }
        }
        return count > 0 ? Math.round(totalDays / count) : 0;
    }
    calculateAverageTimeToHire(recruitments) {
        let totalDays = 0;
        let count = 0;
        for (const r of recruitments) {
            const apps = r.applications || [];
            for (const app of apps) {
                if (app.status === Activity_1.ApplicationStatus.ACCEPTED && app.reviewedAt) {
                    const applied = new Date(app.appliedAt);
                    const accepted = new Date(app.reviewedAt);
                    totalDays += Math.ceil((accepted.getTime() - applied.getTime()) / (1000 * 60 * 60 * 24));
                    count++;
                }
            }
        }
        return count > 0 ? Math.round(totalDays / count) : 0;
    }
    calculatePerformanceBySource(recruitments) {
        const sources = {};
        for (const r of recruitments) {
            const apps = r.applications || [];
            for (const app of apps) {
                const source = app.screeningResults?.source ||
                    'direct';
                if (!sources[source]) {
                    sources[source] = { applied: 0, accepted: 0, totalScore: 0, scoreCount: 0 };
                }
                sources[source].applied++;
                if (app.status === Activity_1.ApplicationStatus.ACCEPTED) {
                    sources[source].accepted++;
                }
                if (app.screeningScore) {
                    sources[source].totalScore += app.screeningScore;
                    sources[source].scoreCount++;
                }
            }
        }
        const result = {};
        for (const [source, data] of Object.entries(sources)) {
            result[source] = {
                applications: data.applied,
                acceptanceRate: data.applied > 0 ? Math.round((data.accepted / data.applied) * 100) : 0,
                avgScore: data.scoreCount > 0 ? Math.round(data.totalScore / data.scoreCount) : 0,
            };
        }
        return result;
    }
    calculateAcceptanceRateTrend(recruitments, thirtyDaysAgo, sixtyDaysAgo) {
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
                    if (app.status === Activity_1.ApplicationStatus.ACCEPTED) {
                        recentAccepted++;
                    }
                }
                else if (appDate >= sixtyDaysAgo && appDate < thirtyDaysAgo) {
                    prevTotal++;
                    if (app.status === Activity_1.ApplicationStatus.ACCEPTED) {
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
    countOldPendingApplications(recruitments, days) {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - days);
        let count = 0;
        for (const r of recruitments) {
            const apps = r.applications || [];
            for (const app of apps) {
                if (app.status === Activity_1.ApplicationStatus.PENDING && new Date(app.appliedAt) < threshold) {
                    count++;
                }
            }
        }
        return count;
    }
    countExpiringRecruitments(recruitments, days) {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + days);
        return recruitments.filter(r => r.expiresAt && new Date(r.expiresAt) <= threshold).length;
    }
    generateRecruitmentInsights(recruitments, metrics) {
        const insights = [];
        if (metrics.recentApplications > metrics.previousApplications * 1.2) {
            insights.push({
                type: 'positive',
                category: 'applications',
                message: 'Application volume is up significantly compared to last month',
                actionable: 'Consider expanding hiring capacity to handle increased interest',
            });
        }
        else if (metrics.recentApplications < metrics.previousApplications * 0.8) {
            insights.push({
                type: 'warning',
                category: 'applications',
                message: 'Application volume has decreased compared to last month',
                actionable: 'Review job posting visibility and consider additional promotion',
            });
        }
        if (metrics.avgTimeToHire > 30) {
            insights.push({
                type: 'warning',
                category: 'efficiency',
                message: `Average time to hire is ${metrics.avgTimeToHire} days`,
                actionable: 'Consider streamlining your review process to reduce time-to-hire',
            });
        }
        else if (metrics.avgTimeToHire > 0 && metrics.avgTimeToHire < 14) {
            insights.push({
                type: 'positive',
                category: 'efficiency',
                message: 'Your hiring process is efficient with quick turnaround times',
                actionable: 'Maintain current processes while ensuring quality standards',
            });
        }
        const acceptanceRate = metrics.totalApplications > 0
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
        const activeWithNoApps = recruitments.filter(r => [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.RECRUITING].includes(r.status) &&
            (r.applications || []).length === 0);
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
    mapStatusToStage(status) {
        switch (status) {
            case Activity_1.ApplicationStatus.PENDING:
                return 'applied';
            case Activity_1.ApplicationStatus.UNDER_REVIEW:
                return 'screening';
            case Activity_1.ApplicationStatus.INTERVIEW_SCHEDULED:
                return 'interview';
            case Activity_1.ApplicationStatus.ACCEPTED:
                return 'accepted';
            case Activity_1.ApplicationStatus.WAITLISTED:
                return 'offer';
            case Activity_1.ApplicationStatus.COMPLETED:
                return 'accepted';
            default:
                return 'applied';
        }
    }
    calculateDaysInStage(app) {
        const now = new Date();
        const lastUpdate = app.reviewedAt || app.appliedAt;
        return Math.ceil((now.getTime() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24));
    }
    identifyBottleneck(stages) {
        let maxDays = 0;
        let bottleneckStage = null;
        for (const stage of stages) {
            if (stage.metrics.avgDaysInStage > maxDays && stage.metrics.count > 0) {
                maxDays = stage.metrics.avgDaysInStage;
                bottleneckStage = stage.id;
            }
        }
        return maxDays > 7 ? bottleneckStage : null;
    }
    calculateStageVelocity(recruitments, days) {
        const velocity = {
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
exports.RecruitmentService = RecruitmentService;
//# sourceMappingURL=RecruitmentService.js.map