/**
 * Recruitment Sub-Module (Organization Domain)
 * 
 * Provides dedicated recruitment management functionality as part of the Organization domain:
 * - Advanced skill matching algorithm
 * - Automated onboarding workflows
 * - Recruitment analytics dashboard
 * - Candidate pipeline visualization
 * - Candidate evaluation and scoring
 * 
 * This sub-module was moved from the standalone recruitment domain as part of
 * domain consolidation. Recruitment is a core organization management function.
 * 
 * @since Phase 1 - Domain Consolidation
 */

export { RecruitmentService } from './RecruitmentService';

// Re-export types
export type {
    SkillMatchCriteria,
    CandidateProfile,
    SkillMatchResult,
    OnboardingStep,
    OnboardingWorkflow,
    RecruitmentAnalytics,
    RecruitmentFilterOptions,
    // New exports for analytics dashboard and pipeline visualization
    SourcePerformance,
    RecruitmentInsight,
    RecruitmentDashboard,
    PipelineCandidate,
    PipelineStage,
    StageTransition,
    CandidatePipeline,
    PipelineHistory
} from './RecruitmentService';

