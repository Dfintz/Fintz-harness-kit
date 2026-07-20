import type { ApplicationQuestion, CrewSlot, PassengerSlot, ShipRequirement, ShipRequirementType, TransportType } from '@sc-fleet-manager/shared-types';
import type { ParticipantMetadata } from '../types/models';
import { OptionalTenantEntity } from './base/OptionalTenantEntity';
import type { Team } from './Team';
export declare enum ActivityType {
    MISSION = "mission",
    CONTRACT = "contract",
    BOUNTY = "bounty",
    EVENT = "event",
    LFG = "lfg",
    OPERATION = "operation",
    RECRUITMENT = "recruitment",
    JOB_LISTING = "job_listing"
}
export declare enum ActivityStatus {
    DRAFT = "draft",
    OPEN = "open",
    PLANNING = "planning",
    RECRUITING = "recruiting",
    READY = "ready",
    IN_PROGRESS = "in_progress",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    EXPIRED = "expired"
}
export declare enum ActivityVisibility {
    PUBLIC = "public",
    ORGANIZATION = "organization",
    CROSS_ORG = "cross_org",
    ALLIANCE = "alliance",
    PRIVATE = "private",
    LISTED = "listed"
}
export declare enum ParticipantRole {
    LEADER = "leader",
    CO_LEADER = "co_leader",
    COMMANDER = "commander",
    PILOT = "pilot",
    GUNNER = "gunner",
    ENGINEER = "engineer",
    MEDIC = "medic",
    SCOUT = "scout",
    TANK = "tank",
    DPS = "dps",
    SUPPORT = "support",
    CONTRACTOR = "contractor",
    CLIENT = "client",
    HUNTER = "hunter",
    MEMBER = "member",
    ANY = "any"
}
export interface ActivityParticipant {
    userId: string;
    userName: string;
    avatarUrl?: string;
    organizationId?: string;
    organizationName?: string;
    role: ParticipantRole;
    status: 'invited' | 'accepted' | 'declined' | 'standby';
    joinedAt: Date;
    shipType?: string;
    shipName?: string;
    shipId?: string;
    crewPosition?: string;
    crewShipId?: string;
    reputation?: number;
    notes?: string;
    message?: string;
    metadata?: ParticipantMetadata;
}
export interface OrganizationParticipation {
    organizationId: string;
    organizationName: string;
    role: 'host' | 'co_host' | 'participant' | 'allied' | 'contracted';
    memberCount: number;
    status: 'invited' | 'accepted' | 'declined';
    joinedAt: Date;
    invitedBy?: string;
    contribution?: string;
}
export interface RoleRequirement {
    role: ParticipantRole;
    min: number;
    max?: number;
    filled: number;
    required: boolean;
}
export interface ResourceRequirement {
    type: 'ship' | 'vehicle' | 'equipment' | 'cargo' | 'credits';
    name: string;
    quantity: number;
    provided: number;
    providedBy?: Array<{
        userId?: string;
        userName?: string;
        organizationId?: string;
        quantity: number;
        shipId?: string;
        crewCapacity?: number;
    }>;
    requiredCapabilities?: string[];
}
export interface RouteWaypoint {
    order: number;
    location: string;
    system: string;
    coordinates?: string;
    distance?: number;
    estimatedTravelTime?: number;
    activities?: string[];
    requiredFuel?: number;
    quantumFuelRequired?: number;
    refuelAvailable?: boolean;
    notes?: string;
}
export interface CrewMember {
    userId: string;
    userName: string;
    avatarUrl?: string;
    position: string;
    role?: string;
    assignedAt?: Date | string;
}
export interface ShipMetadata {
    size?: string;
    manufacturer?: string;
    cargoCapacity?: number;
    hangarSize?: string;
    vehicleCargoCapacity?: number;
    quantumFuelCapacity?: number;
    hydrogenFuelCapacity?: number;
    isRefuelCapable?: boolean;
    isRearmCapable?: boolean;
    isRepairCapable?: boolean;
    loanerShip?: string;
    quantum?: string;
    shields?: string;
    weapons?: string[];
    notes?: string;
    [key: string]: unknown;
}
export interface ShipAssignment {
    id?: string;
    shipId?: string;
    shipType: string;
    shipName?: string;
    ownerId: string;
    ownerName: string;
    captainId?: string;
    captainName?: string;
    description?: string;
    role: 'combat' | 'mining' | 'cargo' | 'medical' | 'support' | 'scout' | 'other';
    crewCapacity: number;
    crewAssigned: number;
    crew?: CrewMember[];
    currentCrew?: number;
    maxCrew?: number;
    crewMembers: CrewMember[];
    crewSlots?: CrewSlot[];
    capabilities: string[];
    status: 'available' | 'assigned' | 'deployed' | 'maintenance';
    isLoaner?: boolean;
    contributedBy?: string;
    contributedByUserId?: string;
    fleetId?: string;
    fleetName?: string;
    parentShipId?: string;
    isTransported?: boolean;
    transportType?: TransportType;
    passengers?: PassengerSlot[];
    metadata?: ShipMetadata;
}
export interface MiningData {
    location: string;
    system: string;
    topResources: Array<{
        name: string;
        symbol: string;
        percentage: number;
        estimatedValue?: number;
    }>;
    accessibility: string;
    recommendedShips: string[];
    estimatedProfitPerHour?: number;
    notes: string;
    lastUpdated: Date;
}
export declare enum PaymentType {
    FIXED = "fixed",
    HOURLY = "hourly",
    PERCENTAGE = "percentage",
    NEGOTIABLE = "negotiable"
}
export declare enum DifficultyLevel {
    EASY = "easy",
    MEDIUM = "medium",
    HARD = "hard",
    EXPERT = "expert"
}
export declare enum ApplicationStatus {
    PENDING = "pending",
    UNDER_REVIEW = "under_review",
    INTERVIEW_SCHEDULED = "interview_scheduled",
    ACCEPTED = "accepted",
    REJECTED = "rejected",
    WITHDRAWN = "withdrawn",
    WAITLISTED = "waitlisted",
    COMPLETED = "completed"
}
export interface ContractorRequirements {
    minimumReputation?: number;
    minimumExperience?: number;
    requiredCertifications?: string[];
    requiredShips?: string[];
    minimumCrewSize?: number;
    maximumCrewSize?: number;
    requiredLanguages?: string[];
    minimumAge?: number;
    backgroundCheckRequired?: boolean;
    securityClearance?: string;
    minCompletionRate?: number;
    requiredSpecializations?: string[];
    passingScore?: number;
}
export type ScreeningValue = string | number | boolean;
export interface ScreeningResult {
    criterionId: string;
    criterionName: string;
    passed: boolean;
    actualValue?: ScreeningValue;
    expectedValue?: ScreeningValue;
    reason?: string;
    results?: Array<{
        name: string;
        value: ScreeningValue;
        passed: boolean;
    }>;
    recommendations?: string;
}
export interface ContractorScreeningResult {
    userId: string;
    screenedAt: Date;
    passed: boolean;
    score: number;
    requirements: ContractorRequirements;
    results: Record<string, {
        passed: boolean;
        score: number;
    }>;
    recommendations: string[];
}
export interface ActivityApplication {
    id?: string;
    applicationId: string;
    applicantId: string;
    applicantName: string;
    applicantEmail?: string;
    rsiHandle?: string;
    discordId?: string;
    appliedAt: Date;
    status: ApplicationStatus;
    userId?: string;
    userName?: string;
    organizationId?: string;
    organizationName?: string;
    message?: string;
    coverLetter?: string;
    experience?: string;
    references?: string[];
    availableHours?: number;
    preferredRole?: string;
    metadata?: Record<string, unknown>;
    answers?: Array<{
        questionId: string;
        question: string;
        answer: string;
    }>;
    screeningScore?: number;
    screeningPassed?: boolean;
    screeningResults?: ScreeningResult[];
    reviewedBy?: string;
    reviewedAt?: Date;
    rejectionReason?: string;
    acceptedAt?: Date;
    feedback?: string;
    interviewScheduledAt?: Date;
    interviewNotes?: string;
    interviewCompleted?: boolean;
    completedAt?: Date;
    rating?: number;
    review?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    referredBy?: string;
    timezone?: string;
    availablePlaytimes?: string[];
    preferredRoles?: string[];
}
export interface ActivityVoiceChannel {
    channelId?: string;
    templateId?: string;
    autoCreate: boolean;
    autoDelete: boolean;
    userLimit?: number;
    bitrate?: number;
    categoryId?: string;
    permissions?: Record<string, {
        allow: string;
        deny: string;
    }>;
    expiresAt?: Date;
}
export interface MissionObjective {
    id: string;
    description: string;
    completed: boolean;
    optional?: boolean;
}
export interface AfterActionReport {
    submittedBy: string;
    submittedAt: Date;
    outcome: 'success' | 'partial' | 'failure';
    objectivesCompleted?: string[];
    casualties?: number;
    notes?: string;
    recommendations?: string;
}
export interface OperationPhase {
    id: string;
    name: string;
    order: number;
    description?: string;
    startTime?: Date;
    endTime?: Date;
    objectives?: string[];
    status?: 'pending' | 'in_progress' | 'completed' | 'failed';
}
export interface CommandStructure {
    commander?: string;
    commanderId?: string;
    squadLeaders?: Array<{
        userId: string;
        userName: string;
        squadName: string;
    }>;
    chainOfCommand?: string[];
    roles?: Record<string, string>;
}
export interface CompletionReportMetadata {
    submittedBy: string;
    submittedAt: Date;
    actualDuration?: number;
    actualParticipants?: number;
    successRate?: number;
    creditsEarned?: number;
    reputationEarned?: number;
    notes?: string;
    screenshots?: string[];
    metadata?: Record<string, unknown>;
}
export interface RescheduleHistoryEntry {
    oldDate: Date;
    newDate: Date;
    previousStartDate?: Date;
    previousEndDate?: Date;
    newStartDate?: Date;
    reason: string;
    rescheduledBy: string;
    rescheduledAt: Date;
}
export declare class Activity extends OptionalTenantEntity {
    id: string;
    title: string;
    description: string;
    activityType: ActivityType;
    status: ActivityStatus;
    visibility: ActivityVisibility;
    creatorId: string;
    creatorName: string;
    organizationName?: string;
    teamId?: string;
    team?: Team;
    participatingOrgs: OrganizationParticipation[];
    invitedOrgs: string[];
    alliedOrgs: string[];
    participants: ActivityParticipant[];
    currentParticipants: number;
    actualParticipants?: number;
    maxParticipants?: number;
    minParticipants: number;
    waitlist: string[];
    roleRequirements?: RoleRequirement[];
    resourceRequirements?: ResourceRequirement[];
    scheduledStartDate?: Date;
    scheduledEndDate?: Date;
    timezone?: string;
    estimatedDuration?: number;
    actualStartDate?: Date;
    actualEndDate?: Date;
    startedAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    actualDuration?: number;
    location?: string;
    systemLocation?: string;
    difficulty?: string;
    voiceChannel?: ActivityVoiceChannel;
    voiceChannelId?: string;
    voiceChannelName?: string;
    discordEventId?: string;
    routePlan?: RouteWaypoint[];
    totalDistance?: number;
    totalEstimatedTime?: number;
    totalCargoCapacity?: number;
    totalQuantumFuel?: number;
    totalQuantumFuelRequired?: number;
    maxJumpRange?: number;
    hasRefuelShip?: boolean;
    shipAssignments?: ShipAssignment[];
    ships?: ShipAssignment[];
    shipRequirementType?: ShipRequirementType;
    requiredShips?: ShipRequirement[];
    requiredShipTypes?: string;
    totalCrewCapacity?: number;
    totalCrewAssigned?: number;
    miningData?: MiningData;
    isMiningOperation: boolean;
    targetResources?: string;
    rewardCredits: number;
    rewardReputation: number;
    rewardItems?: Array<{
        itemName: string;
        quantity: number;
        split: 'equal' | 'merit' | 'leader';
    }>;
    paymentType?: PaymentType;
    paymentAmount?: number;
    currency: string;
    paymentNotes?: string;
    difficultyLevel?: DifficultyLevel;
    applications: ActivityApplication[];
    currentApplicants: number;
    maxApplicants?: number;
    contractorRequirements?: ContractorRequirements;
    screeningEnabled: boolean;
    autoAcceptQualified: boolean;
    applicationQuestions?: ApplicationQuestion[];
    rolesNeeded: string[];
    requirements?: string;
    expiresAt?: Date;
    bannerImageUrl?: string;
    contactName?: string;
    contactEmail?: string;
    contactDiscord?: string;
    tags: string[];
    categories: string[];
    metadata?: {
        contractType?: string;
        contractValue?: number;
        deliverables?: string;
        targetId?: string;
        targetName?: string;
        issuerId?: string;
        expiryDate?: Date;
        bountyStatus?: string;
        claimedAt?: Date;
        completedAt?: Date;
        verifiedAt?: Date;
        paidAt?: Date;
        actualPayout?: number;
        lastUpdatedBy?: string;
        missionType?: string;
        briefing?: string;
        objectives?: MissionObjective[];
        afterActionReport?: AfterActionReport;
        eventType?: string;
        recurrencePattern?: 'none' | 'daily' | 'weekly' | 'monthly';
        recurrenceEndDate?: Date;
        parentEventId?: string;
        isTemplate?: boolean;
        templateId?: string;
        autoRemind?: boolean;
        reminderTime?: Date;
        discordServerId?: string;
        lfgActivity?: string;
        quickJoin?: boolean;
        quickJoinToken?: string;
        quickJoinTokenExpiry?: string;
        originatedFromLFG?: boolean;
        lfgPostId?: string;
        requiresVoice?: boolean;
        languages?: string[];
        operationScale?: 'small' | 'medium' | 'large' | 'fleet';
        operationPhases?: OperationPhase[];
        commandStructure?: CommandStructure;
        requiredSkillLevel?: string;
        completionReport?: string | CompletionReportMetadata;
        rating?: number;
        cancellationReason?: string;
        cancelledBy?: string;
        rescheduleHistory?: RescheduleHistoryEntry[];
        mirrorKeyHash?: string;
        mirrorInviteCode?: string;
        recurrenceIntervalWeeks?: number;
        tempRoleId?: string;
        tempRoleName?: string;
    };
    linkedMissionId?: string;
    linkedContractId?: string;
    linkedBountyId?: string;
    linkedEventId?: string;
    parentActivityId?: string;
    completionReport?: {
        submittedBy: string;
        submittedAt: Date;
        outcome: 'success' | 'partial' | 'failure';
        participantCount: number;
        duration: number;
        creditsEarned: number;
        reputationEarned: number;
        objectivesCompleted?: string[];
        casualties?: number;
        performanceRatings?: Record<string, number>;
        notableEvents?: string[];
        recommendations?: string;
    };
    isFeatured: boolean;
    isUrgent: boolean;
    requiresApproval: boolean;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
    get isMultiOrg(): boolean;
    get isFull(): boolean;
    get hasStarted(): boolean;
    get isExpired(): boolean;
    get canJoin(): boolean;
}
//# sourceMappingURL=Activity.d.ts.map