import type {
  ApplicationQuestion,
  CrewSlot,
  PassengerSlot,
  ShipRequirement,
  ShipRequirementType,
  TransportType,
} from '@sc-fleet-manager/shared-types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import type { ParticipantMetadata } from '../types/models';

import { OptionalTenantEntity } from './base/OptionalTenantEntity';
import type { Team } from './Team';

// Import shared PassengerSlot from shared-types for consistency

/**
 * Unified Activity Types - Maps all system activities
 */
export enum ActivityType {
  MISSION = 'mission',
  CONTRACT = 'contract',
  BOUNTY = 'bounty',
  EVENT = 'event',
  LFG = 'lfg',
  OPERATION = 'operation', // Large-scale org/cross-org operations
  RECRUITMENT = 'recruitment', // Internal use by recruitment subsystem
  JOB_LISTING = 'job_listing', // Contractor/freelancer jobs
}

/**
 * Activity Status - Unified across all activity types
 */
export enum ActivityStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PLANNING = 'planning',
  RECRUITING = 'recruiting',
  READY = 'ready',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/**
 * Activity Visibility - Controls who can see/join
 */
export enum ActivityVisibility {
  PUBLIC = 'public', // Anyone can see and join
  ORGANIZATION = 'organization', // Only org members
  CROSS_ORG = 'cross_org', // Multiple specific orgs
  ALLIANCE = 'alliance', // Allied organizations
  PRIVATE = 'private', // Invitation only
  LISTED = 'listed', // Publicly listed but controlled access
}

/**
 * Participant Role in Activity
 */
export enum ParticipantRole {
  LEADER = 'leader',
  CO_LEADER = 'co_leader',
  COMMANDER = 'commander',
  PILOT = 'pilot',
  GUNNER = 'gunner',
  ENGINEER = 'engineer',
  MEDIC = 'medic',
  SCOUT = 'scout',
  TANK = 'tank',
  DPS = 'dps',
  SUPPORT = 'support',
  CONTRACTOR = 'contractor',
  CLIENT = 'client',
  HUNTER = 'hunter',
  MEMBER = 'member',
  ANY = 'any',
}

/**
 * Participant in an activity
 */
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
  shipName?: string; // Name of participant's ship
  shipId?: string; // Reference to user's ship
  crewPosition?: string; // Specific crew role: pilot, gunner, engineer, etc.
  crewShipId?: string; // If assigned to someone else's ship as crew
  reputation?: number;
  notes?: string;
  message?: string; // Optional message from participant
  metadata?: ParticipantMetadata; // Additional participant metadata
}

/**
 * Organization participation in activity
 */
export interface OrganizationParticipation {
  organizationId: string;
  organizationName: string;
  role: 'host' | 'co_host' | 'participant' | 'allied' | 'contracted';
  memberCount: number;
  status: 'invited' | 'accepted' | 'declined';
  joinedAt: Date;
  invitedBy?: string; // User ID who sent the invitation
  contribution?: string; // e.g., "Providing 5 fighters", "Security detail"
}

/**
 * Role Requirements for activity
 */
export interface RoleRequirement {
  role: ParticipantRole;
  min: number;
  max?: number;
  filled: number;
  required: boolean;
}

/**
 * Resource Requirements
 */
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
    shipId?: string; // For ship-type resources
    crewCapacity?: number; // Available crew slots on ship
  }>;
  requiredCapabilities?: string[]; // E.g., mining, cargo, combat, medical
}

/**
 * Route Waypoint for activity planning
 */
export interface RouteWaypoint {
  order: number;
  location: string;
  system: string;
  coordinates?: string;
  distance?: number; // km from previous waypoint
  estimatedTravelTime?: number; // minutes
  activities?: string[]; // mining, refuel, resupply, combat, etc.
  requiredFuel?: number; // SCU - deprecated in favor of quantumFuelRequired
  quantumFuelRequired?: number; // SCU - quantum fuel needed from previous waypoint to here
  refuelAvailable?: boolean; // Whether this waypoint has refuel capability
  notes?: string;
}

/**
 * Crew Member for ship assignment
 *
 * Primary field is 'position' for backward compatibility with existing Activity code.
 * The 'role' field is optional and provided for consistency with the CrewAssignment model.
 *
 * Field precedence when both are present:
 * - 'position' is the primary field and takes precedence
 * - 'role' can be used as an alias but 'position' will be used if both exist
 *
 * Migration path:
 * - Existing code continues using 'position'
 * - New code can use either 'position' or 'role'
 * - Future refactoring may standardize on 'role' across all crew-related models
 */
export interface CrewMember {
  userId: string;
  userName: string;
  avatarUrl?: string;
  position: string; // pilot, gunner, engineer, etc. (PRIMARY field)
  /** Optional: Alias for position (for consistency with CrewAssignment model) */
  role?: string;
  /** Optional: Timestamp when crew member was assigned */
  assignedAt?: Date | string;
}

// Note: PassengerSlot is now imported from @sc-fleet-manager/shared-types
// to eliminate duplication with PublicJobListing.ts

/**
 * Ship metadata for additional information
 */
export interface ShipMetadata {
  size?: string;
  manufacturer?: string;
  cargoCapacity?: number;
  hangarSize?: string; // Hangar size — can carry other ships (e.g., "Small", "Medium")
  vehicleCargoCapacity?: number; // Vehicle cargo capacity for ground vehicles
  quantumFuelCapacity?: number; // Quantum fuel tank capacity
  hydrogenFuelCapacity?: number; // Hydrogen fuel tank capacity
  isRefuelCapable?: boolean; // Whether this ship can refuel other ships
  isRearmCapable?: boolean; // Whether this ship can rearm other ships
  isRepairCapable?: boolean; // Whether this ship can repair other ships
  loanerShip?: string; // Loaner ship given when main ship is not yet flyable
  quantum?: string;
  shields?: string;
  weapons?: string[];
  notes?: string;
  [key: string]: unknown;
}

/**
 * Ship Assignment for activity
 *
 * This interface can be conceptually viewed as extending:
 * - BaseShipInfo (from @sc-fleet-manager/shared-types): Core ship fields
 * - ShipTransportInfo (from @sc-fleet-manager/shared-types): Transport and passenger fields
 *
 * While not using literal TypeScript extends for simplicity, the structure follows
 * the composable pattern for consistency with shared types.
 */
export interface ShipAssignment {
  id?: string;
  shipId?: string;
  shipType: string;
  shipName?: string;
  ownerId: string;
  ownerName: string;
  captainId?: string; // Captain/pilot user ID
  captainName?: string; // Captain/pilot name
  description?: string; // Ship description
  role: 'combat' | 'mining' | 'cargo' | 'medical' | 'support' | 'scout' | 'other';
  crewCapacity: number;
  crewAssigned: number;
  crew?: CrewMember[]; // Alias for crewMembers (API accepts both)
  currentCrew?: number; // Alias for crewAssigned
  maxCrew?: number; // Alias for crewCapacity
  crewMembers: CrewMember[]; // Primary crew array (use this in new code)
  // Typed crew slots (seats per position). Auto-derived on ship add, editable
  // later. Sum of capacities equals crewCapacity; occupants live in crewMembers.
  crewSlots?: CrewSlot[];
  capabilities: string[]; // mining, combat, cargo_large, medical, etc.
  status: 'available' | 'assigned' | 'deployed' | 'maintenance';

  // Loaner ship support (Wave 1.7 parity with PublicJobListing)
  isLoaner?: boolean; // Whether this ship is a loaner (contributed by someone not personally crewing it)
  contributedBy?: string; // Display name of person who contributed/provided this ship
  contributedByUserId?: string; // User ID of the ship contributor
  fleetId?: string; // Source fleet when this ship was added through a fleet action
  fleetName?: string; // Display name of the source fleet

  // Nested transport support (ships/vehicles inside ships)
  parentShipId?: string; // ID of parent ship if this is transported inside another ship
  isTransported?: boolean; // Whether this entry is nested inside a parent ship
  transportType?: TransportType; // Transport method: 'hangar', 'cargo', 'tractor_beam', or 'docking_collar'

  // Passenger support (non-crew personnel like marines)
  passengers?: PassengerSlot[]; // Passengers (NOT counted toward crew totals)

  metadata?: ShipMetadata; // Additional ship metadata
}

/**
 * Mining Data Integration
 */
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

/**
 * Payment Types for job listings and contracts
 */
export enum PaymentType {
  FIXED = 'fixed',
  HOURLY = 'hourly',
  PERCENTAGE = 'percentage',
  NEGOTIABLE = 'negotiable',
}

/**
 * Difficulty Level for job listings and missions
 */
export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert',
}

/**
 * Application Status for recruitment and job listings
 */
export enum ApplicationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  INTERVIEW_SCHEDULED = 'interview_scheduled',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
  WAITLISTED = 'waitlisted',
  COMPLETED = 'completed',
}

/**
 * Contractor/Applicant Requirements for screening
 */
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

/**
 * Screening criteria result
 */
export type ScreeningValue = string | number | boolean;

export interface ScreeningResult {
  criterionId: string;
  criterionName: string;
  passed: boolean;
  actualValue?: ScreeningValue;
  expectedValue?: ScreeningValue;
  reason?: string;
  results?: Array<{ name: string; value: ScreeningValue; passed: boolean }>;
  recommendations?: string;
}

/**
 * Overall contractor screening result
 */
export interface ContractorScreeningResult {
  userId: string;
  screenedAt: Date;
  passed: boolean;
  score: number;
  requirements: ContractorRequirements;
  results: Record<string, { passed: boolean; score: number }>;
  recommendations: string[];
}

/**
 * Application for activity (recruitment or job listing)
 */
export interface ActivityApplication {
  id?: string; // Alternative to applicationId
  applicationId: string;
  applicantId: string;
  applicantName: string;
  applicantEmail?: string;
  rsiHandle?: string;
  discordId?: string;
  appliedAt: Date;
  status: ApplicationStatus;

  // Applicant identification (alternative naming)
  userId?: string;
  userName?: string;
  organizationId?: string;
  organizationName?: string;

  // Application details
  message?: string;
  coverLetter?: string;
  experience?: string;
  references?: string[];
  availableHours?: number;
  preferredRole?: string; // Alternative to preferredRoles
  metadata?: Record<string, unknown>;
  answers?: Array<{
    questionId: string;
    question: string;
    answer: string;
  }>;

  // Screening
  screeningScore?: number;
  screeningPassed?: boolean;
  screeningResults?: ScreeningResult[];

  // Review process
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  acceptedAt?: Date;
  feedback?: string;

  // Interview
  interviewScheduledAt?: Date;
  interviewNotes?: string;
  interviewCompleted?: boolean;

  // Completion (for contractors)
  completedAt?: Date;
  rating?: number;
  review?: string;

  // Metadata
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  referredBy?: string;
  timezone?: string;
  availablePlaytimes?: string[];
  preferredRoles?: string[];
}

/**
 * Voice Channel Configuration for Activity
 */
export interface ActivityVoiceChannel {
  channelId?: string;
  templateId?: string;
  autoCreate: boolean;
  autoDelete: boolean;
  userLimit?: number;
  bitrate?: number;
  categoryId?: string;
  permissions?: Record<string, { allow: string; deny: string }>;
  expiresAt?: Date;
}

/**
 * Mission Objective
 */
export interface MissionObjective {
  id: string;
  description: string;
  completed: boolean;
  optional?: boolean;
}

/**
 * After Action Report
 */
export interface AfterActionReport {
  submittedBy: string;
  submittedAt: Date;
  outcome: 'success' | 'partial' | 'failure';
  objectivesCompleted?: string[];
  casualties?: number;
  notes?: string;
  recommendations?: string;
}

/**
 * Operation Phase
 */
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

/**
 * Command Structure
 */
export interface CommandStructure {
  commander?: string;
  commanderId?: string;
  squadLeaders?: Array<{ userId: string; userName: string; squadName: string }>;
  chainOfCommand?: string[];
  roles?: Record<string, string>;
}

/**
 * Completion Report Metadata
 */
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

/**
 * Reschedule History Entry
 */
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

/**
 * Unified Activity Model
 * Serves as the base for all activity types in the system
 *
 * MULTI-TENANCY: This entity is tenant-scoped - each activity belongs to an organization.
 * Activities can be shared with other organizations via the sharedWithOrgs field.
 */
@Entity('activities')
@Index(['activityType', 'status'])
@Index(['creatorId'])
@Index(['scheduledStartDate'])
@Index(['organizationId', 'activityType'])
@Index(['organizationId', 'status'])
@Index(['organizationId', 'createdAt'])
export class Activity extends OptionalTenantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Core Activity Information
  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  activityType: ActivityType;

  @Column({
    type: 'enum',
    enum: ActivityStatus,
    default: ActivityStatus.DRAFT,
  })
  status: ActivityStatus;

  @Column({
    type: 'enum',
    enum: ActivityVisibility,
    default: ActivityVisibility.ORGANIZATION,
  })
  visibility: ActivityVisibility;

  // Creator/Owner Information
  @Column()
  creatorId: string;

  @Column()
  creatorName: string;

  // Primary Organization (Host) - inherited from TenantEntity
  // organizationId is provided by TenantEntity base class

  @Column({ nullable: true })
  organizationName?: string;

  // Team/Squad Assignment (Phase 1.1 — Cross-Domain Linking)
  @Index('idx_activity_team')
  @Column({ type: 'uuid', nullable: true })
  teamId?: string;

  @ManyToOne('Team', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team?: Team;

  // Cross-Organization Support
  @Column('jsonb', { default: '[]' })
  participatingOrgs: OrganizationParticipation[];

  @Column('simple-array', { default: '' })
  invitedOrgs: string[]; // Organization IDs invited but not yet accepted

  @Column('simple-array', { default: '' })
  alliedOrgs: string[]; // Allied organizations (automatic access)

  // Participant Management
  /**
   * @deprecated Use normalized `activity_participants` table via ActivityParticipantService.
   * All consumers migrated to normalized table (Phase 4). Column excluded from default
   * queries to prevent loading large JSON arrays. Use addSelect('participants') if needed.
   */
  @Column('simple-json', { default: '[]', select: false })
  participants: ActivityParticipant[];

  @Column({ default: 0 })
  currentParticipants: number;

  @Column({ nullable: true })
  actualParticipants?: number; // Actual attendance count

  @Column({ nullable: true })
  maxParticipants?: number;

  @Column({ default: 1 })
  minParticipants: number;

  @Column('simple-array', { default: '' })
  waitlist: string[]; // User IDs on waitlist when activity is full

  // Role and Resource Requirements
  @Column('simple-json', { nullable: true })
  roleRequirements?: RoleRequirement[];

  @Column('simple-json', { nullable: true })
  resourceRequirements?: ResourceRequirement[];

  // Scheduling
  @Column({ type: 'timestamp', nullable: true })
  scheduledStartDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  scheduledEndDate?: Date;

  @Column({ nullable: true })
  timezone?: string;

  @Column({ nullable: true })
  estimatedDuration?: number; // minutes

  @Column({ type: 'timestamp', nullable: true })
  actualStartDate?: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualEndDate?: Date;

  // Lifecycle timestamps (aliases for compatibility)
  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ nullable: true })
  actualDuration?: number; // Actual duration in minutes

  // Location and Environment
  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: true })
  systemLocation?: string; // Star system

  @Column({ nullable: true })
  difficulty?: string;

  // Voice Channel Integration
  @Column('simple-json', { nullable: true })
  voiceChannel?: ActivityVoiceChannel;

  @Column({ nullable: true })
  voiceChannelId?: string; // Alias for voiceChannel.channelId

  @Column({ nullable: true })
  voiceChannelName?: string; // Alias for voiceChannel.name

  /** Linked Discord Scheduled Event ID (created via guild.scheduledEvents.create) */
  @Index('idx_activity_discord_event_id')
  @Column({ nullable: true })
  discordEventId?: string;

  // Route Planning
  @Column('simple-json', { nullable: true })
  routePlan?: RouteWaypoint[];

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalDistance?: number; // Total route distance in km

  @Column({ nullable: true })
  totalEstimatedTime?: number; // Total estimated time in minutes

  // Route Planning - Calculated Fleet Capabilities
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalCargoCapacity?: number; // Total cargo capacity (SCU) across all ships

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalQuantumFuel?: number; // Total quantum fuel capacity across all ships

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalQuantumFuelRequired?: number; // Total quantum fuel needed for entire route

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxJumpRange?: number; // Maximum single jump range (km) - limited by ship with shortest range

  @Column({ default: false, nullable: true })
  hasRefuelShip?: boolean; // Whether fleet includes a refuel-capable ship (Starfarer, etc.)

  // Ship and Crew Management
  @Column('simple-json', { nullable: true })
  shipAssignments?: ShipAssignment[];

  @Column('simple-json', { nullable: true })
  ships?: ShipAssignment[]; // Alias for shipAssignments

  @Column({ type: 'varchar', length: 20, nullable: true, default: 'none' })
  shipRequirementType?: ShipRequirementType;

  @Column('simple-json', { nullable: true })
  requiredShips?: ShipRequirement[]; // Structured ship requirements with quantity

  @Column({ nullable: true })
  requiredShipTypes?: string; // Legacy: JSON string of required ship types

  @Column({ nullable: true })
  totalCrewCapacity?: number; // Total crew slots available across all ships

  @Column({ nullable: true })
  totalCrewAssigned?: number; // Total crew members assigned

  // Mining-Specific Data
  @Column('simple-json', { nullable: true })
  miningData?: MiningData;

  @Column({ default: false })
  isMiningOperation: boolean;

  @Column({ nullable: true })
  targetResources?: string; // JSON string array of target minerals

  // Rewards and Compensation
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  rewardCredits: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  rewardReputation: number;

  @Column('simple-json', { nullable: true })
  rewardItems?: Array<{
    itemName: string;
    quantity: number;
    split: 'equal' | 'merit' | 'leader';
  }>;

  // Job Listing & Recruitment Fields
  @Column({
    type: 'enum',
    enum: PaymentType,
    nullable: true,
  })
  paymentType?: PaymentType;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  paymentAmount?: number;

  @Column({ length: 10, default: 'aUEC' })
  currency: string;

  @Column('text', { nullable: true })
  paymentNotes?: string;

  @Column({
    type: 'enum',
    enum: DifficultyLevel,
    nullable: true,
  })
  difficultyLevel?: DifficultyLevel;

  // Application Management
  @Column('simple-json', { default: '[]' })
  applications: ActivityApplication[];

  @Column({ default: 0 })
  currentApplicants: number;

  @Column({ nullable: true })
  maxApplicants?: number;

  @Column('simple-json', { nullable: true })
  contractorRequirements?: ContractorRequirements;

  @Column({ default: false })
  screeningEnabled: boolean;

  @Column({ default: false })
  autoAcceptQualified: boolean;

  @Column('jsonb', { nullable: true })
  applicationQuestions?: ApplicationQuestion[]; // Snapshot of org's application questions at recruitment creation time

  // Recruitment-specific
  @Column('simple-array', { default: '' })
  rolesNeeded: string[]; // For recruitment/job listings

  @Column('text', { nullable: true })
  requirements?: string;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date;

  @Column({ nullable: true })
  bannerImageUrl?: string;

  // Contact Information (for job listings)
  @Column({ nullable: true })
  contactName?: string;

  @Column({ nullable: true })
  contactEmail?: string;

  @Column({ nullable: true })
  contactDiscord?: string;

  // Tags and Categorization
  @Column('simple-array', { default: '' })
  tags: string[];

  @Column('simple-array', { default: '' })
  categories: string[];

  // Additional Metadata
  @Column('simple-json', { nullable: true })
  metadata?: {
    // Contract-specific
    contractType?: string;
    contractValue?: number;
    deliverables?: string;

    // Bounty-specific
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

    // Mission-specific
    missionType?: string;
    briefing?: string;
    objectives?: MissionObjective[];
    afterActionReport?: AfterActionReport;

    // Event-specific
    eventType?: string;
    recurrencePattern?: 'none' | 'daily' | 'weekly' | 'monthly';
    recurrenceEndDate?: Date;
    parentEventId?: string;
    isTemplate?: boolean;
    templateId?: string;
    autoRemind?: boolean;
    reminderTime?: Date;
    discordServerId?: string;

    // LFG-specific
    lfgActivity?: string;
    quickJoin?: boolean;
    quickJoinToken?: string;
    quickJoinTokenExpiry?: string;
    originatedFromLFG?: boolean;
    lfgPostId?: string;
    requiresVoice?: boolean;
    languages?: string[];

    // Operation-specific
    operationScale?: 'small' | 'medium' | 'large' | 'fleet';
    operationPhases?: OperationPhase[];
    commandStructure?: CommandStructure;
    requiredSkillLevel?: string;

    // Completion-specific
    completionReport?: string | CompletionReportMetadata;
    rating?: number;
    cancellationReason?: string;
    cancelledBy?: string;

    // Reschedule tracking
    rescheduleHistory?: RescheduleHistoryEntry[];

    // Wave 1.8 — Event Mirroring
    mirrorKeyHash?: string;
    /** Short invite code for mirror creation (e.g. "FLEET-A7X3") */
    mirrorInviteCode?: string;

    // Wave 1.7 — Recurring events
    recurrenceIntervalWeeks?: number;

    // Temporary event role (auto-assigned on RSVP, removed on leave/event end)
    tempRoleId?: string;
    tempRoleName?: string;
  };

  // Linked Entities
  @Column({ nullable: true })
  linkedMissionId?: string;

  @Column({ nullable: true })
  linkedContractId?: string;

  @Column({ nullable: true })
  linkedBountyId?: string;

  @Column({ nullable: true })
  linkedEventId?: string;

  @Column({ nullable: true })
  parentActivityId?: string; // For recurring or phased activities

  // Completion and Results
  @Column('simple-json', { nullable: true })
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

  // Administrative
  @Column({ default: false })
  isFeatured: boolean;

  @Column({ default: false })
  isUrgent: boolean;

  @Column({ default: false })
  requiresApproval: boolean;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Computed properties
  get isMultiOrg(): boolean {
    return (
      this.participatingOrgs.length > 1 ||
      this.visibility === ActivityVisibility.CROSS_ORG ||
      this.visibility === ActivityVisibility.ALLIANCE
    );
  }

  get isFull(): boolean {
    return this.maxParticipants !== undefined && this.currentParticipants >= this.maxParticipants;
  }

  get hasStarted(): boolean {
    return this.actualStartDate !== undefined && this.actualStartDate <= new Date();
  }

  get isExpired(): boolean {
    if (!this.scheduledEndDate) {
      return false;
    }
    return new Date() > this.scheduledEndDate;
  }

  get canJoin(): boolean {
    return (
      this.status === ActivityStatus.OPEN ||
      (this.status === ActivityStatus.RECRUITING && !this.isFull && !this.hasStarted)
    );
  }
}
