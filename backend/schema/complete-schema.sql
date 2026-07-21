-- ============================================================================
-- SC Fleet Manager - Complete Database Schema
-- Generated from live Azure PostgreSQL 15.14
-- Date: 2026-03-07
-- Tables: 115 user tables + 1 migrations table (116 total)
-- Enums: 59 custom types
-- Indexes: 621 definitions
-- ============================================================================

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;

-- ============================================================================
-- Extensions
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- ============================================================================
-- Enum Types (59)
-- ============================================================================

CREATE TYPE public.activities_activitytype_enum AS ENUM ('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'recruitment', 'job_listing');
CREATE TYPE public.activities_difficultylevel_enum AS ENUM ('easy', 'medium', 'hard', 'expert');
CREATE TYPE public.activities_paymenttype_enum AS ENUM ('fixed', 'hourly', 'percentage', 'negotiable');
CREATE TYPE public.activities_status_enum AS ENUM ('draft', 'open', 'planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled', 'expired');
CREATE TYPE public.activities_visibility_enum AS ENUM ('public', 'organization', 'cross_org', 'alliance', 'private', 'listed');
CREATE TYPE public.activity_level_enum AS ENUM ('inactive', 'low', 'moderate', 'high', 'very_high');
CREATE TYPE public.ai_feature_type_enum AS ENUM ('briefing_generation', 'mission_summary');
CREATE TYPE public.briefings_status_enum AS ENUM ('draft', 'active', 'completed', 'archived');
CREATE TYPE public.contact_request_visibility_enum AS ENUM ('all', 'leadership', 'hr', 'diplomacy', 'recruitment', 'custom');
CREATE TYPE public.contact_requests_status_enum AS ENUM ('pending', 'read', 'replied', 'archived', 'spam');
CREATE TYPE public.contact_requests_targettype_enum AS ENUM ('organization', 'alliance');
CREATE TYPE public.data_breach_notifications_severity_enum AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.data_breach_notifications_status_enum AS ENUM ('INVESTIGATING', 'CONTAINED', 'NOTIFIED', 'RESOLVED');
CREATE TYPE public.deletion_requests_status_enum AS ENUM ('pending', 'cancelled', 'completed', 'failed');
CREATE TYPE public.export_requests_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed', 'expired');
CREATE TYPE public.invitation_status_enum AS ENUM ('pending', 'approved', 'accepted', 'rejected', 'declined', 'expired');
CREATE TYPE public.job_application_status_enum AS ENUM ('pending', 'approved', 'rejected', 'waitlisted', 'withdrawn');
CREATE TYPE public.job_application_type_enum AS ENUM ('crew', 'passenger', 'vehicle', 'general');
CREATE TYPE public.listing_category_enum AS ENUM ('job', 'service');
CREATE TYPE public.mirror_actions_actiontype_enum AS ENUM ('warning', 'timeout', 'kick', 'ban');
CREATE TYPE public.mirror_actions_status_enum AS ENUM ('pending', 'confirmed', 'cancelled', 'failed');
CREATE TYPE public.mirrored_activity_status_enum AS ENUM ('active', 'paused', 'cancelled', 'expired');
CREATE TYPE public.mission_difficulty_enum AS ENUM ('trivial', 'easy', 'medium', 'hard', 'extreme');
CREATE TYPE public.mission_priority_enum AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE public.mission_status_enum AS ENUM ('draft', 'planned', 'briefed', 'in_progress', 'completed', 'failed', 'cancelled');
CREATE TYPE public.mission_type_enum AS ENUM ('combat', 'mining', 'trading', 'exploration', 'logistics', 'rescue', 'reconnaissance', 'escort', 'salvage', 'custom');
CREATE TYPE public.moderation_incidents_incidenttype_enum AS ENUM ('warning', 'timeout', 'long_timeout', 'kick', 'ban');
CREATE TYPE public.moderation_incidents_status_enum AS ENUM ('active', 'expired', 'revoked');
CREATE TYPE public.operations_status_enum AS ENUM ('planned', 'in-progress', 'completed', 'cancelled');
CREATE TYPE public.operations_type_enum AS ENUM ('mission', 'event', 'mining', 'trading', 'logistics', 'intel');
CREATE TYPE public.org_application_status_enum AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');
CREATE TYPE public.org_primary_focus_enum AS ENUM ('combat', 'mining', 'trading', 'exploration', 'bounty_hunting', 'medical', 'transport', 'salvage', 'security', 'social', 'piracy', 'racing', 'mixed');
CREATE TYPE public.organization_activities_action_enum AS ENUM ('org.created', 'org.updated', 'org.deleted', 'org.archived', 'org.activated', 'hierarchy.sub_org_created', 'hierarchy.org_moved', 'hierarchy.org_detached', 'hierarchy.restructured', 'member.added', 'member.removed', 'member.role_changed', 'member.promoted', 'member.demoted', 'member.transferred', 'permission.granted', 'permission.revoked', 'permission.updated', 'permission.role_created', 'permission.role_deleted', 'settings.updated', 'metadata.updated', 'security.access_denied', 'security.alert', 'integration.enabled', 'integration.disabled');
CREATE TYPE public.organization_activities_severity_enum AS ENUM ('info', 'warning', 'error', 'critical');
CREATE TYPE public.organization_analytics_period_enum AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ALL_TIME');
CREATE TYPE public.organization_deletion_requests_status_enum AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'completed', 'failed', 'email_verification_pending');
CREATE TYPE public.organization_permissions_resource_enum AS ENUM ('fleet', 'ship', 'member', 'members', 'event', 'finance', 'contract', 'recruitment', 'logistics', 'settings', 'permissions', 'hierarchy', 'analytics', 'custom');
CREATE TYPE public.organization_permissions_scope_enum AS ENUM ('organization', 'division', 'department', 'team', 'custom');
CREATE TYPE public.organization_ships_condition_enum AS ENUM ('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical');
CREATE TYPE public.organization_ships_role_enum AS ENUM ('command', 'combat', 'logistics', 'mining', 'exploration', 'medical', 'transport', 'support', 'reserve');
CREATE TYPE public.organization_ships_sharinglevel_enum AS ENUM ('private', 'personal', 'shared_users', 'organization', 'alliance', 'public');
CREATE TYPE public.organization_ships_status_enum AS ENUM ('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold');
CREATE TYPE public.organization_templates_category_enum AS ENUM ('MILITARY', 'CORPORATE', 'GUILD', 'COMMUNITY', 'PROJECT', 'CUSTOM');
CREATE TYPE public.organization_templates_visibility_enum AS ENUM ('PUBLIC', 'PRIVATE', 'ORGANIZATION', 'MARKETPLACE');
CREATE TYPE public.organizations_status_enum AS ENUM ('active', 'inactive', 'archived', 'suspended');
CREATE TYPE public.organizations_type_enum AS ENUM ('root', 'division', 'department', 'team', 'project');
CREATE TYPE public.public_job_listings_focus_enum AS ENUM ('combat', 'mining', 'trading', 'exploration', 'bounty_hunting', 'medical', 'transport', 'salvage', 'security', 'social', 'piracy', 'racing', 'mixed');
CREATE TYPE public.public_job_listings_jobtype_enum AS ENUM ('crew', 'pilot', 'gunner', 'engineer', 'medic', 'miner', 'hauler', 'scout', 'security', 'leadership', 'support', 'other');
CREATE TYPE public.public_job_listings_ownertype_enum AS ENUM ('organization', 'alliance', 'user');
CREATE TYPE public.public_job_listings_paytype_enum AS ENUM ('fixed', 'hourly', 'percentage', 'negotiable', 'volunteer');
CREATE TYPE public.public_org_profiles_activitylevel_enum AS ENUM ('inactive', 'low', 'moderate', 'high', 'very_high');
CREATE TYPE public.public_org_profiles_primaryfocus_enum AS ENUM ('combat', 'mining', 'trading', 'exploration', 'bounty_hunting', 'medical', 'transport', 'salvage', 'security', 'social', 'piracy', 'racing', 'mixed');
CREATE TYPE public.tickets_category_enum AS ENUM ('hr', 'recruitment', 'diplomacy', 'general', 'support');
CREATE TYPE public.tickets_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.tickets_status_enum AS ENUM ('open', 'in_progress', 'awaiting_response', 'on_hold', 'resolved', 'closed');
CREATE TYPE public.tickets_recipienttype_enum AS ENUM ('org_leadership', 'org_officers', 'team_leader', 'alliance_council', 'hr_department', 'recruitment', 'diplomacy', 'specific_user', 'platform_admin');
CREATE TYPE public.user_consents_consenttype_enum AS ENUM ('essential', 'analytics', 'marketing', 'third_party', 'data_processing');
CREATE TYPE public.user_ships_condition_enum AS ENUM ('pristine', 'excellent', 'good', 'fair', 'poor', 'damaged', 'critical');
CREATE TYPE public.user_ships_sharinglevel_enum AS ENUM ('personal', 'shared_users', 'organization', 'alliance', 'public', 'private');
CREATE TYPE public.user_ships_status_enum AS ENUM ('owned', 'pledged', 'loaned', 'gifted', 'lost', 'destroyed', 'sold');

-- ============================================================================
-- Tables (116 including migrations)
-- ============================================================================

CREATE TABLE "public"."account_access_logs" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    accountId uuid NOT NULL,
    userId uuid NOT NULL,
    organizationId uuid NOT NULL,
    action character varying(50) NOT NULL,
    ipAddress character varying(100),
    userAgent text,
    metadata json,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_22ca6df6df049ca6af35441ffa6 PRIMARY KEY (id)
);

CREATE TABLE "public"."account_permissions" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    organizationId uuid NOT NULL,
    accountId uuid,
    action character varying(50) NOT NULL,
    granted boolean DEFAULT true NOT NULL,
    grantedBy uuid,
    expiresAt timestamp without time zone,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_148a3901b839a6ef45ba05de4ea PRIMARY KEY (id)
);

CREATE TABLE "public"."activities" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    description text NOT NULL,
    activityType activities_activitytype_enum NOT NULL,
    status activities_status_enum DEFAULT 'draft'::activities_status_enum NOT NULL,
    visibility activities_visibility_enum DEFAULT 'organization'::activities_visibility_enum NOT NULL,
    creatorId character varying NOT NULL,
    creatorName character varying NOT NULL,
    organizationName character varying,
    participatingOrgs jsonb DEFAULT '[]'::jsonb NOT NULL,
    invitedOrgs text DEFAULT ''::text NOT NULL,
    alliedOrgs text DEFAULT ''::text NOT NULL,
    participants text DEFAULT '[]'::text NOT NULL,
    currentParticipants integer DEFAULT 0 NOT NULL,
    actualParticipants integer,
    maxParticipants integer,
    minParticipants integer DEFAULT 1 NOT NULL,
    waitlist text DEFAULT ''::text NOT NULL,
    roleRequirements text,
    resourceRequirements text,
    scheduledStartDate timestamp without time zone,
    scheduledEndDate timestamp without time zone,
    estimatedDuration integer,
    actualStartDate timestamp without time zone,
    actualEndDate timestamp without time zone,
    startedAt timestamp without time zone,
    completedAt timestamp without time zone,
    cancelledAt timestamp without time zone,
    actualDuration integer,
    location character varying,
    systemLocation character varying,
    difficulty character varying,
    voiceChannel text,
    voiceChannelId character varying,
    voiceChannelName character varying,
    routePlan text,
    totalDistance numeric(10,2),
    totalEstimatedTime integer,
    shipAssignments text,
    ships text,
    requiredShipTypes character varying,
    totalCrewCapacity integer,
    totalCrewAssigned integer,
    miningData text,
    isMiningOperation boolean DEFAULT false NOT NULL,
    targetResources character varying,
    rewardCredits numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    rewardReputation numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    rewardItems text,
    paymentType activities_paymenttype_enum,
    paymentAmount numeric(15,2),
    currency character varying(10) DEFAULT 'aUEC'::character varying NOT NULL,
    paymentNotes text,
    difficultyLevel activities_difficultylevel_enum,
    applications text DEFAULT '[]'::text NOT NULL,
    currentApplicants integer DEFAULT 0 NOT NULL,
    maxApplicants integer,
    contractorRequirements text,
    screeningEnabled boolean DEFAULT false NOT NULL,
    autoAcceptQualified boolean DEFAULT false NOT NULL,
    applicationQuestions text,
    rolesNeeded text DEFAULT ''::text NOT NULL,
    requirements text,
    expiresAt timestamp without time zone,
    contactName character varying,
    contactEmail character varying,
    contactDiscord character varying,
    tags text DEFAULT ''::text NOT NULL,
    categories text DEFAULT ''::text NOT NULL,
    metadata text,
    linkedMissionId character varying,
    linkedContractId character varying,
    linkedBountyId character varying,
    linkedEventId character varying,
    parentActivityId character varying,
    completionReport text,
    isFeatured boolean DEFAULT false NOT NULL,
    isUrgent boolean DEFAULT false NOT NULL,
    requiresApproval boolean DEFAULT false NOT NULL,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    totalCargoCapacity numeric(10,2),
    totalQuantumFuel numeric(10,2),
    totalQuantumFuelRequired numeric(10,2),
    maxJumpRange numeric(10,2),
    hasRefuelShip boolean DEFAULT false,
    teamId uuid,
    CONSTRAINT FK_activities_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_activity_team FOREIGN KEY ("teamId") REFERENCES teams(id) ON DELETE SET NULL,
    CONSTRAINT PK_7f4004429f731ffb9c88eb486a8 PRIMARY KEY (id)
);

COMMENT ON COLUMN "public"."activities".teamId IS 'Optional team/squad this activity is assigned to';

CREATE TABLE "public"."activity_reminders" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    activityId character varying NOT NULL,
    reminderType character varying NOT NULL,
    channel character varying DEFAULT 'discord'::character varying NOT NULL,
    scheduledTime timestamp without time zone NOT NULL,
    deliveryStatus character varying DEFAULT 'pending'::character varying NOT NULL,
    recipientUserIds text,
    recipientEmails text,
    discordChannelId character varying,
    messageTemplate text NOT NULL,
    messageVariables text,
    sentAt timestamp without time zone,
    errorMessage text,
    retryCount integer DEFAULT 0 NOT NULL,
    lastRetryAt timestamp without time zone,
    isEnabled boolean DEFAULT true NOT NULL,
    createdBy uuid,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_52bc63640f4068b3f2b9fd55af9 PRIMARY KEY (id)
);

CREATE TABLE "public"."ai_usage_tracking" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    featureType ai_feature_type_enum DEFAULT 'briefing_generation'::ai_feature_type_enum,
    usageDate date NOT NULL,
    requestCount integer DEFAULT 0,
    promptTokens integer DEFAULT 0,
    completionTokens integer DEFAULT 0,
    totalTokens integer DEFAULT 0,
    lastModelUsed character varying(100),
    lastRequestByUserId character varying,
    createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT PK_ai_usage_tracking PRIMARY KEY (id)
);

CREATE TABLE "public"."alliance_diplomacy" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orgId1 character varying NOT NULL,
    orgId2 character varying NOT NULL,
    allianceType character varying NOT NULL,
    status character varying DEFAULT 'proposed'::character varying NOT NULL,
    proposedBy character varying NOT NULL,
    approvedBy uuid,
    terms text DEFAULT '[]'::text NOT NULL,
    incidents text DEFAULT '[]'::text NOT NULL,
    startDate timestamp without time zone,
    endDate timestamp without time zone,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_c3306cb26f826f808f01722a47e PRIMARY KEY (id)
);

CREATE TABLE "public"."announcement_deliveries" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    announcementId uuid NOT NULL,
    guildId character varying(20) NOT NULL,
    channelId character varying(20),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    messageId character varying(20),
    retryCount integer DEFAULT 0 NOT NULL,
    scheduledAt timestamp without time zone,
    deliveredAt timestamp without time zone,
    errorMessage text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_cd58870d692033fec11e8f00820 FOREIGN KEY ("announcementId") REFERENCES announcements(id) ON DELETE CASCADE,
    CONSTRAINT PK_78fa24cdd67e5e793aee26299c5 PRIMARY KEY (id)
);

CREATE TABLE "public"."announcement_templates" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid,
    name character varying(100) NOT NULL,
    title character varying(256),
    content text NOT NULL,
    embedConfig jsonb,
    isGlobal boolean DEFAULT false NOT NULL,
    createdBy uuid NOT NULL,
    createdByName character varying,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    CONSTRAINT CHK_at_orgId_or_global CHECK ("isGlobal" = true OR "organizationId" IS NOT NULL),
    CONSTRAINT FK_announcement_templates_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_68ad7037ac4199207d06d8006f3 PRIMARY KEY (id)
);

CREATE TABLE "public"."announcements" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title character varying(256) NOT NULL,
    content text NOT NULL,
    embedConfig text,
    targetType character varying(20) DEFAULT 'single'::character varying NOT NULL,
    targetIds text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    createdBy uuid NOT NULL,
    createdByName character varying,
    scheduledAt timestamp without time zone,
    sentAt timestamp without time zone,
    deliveryResults text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_announcements_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_b3ad760876ff2e19d58e05dc8b0 PRIMARY KEY (id)
);

CREATE TABLE "public"."blacklist_sharing_config" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    shareWarnings boolean DEFAULT false NOT NULL,
    shareTimeouts boolean DEFAULT true NOT NULL,
    shareKicks boolean DEFAULT true NOT NULL,
    shareBans boolean DEFAULT true NOT NULL,
    receiveAlerts boolean DEFAULT true NOT NULL,
    minAlertSeverity integer DEFAULT 2 NOT NULL,
    alertChannelId character varying(20),
    autoShareWithAllies boolean DEFAULT false NOT NULL,
    autoShareMinSeverity integer DEFAULT 3 NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_blacklist_sharing_config_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_fb646e18c393738dce7bc99fdb4 PRIMARY KEY (id)
);

CREATE TABLE "public"."bounties" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    createdBy uuid NOT NULL,
    createdByName character varying(100),
    title character varying(200) NOT NULL,
    description text,
    bountyType character varying(20) NOT NULL,
    targetType character varying(20) NOT NULL,
    targetIdentifier character varying(100),
    targetName character varying(100),
    targetDetails jsonb,
    rewardType character varying(20) NOT NULL,
    rewardAmount integer,
    rewardDescription text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    difficulty character varying(20),
    location character varying(200),
    systemLocation character varying(100),
    claimedBy uuid,
    claimedByName character varying(100),
    claimedAt timestamp without time zone,
    completedAt timestamp without time zone,
    verifiedBy uuid,
    verifiedAt timestamp without time zone,
    paidAt timestamp without time zone,
    expiresAt timestamp without time zone,
    visibility character varying(20) DEFAULT 'organization'::character varying NOT NULL,
    tags text DEFAULT ''::text NOT NULL,
    metadata jsonb,
    linkedActivityId uuid,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_bounties_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_335c87017bcb2fa9bc15678f385 PRIMARY KEY (id)
);

CREATE TABLE "public"."bounty_claims" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    bountyId uuid NOT NULL,
    hunterId uuid NOT NULL,
    hunterName character varying(100),
    organizationId uuid NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    notes text,
    claimedAt timestamp without time zone DEFAULT now() NOT NULL,
    submittedAt timestamp without time zone,
    completedAt timestamp without time zone,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_ae31dba6b4155bbdff8e2e900ec FOREIGN KEY ("bountyId") REFERENCES bounties(id) ON DELETE CASCADE,
    CONSTRAINT PK_72f648c6d4c72a7688d2352f681 PRIMARY KEY (id)
);

CREATE TABLE "public"."bounty_evidence" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    claimId uuid NOT NULL,
    evidenceType character varying(20) NOT NULL,
    content text,
    fileUrl character varying(500),
    fileName character varying(255),
    fileSize integer,
    mimeType character varying(100),
    submittedBy uuid NOT NULL,
    submittedAt timestamp without time zone DEFAULT now() NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_c01c84e0fec439a9a9df4f7894d FOREIGN KEY ("claimId") REFERENCES bounty_claims(id) ON DELETE CASCADE,
    CONSTRAINT PK_801da15da2497aec83181ed1aef PRIMARY KEY (id)
);

CREATE TABLE "public"."briefings" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    creatorId character varying NOT NULL,
    organizationId uuid,
    missionId character varying,
    elements text DEFAULT '[]'::text NOT NULL,
    status briefings_status_enum DEFAULT 'draft'::briefings_status_enum NOT NULL,
    participants text,
    version integer DEFAULT 1 NOT NULL,
    backgroundImage character varying,
    tags text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_388798f424958f8c105d3b3d4b6 PRIMARY KEY (id)
);

CREATE TABLE "public"."cargo_manifests" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipId uuid NOT NULL,
    ownerId character varying NOT NULL,
    cargo text DEFAULT '[]'::text NOT NULL,
    origin character varying,
    destination character varying,
    status character varying DEFAULT 'loading'::character varying NOT NULL,
    sharedWithFleet boolean DEFAULT false NOT NULL,
    sharedWithAlliance boolean DEFAULT false NOT NULL,
    departureDate timestamp without time zone,
    arrivalDate timestamp without time zone,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_43c9b6a4b52a0726e743560e8ab PRIMARY KEY (id)
);

CREATE TABLE "public"."contact_request_replies" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    contactRequestId uuid NOT NULL,
    senderUserId uuid NOT NULL,
    message text NOT NULL,
    isOrgReply boolean DEFAULT false,
    createdAt timestamp without time zone DEFAULT now(),
    CONSTRAINT FK_contact_request_replies_contactRequestId FOREIGN KEY ("contactRequestId") REFERENCES contact_requests(id) ON DELETE CASCADE,
    CONSTRAINT FK_contact_request_replies_senderUserId FOREIGN KEY ("senderUserId") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT contact_request_replies_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."contact_requests" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    targetType contact_requests_targettype_enum DEFAULT 'organization'::contact_requests_targettype_enum NOT NULL,
    organizationId uuid,
    allianceId character varying,
    senderName character varying(100) NOT NULL,
    senderEmail character varying(255),
    rsiHandle character varying(100),
    discordUsername character varying(100),
    subject text NOT NULL,
    message text NOT NULL,
    contactType character varying(50) DEFAULT 'general'::character varying NOT NULL,
    status contact_requests_status_enum DEFAULT 'pending'::contact_requests_status_enum NOT NULL,
    internalNotes text,
    handledBy character varying,
    handledAt timestamp without time zone,
    senderIp character varying(45),
    userAgent character varying(500),
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    senderUserId uuid,
    visibility contact_request_visibility_enum DEFAULT 'all'::contact_request_visibility_enum NOT NULL,
    visibleToRoles jsonb,
    CONSTRAINT CHK_cr_orgId_when_org_target CHECK ("targetType" <> 'organization'::contact_requests_targettype_enum OR "organizationId" IS NOT NULL),
    CONSTRAINT FK_cf6a23aa7baad6f29d8d0e7008a FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_contact_requests_senderUserId FOREIGN KEY ("senderUserId") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT PK_5fc5cfa569e4e66051c6acde3b9 PRIMARY KEY (id)
);

CREATE TABLE "public"."crew_assignments" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipId uuid NOT NULL,
    missionId character varying,
    assignerId character varying NOT NULL,
    crew text DEFAULT '[]'::text NOT NULL,
    startDate timestamp without time zone,
    endDate timestamp without time zone,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    organizationId uuid NOT NULL,
    CONSTRAINT FK_crew_assignments_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_8a8c48b395cb80b00283f1e8479 PRIMARY KEY (id)
);

CREATE TABLE "public"."data_breach_notifications" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    severity data_breach_notifications_severity_enum DEFAULT 'medium'::data_breach_notifications_severity_enum NOT NULL,
    affectedUsers text NOT NULL,
    affectedDataTypes text NOT NULL,
    status data_breach_notifications_status_enum DEFAULT 'INVESTIGATING'::data_breach_notifications_status_enum NOT NULL,
    discoveredAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    containedAt timestamp without time zone,
    notifiedAt timestamp without time zone,
    resolvedAt timestamp without time zone,
    notifiedUsers text DEFAULT '[]'::text NOT NULL,
    notificationErrors text DEFAULT '[]'::text NOT NULL,
    remediationSteps text DEFAULT ''::text NOT NULL,
    recommendations text DEFAULT ''::text NOT NULL,
    internalNotes text,
    regulatoryReport text,
    CONSTRAINT PK_01c8db57af3342f558ad4ca5488 PRIMARY KEY (id)
);

CREATE TABLE "public"."deletion_requests" (
    id uuid NOT NULL,
    userId uuid,
    status deletion_requests_status_enum DEFAULT 'pending'::deletion_requests_status_enum NOT NULL,
    requestedAt timestamp without time zone NOT NULL,
    scheduledFor timestamp without time zone NOT NULL,
    completedAt timestamp without time zone,
    cancelledAt timestamp without time zone,
    cancelledBy uuid,
    cancellationReason text,
    requestIpAddress character varying(45),
    requestUserAgent character varying(500),
    failureReason text,
    deletionPreview jsonb,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_deletion_requests_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT PK_f8ee986c713abeb93129e4bab0b PRIMARY KEY (id)
);

CREATE TABLE "public"."encrypted_data" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    keyId character varying(64) NOT NULL,
    dataType character varying(50) NOT NULL,
    resourceId uuid,
    encryptedData text NOT NULL,
    encryptionMetadata jsonb NOT NULL,
    createdBy uuid NOT NULL,
    minSecurityLevel integer DEFAULT 1 NOT NULL,
    allowedRoles text[],
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    accessedCount integer DEFAULT 0 NOT NULL,
    lastAccessedAt timestamp without time zone,
    isDeleted boolean DEFAULT false NOT NULL,
    deletedAt timestamp without time zone,
    deletedBy character varying(255),
    CONSTRAINT fk_encrypted_data_org FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_encrypted_data_key FOREIGN KEY ("keyId") REFERENCES organization_encryption_keys("keyId") ON DELETE RESTRICT,
    CONSTRAINT encrypted_data_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."encryption_audit_log" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    eventType character varying(50) NOT NULL,
    userId uuid NOT NULL,
    message text NOT NULL,
    details jsonb,
    ipAddress character varying(45),
    userAgent text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT fk_encryption_audit_org FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT encryption_audit_log_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."encryption_key_claims" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    keyId character varying(64) NOT NULL,
    encryptedClaim text NOT NULL,
    claimMetadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    createdBy uuid NOT NULL,
    claimedBy uuid,
    label character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    expiresAt timestamp without time zone NOT NULL,
    claimedAt timestamp without time zone,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT fk_key_claims_org FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_key_claims_claimant FOREIGN KEY ("claimedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_key_claims_creator FOREIGN KEY ("createdBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT encryption_key_claims_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."event_attendance_confirmations" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    eventId character varying NOT NULL,
    userId uuid NOT NULL,
    status character varying DEFAULT 'pending_confirmation'::character varying NOT NULL,
    rsvpStatus character varying,
    rsvpRole character varying,
    actualRole character varying,
    checkInTime timestamp without time zone,
    checkOutTime timestamp without time zone,
    durationMinutes integer,
    notes text,
    feedbackFromOrganizer text,
    performanceRating text,
    confirmedBy character varying,
    confirmedAt timestamp without time zone,
    autoConfirmed boolean DEFAULT false NOT NULL,
    excusedAbsence boolean DEFAULT false NOT NULL,
    absenceReason text,
    notificationSent boolean DEFAULT false NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_event_attendance_confirmations_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_a40b708f0558a4f1dc012360ad9 PRIMARY KEY (id)
);

CREATE TABLE "public"."export_requests" (
    id uuid NOT NULL,
    userId uuid,
    status export_requests_status_enum DEFAULT 'pending'::export_requests_status_enum NOT NULL,
    requestedAt timestamp without time zone NOT NULL,
    processingStartedAt timestamp without time zone,
    completedAt timestamp without time zone,
    expiresAt timestamp without time zone,
    requestIpAddress character varying(45),
    requestUserAgent character varying(500),
    failureReason text,
    filePath character varying(500),
    fileSize character varying(50),
    downloadToken character varying(1000),
    notificationSent boolean DEFAULT false NOT NULL,
    exportMetadata jsonb,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_export_requests_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT PK_c1447734294baee42649c066afe PRIMARY KEY (id)
);

CREATE TABLE "public"."external_integrations" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    fleetId uuid NOT NULL,
    name character varying NOT NULL,
    description text,
    type character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    syncDirection character varying NOT NULL,
    authConfig text NOT NULL,
    webhookConfig text,
    apiConfig text,
    fieldMappings text DEFAULT '[]'::text NOT NULL,
    autoSync boolean DEFAULT false NOT NULL,
    syncIntervalMinutes integer,
    lastSyncAt timestamp without time zone,
    nextSyncAt timestamp without time zone,
    syncHistory text DEFAULT '[]'::text NOT NULL,
    totalSyncs integer DEFAULT 0 NOT NULL,
    successfulSyncs integer DEFAULT 0 NOT NULL,
    failedSyncs integer DEFAULT 0 NOT NULL,
    syncedCategories text DEFAULT ''::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    errorMessage text,
    lastErrorAt timestamp without time zone,
    createdBy uuid NOT NULL,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_66facb1a93a1c6dba9c1e006fba PRIMARY KEY (id)
);

CREATE TABLE "public"."feature_flags" (
    id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    description text NOT NULL,
    status character varying(50) DEFAULT 'disabled'::character varying NOT NULL,
    scope character varying(50) DEFAULT 'global'::character varying NOT NULL,
    percentage integer,
    metadata jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    targetOrganizations text,
    targetUsers text,
    CONSTRAINT PK_db657d344e9caacfc9d5cf8bbac PRIMARY KEY (id)
);

CREATE TABLE "public"."federation_members" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    federationId uuid NOT NULL,
    organizationId uuid NOT NULL,
    organizationName character varying(200) NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    votingPower integer DEFAULT 1 NOT NULL,
    contributions integer DEFAULT 0 NOT NULL,
    joinedAt timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_fed_member_federation FOREIGN KEY ("federationId") REFERENCES federations(id) ON DELETE CASCADE,
    CONSTRAINT PK_c39c4445081d554daadda5e8982 PRIMARY KEY (id)
);

CREATE TABLE "public"."federation_proposals" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    federationId uuid NOT NULL,
    type character varying(30) NOT NULL,
    title character varying(200) NOT NULL,
    description text NOT NULL,
    proposedBy character varying(200) NOT NULL,
    proposedByOrg uuid NOT NULL,
    votes jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    requiredApproval integer NOT NULL,
    metadata jsonb,
    votingEndsAt timestamp with time zone NOT NULL,
    createdAt timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_fed_proposal_federation FOREIGN KEY ("federationId") REFERENCES federations(id) ON DELETE CASCADE,
    CONSTRAINT PK_fabfb4a24c1c5c5506f318f8187 PRIMARY KEY (id)
);

CREATE TABLE "public"."federations" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name character varying(200) NOT NULL,
    description text NOT NULL,
    founderId uuid NOT NULL,
    founderOrgId uuid NOT NULL,
    governance jsonb DEFAULT '{}'::jsonb NOT NULL,
    sharedResources jsonb DEFAULT '[]'::jsonb NOT NULL,
    treaties jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'forming'::character varying NOT NULL,
    isPublic boolean DEFAULT false NOT NULL,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    logoUrl character varying(500),
    bannerUrl character varying(500),
    discordUrl character varying(500),
    websiteUrl character varying(500),
    createdAt timestamp with time zone DEFAULT now() NOT NULL,
    updatedAt timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_1194941540acb3e297dd468b2bd PRIMARY KEY (id)
);

CREATE TABLE "public"."fleet_inventory" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    fleetId uuid NOT NULL,
    itemName character varying NOT NULL,
    description text,
    category character varying DEFAULT 'other'::character varying NOT NULL,
    quantity numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    unit character varying DEFAULT 'units'::character varying NOT NULL,
    thresholds text NOT NULL,
    status character varying DEFAULT 'adequate'::character varying NOT NULL,
    location text,
    unitCost numeric(10,2),
    totalValue numeric(10,2),
    supplierId character varying,
    supplierName character varying,
    alertEnabled boolean DEFAULT true NOT NULL,
    lastRestockDate timestamp without time zone,
    nextRestockDate timestamp without time zone,
    averageConsumptionRate numeric(10,2),
    estimatedDaysRemaining integer,
    notes text,
    managerId character varying NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_1a7895844e30127a607ec6957eb PRIMARY KEY (id)
);

CREATE TABLE "public"."fleet_logistics" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fleetId uuid NOT NULL,
    operationName character varying NOT NULL,
    description text,
    coordinatorId character varying NOT NULL,
    status character varying DEFAULT 'planning'::character varying NOT NULL,
    ships text DEFAULT '[]'::text NOT NULL,
    resources text DEFAULT '[]'::text NOT NULL,
    route text DEFAULT '[]'::text NOT NULL,
    totalFuelCapacity integer DEFAULT 0 NOT NULL,
    totalCargoCapacity integer DEFAULT 0 NOT NULL,
    totalFuelRequired integer DEFAULT 0 NOT NULL,
    totalCargoUsed integer DEFAULT 0 NOT NULL,
    maxJumpRange integer,
    estimatedDuration integer,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_e7e20a5bac870034462bdddc5ab PRIMARY KEY (id)
);

CREATE TABLE "public"."fleet_members" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    fleetId uuid NOT NULL,
    rank character varying DEFAULT 'member'::character varying NOT NULL,
    role character varying,
    shipType character varying,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    specialization text,
    joinedAt timestamp without time zone,
    lastActiveAt timestamp without time zone,
    leftAt timestamp without time zone,
    departureReason text,
    stats text,
    roles text,
    certifications text,
    isLeader boolean DEFAULT false NOT NULL,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_78077b4056498fe2b126d765862 FOREIGN KEY ("fleetId") REFERENCES fleets(id) ON DELETE CASCADE,
    CONSTRAINT FK_cf22cc9b9f24edc5bf1d7f31cbd FOREIGN KEY ("organizationId") REFERENCES organizations(id),
    CONSTRAINT FK_fleet_members_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_997d7181651683618dfc4dffd51 PRIMARY KEY (id)
);

CREATE TABLE "public"."fleet_ships" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    fleetId uuid NOT NULL,
    shipId uuid NOT NULL,
    organizationId uuid NOT NULL,
    role character varying,
    notes text,
    assignedBy character varying,
    assignedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    sharedWithOrgs text DEFAULT ''::text,
    CONSTRAINT fk_fleet_ships_fleet FOREIGN KEY ("fleetId") REFERENCES fleets(id) ON DELETE CASCADE,
    CONSTRAINT fk_fleet_ships_ship FOREIGN KEY ("shipId") REFERENCES ships(id) ON DELETE CASCADE,
    CONSTRAINT PK_9bd40062fc578d15eb4fbb254f9 PRIMARY KEY (id)
);

CREATE TABLE "public"."fleets" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text,
    emblem text,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    type character varying DEFAULT 'mixed'::character varying NOT NULL,
    leaderId character varying,
    secondInCommandId character varying,
    members text NOT NULL,
    shipIds text DEFAULT ''::text NOT NULL,
    maxMembers integer DEFAULT 50 NOT NULL,
    isPublic boolean DEFAULT false NOT NULL,
    allowApplications boolean DEFAULT false NOT NULL,
    composition text,
    operationalStats text,
    primaryActivity text,
    deployedAt timestamp without time zone,
    deploymentLocation text,
    color character varying DEFAULT '#00d9ff'::character varying NOT NULL,
    tags text DEFAULT ''::text NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    visibility character varying DEFAULT 'private'::character varying NOT NULL,
    allowedOrganizations text DEFAULT ''::text NOT NULL,
    publicViewEnabled boolean DEFAULT false NOT NULL,
    allowJoinRequests boolean DEFAULT false NOT NULL,
    parentFleetId uuid,
    level integer DEFAULT 0 NOT NULL,
    sortOrder integer DEFAULT 0 NOT NULL,
    hierarchyPath text DEFAULT ''::text NOT NULL,
    teamId uuid,
    isArchived boolean DEFAULT false NOT NULL,
    archivedAt timestamp without time zone,
    archivedBy character varying,
    archiveReason text,
    restoredAt timestamp without time zone,
    restoredBy character varying,
    crewMode character varying(20) DEFAULT 'conservative'::character varying NOT NULL,
    CONSTRAINT FK_fleet_parent FOREIGN KEY ("parentFleetId") REFERENCES fleets(id) ON DELETE SET NULL,
    CONSTRAINT FK_cf1212e908b0a1040c668d8abc6 FOREIGN KEY ("organizationId") REFERENCES organizations(id),
    CONSTRAINT FK_fleet_team FOREIGN KEY ("teamId") REFERENCES teams(id) ON DELETE SET NULL,
    CONSTRAINT PK_18a71e919faac62c1da6b5f8754 PRIMARY KEY (id)
);

COMMENT ON COLUMN "public"."fleets".teamId IS 'Optional team/squad this fleet is assigned to';

CREATE TABLE "public"."guild_organizations" (
    guildId character varying(20) NOT NULL,
    organizationId uuid NOT NULL,
    guildName character varying(100),
    isPrimary boolean DEFAULT true NOT NULL,
    isActive boolean DEFAULT true NOT NULL,
    createdBy uuid,
    metadata jsonb,
    deactivatedAt timestamp without time zone,
    deactivatedBy character varying(255),
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_guild_organizations_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_f1f7f553e4a84585a44a435df66 PRIMARY KEY ("guildId")
);

CREATE TABLE "public"."hunter_profiles" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    userName character varying(100),
    organizationId uuid NOT NULL,
    totalBountiesCompleted integer DEFAULT 0 NOT NULL,
    totalBountiesClaimed integer DEFAULT 0 NOT NULL,
    totalBountiesAbandoned integer DEFAULT 0 NOT NULL,
    totalBountiesRejected integer DEFAULT 0 NOT NULL,
    totalRewardsEarned bigint DEFAULT '0'::bigint NOT NULL,
    successRate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    averageCompletionTimeMinutes integer DEFAULT 0 NOT NULL,
    rank character varying(50) DEFAULT 'rookie'::character varying NOT NULL,
    reputationScore integer DEFAULT 0 NOT NULL,
    killBountiesCompleted integer DEFAULT 0 NOT NULL,
    captureBountiesCompleted integer DEFAULT 0 NOT NULL,
    intelBountiesCompleted integer DEFAULT 0 NOT NULL,
    transportBountiesCompleted integer DEFAULT 0 NOT NULL,
    rescueBountiesCompleted integer DEFAULT 0 NOT NULL,
    customBountiesCompleted integer DEFAULT 0 NOT NULL,
    lastBountyCompletedAt timestamp without time zone,
    currentStreak integer DEFAULT 0 NOT NULL,
    longestStreak integer DEFAULT 0 NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_d44e70fd44fa7bb863c8dcb6c41 PRIMARY KEY (id)
);

CREATE TABLE "public"."intel_approvals" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizationId uuid NOT NULL,
    intelEntryId uuid NOT NULL,
    requestedBy uuid NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    reason text,
    requiredApprovals integer DEFAULT 2 NOT NULL,
    approvers text,
    approvalDetails json,
    expiresAt timestamp without time zone,
    completedAt timestamp without time zone,
    completedBy uuid,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_intel_approvals_intelEntryId FOREIGN KEY ("intelEntryId") REFERENCES intel_entries(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_approvals_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_approvals_completedBy FOREIGN KEY ("completedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT FK_intel_approvals_requestedBy FOREIGN KEY ("requestedBy") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_f7e5857845171ba301cc4465b29 PRIMARY KEY (id)
);

CREATE TABLE "public"."intel_audit_logs" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizationId uuid NOT NULL,
    userId uuid NOT NULL,
    intelEntryId uuid,
    action character varying NOT NULL,
    description text,
    ipAddress character varying,
    userAgent character varying,
    severity character varying DEFAULT 'info'::character varying NOT NULL,
    metadata json,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_intel_audit_logs_intelEntryId FOREIGN KEY ("intelEntryId") REFERENCES intel_entries(id) ON DELETE SET NULL,
    CONSTRAINT FK_intel_audit_logs_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_audit_logs_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_f9bc498bbf14ef7eb7cfcfaac09 PRIMARY KEY (id)
);

CREATE TABLE "public"."intel_entries" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizationId uuid NOT NULL,
    title character varying NOT NULL,
    content text NOT NULL,
    classification character varying DEFAULT 'restricted'::character varying NOT NULL,
    category character varying DEFAULT 'other'::character varying NOT NULL,
    tags text,
    location character varying,
    eventDate timestamp without time zone,
    isArchived boolean DEFAULT false NOT NULL,
    createdBy uuid NOT NULL,
    updatedBy uuid,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    declassificationDate timestamp without time zone,
    targetClassification character varying,
    reviewDate timestamp without time zone,
    reviewIntervalDays integer,
    lastReviewedAt timestamp without time zone,
    lastReviewedBy character varying,
    autoDeclassify boolean DEFAULT false NOT NULL,
    expirationDate timestamp without time zone,
    isExpired boolean DEFAULT false NOT NULL,
    isShared boolean DEFAULT false NOT NULL,
    shareCount integer DEFAULT 0 NOT NULL,
    metadata json,
    CONSTRAINT FK_intel_entries_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_entries_createdBy FOREIGN KEY ("createdBy") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_entries_updatedBy FOREIGN KEY ("updatedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT PK_c080fddb6573048217e04407f65 PRIMARY KEY (id)
);

CREATE TABLE "public"."intel_officers" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organizationId uuid NOT NULL,
    userId uuid NOT NULL,
    rank character varying DEFAULT 'junior'::character varying NOT NULL,
    accessLevel character varying DEFAULT 'read'::character varying NOT NULL,
    isActive boolean DEFAULT true NOT NULL,
    specializations character varying,
    appointedBy uuid NOT NULL,
    revokedBy uuid,
    revokedAt timestamp without time zone,
    notes text,
    appointedAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_intel_officers_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_officers_appointedBy FOREIGN KEY ("appointedBy") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_officers_revokedBy FOREIGN KEY ("revokedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT FK_intel_officers_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_a12c53f473051421f800f1fc9e5 PRIMARY KEY (id)
);

CREATE TABLE "public"."intel_shares" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    intelEntryId uuid NOT NULL,
    sourceOrganizationId uuid NOT NULL,
    targetOrganizationId uuid NOT NULL,
    permission character varying DEFAULT 'view'::character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    maxClassification character varying DEFAULT 'restricted'::character varying NOT NULL,
    sharedBy uuid NOT NULL,
    acceptedBy uuid,
    revokedBy uuid,
    shareReason text,
    revokeReason text,
    expiresAt timestamp without time zone,
    acceptedAt timestamp without time zone,
    revokedAt timestamp without time zone,
    viewCount integer DEFAULT 0 NOT NULL,
    lastViewedAt timestamp without time zone,
    metadata json,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_intel_shares_targetOrganizationId FOREIGN KEY ("targetOrganizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_shares_intelEntryId FOREIGN KEY ("intelEntryId") REFERENCES intel_entries(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_shares_sourceOrganizationId FOREIGN KEY ("sourceOrganizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_shares_sharedBy FOREIGN KEY ("sharedBy") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT FK_intel_shares_acceptedBy FOREIGN KEY ("acceptedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT FK_intel_shares_revokedBy FOREIGN KEY ("revokedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT PK_a6977679bac5dfdbdc2a7657c59 PRIMARY KEY (id)
);

CREATE TABLE "public"."invitations" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    inviteeUserId uuid NOT NULL,
    inviterId uuid,
    inviterRole character varying(20) NOT NULL,
    status invitation_status_enum DEFAULT 'pending'::invitation_status_enum,
    message text,
    token character varying(255) NOT NULL,
    expiresAt timestamp without time zone NOT NULL,
    createdAt timestamp without time zone DEFAULT now(),
    CONSTRAINT FK_invitations_organization FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_invitations_invitee FOREIGN KEY ("inviteeUserId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT FK_invitations_inviter FOREIGN KEY ("inviterId") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT invitations_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."job_applications" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    jobListingId uuid NOT NULL,
    applicantUserId uuid NOT NULL,
    applicationType job_application_type_enum DEFAULT 'general'::job_application_type_enum,
    status job_application_status_enum DEFAULT 'pending'::job_application_status_enum,
    applicantDisplayName character varying(255),
    message text,
    shipIndex integer,
    roleIndex integer,
    roleName character varying(100),
    shipName character varying(255),
    passengerShipIndex integer,
    passengerRole character varying(100),
    vehicleName character varying(255),
    reviewedBy character varying(255),
    reviewNote text,
    reviewedAt timestamp without time zone,
    waitlistPosition integer,
    createdAt timestamp without time zone DEFAULT now(),
    updatedAt timestamp without time zone DEFAULT now(),
    CONSTRAINT FK_job_applications_jobListing FOREIGN KEY ("jobListingId") REFERENCES public_job_listings(id) ON DELETE CASCADE,
    CONSTRAINT FK_job_applications_applicant FOREIGN KEY ("applicantUserId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT job_applications_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."legal_holds" (
    id uuid NOT NULL,
    userId uuid NOT NULL,
    reason text NOT NULL,
    holdUntil timestamp without time zone,
    createdBy uuid,
    isActive boolean DEFAULT true NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_legal_holds_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT PK_bbe3e0c98678909493a90442dfb PRIMARY KEY (id)
);

CREATE TABLE "public"."lfg_group_history" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    lfgPostId character varying NOT NULL,
    activity character varying NOT NULL,
    description character varying NOT NULL,
    creatorId character varying NOT NULL,
    creatorName character varying NOT NULL,
    participantIds text NOT NULL,
    participantCount integer NOT NULL,
    guildId character varying NOT NULL,
    channelId character varying NOT NULL,
    wasSuccessful boolean DEFAULT false NOT NULL,
    durationMinutes integer,
    completionNotes text,
    completedAt timestamp without time zone DEFAULT now() NOT NULL,
    userId uuid NOT NULL,
    CONSTRAINT PK_80b75aa8bd93334760f5159d745 PRIMARY KEY (id)
);

CREATE TABLE "public"."lfg_reputation_ratings" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    sessionId character varying NOT NULL,
    userId uuid NOT NULL,
    raterId character varying NOT NULL,
    overallRating integer NOT NULL,
    categoryRatings text,
    comment text,
    isPositive boolean DEFAULT false NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_6340d9c9b704610156ea5dd7c43 PRIMARY KEY (id)
);

CREATE TABLE "public"."lfg_user_reputation" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    totalSessions integer DEFAULT 0 NOT NULL,
    successfulSessions integer DEFAULT 0 NOT NULL,
    failedSessions integer DEFAULT 0 NOT NULL,
    successRate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    totalRatingsReceived integer DEFAULT 0 NOT NULL,
    averageRating numeric(3,2) DEFAULT '0'::numeric NOT NULL,
    positiveRatings integer DEFAULT 0 NOT NULL,
    negativeRatings integer DEFAULT 0 NOT NULL,
    categoryAverages text,
    activityStats text,
    overallScore numeric(5,2) DEFAULT '50'::numeric NOT NULL,
    sessionsAsLeader integer DEFAULT 0 NOT NULL,
    successfulLeaderSessions integer DEFAULT 0 NOT NULL,
    leadershipSuccessRate numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    currentSuccessStreak integer DEFAULT 0 NOT NULL,
    longestSuccessStreak integer DEFAULT 0 NOT NULL,
    lastSessionAt timestamp without time zone,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_596bc5120360a11d474b8d519e1 PRIMARY KEY (id),
    CONSTRAINT UQ_9366adeac0c4b6a0b788827f4e1 UNIQUE ("userId")
);

CREATE TABLE "public"."logistics_alerts" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    fleetId uuid NOT NULL,
    inventoryItemId character varying NOT NULL,
    itemName character varying NOT NULL,
    type character varying NOT NULL,
    severity character varying NOT NULL,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    title character varying NOT NULL,
    message text NOT NULL,
    metadata text,
    recipients text DEFAULT '[]'::text NOT NULL,
    notificationChannels text DEFAULT ''::text NOT NULL,
    notificationSent boolean DEFAULT false NOT NULL,
    notificationSentAt timestamp without time zone,
    acknowledgedBy character varying,
    acknowledgedAt timestamp without time zone,
    resolvedBy character varying,
    resolvedAt timestamp without time zone,
    resolutionNotes text,
    actions text DEFAULT '[]'::text NOT NULL,
    repeatCount integer DEFAULT 0 NOT NULL,
    lastTriggeredAt timestamp without time zone,
    expiresAt timestamp without time zone,
    autoResolve boolean DEFAULT true NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_bbd6d34dfa1097241e38505da18 PRIMARY KEY (id)
);

CREATE TABLE "public"."member_audit_events" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    userId uuid NOT NULL,
    flagType character varying(40) NOT NULL,
    severity character varying(10) NOT NULL,
    status character varying(12) DEFAULT 'open'::character varying NOT NULL,
    description text NOT NULL,
    metadata jsonb,
    relatedEntityId uuid,
    relatedEntityType character varying(50),
    isAutoGenerated boolean DEFAULT true,
    resolvedBy uuid,
    resolvedAt timestamp without time zone,
    resolutionNote text,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    createdAt timestamp without time zone DEFAULT now(),
    updatedAt timestamp without time zone DEFAULT now(),
    CONSTRAINT member_audit_events_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."migrations" (
    id integer DEFAULT nextval('migrations_id_seq'::regclass) NOT NULL,
    timestamp bigint NOT NULL,
    name character varying NOT NULL,
    CONSTRAINT PK_8c82d7f526340ab734260ea46be PRIMARY KEY (id)
);

CREATE TABLE "public"."mining_operations" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text NOT NULL,
    location character varying NOT NULL,
    coordinatorId character varying NOT NULL,
    scheduledDate timestamp without time zone NOT NULL,
    completedDate timestamp without time zone,
    status character varying DEFAULT 'planned'::character varying NOT NULL,
    crew text DEFAULT '[]'::text NOT NULL,
    resourcesFound text DEFAULT '[]'::text NOT NULL,
    totalValue integer DEFAULT 0 NOT NULL,
    notes character varying,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_49c17502b923a6b01e1ed398a77 PRIMARY KEY (id)
);

CREATE TABLE "public"."mirror_actions" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    sourceIncidentId uuid NOT NULL,
    sourceOrganizationId uuid NOT NULL,
    sourceGuildId character varying(20),
    sourceGuildName character varying(100),
    targetDiscordId character varying(20) NOT NULL,
    targetUsername character varying(100),
    targetGuildId character varying(20) NOT NULL,
    targetGuildName character varying(100),
    actionType mirror_actions_actiontype_enum DEFAULT 'ban'::mirror_actions_actiontype_enum NOT NULL,
    severity integer DEFAULT 5 NOT NULL,
    status mirror_actions_status_enum DEFAULT 'pending'::mirror_actions_status_enum NOT NULL,
    reason text,
    originalReason text,
    durationMinutes integer,
    moderatorId uuid NOT NULL,
    moderatorDiscordId character varying(20),
    moderatorUsername character varying(100),
    confirmationRequired boolean DEFAULT false NOT NULL,
    confirmedAt timestamp without time zone,
    executedAt timestamp without time zone,
    errorMessage text,
    isBulkMirror boolean DEFAULT false NOT NULL,
    bulkMirrorId uuid,
    metadata jsonb,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_mirror_actions_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_mirror_actions_sourceIncidentId FOREIGN KEY ("sourceIncidentId") REFERENCES moderation_incidents(id) ON DELETE SET NULL,
    CONSTRAINT PK_3227e44fb747d3a1db19091b68e PRIMARY KEY (id)
);

CREATE TABLE "public"."mirrored_activities" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    sourceActivityId character varying NOT NULL,
    sourceGuildId character varying NOT NULL,
    sourceOrganizationId uuid NOT NULL,
    mirrorActivityId character varying,
    mirrorGuildId character varying NOT NULL,
    mirrorChannelId character varying NOT NULL,
    mirrorMessageId character varying,
    mirrorKey character varying,
    status mirrored_activity_status_enum DEFAULT 'active'::mirrored_activity_status_enum,
    syncEnabled boolean DEFAULT true,
    lastSyncAt timestamp without time zone,
    metadata jsonb,
    createdAt timestamp without time zone DEFAULT now(),
    updatedAt timestamp without time zone DEFAULT now(),
    deletedAt timestamp without time zone,
    deletedBy character varying,
    CONSTRAINT mirrored_activities_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."missions" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    missionType mission_type_enum DEFAULT 'custom'::mission_type_enum,
    status mission_status_enum DEFAULT 'draft'::mission_status_enum,
    difficulty mission_difficulty_enum DEFAULT 'medium'::mission_difficulty_enum,
    priority mission_priority_enum DEFAULT 'normal'::mission_priority_enum,
    createdBy uuid NOT NULL,
    assignedTo character varying,
    fleetId uuid,
    linkedActivityId uuid,
    location character varying(200),
    objectives text DEFAULT '[]'::text,
    participants text DEFAULT '[]'::text,
    tags text DEFAULT ''::text,
    reward character varying(500),
    startDate timestamp without time zone,
    endDate timestamp without time zone,
    completedAt timestamp without time zone,
    notes text,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    createdAt timestamp without time zone DEFAULT now(),
    updatedAt timestamp without time zone DEFAULT now(),
    CONSTRAINT FK_missions_fleetId FOREIGN KEY ("fleetId") REFERENCES fleets(id) ON DELETE SET NULL,
    CONSTRAINT FK_missions_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_missions PRIMARY KEY (id)
);

CREATE TABLE "public"."moderation_incidents" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    guildId character varying(20) NOT NULL,
    guildName character varying(100),
    targetDiscordId character varying(20) NOT NULL,
    targetUsername character varying(100),
    moderatorId uuid NOT NULL,
    moderatorDiscordId character varying(20),
    moderatorUsername character varying(100),
    incidentType moderation_incidents_incidenttype_enum DEFAULT 'warning'::moderation_incidents_incidenttype_enum NOT NULL,
    severity integer DEFAULT 1 NOT NULL,
    status moderation_incidents_status_enum DEFAULT 'active'::moderation_incidents_status_enum NOT NULL,
    reason text,
    durationMinutes integer,
    isShared boolean DEFAULT false NOT NULL,
    isAutoDetected boolean DEFAULT false NOT NULL,
    discordAuditLogId character varying(20),
    metadata jsonb,
    expiresAt timestamp without time zone,
    revokedBy uuid,
    revokedAt timestamp without time zone,
    revokeReason text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_moderation_incidents_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_64a45c85ec750d46917cafaeac7 PRIMARY KEY (id)
);

CREATE TABLE "public"."notification_preferences" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    muteAll boolean DEFAULT false,
    channels jsonb DEFAULT '{"email": false, "inApp": true, "discord": true}'::jsonb,
    categories jsonb DEFAULT '{"fleet": true, "trade": true, "social": true, "system": true, "activity": true, "security": true, "organization": true}'::jsonb,
    digestFrequency character varying(10) DEFAULT 'daily'::character varying,
    createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FK_notification_preferences_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_notification_preferences PRIMARY KEY (id),
    CONSTRAINT notification_preferences_userId_key UNIQUE ("userId")
);

CREATE TABLE "public"."notifications" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    senderId uuid,
    type character varying DEFAULT 'info'::character varying NOT NULL,
    priority character varying DEFAULT 'normal'::character varying NOT NULL,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false NOT NULL,
    readAt timestamp without time zone,
    data jsonb,
    createdAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT FK_notifications_senderId FOREIGN KEY ("senderId") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT FK_notifications_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_notifications PRIMARY KEY (id)
);

CREATE TABLE "public"."operations" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    type operations_type_enum NOT NULL,
    name character varying NOT NULL,
    description text,
    status operations_status_enum DEFAULT 'planned'::operations_status_enum NOT NULL,
    startDate timestamp without time zone,
    endDate timestamp without time zone,
    participants text[] DEFAULT '{}'::text[] NOT NULL,
    createdBy uuid NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_operations_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_7b62d84d6f9912b975987165856 PRIMARY KEY (id)
);

CREATE TABLE "public"."org_applications" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    applicantUserId uuid NOT NULL,
    status org_application_status_enum DEFAULT 'pending'::org_application_status_enum,
    message text,
    reviewedBy character varying(255),
    reviewNote text,
    reviewedAt timestamp without time zone,
    createdAt timestamp without time zone DEFAULT now(),
    updatedAt timestamp without time zone DEFAULT now(),
    targetType character varying(20) DEFAULT 'organization'::character varying NOT NULL,
    applicantType character varying(20) DEFAULT 'user'::character varying NOT NULL,
    CONSTRAINT FK_org_applications_organization FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_org_applications_applicant FOREIGN KEY ("applicantUserId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT org_applications_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."org_watchlist_entries" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    rsiOrgSid character varying(100) NOT NULL,
    rsiOrgName character varying(255) NOT NULL,
    reason character varying(30) NOT NULL,
    threatLevel character varying(12) NOT NULL,
    notes text,
    addedBy uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    createdAt timestamp without time zone DEFAULT now(),
    updatedAt timestamp without time zone DEFAULT now(),
    CONSTRAINT org_watchlist_entries_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."organization_activities" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    action organization_activities_action_enum NOT NULL,
    actorId uuid,
    actorType character varying,
    actorName character varying,
    targetUserId character varying,
    targetUserName character varying,
    targetOrgId uuid,
    targetOrgName character varying,
    resourceType character varying,
    resourceId character varying,
    description text,
    before jsonb,
    after jsonb,
    metadata jsonb,
    severity organization_activities_severity_enum DEFAULT 'info'::organization_activities_severity_enum NOT NULL,
    tags text,
    requiresReview boolean DEFAULT false NOT NULL,
    reviewed boolean DEFAULT false NOT NULL,
    reviewedBy character varying,
    reviewedAt timestamp without time zone,
    ipAddress character varying,
    userAgent text,
    method character varying,
    endpoint text,
    statusCode integer,
    timestamp timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_organization_analytics_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_529b6dbb2fb009fa25ca86b52c7 FOREIGN KEY ("actorId") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT PK_e13b7949ae7df5ca4100063fec0 PRIMARY KEY (id)
);

CREATE TABLE "public"."organization_analytics" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    period organization_analytics_period_enum DEFAULT 'DAILY'::organization_analytics_period_enum NOT NULL,
    periodStart timestamp without time zone NOT NULL,
    periodEnd timestamp without time zone NOT NULL,
    memberStats jsonb NOT NULL,
    activityMetrics jsonb NOT NULL,
    engagementMetrics jsonb NOT NULL,
    growthMetrics jsonb NOT NULL,
    hierarchyHealth jsonb NOT NULL,
    resourceUsage jsonb NOT NULL,
    overallHealthScore numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    comparison jsonb,
    alerts jsonb,
    recommendations jsonb,
    metadata jsonb,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    isSnapshot boolean DEFAULT false NOT NULL,
    CONSTRAINT FK_organization_analytics_organizationId2 FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_31600a2fa9dafc883312ea30ed2 PRIMARY KEY (id)
);

CREATE TABLE "public"."organization_deletion_requests" (
    id uuid NOT NULL,
    organizationId uuid NOT NULL,
    requestedBy uuid NOT NULL,
    status organization_deletion_requests_status_enum DEFAULT 'pending'::organization_deletion_requests_status_enum NOT NULL,
    requestedAt timestamp without time zone NOT NULL,
    approvedAt timestamp without time zone,
    approvedBy uuid,
    approvalNotes text,
    rejectedAt timestamp without time zone,
    rejectedBy uuid,
    rejectionReason text,
    scheduledFor timestamp without time zone,
    completedAt timestamp without time zone,
    cancelledAt timestamp without time zone,
    cancelledBy uuid,
    cancellationReason text,
    requestReason text,
    requestIpAddress character varying(45),
    requestUserAgent character varying(500),
    failureReason text,
    deleteDescendants boolean DEFAULT false NOT NULL,
    dataExportGenerated boolean DEFAULT false NOT NULL,
    exportFilePath character varying(500),
    exportDownloadToken character varying(1000),
    deletionPreview jsonb,
    gracePeriodDays integer DEFAULT 30 NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    emailVerificationToken character varying(255),
    emailVerifiedAt timestamp without time zone,
    exportDownloadCount integer DEFAULT 0 NOT NULL,
    exportLastDownloadedAt timestamp without time zone,
    CONSTRAINT FK_fe315a04d228e831b5d820bdffc FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_d2b4bc0e38105627a58f61e48f1 FOREIGN KEY ("approvedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT FK_a6e8aeeee4f9260a474e5883329 FOREIGN KEY ("cancelledBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT FK_2de7ce401e3ef4fde79a82905d7 FOREIGN KEY ("rejectedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT FK_9bd2c2d1a7b7c1923e8b616576b FOREIGN KEY ("requestedBy") REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT PK_16b55e56b8c68d6dc41db73aca0 PRIMARY KEY (id)
);

CREATE TABLE "public"."organization_encryption_keys" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    keyId character varying(64) NOT NULL,
    algorithm character varying(32) DEFAULT 'AES-256-GCM'::character varying NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    keyWrappers jsonb NOT NULL,
    recoveryHint text,
    requiresRecoveryPhrase boolean DEFAULT true NOT NULL,
    createdBy uuid NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    rotatedAt timestamp without time zone,
    isActive boolean DEFAULT true NOT NULL,
    lastUsedAt timestamp without time zone,
    usageCount integer DEFAULT 0 NOT NULL,
    CONSTRAINT fk_org_encryption_key_org FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT organization_encryption_keys_pkey PRIMARY KEY (id),
    CONSTRAINT organization_encryption_keys_keyId_key UNIQUE ("keyId")
);

CREATE TABLE "public"."organization_inventory" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    itemName character varying NOT NULL,
    description text,
    category character varying DEFAULT 'commodities'::character varying NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit character varying,
    unitValue numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    totalValue numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    location character varying,
    assignedTo character varying,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_1cd7cd817ce344fc44d09c5be3c PRIMARY KEY (id)
);

CREATE TABLE "public"."organization_memberships" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    organizationId uuid NOT NULL,
    roleBackup character varying DEFAULT 'member'::character varying NOT NULL,
    title text,
    isActive boolean DEFAULT true NOT NULL,
    joinedAt timestamp without time zone,
    leftAt timestamp without time zone,
    permissions text,
    metadata jsonb,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    securityLevel integer DEFAULT 1 NOT NULL,
    roleId uuid NOT NULL,
    CONSTRAINT FK_organization_memberships_roleId FOREIGN KEY ("roleId") REFERENCES roles(id) ON DELETE RESTRICT,
    CONSTRAINT FK_organization_memberships_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_organization_memberships_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_cd7be805730a4c778a5f45364af PRIMARY KEY (id)
);

COMMENT ON COLUMN "public"."organization_memberships".roleBackup IS 'Deprecated: Original string-based role. Kept temporarily for rollback safety. Will be removed in future migration.';

CREATE TABLE "public"."organization_permissions" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    userId uuid,
    roleId character varying,
    resource organization_permissions_resource_enum NOT NULL,
    resourceId character varying,
    actions text NOT NULL,
    scope organization_permissions_scope_enum DEFAULT 'organization'::organization_permissions_scope_enum NOT NULL,
    inheritable boolean DEFAULT true NOT NULL,
    inherited boolean DEFAULT false NOT NULL,
    inheritedFrom character varying,
    priority integer DEFAULT 1 NOT NULL,
    conditions jsonb,
    metadata jsonb,
    isActive boolean DEFAULT true NOT NULL,
    expiresAt timestamp without time zone,
    grantedBy character varying,
    reason character varying,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_c4b00225d0f8f7976e6710d3100 FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_884aa7f412cd9cee938f0f2b9db FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_0b3674af6e27e4e3a04721e8655 PRIMARY KEY (id)
);

CREATE TABLE "public"."organization_relationships" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    targetOrganizationId uuid NOT NULL,
    type character varying DEFAULT 'neutral'::character varying NOT NULL,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    trustScore numeric(5,2) DEFAULT '50'::numeric NOT NULL,
    relationshipStrength numeric(5,2) DEFAULT '50'::numeric NOT NULL,
    interactionCount integer DEFAULT 0 NOT NULL,
    positiveInteractions integer DEFAULT 0 NOT NULL,
    negativeInteractions integer DEFAULT 0 NOT NULL,
    description text,
    notes text,
    tags text,
    metadata text,
    primaryContact character varying,
    contactName character varying,
    contactRole character varying,
    contactEmail character varying,
    communicationChannels text,
    establishedBy character varying,
    lastModifiedBy character varying,
    establishedDate timestamp without time zone,
    lastInteractionDate timestamp without time zone,
    reviewDate timestamp without time zone,
    expiryDate timestamp without time zone,
    isMutual boolean DEFAULT false NOT NULL,
    isMutuallyRecognized boolean DEFAULT false NOT NULL,
    reciprocalRelationshipId character varying,
    isPublic boolean DEFAULT false NOT NULL,
    requiresApproval boolean DEFAULT false NOT NULL,
    autoRenew boolean DEFAULT false NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_0cafd563e0d8b2b484713b58e8f PRIMARY KEY (id)
);

CREATE TABLE "public"."organization_ships" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    shipId uuid NOT NULL,
    shipName character varying NOT NULL,
    customName character varying,
    role organization_ships_role_enum DEFAULT 'reserve'::organization_ships_role_enum NOT NULL,
    status organization_ships_status_enum DEFAULT 'owned'::organization_ships_status_enum NOT NULL,
    condition organization_ships_condition_enum DEFAULT 'good'::organization_ships_condition_enum NOT NULL,
    acquisitionMethod character varying,
    acquiredBy character varying,
    acquiredDate timestamp without time zone,
    acquisitionCost numeric(12,2),
    assignedCaptain character varying,
    assignedCrew text,
    maxCrew integer,
    location character varying,
    homeBase character varying,
    insuranceLevel character varying,
    insuranceExpires timestamp without time zone,
    lastMaintenance timestamp without time zone,
    nextMaintenance timestamp without time zone,
    flightHours integer DEFAULT 0 NOT NULL,
    missionsCompleted integer DEFAULT 0 NOT NULL,
    totalEarnings numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    maintenanceCosts numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    modifications jsonb,
    isAvailable boolean DEFAULT true NOT NULL,
    isCapital boolean DEFAULT false NOT NULL,
    requiresPermission boolean DEFAULT false NOT NULL,
    minimumRank character varying,
    notes text,
    tags text,
    isActive boolean DEFAULT true NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    sharingLevel organization_ships_sharinglevel_enum DEFAULT 'organization'::organization_ships_sharinglevel_enum NOT NULL,
    minRequiredRank integer,
    useCustomVisibility boolean DEFAULT false NOT NULL,
    CONSTRAINT FK_3d32c3fa79379e069dfe38abfd8 FOREIGN KEY ("organizationId") REFERENCES organizations(id),
    CONSTRAINT PK_eb7f1ad251d2a9a17d84fe95bfc PRIMARY KEY (id)
);

CREATE TABLE "public"."organization_templates" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    category organization_templates_category_enum DEFAULT 'CUSTOM'::organization_templates_category_enum NOT NULL,
    visibility organization_templates_visibility_enum DEFAULT 'PRIVATE'::organization_templates_visibility_enum NOT NULL,
    createdBy uuid NOT NULL,
    creatorName character varying(255),
    structure jsonb NOT NULL,
    defaultRoles jsonb DEFAULT '[]'::jsonb NOT NULL,
    defaultPermissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    defaultSettings jsonb NOT NULL,
    applicationConfig jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags text,
    iconUrl character varying(500),
    usageCount integer DEFAULT 0 NOT NULL,
    averageRating numeric(3,2) DEFAULT '0'::numeric NOT NULL,
    ratingCount integer DEFAULT 0 NOT NULL,
    isActive boolean DEFAULT true NOT NULL,
    isFeatured boolean DEFAULT false NOT NULL,
    isVerified boolean DEFAULT false NOT NULL,
    isPublic boolean DEFAULT false NOT NULL,
    version character varying(20) DEFAULT '1.0.0'::character varying NOT NULL,
    changelog text,
    forkedFrom uuid,
    preview jsonb,
    metadata jsonb,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    lastUsedAt timestamp without time zone,
    CONSTRAINT FK_organization_templates_forkedFrom FOREIGN KEY ("forkedFrom") REFERENCES organization_templates(id) ON DELETE SET NULL,
    CONSTRAINT PK_04821cf14f17052feac3bd1cdac PRIMARY KEY (id)
);

CREATE TABLE "public"."organizations" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text,
    members text NOT NULL,
    parentOrgId uuid,
    type organizations_type_enum DEFAULT 'root'::organizations_type_enum NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    path text DEFAULT ''::text NOT NULL,
    rootOrgId character varying,
    status organizations_status_enum DEFAULT 'active'::organizations_status_enum NOT NULL,
    ownerId character varying,
    adminIds text,
    settings jsonb,
    metadata jsonb,
    structure jsonb,
    tags text,
    logoUrl character varying,
    website character varying,
    contactEmail character varying,
    totalMembers integer DEFAULT 0 NOT NULL,
    directMembers integer DEFAULT 0 NOT NULL,
    childCount integer DEFAULT 0 NOT NULL,
    isArchived boolean DEFAULT false NOT NULL,
    archivedAt timestamp without time zone,
    archivedBy character varying,
    archiveReason text,
    restoredAt timestamp without time zone,
    restoredBy character varying,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    rsiSid character varying,
    rsiVerified boolean DEFAULT false NOT NULL,
    rsiVerifiedAt timestamp without time zone,
    rsiVerificationCode character varying,
    rsiVerificationCodeExpiresAt timestamp without time zone,
    CONSTRAINT FK_organizations_parentOrgId FOREIGN KEY ("parentOrgId") REFERENCES organizations(id) ON DELETE SET NULL,
    CONSTRAINT PK_6b031fcd0863e3f6b44230163f9 PRIMARY KEY (id)
);

COMMENT ON COLUMN "public"."organizations".rsiSid IS 'RSI organization SID (Spectrum ID)';

COMMENT ON COLUMN "public"."organizations".rsiVerified IS 'Whether the RSI organization is verified';

COMMENT ON COLUMN "public"."organizations".rsiVerifiedAt IS 'Timestamp when RSI organization was verified';

COMMENT ON COLUMN "public"."organizations".rsiVerificationCode IS 'Temporary verification code for RSI organization verification';

COMMENT ON COLUMN "public"."organizations".rsiVerificationCodeExpiresAt IS 'Expiration timestamp for verification code';

CREATE TABLE "public"."password_history" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    passwordHash text NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_20c510e5ca12f63b0c915c3e2df FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_da65ed4600e5e6bc9315754a8b2 PRIMARY KEY (id)
);

CREATE TABLE "public"."password_reset_tokens" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    token character varying NOT NULL,
    expiresAt timestamp without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_d6a19d4b4f6c62dcd29daa497e2 FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_d16bebd73e844c48bca50ff8d3d PRIMARY KEY (id),
    CONSTRAINT UQ_ab673f0e63eac966762155508ee UNIQUE (token)
);

CREATE TABLE "public"."passwordless_tokens" (
    id uuid NOT NULL,
    userId uuid,
    email character varying(255) NOT NULL,
    tokenHash character varying(128) NOT NULL,
    shortCode character varying(6),
    tokenType character varying(20) DEFAULT 'magic_link'::character varying NOT NULL,
    expiresAt timestamp without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    usedAt timestamp without time zone,
    attempts integer DEFAULT 0 NOT NULL,
    maxAttempts integer DEFAULT 5 NOT NULL,
    requestIp character varying(45),
    requestUserAgent text,
    verifyIp character varying(45),
    verifyUserAgent text,
    purpose character varying(30) DEFAULT 'login'::character varying NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_5ca1df0650d11157a2a397730b9 FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_c463ea87bf42c6e89e93f82b100 PRIMARY KEY (id)
);

CREATE TABLE "public"."permissions" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    organizationId uuid NOT NULL,
    resource character varying NOT NULL,
    action character varying NOT NULL,
    granted boolean DEFAULT false NOT NULL,
    grantedBy character varying,
    expiresAt timestamp without time zone,
    conditions json,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_920331560282b8bd21bb02290df PRIMARY KEY (id)
);

CREATE TABLE "public"."public_job_listings" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid,
    allianceId character varying,
    ownerType public_job_listings_ownertype_enum DEFAULT 'organization'::public_job_listings_ownertype_enum NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    jobType public_job_listings_jobtype_enum DEFAULT 'crew'::public_job_listings_jobtype_enum NOT NULL,
    focus public_job_listings_focus_enum DEFAULT 'mixed'::public_job_listings_focus_enum NOT NULL,
    payType public_job_listings_paytype_enum,
    payMin integer,
    payMax integer,
    experienceLevel integer DEFAULT 0 NOT NULL,
    isActive boolean DEFAULT true NOT NULL,
    postedAt timestamp without time zone DEFAULT now() NOT NULL,
    expiresAt timestamp without time zone,
    createdBy uuid,
    contactInfo character varying(255),
    timezone character varying(50),
    languages jsonb,
    tags jsonb,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    crewSpotsTotal integer,
    crewSpotsFilled integer DEFAULT 0,
    requiredShips jsonb,
    shipRequirementType character varying(20) DEFAULT 'none'::character varying,
    listingCategory listing_category_enum DEFAULT 'job'::listing_category_enum NOT NULL,
    CONSTRAINT CHK_pjl_orgId_when_org_owner CHECK ("ownerType" <> 'organization'::public_job_listings_ownertype_enum OR "organizationId" IS NOT NULL),
    CONSTRAINT FK_public_job_listings_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_d25470ca0f3a94adc67182a6871 PRIMARY KEY (id)
);

CREATE TABLE "public"."public_org_profiles" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    isPublic boolean DEFAULT false NOT NULL,
    tagline character varying(200),
    primaryFocus public_org_profiles_primaryfocus_enum DEFAULT 'mixed'::public_org_profiles_primaryfocus_enum NOT NULL,
    secondaryFocus jsonb,
    memberCount integer DEFAULT 0 NOT NULL,
    activityLevel public_org_profiles_activitylevel_enum DEFAULT 'moderate'::public_org_profiles_activitylevel_enum NOT NULL,
    rsiUrl character varying(255),
    discordInvite character varying(100),
    languages jsonb,
    timezone character varying(50),
    isVerified boolean DEFAULT false NOT NULL,
    isRecruiting boolean DEFAULT false NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    twitterUrl character varying(255),
    youtubeUrl character varying(255),
    twitchUrl character varying(255),
    websiteUrl character varying(255),
    bannerUrl character varying(500),
    useDiscordForApplications boolean DEFAULT false NOT NULL,
    CONSTRAINT FK_public_org_profiles_organization FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_d5a1cbe6b962269820be5021551 PRIMARY KEY (id),
    CONSTRAINT UQ_da7e5aa35ad6fab8d85c70d995b UNIQUE ("organizationId")
);

CREATE TABLE "public"."recovery_tokens" (
    id integer DEFAULT nextval('recovery_tokens_id_seq'::regclass) NOT NULL,
    userId uuid NOT NULL,
    tokenHash character varying NOT NULL,
    token character varying,
    type character varying NOT NULL,
    expiresAt timestamp without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    isUsed boolean DEFAULT false NOT NULL,
    usedAt timestamp without time zone,
    ipAddress character varying,
    userAgent character varying,
    adminUserId character varying,
    reason character varying(1000),
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_533de0ae206825b9ab04e79874e PRIMARY KEY (id)
);

CREATE TABLE "public"."refresh_tokens" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    tokenHash character varying NOT NULL,
    expiresAt timestamp without time zone NOT NULL,
    revoked boolean DEFAULT false NOT NULL,
    revokedAt timestamp without time zone,
    replacedByToken character varying,
    ipAddress character varying,
    userAgent character varying,
    tokenEncrypted character varying(512),
    encryptionIv character varying,
    encryptionAuthTag character varying,
    familyId character varying,
    parentTokenId character varying,
    lastUsedAt timestamp without time zone,
    location character varying,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_7d8bee0204106019488c4c50ffa PRIMARY KEY (id)
);

CREATE TABLE "public"."relationship_history" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    relationshipId character varying NOT NULL,
    organizationId uuid NOT NULL,
    targetOrganizationId uuid NOT NULL,
    changeType character varying NOT NULL,
    description text NOT NULL,
    previousValue text,
    newValue text,
    changeDetails text,
    actorId uuid,
    actorName character varying,
    actorRole character varying,
    reason text,
    notes text,
    tags text,
    metadata text,
    isSystemGenerated boolean DEFAULT false NOT NULL,
    isSignificant boolean DEFAULT false NOT NULL,
    requiresNotification boolean DEFAULT false NOT NULL,
    notificationSent boolean DEFAULT false NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_a734b2c6f910c17a5aa6902580e PRIMARY KEY (id)
);

CREATE TABLE "public"."reputation" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    userId uuid NOT NULL,
    scores text DEFAULT '[]'::text NOT NULL,
    overallScore integer DEFAULT 0 NOT NULL,
    history text DEFAULT '[]'::text NOT NULL,
    lastUpdated timestamp without time zone DEFAULT now() NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_640807583e8622e1d9bbe6f1b7b PRIMARY KEY (id)
);

CREATE TABLE "public"."roles" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    organizationId uuid,
    isSystemRole boolean DEFAULT false NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    permissions text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT CHK_roles_orgId_or_system CHECK ("isSystemRole" = true OR "organizationId" IS NOT NULL),
    CONSTRAINT fk_role_organization FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."rsi_member_cache" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    rsiOrgSid character varying(50) NOT NULL,
    rsiHandle character varying(100) NOT NULL,
    rsiRank character varying(50) NOT NULL,
    rsiRankOrder integer,
    isAffiliate boolean DEFAULT false NOT NULL,
    displayName character varying(100),
    metadata jsonb,
    cachedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_f9cc84f84e82a1f598d2fa08b0c PRIMARY KEY (id),
    CONSTRAINT UQ_rsi_member_cache_org_handle UNIQUE ("organizationId", "rsiHandle")
);

CREATE TABLE "public"."rsi_role_mappings" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    rsiRank character varying(50) NOT NULL,
    discordRoleId character varying(20),
    rbacPermissions jsonb,
    isActive boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    description character varying(255),
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_801c3304d4667dc49021dee771b FOREIGN KEY ("organizationId") REFERENCES organizations(id),
    CONSTRAINT PK_e77d56a8ae1d8975ab493fe1230 PRIMARY KEY (id),
    CONSTRAINT UQ_rsi_role_mappings_org_rank UNIQUE ("organizationId", "rsiRank")
);

CREATE TABLE "public"."rsi_sync_audit_log" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    syncType character varying(20) NOT NULL,
    changesDetected integer DEFAULT 0 NOT NULL,
    changesApplied integer DEFAULT 0 NOT NULL,
    errors integer DEFAULT 0 NOT NULL,
    details jsonb,
    syncedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_10e9ff1af1d9868e8661cc1d330 FOREIGN KEY ("organizationId") REFERENCES organizations(id),
    CONSTRAINT PK_09819a44de2ab9951d437b1fdf6 PRIMARY KEY (id)
);

CREATE TABLE "public"."rsi_sync_schedules" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    rsiOrgSid character varying(50) NOT NULL,
    guildId character varying(20),
    isEnabled boolean DEFAULT false NOT NULL,
    intervalMinutes integer DEFAULT 60 NOT NULL,
    lastSyncAt timestamp without time zone,
    nextSyncAt timestamp without time zone,
    consecutiveFailures integer DEFAULT 0 NOT NULL,
    lastErrorMessage text,
    notifyOnChanges boolean DEFAULT true NOT NULL,
    notifyOnErrors boolean DEFAULT true NOT NULL,
    notificationChannelId character varying(20),
    removeRolesOnLeave boolean DEFAULT true NOT NULL,
    affiliateHandling character varying(20) DEFAULT 'include'::character varying NOT NULL,
    affiliateRoleId character varying(20),
    maxConsecutiveFailures integer DEFAULT 5 NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_rsi_sync_schedules_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_636721c9fab918a805b2afc6f28 PRIMARY KEY (id)
);

CREATE TABLE "public"."rsi_user_links" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    organizationId uuid NOT NULL,
    rsiHandle character varying(100) NOT NULL,
    verificationMethod character varying(20) NOT NULL,
    verificationCode character varying(50),
    verifiedAt timestamp without time zone,
    lastSyncedAt timestamp without time zone,
    syncStatus character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    discordUserId character varying(20),
    lastKnownRank character varying(50),
    isAffiliate boolean DEFAULT false NOT NULL,
    metadata jsonb,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_rsi_user_links_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_rsi_user_links_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_64749fa095b2f9c18b307dd8725 PRIMARY KEY (id),
    CONSTRAINT UQ_rsi_user_links_user_org UNIQUE ("userId", "organizationId")
);

CREATE TABLE "public"."scstats_csv_imports" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    playtimeData jsonb,
    loadoutTopData jsonb,
    loadoutDetailData jsonb,
    purchasesData jsonb,
    shipsData jsonb,
    playtimeImportedAt timestamp with time zone,
    loadoutImportedAt timestamp with time zone,
    purchasesImportedAt timestamp with time zone,
    shipsImportedAt timestamp with time zone,
    summary jsonb,
    consentGranted boolean DEFAULT false NOT NULL,
    consentDate timestamp with time zone,
    createdAt timestamp with time zone DEFAULT now() NOT NULL,
    updatedAt timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_e7700ab01613b562fb82e397368 PRIMARY KEY (id)
);

-- security_events table removed (orphan, no application writer).
-- See migration 1863600000000-DropSecurityEventsTable and docs/MIGRATION_AUDIT.md §1.2.

CREATE TABLE "public"."security_levels" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    level integer NOT NULL,
    resourceType character varying NOT NULL,
    accessLevel character varying NOT NULL,
    restrictions json,
    approvedBy uuid,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    sourceOrgId uuid,
    targetOrgId uuid,
    notes text,
    isActive boolean DEFAULT true,
    expiresAt timestamp without time zone,
    updatedBy uuid,
    CONSTRAINT check_different_orgs CHECK ("sourceOrgId"::text <> "targetOrgId"::text),
    CONSTRAINT fk_security_level_source_org FOREIGN KEY ("sourceOrgId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_security_level_target_org FOREIGN KEY ("targetOrgId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_2f2be9afaa3eaca9e93811054e3 PRIMARY KEY (id)
);

CREATE TABLE "public"."shared_accounts" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    accountName character varying(255) NOT NULL,
    accountUsername character varying(100) NOT NULL,
    description text,
    organizationId uuid NOT NULL,
    keyVaultSecretName character varying(255) NOT NULL,
    twoFactorSecretName character varying(255),
    passwordExpiresAt timestamp without time zone,
    categories text,
    tags text,
    createdBy uuid NOT NULL,
    lastAccessedBy uuid,
    lastAccessedAt timestamp without time zone,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_13836720b8a28794f5f5e0a3f95 PRIMARY KEY (id)
);

CREATE TABLE "public"."ship_loadouts" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    ownerId character varying NOT NULL,
    shipId uuid,
    shipName character varying NOT NULL,
    components text NOT NULL,
    description text,
    erkulGamesUrl character varying,
    statistics text,
    version integer DEFAULT 1 NOT NULL,
    parentLoadoutId character varying,
    isLatestVersion boolean DEFAULT true NOT NULL,
    sharedWithFleet boolean DEFAULT false NOT NULL,
    sharedWithOrg boolean DEFAULT false NOT NULL,
    sharedWithAlliance boolean DEFAULT false NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    sharedWithUsers text,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_6b3061d44b08ebcd3c89136a5e2 PRIMARY KEY (id)
);

CREATE TABLE "public"."ship_loans" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipId uuid NOT NULL,
    lenderId character varying NOT NULL,
    borrowerId character varying NOT NULL,
    requestDate timestamp without time zone NOT NULL,
    approvedDate timestamp without time zone,
    startDate timestamp without time zone NOT NULL,
    expectedReturnDate timestamp without time zone NOT NULL,
    actualReturnDate timestamp without time zone,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    terms text,
    notes text,
    insuranceRequired boolean DEFAULT false NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_7e554b08f99d85ff4f3b32c94cc PRIMARY KEY (id)
);

CREATE TABLE "public"."ship_maintenance" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    shipId uuid NOT NULL,
    ownerId character varying NOT NULL,
    maintenanceType character varying NOT NULL,
    scheduledDate timestamp without time zone NOT NULL,
    completedDate timestamp without time zone,
    status character varying DEFAULT 'scheduled'::character varying NOT NULL,
    description text,
    cost integer,
    performedBy character varying,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_94e2fc9c8c93ddaf0376a9a9290 PRIMARY KEY (id)
);

CREATE TABLE "public"."ships" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    manufacturer character varying NOT NULL,
    manufacturerCode character varying,
    description text,
    role character varying,
    roles text,
    size character varying,
    status character varying DEFAULT 'flight_ready'::character varying NOT NULL,
    crew integer,
    minCrew integer,
    maxCrew integer,
    length numeric(10,2),
    beam numeric(10,2),
    height numeric(10,2),
    mass numeric(10,2),
    cargo integer,
    vehicleCargo integer,
    price numeric(10,2),
    pledgePrice integer,
    speed integer,
    afterburnerSpeed integer,
    quantumSpeed integer,
    quantumFuelCapacity integer,
    hydrogenFuelCapacity integer,
    shields integer,
    armor integer,
    weapons text,
    hardpoints text,
    hangarSize character varying,
    storageUrl character varying,
    thumbnailUrl character varying,
    imageUrl character varying,
    brochureUrl character varying,
    isActive boolean DEFAULT true NOT NULL,
    loanerShip character varying,
    variants text,
    isVehicle boolean DEFAULT false NOT NULL,
    metadata text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_7af8add8b07b52d436834de24dd FOREIGN KEY ("organizationId") REFERENCES organizations(id),
    CONSTRAINT PK_fba257c7e5f4ff0c26afa06e9ee PRIMARY KEY (id)
);

CREATE TABLE "public"."team_members" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    teamId uuid NOT NULL,
    userId uuid NOT NULL,
    role character varying(20) DEFAULT 'member'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    joinedAt timestamp with time zone,
    leftAt timestamp with time zone,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp with time zone,
    deletedBy character varying,
    createdAt timestamp with time zone DEFAULT now() NOT NULL,
    updatedAt timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_tm_team FOREIGN KEY ("teamId") REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT PK_ca3eae89dcf20c9fd95bf7460aa PRIMARY KEY (id)
);

CREATE TABLE "public"."teams" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    type character varying(20) DEFAULT 'squad'::character varying NOT NULL,
    parentTeamId uuid,
    level integer DEFAULT 0 NOT NULL,
    sortOrder integer DEFAULT 0 NOT NULL,
    maxMembers integer DEFAULT 20 NOT NULL,
    isActive boolean DEFAULT true NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp with time zone,
    deletedBy character varying,
    createdAt timestamp with time zone DEFAULT now() NOT NULL,
    updatedAt timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_team_parent FOREIGN KEY ("parentTeamId") REFERENCES teams(id) ON DELETE SET NULL,
    CONSTRAINT PK_7e5523774a38b08a6236d322403 PRIMARY KEY (id)
);

CREATE TABLE "public"."tickets" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    ticketNumber character varying NOT NULL,
    subject character varying NOT NULL,
    description text NOT NULL,
    category tickets_category_enum DEFAULT 'general'::tickets_category_enum NOT NULL,
    priority tickets_priority_enum DEFAULT 'medium'::tickets_priority_enum NOT NULL,
    status tickets_status_enum DEFAULT 'open'::tickets_status_enum NOT NULL,
    creatorId character varying NOT NULL,
    creatorName character varying NOT NULL,
    creatorDiscordId character varying,
    creatorEmail character varying,
    assigneeId character varying,
    assigneeName character varying,
    recipientType tickets_recipienttype_enum,
    assignmentHistory text DEFAULT '[]'::text NOT NULL,
    messages text DEFAULT '[]'::text NOT NULL,
    discordSettings text,
    discordChannelId character varying,
    discordThreadId character varying,
    relatedRecruitmentId character varying,
    relatedDiplomacyId character varying,
    relatedApplicationId character varying,
    tags text DEFAULT ''::text NOT NULL,
    resolution text,
    resolvedAt timestamp without time zone,
    resolvedBy character varying,
    satisfactionRating integer,
    feedback text,
    dueDate timestamp without time zone,
    slaBreached boolean DEFAULT false NOT NULL,
    firstResponseAt timestamp without time zone,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    closedAt timestamp without time zone,
    recipientId character varying,
    recipientName character varying,
    CONSTRAINT FK_tickets_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_343bc942ae261cf7a1377f48fd0 PRIMARY KEY (id),
    CONSTRAINT UQ_e99bd0f51b92896fdaf99ebb715 UNIQUE ("ticketNumber")
);

CREATE TABLE "public"."token_blacklist" (
    id integer DEFAULT nextval('token_blacklist_id_seq'::regclass) NOT NULL,
    tokenJti character varying NOT NULL,
    userId uuid NOT NULL,
    expiresAt timestamp without time zone NOT NULL,
    revokedAt timestamp without time zone DEFAULT now() NOT NULL,
    reason character varying,
    ipAddress character varying,
    userAgent character varying,
    CONSTRAINT PK_3e37528d03f0bd5335874afa48d PRIMARY KEY (id),
    CONSTRAINT UQ_cdae079f3ade88775b9abbce907 UNIQUE ("tokenJti")
);

CREATE TABLE "public"."tournaments" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text NOT NULL,
    organizerId character varying NOT NULL,
    startDate timestamp without time zone NOT NULL,
    endDate timestamp without time zone,
    status character varying DEFAULT 'registration'::character varying NOT NULL,
    maxParticipants integer DEFAULT 8 NOT NULL,
    participants text DEFAULT '[]'::text NOT NULL,
    matches text DEFAULT '[]'::text NOT NULL,
    prizePool character varying,
    rules character varying,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_6d5d129da7a80cf99e8ad4833a9 PRIMARY KEY (id)
);

CREATE TABLE "public"."trading_routes" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text NOT NULL,
    creatorId character varying NOT NULL,
    organizationId uuid,
    visibility character varying DEFAULT 'organization'::character varying NOT NULL,
    stops text NOT NULL,
    estimatedProfit integer,
    estimatedDuration integer,
    minCargoCapacity integer,
    fleetComposition text,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    performance text,
    tags text DEFAULT ''::text NOT NULL,
    notes character varying,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT CHK_tr_orgId_when_org_visibility CHECK (visibility::text <> 'organization'::text OR "organizationId" IS NOT NULL),
    CONSTRAINT FK_1953c95dfeac3784af0a133f05e FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE SET NULL,
    CONSTRAINT PK_4452a00d6ed579add9c9b06854e PRIMARY KEY (id)
);

CREATE TABLE "public"."trusted_devices" (
    id uuid NOT NULL,
    userId uuid NOT NULL,
    deviceFingerprint character varying(64) NOT NULL,
    deviceName character varying(255),
    userAgent text,
    ipAddress character varying(45),
    location character varying(255),
    lastUsed timestamp without time zone NOT NULL,
    isActive boolean DEFAULT true NOT NULL,
    trustLevel character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    verificationMethod character varying(20),
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_d1623ce96eb58dbfc177e00e413 FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_bc545fd72c357ff2edc8bbc7deb PRIMARY KEY (id)
);

CREATE TABLE "public"."tunnels" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    creatorGuildId character varying NOT NULL,
    creatorChannelId character varying NOT NULL,
    isPublic boolean DEFAULT true NOT NULL,
    password character varying,
    connectedChannels text NOT NULL,
    rateLimitConfig text,
    contentFilterEnabled boolean DEFAULT true NOT NULL,
    organizationId uuid,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_00190c58082e29bb99fe01b381e FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE SET NULL,
    CONSTRAINT PK_3fbdf81d4f41de370e8e0ad9135 PRIMARY KEY (id)
);

CREATE TABLE "public"."user_activities" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    action character varying NOT NULL,
    resource character varying,
    method character varying,
    ipAddress character varying,
    userAgent text,
    metadata jsonb,
    statusCode integer,
    duration integer,
    timestamp timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_5618ade060df353e3965b759995 FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_1245d4d2cf04ba7743f2924d951 PRIMARY KEY (id)
);

CREATE TABLE "public"."user_availability" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    organizationId uuid NOT NULL,
    dayOfWeek integer NOT NULL,
    startMinute integer NOT NULL,
    endMinute integer NOT NULL,
    isRecurring boolean DEFAULT true NOT NULL,
    effectiveDate date,
    expiresAt date,
    createdAt timestamp with time zone DEFAULT now() NOT NULL,
    updatedAt timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_availability_pkey PRIMARY KEY (id)
);

CREATE TABLE "public"."user_consents" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    consentType user_consents_consenttype_enum NOT NULL,
    granted boolean NOT NULL,
    purpose text,
    version character varying(100),
    ipAddress character varying(45),
    userAgent character varying(500),
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    expiresAt timestamp without time zone,
    CONSTRAINT FK_7a8097efad75fcbc548d467d648 FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_65e4c6d6204ad8719abf4b30326 PRIMARY KEY (id)
);

CREATE TABLE "public"."user_gameplay_preferences" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    activityPreferences text NOT NULL,
    experienceLevels text,
    playstyles text NOT NULL,
    preferredGroupSizeMin integer DEFAULT 4 NOT NULL,
    preferredGroupSizeMax integer DEFAULT 8 NOT NULL,
    requiresVoiceChat boolean DEFAULT false NOT NULL,
    prefersSilentPlay boolean DEFAULT false NOT NULL,
    timezone character varying,
    availability text,
    preferredRoles text,
    languages text DEFAULT 'english'::text NOT NULL,
    combatSkill integer DEFAULT 50 NOT NULL,
    pilotingSkill integer DEFAULT 50 NOT NULL,
    tradingSkill integer DEFAULT 50 NOT NULL,
    miningSkill integer DEFAULT 50 NOT NULL,
    allowCrossOrgMatching boolean DEFAULT true NOT NULL,
    onlyMatchWithVerified boolean DEFAULT false NOT NULL,
    minReputationScore integer DEFAULT 50 NOT NULL,
    preferenceUpdateCount integer DEFAULT 0 NOT NULL,
    lastPreferenceUpdate timestamp without time zone,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    scstats_raw_data text,
    scstats_last_import timestamp without time zone,
    scstats_verified boolean DEFAULT false,
    scstats_total_hours numeric(10,2),
    scstats_kd_ratio numeric(10,2),
    scstats_missions_completed integer,
    scstats_favorite_vehicle character varying(255),
    scstats_import_count integer DEFAULT 0,
    scstats_consent_granted boolean DEFAULT false,
    scstats_consent_date timestamp without time zone,
    CONSTRAINT PK_db4ed19dd254e031e93d63351e4 PRIMARY KEY (id)
);

CREATE TABLE "public"."user_sessions" (
    id integer DEFAULT nextval('user_sessions_id_seq'::regclass) NOT NULL,
    userId uuid NOT NULL,
    sessionToken character varying NOT NULL,
    discordAccessToken character varying NOT NULL,
    discordRefreshToken character varying NOT NULL,
    discordTokenExpiry timestamp without time zone NOT NULL,
    isActive boolean DEFAULT true NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    lastActivity timestamp without time zone NOT NULL,
    expiresAt timestamp without time zone NOT NULL,
    ipAddress character varying,
    userAgent character varying,
    CONSTRAINT FK_user_sessions_userId FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_e93e031a5fed190d4789b6bfd83 PRIMARY KEY (id),
    CONSTRAINT UQ_cd183bcb9ffe40bd858ed6b6b87 UNIQUE ("sessionToken")
);

CREATE TABLE "public"."user_ships" (
    organizationId uuid,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    userId uuid NOT NULL,
    shipId uuid NOT NULL,
    shipName character varying NOT NULL,
    customName character varying,
    status user_ships_status_enum DEFAULT 'owned'::user_ships_status_enum NOT NULL,
    condition user_ships_condition_enum DEFAULT 'good'::user_ships_condition_enum NOT NULL,
    acquiredDate timestamp without time zone,
    acquiredPrice numeric(10,2),
    acquiredCurrency character varying,
    insuranceLevel character varying,
    insuranceExpires timestamp without time zone,
    location character varying,
    hangar character varying,
    loanedFrom character varying,
    loanedTo character varying,
    loanExpires timestamp without time zone,
    notes text,
    modifications jsonb,
    flightHours integer DEFAULT 0 NOT NULL,
    missionsCompleted integer DEFAULT 0 NOT NULL,
    totalEarnings numeric(15,2) DEFAULT '0'::numeric NOT NULL,
    tags text,
    sharingLevel user_ships_sharinglevel_enum DEFAULT 'organization'::user_ships_sharinglevel_enum NOT NULL,
    sharedWithUsers text,
    erkulLoadoutUrl character varying,
    isActive boolean DEFAULT true NOT NULL,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    visibleToOrganization boolean DEFAULT true,
    classificationChangedBy character varying(255) DEFAULT NULL::character varying,
    classificationChangedAt timestamp without time zone,
    classificationReason text,
    useCustomVisibility boolean DEFAULT false NOT NULL,
    CONSTRAINT FK_user_ships_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE SET NULL,
    CONSTRAINT PK_715956816823f385ae6fd210bee PRIMARY KEY (id)
);

CREATE TABLE "public"."users" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying NOT NULL,
    email text NOT NULL,
    discordId character varying NOT NULL,
    password text,
    role character varying DEFAULT 'user'::character varying NOT NULL,
    activeOrgId character varying,
    twoFactorSecret text,
    twoFactorEnabled boolean DEFAULT false NOT NULL,
    backupCodes text,
    recoveryCodes text,
    failedTwoFactorAttempts integer DEFAULT 0 NOT NULL,
    twoFactorLockedUntil timestamp without time zone,
    failedLoginAttempts integer DEFAULT 0 NOT NULL,
    lockedUntil timestamp without time zone,
    passwordChangedAt timestamp without time zone,
    lastLoginAt timestamp without time zone,
    lastLoginIp character varying,
    lastFailedLoginAt timestamp without time zone,
    lastActiveAt timestamp without time zone,
    displayName character varying,
    bio character varying,
    avatar character varying,
    preferences text,
    previousUsernames text,
    profileViews integer DEFAULT 0 NOT NULL,
    loginCount integer DEFAULT 0 NOT NULL,
    lastProfileViewAt timestamp without time zone,
    rsiHandle character varying,
    rsiVerified boolean DEFAULT false NOT NULL,
    rsiVerifiedAt timestamp without time zone,
    rsiVerificationCode character varying,
    rsiVerificationCodeExpiresAt timestamp without time zone,
    manualVerificationRequested boolean DEFAULT false NOT NULL,
    manualVerificationReason character varying,
    manualVerificationApprovedBy character varying,
    manualVerificationApprovedAt timestamp without time zone,
    manualVerificationRejectedBy character varying,
    manualVerificationRejectedAt timestamp without time zone,
    manualVerificationNotes character varying,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT PK_a3ffb1c0c8416b9fc6f907b7433 PRIMARY KEY (id),
    CONSTRAINT UQ_97672ac88f789774dd47f7c8be3 UNIQUE (email),
    CONSTRAINT UQ_ae4a93a6b25195ccc2a97e13f0d UNIQUE ("discordId"),
    CONSTRAINT UQ_fe0bb3f6520ee0469504521e710 UNIQUE (username)
);

CREATE TABLE "public"."webauthn_credentials" (
    id uuid NOT NULL,
    userId uuid NOT NULL,
    credentialId text NOT NULL,
    credentialPublicKey text NOT NULL,
    counter bigint DEFAULT '0'::bigint NOT NULL,
    aaguid character varying(36),
    credentialType character varying(20) DEFAULT 'public-key'::character varying NOT NULL,
    deviceName character varying(100),
    transports text,
    backedUp boolean DEFAULT false NOT NULL,
    backupEligible boolean DEFAULT false NOT NULL,
    attestationFormat character varying(50),
    isActive boolean DEFAULT true NOT NULL,
    lastUsedAt timestamp without time zone,
    useCount integer DEFAULT 0 NOT NULL,
    registrationIp character varying(45),
    registrationUserAgent text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_4e5d1a5131f49fdbc410b8ded04 FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT PK_f5a100358f652926a5abae5e431 PRIMARY KEY (id)
);

CREATE TABLE "public"."webhook_retry_queue" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    webhookId character varying NOT NULL,
    organizationId uuid NOT NULL,
    event character varying NOT NULL,
    payload text NOT NULL,
    retryCount integer NOT NULL,
    maxRetries integer NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    nextRetryAt timestamp without time zone,
    lastError text,
    lastStatusCode integer,
    lastResponseTime integer,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    processedAt timestamp without time zone,
    completedAt timestamp without time zone,
    CONSTRAINT PK_fec12a29de16de94eb6ae8ce5b7 PRIMARY KEY (id)
);

CREATE TABLE "public"."webhooks" (
    organizationId uuid NOT NULL,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp without time zone,
    deletedBy character varying,
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description text,
    type character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    events text NOT NULL,
    discordConfig text,
    customConfig text,
    secret character varying,
    maxRetries integer DEFAULT 3 NOT NULL,
    retryDelayMs integer DEFAULT 1000 NOT NULL,
    timeoutMs integer DEFAULT 30000 NOT NULL,
    totalDeliveries integer DEFAULT 0 NOT NULL,
    successfulDeliveries integer DEFAULT 0 NOT NULL,
    failedDeliveries integer DEFAULT 0 NOT NULL,
    lastDeliveryAt timestamp without time zone,
    lastSuccessAt timestamp without time zone,
    lastFailureAt timestamp without time zone,
    lastError text,
    deliveryHistory text DEFAULT '[]'::text NOT NULL,
    createdBy uuid NOT NULL,
    notes text,
    createdAt timestamp without time zone DEFAULT now() NOT NULL,
    updatedAt timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_webhooks_organizationId FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT PK_9e8795cfc899ab7bdaa831e8527 PRIMARY KEY (id)
);

CREATE TABLE "public"."wiki_page_revisions" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    pageId uuid NOT NULL,
    content text NOT NULL,
    editedBy uuid NOT NULL,
    changeDescription character varying(500),
    version integer NOT NULL,
    editedAt timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT FK_wiki_revision_page FOREIGN KEY ("pageId") REFERENCES wiki_pages(id) ON DELETE CASCADE,
    CONSTRAINT PK_3acec0bb1e14326f32046337c62 PRIMARY KEY (id)
);

CREATE TABLE "public"."wiki_pages" (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organizationId uuid NOT NULL,
    title character varying(200) NOT NULL,
    slug character varying(200) NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    parentPageId uuid,
    sortOrder integer DEFAULT 0 NOT NULL,
    tags text DEFAULT ''::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    isLocked boolean DEFAULT false NOT NULL,
    createdBy uuid NOT NULL,
    lastEditedBy uuid,
    sharedWithOrgs text DEFAULT ''::text,
    deletedAt timestamp with time zone,
    deletedBy character varying,
    createdAt timestamp with time zone DEFAULT now() NOT NULL,
    updatedAt timestamp with time zone DEFAULT now() NOT NULL,
    search_vector tsvector DEFAULT ''::tsvector,
    CONSTRAINT FK_wiki_page_org FOREIGN KEY ("organizationId") REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_wiki_page_parent FOREIGN KEY ("parentPageId") REFERENCES wiki_pages(id) ON DELETE SET NULL,
    CONSTRAINT PK_ff448f4c3a7b7a87331e2e8eddb PRIMARY KEY (id)
);


-- ============================================================================
-- Sequences
-- ============================================================================

CREATE SEQUENCE "public"."migrations_id_seq"
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 2147483647
    NO CYCLE;

CREATE SEQUENCE "public"."recovery_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 2147483647
    NO CYCLE;

CREATE SEQUENCE "public"."token_blacklist_id_seq"
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 2147483647
    NO CYCLE;

CREATE SEQUENCE "public"."user_sessions_id_seq"
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 2147483647
    NO CYCLE;


-- ============================================================================
-- Indexes (621)
-- ============================================================================

CREATE UNIQUE INDEX "PK_22ca6df6df049ca6af35441ffa6" ON public.account_access_logs USING btree (id);

CREATE INDEX "IDX_8e8046fd3cce48d1c4a006bb3e" ON public.account_access_logs USING btree ("createdAt");

CREATE INDEX "IDX_9bead3741bec5a263e50a10c58" ON public.account_access_logs USING btree ("organizationId");

CREATE INDEX "IDX_e3e5b0db1dd02ff694720df3c3" ON public.account_access_logs USING btree ("userId");

CREATE INDEX "IDX_fc10b7b875024387429ce33997" ON public.account_access_logs USING btree ("accountId");

CREATE UNIQUE INDEX "PK_148a3901b839a6ef45ba05de4ea" ON public.account_permissions USING btree (id);

CREATE INDEX "IDX_7c2536ffc1c490825268aec202" ON public.account_permissions USING btree ("userId");

CREATE INDEX "IDX_b2ad32854ce2177dfaa6c63e33" ON public.account_permissions USING btree ("organizationId");

CREATE INDEX "IDX_mae_org_id" ON public.member_audit_events USING btree ("organizationId");

CREATE INDEX "IDX_mae_org_user" ON public.member_audit_events USING btree ("organizationId", "userId");

CREATE INDEX "IDX_mae_org_status" ON public.member_audit_events USING btree ("organizationId", status);

CREATE INDEX "IDX_mae_org_flag_type" ON public.member_audit_events USING btree ("organizationId", "flagType");

CREATE INDEX "IDX_mae_org_severity" ON public.member_audit_events USING btree ("organizationId", severity);

CREATE INDEX "IDX_mae_org_created" ON public.member_audit_events USING btree ("organizationId", "createdAt");

CREATE INDEX "IDX_mae_user_id" ON public.member_audit_events USING btree ("userId");

CREATE INDEX "IDX_mae_user_flag_type" ON public.member_audit_events USING btree ("userId", "flagType");

CREATE UNIQUE INDEX member_audit_events_pkey ON public.member_audit_events USING btree (id);

CREATE INDEX "IDX_mae_status" ON public.member_audit_events USING btree (status);

CREATE UNIQUE INDEX "PK_388798f424958f8c105d3b3d4b6" ON public.briefings USING btree (id);

CREATE INDEX "IDX_briefings_creatorId" ON public.briefings USING btree ("creatorId");

CREATE INDEX "IDX_briefings_status" ON public.briefings USING btree (status);

CREATE UNIQUE INDEX "PK_8c82d7f526340ab734260ea46be" ON public.migrations USING btree (id);

CREATE INDEX "IDX_alliance_diplomacy_orgId1" ON public.alliance_diplomacy USING btree ("orgId1");

CREATE INDEX "IDX_alliance_diplomacy_orgId2" ON public.alliance_diplomacy USING btree ("orgId2");

CREATE INDEX "IDX_alliance_diplomacy_status" ON public.alliance_diplomacy USING btree (status);

CREATE UNIQUE INDEX "PK_c3306cb26f826f808f01722a47e" ON public.alliance_diplomacy USING btree (id);

CREATE UNIQUE INDEX "PK_52bc63640f4068b3f2b9fd55af9" ON public.activity_reminders USING btree (id);

CREATE INDEX "IDX_3f8b30ca82a1b7b186220cfc60" ON public.activity_reminders USING btree ("deliveryStatus", "scheduledTime");

CREATE INDEX "IDX_f69af662653e2675cdc0ed7e9c" ON public.activity_reminders USING btree ("scheduledTime");

CREATE INDEX "IDX_activity_reminders_activityId" ON public.activity_reminders USING btree ("activityId");

CREATE INDEX "IDX_activity_reminders_activityId_scheduledTime" ON public.activity_reminders USING btree ("activityId", "scheduledTime");

CREATE UNIQUE INDEX "PK_68ad7037ac4199207d06d8006f3" ON public.announcement_templates USING btree (id);

CREATE INDEX "IDX_34e885e61844520a846c59ec5f" ON public.announcement_templates USING btree ("organizationId");

CREATE INDEX "IDX_9d6678bf710bb0149ab36ed9c8" ON public.announcement_templates USING btree ("isGlobal");

CREATE INDEX "IDX_2c5913a4dbbd5742f21ee87ac7" ON public.announcement_templates USING btree ("createdBy");

CREATE INDEX "IDX_c93930b33876ae71d282ecae6c" ON public.announcement_templates USING btree (name);

CREATE UNIQUE INDEX "PK_d44e70fd44fa7bb863c8dcb6c41" ON public.hunter_profiles USING btree (id);

CREATE INDEX "IDX_0f2fcbb1db365641aad484e537" ON public.hunter_profiles USING btree ("organizationId", "totalBountiesCompleted");

CREATE UNIQUE INDEX "IDX_610462b6dc6bff427b9b268b46" ON public.hunter_profiles USING btree ("userId", "organizationId");

CREATE INDEX "IDX_703e8a0fcdd42ffa3b4a74b59d" ON public.hunter_profiles USING btree ("organizationId", "reputationScore");

CREATE INDEX "IDX_a9d04ea102cc016cea6bf945b1" ON public.hunter_profiles USING btree ("organizationId", "totalRewardsEarned");

CREATE INDEX "IDX_data_breach_notifications_severity" ON public.data_breach_notifications USING btree (severity);

CREATE INDEX "IDX_data_breach_notifications_status" ON public.data_breach_notifications USING btree (status);

CREATE UNIQUE INDEX "PK_01c8db57af3342f558ad4ca5488" ON public.data_breach_notifications USING btree (id);

CREATE INDEX "IDX_cargo_manifests_shipId" ON public.cargo_manifests USING btree ("shipId");

CREATE INDEX "IDX_cargo_manifests_ownerId" ON public.cargo_manifests USING btree ("ownerId");

CREATE INDEX "IDX_cargo_manifests_status" ON public.cargo_manifests USING btree (status);

CREATE UNIQUE INDEX "PK_43c9b6a4b52a0726e743560e8ab" ON public.cargo_manifests USING btree (id);

CREATE INDEX "IDX_owe_org_id" ON public.org_watchlist_entries USING btree ("organizationId");

CREATE UNIQUE INDEX "IDX_owe_org_sid" ON public.org_watchlist_entries USING btree ("organizationId", "rsiOrgSid");

CREATE INDEX "IDX_owe_org_reason" ON public.org_watchlist_entries USING btree ("organizationId", reason);

CREATE INDEX "IDX_owe_org_threat" ON public.org_watchlist_entries USING btree ("organizationId", "threatLevel");

CREATE UNIQUE INDEX org_watchlist_entries_pkey ON public.org_watchlist_entries USING btree (id);

CREATE INDEX "IDX_owe_rsi_sid" ON public.org_watchlist_entries USING btree ("rsiOrgSid");

CREATE UNIQUE INDEX "PK_6340d9c9b704610156ea5dd7c43" ON public.lfg_reputation_ratings USING btree (id);

CREATE INDEX "IDX_91e6d04bb0e5e617a47e84c7bf" ON public.lfg_reputation_ratings USING btree ("createdAt");

CREATE INDEX "IDX_acfac72549dec8579ba5dcbd10" ON public.lfg_reputation_ratings USING btree ("raterId");

CREATE INDEX "IDX_ded82136e04a6dc16f680cb8a3" ON public.lfg_reputation_ratings USING btree ("sessionId");

CREATE UNIQUE INDEX "IDX_04c28e56cf391ef271792cbb0d" ON public.lfg_reputation_ratings USING btree ("userId", "raterId");

CREATE INDEX "IDX_b5a85a2b723cc2fcee17d9c8fe" ON public.lfg_reputation_ratings USING btree ("userId");

CREATE UNIQUE INDEX "PK_596bc5120360a11d474b8d519e1" ON public.lfg_user_reputation USING btree (id);

CREATE INDEX "IDX_34105b9b0bc2814dd0903dedea" ON public.lfg_user_reputation USING btree ("totalSessions");

CREATE UNIQUE INDEX "UQ_9366adeac0c4b6a0b788827f4e1" ON public.lfg_user_reputation USING btree ("userId");

CREATE INDEX idx_lfg_reputation_user_score ON public.lfg_user_reputation USING btree ("userId", "overallScore" DESC);

CREATE INDEX idx_lfg_reputation_score ON public.lfg_user_reputation USING btree ("overallScore" DESC);

CREATE UNIQUE INDEX "PK_bbd6d34dfa1097241e38505da18" ON public.logistics_alerts USING btree (id);

CREATE INDEX "IDX_8283b06ef42b83e1186654d8be" ON public.logistics_alerts USING btree (type);

CREATE INDEX "IDX_b7e066e331881a1401375d0b2b" ON public.logistics_alerts USING btree (status);

CREATE INDEX "IDX_ef8322d2c71a6307dab9468d8e" ON public.logistics_alerts USING btree ("inventoryItemId");

CREATE INDEX "IDX_aba53e5d62aaa563fde12ce1ed" ON public.logistics_alerts USING btree ("fleetId");

CREATE INDEX idx_mirrored_org ON public.mirrored_activities USING btree ("organizationId");

CREATE UNIQUE INDEX mirrored_activities_pkey ON public.mirrored_activities USING btree (id);

CREATE INDEX idx_mirrored_source ON public.mirrored_activities USING btree ("sourceActivityId");

CREATE INDEX idx_mirrored_mirror ON public.mirrored_activities USING btree ("mirrorActivityId");

CREATE INDEX idx_mirrored_guild ON public.mirrored_activities USING btree ("mirrorGuildId");

CREATE INDEX idx_mirrored_status ON public.mirrored_activities USING btree (status);

CREATE INDEX "IDX_00262b4f3912899e1646233755" ON public.mining_operations USING btree ("scheduledDate");

CREATE INDEX "IDX_39b2b5597e5bf453100f2e163c" ON public.mining_operations USING btree ("coordinatorId");

CREATE INDEX "IDX_a1792176786a272d452dde8fc9" ON public.mining_operations USING btree (status);

CREATE UNIQUE INDEX "PK_49c17502b923a6b01e1ed398a77" ON public.mining_operations USING btree (id);

CREATE INDEX idx_fleet_leader ON public.fleets USING btree ("leaderId");

CREATE INDEX idx_fleet_status ON public.fleets USING btree (status);

CREATE INDEX idx_fleet_type ON public.fleets USING btree (type);

CREATE INDEX "IDX_fleet_hierarchy_path" ON public.fleets USING btree ("hierarchyPath");

CREATE INDEX "IDX_fleet_team_id" ON public.fleets USING btree ("teamId");

CREATE UNIQUE INDEX "PK_18a71e919faac62c1da6b5f8754" ON public.fleets USING btree (id);

CREATE INDEX idx_fleet_org_createdat ON public.fleets USING btree ("organizationId", "createdAt");

CREATE INDEX idx_fleet_org_id ON public.fleets USING btree ("organizationId");

CREATE INDEX idx_fleet_org_name ON public.fleets USING btree ("organizationId", name);

CREATE INDEX "IDX_fleet_org_parent_sort" ON public.fleets USING btree ("organizationId", "parentFleetId", "sortOrder");

CREATE INDEX "IDX_fleet_org_team" ON public.fleets USING btree ("organizationId", "teamId");

CREATE INDEX "IDX_fleet_parent_id" ON public.fleets USING btree ("parentFleetId");

CREATE INDEX "IDX_166e1d9c8485596cf2104f7177" ON public.recovery_tokens USING btree ("userId");

CREATE UNIQUE INDEX "PK_533de0ae206825b9ab04e79874e" ON public.recovery_tokens USING btree (id);

CREATE INDEX "IDX_4fe56152d08d0045601d826423" ON public.recovery_tokens USING btree ("tokenHash");

CREATE INDEX "IDX_b74a8fda6281b10dc1cefc0703" ON public.recovery_tokens USING btree ("expiresAt");

CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON public.refresh_tokens USING btree ("userId");

CREATE UNIQUE INDEX "PK_7d8bee0204106019488c4c50ffa" ON public.refresh_tokens USING btree (id);

CREATE INDEX "IDX_40e9a8b923a1b3fb4429a5c624" ON public.refresh_tokens USING btree ("familyId");

CREATE UNIQUE INDEX "PK_f9cc84f84e82a1f598d2fa08b0c" ON public.rsi_member_cache USING btree (id);

CREATE UNIQUE INDEX "UQ_rsi_member_cache_org_handle" ON public.rsi_member_cache USING btree ("organizationId", "rsiHandle");

CREATE INDEX "IDX_rsi_member_cache_cached_at" ON public.rsi_member_cache USING btree ("cachedAt");

CREATE INDEX "IDX_rsi_member_cache_org_id" ON public.rsi_member_cache USING btree ("organizationId");

CREATE INDEX "IDX_rsi_member_cache_org_sid" ON public.rsi_member_cache USING btree ("rsiOrgSid");

CREATE UNIQUE INDEX "PK_920331560282b8bd21bb02290df" ON public.permissions USING btree (id);

CREATE INDEX "IDX_993b02c38468ae34fbf896928c" ON public.permissions USING btree ("organizationId");

CREATE INDEX "IDX_eab26c6cc4b9cc604099bc32df" ON public.permissions USING btree ("userId");

CREATE INDEX "IDX_1fa8245dfac11a2d6056ed8886" ON public.relationship_history USING btree ("actorId");

CREATE INDEX "IDX_b31a0bddc5479a1929f678e548" ON public.relationship_history USING btree ("organizationId");

CREATE INDEX "IDX_dc7bd7a9f661295cdb422c5d3c" ON public.relationship_history USING btree ("organizationId", "targetOrganizationId");

CREATE INDEX "IDX_1ceb94add056519d5cbc092ac8" ON public.relationship_history USING btree ("targetOrganizationId");

CREATE UNIQUE INDEX "PK_a734b2c6f910c17a5aa6902580e" ON public.relationship_history USING btree (id);

CREATE INDEX "IDX_96dba22a1e19471bd21ddbddd4" ON public.relationship_history USING btree ("changeType");

CREATE INDEX "IDX_994812fbae7df2e91b53ace652" ON public.relationship_history USING btree ("relationshipId", "createdAt");

CREATE INDEX "IDX_be6b28b6f116f58b84563fa68d" ON public.relationship_history USING btree ("relationshipId");

CREATE INDEX "IDX_6ba2647dffbd7e346995877a7b" ON public.reputation USING btree ("userId");

CREATE INDEX "IDX_79178c0324de43f075b8b80ad8" ON public.reputation USING btree ("overallScore");

CREATE UNIQUE INDEX "PK_640807583e8622e1d9bbe6f1b7b" ON public.reputation USING btree (id);

CREATE UNIQUE INDEX "PK_13836720b8a28794f5f5e0a3f95" ON public.shared_accounts USING btree (id);

CREATE INDEX "IDX_01f6015cb1759df827971adb9d" ON public.shared_accounts USING btree ("organizationId");

CREATE INDEX "IDX_shared_accounts_createdBy" ON public.shared_accounts USING btree ("createdBy");

CREATE INDEX "IDX_56d61850223447c3b8900979de" ON public.tournaments USING btree ("organizerId");

CREATE INDEX "IDX_5bdbbbf95bc2bcb5caada90f0c" ON public.tournaments USING btree (status);

CREATE INDEX "IDX_86eb37df073cbf54a27a0739a2" ON public.tournaments USING btree ("startDate");

CREATE UNIQUE INDEX "PK_6d5d129da7a80cf99e8ad4833a9" ON public.tournaments USING btree (id);

CREATE UNIQUE INDEX "PK_66facb1a93a1c6dba9c1e006fba" ON public.external_integrations USING btree (id);

CREATE INDEX "IDX_external_integrations_type" ON public.external_integrations USING btree (type);

CREATE INDEX "IDX_external_integrations_status" ON public.external_integrations USING btree (status);

CREATE INDEX "IDX_455aa37f0f255718b2baf37a0c" ON public.external_integrations USING btree ("fleetId");

CREATE UNIQUE INDEX "PK_1cd7cd817ce344fc44d09c5be3c" ON public.organization_inventory USING btree (id);

CREATE INDEX "IDX_36c98acd3ddbf75eb4b97a5c82" ON public.organization_inventory USING btree ("itemName");

CREATE INDEX "IDX_3a558600ed81e974b373b20670" ON public.organization_inventory USING btree (category);

CREATE INDEX "IDX_d6e7445eb3b2e34f4fca1b3005" ON public.organization_inventory USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_1a7895844e30127a607ec6957eb" ON public.fleet_inventory USING btree (id);

CREATE INDEX "IDX_2eed6679a036bcb0c1c0f22b49" ON public.fleet_inventory USING btree ("managerId");

CREATE INDEX "IDX_bcadf87ed8a4a60688747590b6" ON public.fleet_inventory USING btree ("itemName");

CREATE INDEX "IDX_9477347490d8f1987b09502605" ON public.fleet_inventory USING btree ("fleetId");

CREATE INDEX "IDX_4f17a806040f6a180b0ef505d6" ON public.fleet_inventory USING btree ("organizationId");

CREATE INDEX "IDX_e65e846ef190e20a69d2d207d1" ON public.fleet_inventory USING btree (category);

CREATE INDEX "IDX_fleet_logistics_fleetId" ON public.fleet_logistics USING btree ("fleetId");

CREATE INDEX "IDX_fleet_logistics_status" ON public.fleet_logistics USING btree (status);

CREATE UNIQUE INDEX "PK_e7e20a5bac870034462bdddc5ab" ON public.fleet_logistics USING btree (id);

CREATE INDEX idx_fleet_ships_organization ON public.fleet_ships USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_9bd40062fc578d15eb4fbb254f9" ON public.fleet_ships USING btree (id);

CREATE UNIQUE INDEX idx_fleet_ships_fleet_ship ON public.fleet_ships USING btree ("fleetId", "shipId");

CREATE INDEX idx_fleet_ships_fleet ON public.fleet_ships USING btree ("fleetId");

CREATE INDEX idx_fleet_ships_ship ON public.fleet_ships USING btree ("shipId");

CREATE UNIQUE INDEX "PK_80b75aa8bd93334760f5159d745" ON public.lfg_group_history USING btree (id);

CREATE INDEX "IDX_0321fce6a6a5a011230bdb5ff5" ON public.lfg_group_history USING btree ("completedAt");

CREATE INDEX "IDX_1956137bd8d85abd02af8f49b0" ON public.lfg_group_history USING btree ("creatorId");

CREATE INDEX "IDX_1e416d05d88184d43509d15a86" ON public.lfg_group_history USING btree (activity);

CREATE INDEX "IDX_883792a072c562842301797597" ON public.lfg_group_history USING btree ("lfgPostId");

CREATE INDEX "IDX_e3ee9fc6192346767dba0d6732" ON public.lfg_group_history USING btree ("guildId");

CREATE INDEX "IDX_63024c6a78a0f5efbe08dd8078" ON public.lfg_group_history USING btree ("userId");

CREATE UNIQUE INDEX "PK_0cafd563e0d8b2b484713b58e8f" ON public.organization_relationships USING btree (id);

CREATE INDEX "IDX_b50f75bb263eae8a796fab73d9" ON public.organization_relationships USING btree ("trustScore");

CREATE INDEX "IDX_d229064c8a07545aebf98b3546" ON public.organization_relationships USING btree (status);

CREATE INDEX "IDX_df34f5401b10318d928290db32" ON public.organization_relationships USING btree (type);

CREATE INDEX "IDX_6d97569a5d5a96a8dda833871a" ON public.organization_relationships USING btree ("organizationId");

CREATE UNIQUE INDEX "IDX_fbd6e6e6972f9e54c181a726ad" ON public.organization_relationships USING btree ("organizationId", "targetOrganizationId");

CREATE INDEX "IDX_b5911f731f95838a34d5393c9f" ON public.organization_relationships USING btree ("targetOrganizationId");

CREATE UNIQUE INDEX idx_security_levels_unique ON public.security_levels USING btree ("sourceOrgId", "targetOrgId", "resourceType");

CREATE INDEX idx_security_levels_source ON public.security_levels USING btree ("sourceOrgId");

CREATE INDEX idx_security_levels_target ON public.security_levels USING btree ("targetOrgId");

CREATE UNIQUE INDEX "PK_2f2be9afaa3eaca9e93811054e3" ON public.security_levels USING btree (id);

CREATE INDEX idx_security_levels_active ON public.security_levels USING btree ("isActive");

CREATE UNIQUE INDEX "PK_6b3061d44b08ebcd3c89136a5e2" ON public.ship_loadouts USING btree (id);

CREATE INDEX "IDX_701e1b65f14a8862d7561f83d4" ON public.ship_loadouts USING btree ("ownerId");

CREATE INDEX "IDX_ship_loadouts_shipId" ON public.ship_loadouts USING btree ("shipId");

CREATE INDEX "IDX_2649aace0b486f94b2c5c8288d" ON public.ship_loans USING btree ("borrowerId");

CREATE INDEX "IDX_5aca4996783d68c94c64ce7e6c" ON public.ship_loans USING btree ("lenderId");

CREATE INDEX "IDX_a4fcc9bd8e41f96ea0efa20fd8" ON public.ship_loans USING btree ("expectedReturnDate");

CREATE INDEX "IDX_bda88427bc0b9e09445054d42a" ON public.ship_loans USING btree ("startDate");

CREATE INDEX "IDX_f30a35472f4041164624ed8835" ON public.ship_loans USING btree (status);

CREATE UNIQUE INDEX "PK_7e554b08f99d85ff4f3b32c94cc" ON public.ship_loans USING btree (id);

CREATE INDEX "IDX_ship_maintenance_shipId" ON public.ship_maintenance USING btree ("shipId");

CREATE INDEX "IDX_ship_maintenance_ownerId" ON public.ship_maintenance USING btree ("ownerId");

CREATE INDEX "IDX_ship_maintenance_status" ON public.ship_maintenance USING btree (status);

CREATE UNIQUE INDEX "PK_94e2fc9c8c93ddaf0376a9a9290" ON public.ship_maintenance USING btree (id);

CREATE INDEX idx_team_org_parent ON public.teams USING btree ("organizationId", "parentTeamId");

CREATE UNIQUE INDEX idx_team_org_name ON public.teams USING btree ("organizationId", name);

CREATE INDEX idx_team_org_id ON public.teams USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_7e5523774a38b08a6236d322403" ON public.teams USING btree (id);

CREATE INDEX idx_teams_parentteamid ON public.teams USING btree ("parentTeamId");

CREATE UNIQUE INDEX "PK_e13b7949ae7df5ca4100063fec0" ON public.organization_activities USING btree (id);

CREATE INDEX "IDX_19fd8cfe07b4d566c37ef5acd1" ON public.organization_activities USING btree (action);

CREATE INDEX "IDX_b0e084ba642956d4e4fa89bd68" ON public.organization_activities USING btree (severity);

CREATE INDEX "IDX_529b6dbb2fb009fa25ca86b52c" ON public.organization_activities USING btree ("actorId");

CREATE INDEX "IDX_bf1c97ccc2a4e6802b397e2f19" ON public.organization_activities USING btree ("organizationId", "timestamp");

CREATE INDEX "IDX_e6453f509741ab5f60dd2ea335" ON public.organization_activities USING btree ("targetOrgId");

CREATE UNIQUE INDEX "PK_cd7be805730a4c778a5f45364af" ON public.organization_memberships USING btree (id);

CREATE INDEX idx_memberships_role ON public.organization_memberships USING btree ("roleId");

CREATE INDEX "IDX_1813e7f46b5a18529482f51964" ON public.organization_memberships USING btree ("organizationId");

CREATE UNIQUE INDEX "IDX_2dfb6f4b36cdc195e118502ecd" ON public.organization_memberships USING btree ("userId", "organizationId");

CREATE INDEX idx_org_membership_org_role_active ON public.organization_memberships USING btree ("organizationId", "roleBackup", "isActive");

CREATE INDEX "IDX_03b536604ff6c6676b51b74b1c" ON public.organization_memberships USING btree ("userId");

CREATE UNIQUE INDEX "PK_eb7f1ad251d2a9a17d84fe95bfc" ON public.organization_ships USING btree (id);

CREATE INDEX "IDX_3d32c3fa79379e069dfe38abfd" ON public.organization_ships USING btree ("organizationId");

CREATE INDEX "IDX_47ac4fb608b7aacd57235c0c85" ON public.organization_ships USING btree ("organizationId", "shipId");

CREATE INDEX "IDX_bd7a61c5a2f26e058c5907cb25" ON public.organization_ships USING btree ("organizationId", status);

CREATE INDEX "IDX_d734dda305486a0c551a98ea6e" ON public.organization_ships USING btree ("organizationId", role);

CREATE INDEX "IDX_7632e9d1d09afa5b4b43f12198" ON public.organization_ships USING btree ("shipId");

CREATE INDEX "IDX_organization_ships_sharingLevel" ON public.organization_ships USING btree ("sharingLevel");

CREATE UNIQUE INDEX "UQ_rsi_role_mappings_org_rank" ON public.rsi_role_mappings USING btree ("organizationId", "rsiRank");

CREATE INDEX "IDX_rsi_role_mappings_org_id" ON public.rsi_role_mappings USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_e77d56a8ae1d8975ab493fe1230" ON public.rsi_role_mappings USING btree (id);

CREATE INDEX "IDX_rsi_role_mappings_active" ON public.rsi_role_mappings USING btree ("isActive");

CREATE INDEX "IDX_rsi_role_mappings_discord_role" ON public.rsi_role_mappings USING btree ("discordRoleId");

CREATE INDEX "IDX_rsi_role_mappings_rsi_rank" ON public.rsi_role_mappings USING btree ("rsiRank");

CREATE UNIQUE INDEX "PK_da65ed4600e5e6bc9315754a8b2" ON public.password_history USING btree (id);

CREATE INDEX "IDX_20c510e5ca12f63b0c915c3e2d" ON public.password_history USING btree ("userId");

CREATE INDEX "IDX_ddea018826c35b58c992688c1f" ON public.password_history USING btree ("userId", "createdAt");

CREATE UNIQUE INDEX "UQ_rsi_user_links_user_org" ON public.rsi_user_links USING btree ("userId", "organizationId");

CREATE INDEX "IDX_rsi_user_links_org_id" ON public.rsi_user_links USING btree ("organizationId");

CREATE INDEX "IDX_rsi_user_links_user_id" ON public.rsi_user_links USING btree ("userId");

CREATE UNIQUE INDEX "PK_64749fa095b2f9c18b307dd8725" ON public.rsi_user_links USING btree (id);

CREATE INDEX "IDX_rsi_user_links_discord_user_id" ON public.rsi_user_links USING btree ("discordUserId");

CREATE INDEX "IDX_rsi_user_links_rsi_handle" ON public.rsi_user_links USING btree ("rsiHandle");

CREATE INDEX "IDX_rsi_user_links_sync_status" ON public.rsi_user_links USING btree ("syncStatus");

CREATE UNIQUE INDEX "UQ_97672ac88f789774dd47f7c8be3" ON public.users USING btree (email);

CREATE UNIQUE INDEX "UQ_ae4a93a6b25195ccc2a97e13f0d" ON public.users USING btree ("discordId");

CREATE UNIQUE INDEX "UQ_fe0bb3f6520ee0469504521e710" ON public.users USING btree (username);

CREATE INDEX "IDX_0adde088082e5d66bb3b3a3086" ON public.users USING btree ("rsiHandle");

CREATE INDEX "IDX_ace513fa30d485cfd25c11a9e4" ON public.users USING btree (role);

CREATE UNIQUE INDEX "PK_a3ffb1c0c8416b9fc6f907b7433" ON public.users USING btree (id);

CREATE UNIQUE INDEX "PK_7b62d84d6f9912b975987165856" ON public.operations USING btree (id);

CREATE INDEX "IDX_5621e444d1862844a8d57efdb8" ON public.operations USING btree ("organizationId", status);

CREATE INDEX "IDX_81fca3dc1382d9f50ebe2cf706" ON public.operations USING btree ("organizationId");

CREATE INDEX "IDX_9e6536d379a4ce39c3159f4bbd" ON public.operations USING btree ("organizationId", type);

CREATE UNIQUE INDEX "PK_31600a2fa9dafc883312ea30ed2" ON public.organization_analytics USING btree (id);

CREATE INDEX "IDX_organization_analytics_org_period" ON public.organization_analytics USING btree ("organizationId", "periodStart");

CREATE INDEX idx_org_analytics_orgid ON public.organization_analytics USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_bbe3e0c98678909493a90442dfb" ON public.legal_holds USING btree (id);

CREATE INDEX "IDX_legal_holds_isActive" ON public.legal_holds USING btree ("isActive");

CREATE INDEX "IDX_fc7c735f09da430b3538069597" ON public.legal_holds USING btree ("userId");

CREATE INDEX "IDX_rsi_sync_audit_log_org_id" ON public.rsi_sync_audit_log USING btree ("organizationId");

CREATE INDEX "IDX_rsi_sync_audit_log_org_synced_at" ON public.rsi_sync_audit_log USING btree ("organizationId", "syncedAt");

CREATE UNIQUE INDEX "PK_09819a44de2ab9951d437b1fdf6" ON public.rsi_sync_audit_log USING btree (id);

CREATE INDEX "IDX_rsi_sync_audit_log_sync_type" ON public.rsi_sync_audit_log USING btree ("syncType");

CREATE INDEX "IDX_rsi_sync_audit_log_synced_at" ON public.rsi_sync_audit_log USING btree ("syncedAt");

CREATE UNIQUE INDEX "PK_3227e44fb747d3a1db19091b68e" ON public.mirror_actions USING btree (id);

CREATE INDEX "IDX_0a060dcc97086fcea41b05a251" ON public.mirror_actions USING btree ("moderatorId");

CREATE INDEX "IDX_53166fffb3ed4f97718927155d" ON public.mirror_actions USING btree ("createdAt");

CREATE INDEX "IDX_bf68c1eca240633d0bb2f92463" ON public.mirror_actions USING btree ("targetDiscordId");

CREATE INDEX "IDX_ce095d15abfdfac4032e4b0127" ON public.mirror_actions USING btree (status);

CREATE INDEX "IDX_e9367e50e8ab88575171acce6f" ON public.mirror_actions USING btree ("sourceIncidentId");

CREATE INDEX "IDX_5b705ac104d30eacf99b65c092" ON public.mirror_actions USING btree ("organizationId");

CREATE UNIQUE INDEX "UQ_da7e5aa35ad6fab8d85c70d995b" ON public.public_org_profiles USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_d5a1cbe6b962269820be5021551" ON public.public_org_profiles USING btree (id);

CREATE INDEX "IDX_public_org_profiles_isPublic" ON public.public_org_profiles USING btree ("isPublic");

CREATE INDEX "IDX_public_org_profiles_primaryFocus" ON public.public_org_profiles USING btree ("primaryFocus");

CREATE INDEX "IDX_public_org_profiles_activityLevel" ON public.public_org_profiles USING btree ("activityLevel");

CREATE INDEX "IDX_public_org_profiles_isRecruiting" ON public.public_org_profiles USING btree ("isRecruiting");

CREATE INDEX "IDX_public_org_profiles_isVerified" ON public.public_org_profiles USING btree ("isVerified");

CREATE INDEX "IDX_public_org_profiles_memberCount" ON public.public_org_profiles USING btree ("memberCount");

CREATE UNIQUE INDEX "PK_04821cf14f17052feac3bd1cdac" ON public.organization_templates USING btree (id);

CREATE INDEX "IDX_organization_templates_category" ON public.organization_templates USING btree (category);

CREATE INDEX "IDX_organization_templates_isPublic" ON public.organization_templates USING btree ("isPublic");

CREATE INDEX idx_org_templates_forkedfrom ON public.organization_templates USING btree ("forkedFrom");

CREATE UNIQUE INDEX "IDX_rsi_sync_schedules_org_id" ON public.rsi_sync_schedules USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_636721c9fab918a805b2afc6f28" ON public.rsi_sync_schedules USING btree (id);

CREATE INDEX "IDX_rsi_sync_schedules_enabled" ON public.rsi_sync_schedules USING btree ("isEnabled");

CREATE INDEX "IDX_rsi_sync_schedules_next_sync" ON public.rsi_sync_schedules USING btree ("nextSyncAt");

CREATE INDEX idx_tm_org_team ON public.team_members USING btree ("organizationId", "teamId");

CREATE INDEX idx_tm_org_user ON public.team_members USING btree ("organizationId", "userId");

CREATE UNIQUE INDEX idx_tm_user_team ON public.team_members USING btree ("userId", "teamId");

CREATE UNIQUE INDEX "PK_ca3eae89dcf20c9fd95bf7460aa" ON public.team_members USING btree (id);

CREATE INDEX idx_team_members_teamid ON public.team_members USING btree ("teamId");

CREATE UNIQUE INDEX "PK_0b3674af6e27e4e3a04721e8655" ON public.organization_permissions USING btree (id);

CREATE INDEX "IDX_3e6aac5fa7414e30c5cf9dd6fb" ON public.organization_permissions USING btree (scope);

CREATE INDEX "IDX_7b6150a34faf67fac82192fe34" ON public.organization_permissions USING btree ("isActive");

CREATE INDEX "IDX_26fcddb33ea30bbb52a98097e1" ON public.organization_permissions USING btree ("organizationId", "userId");

CREATE INDEX "IDX_a8b3e2fb407e1708a3d5fd3a73" ON public.organization_permissions USING btree ("organizationId", resource);

CREATE INDEX idx_org_permission_org_user_resource ON public.organization_permissions USING btree ("organizationId", "userId", resource);

CREATE INDEX idx_org_permissions_user_org ON public.organization_permissions USING btree ("userId", "organizationId");

CREATE INDEX idx_org_permissions_active ON public.organization_permissions USING btree ("userId", "isActive", "expiresAt") WHERE ("isActive" = true);

CREATE UNIQUE INDEX "PK_72f648c6d4c72a7688d2352f681" ON public.bounty_claims USING btree (id);

CREATE INDEX "IDX_55bac4378c934e4c0fc7c0bf53" ON public.bounty_claims USING btree ("hunterId", status);

CREATE INDEX "IDX_c92c51b956fbdf4789f97a0262" ON public.bounty_claims USING btree ("bountyId", status);

CREATE INDEX "IDX_f401aed46456577e1b1a781e1d" ON public.bounty_claims USING btree ("organizationId", status);

CREATE UNIQUE INDEX "PK_801da15da2497aec83181ed1aef" ON public.bounty_evidence USING btree (id);

CREATE INDEX "IDX_bounty_evidence_submittedBy" ON public.bounty_evidence USING btree ("submittedBy");

CREATE INDEX "IDX_c01c84e0fec439a9a9df4f7894" ON public.bounty_evidence USING btree ("claimId");

CREATE UNIQUE INDEX "PK_78fa24cdd67e5e793aee26299c5" ON public.announcement_deliveries USING btree (id);

CREATE INDEX "IDX_d120b47df7e06027215ae16867" ON public.announcement_deliveries USING btree ("announcementId", "guildId");

CREATE INDEX "IDX_f2ad664afeeb5a1e90d0cea548" ON public.announcement_deliveries USING btree (status, "scheduledAt");

-- security_events indexes removed (table dropped — see migration 1863600000000).

CREATE UNIQUE INDEX "PK_db657d344e9caacfc9d5cf8bbac" ON public.feature_flags USING btree (id);

CREATE INDEX idx_feature_flags_status ON public.feature_flags USING btree (status);

CREATE INDEX idx_feature_flags_scope ON public.feature_flags USING btree (scope);

CREATE INDEX "IDX_0e35d4666bc28c5958d69806cf" ON public.ships USING btree (manufacturer);

CREATE INDEX "IDX_8dffe1cb56023da1c74270e39e" ON public.ships USING btree (name);

CREATE UNIQUE INDEX "PK_fba257c7e5f4ff0c26afa06e9ee" ON public.ships USING btree (id);

CREATE INDEX "IDX_1ac7010a2dad92c8121e931c4c" ON public.ships USING btree ("organizationId", manufacturer);

CREATE INDEX "IDX_3c60b14f7ee8f216be0e6bb7aa" ON public.ships USING btree ("organizationId", "isActive");

CREATE INDEX "IDX_7af8add8b07b52d436834de24d" ON public.ships USING btree ("organizationId");

CREATE INDEX "IDX_a354d8b8757503afb0df5426a0" ON public.ships USING btree ("organizationId", name);

CREATE INDEX idx_ship_org_manufacturer_active ON public.ships USING btree ("organizationId", manufacturer, "isActive");

CREATE INDEX idx_ship_org_size_role ON public.ships USING btree ("organizationId", size, role);

CREATE UNIQUE INDEX "PK_d16bebd73e844c48bca50ff8d3d" ON public.password_reset_tokens USING btree (id);

CREATE UNIQUE INDEX "UQ_ab673f0e63eac966762155508ee" ON public.password_reset_tokens USING btree (token);

CREATE INDEX "IDX_f75f11ca4ed69b941336c5d0e3" ON public.password_reset_tokens USING btree ("expiresAt");

CREATE INDEX "IDX_d6a19d4b4f6c62dcd29daa497e" ON public.password_reset_tokens USING btree ("userId");

CREATE UNIQUE INDEX "PK_c463ea87bf42c6e89e93f82b100" ON public.passwordless_tokens USING btree (id);

CREATE INDEX "IDX_06538a50e3603e89b1ae02d5ad" ON public.passwordless_tokens USING btree ("expiresAt");

CREATE INDEX "IDX_0914d661917b9ed576a094b690" ON public.passwordless_tokens USING btree (email);

CREATE INDEX "IDX_a861005ea2320b64a48c106ea3" ON public.passwordless_tokens USING btree ("tokenHash");

CREATE INDEX "IDX_5ca1df0650d11157a2a397730b" ON public.passwordless_tokens USING btree ("userId");

CREATE UNIQUE INDEX "PK_16b55e56b8c68d6dc41db73aca0" ON public.organization_deletion_requests USING btree (id);

CREATE INDEX "IDX_f54197d186a47f9ee8d8285491" ON public.organization_deletion_requests USING btree (status, "scheduledFor");

CREATE INDEX idx_org_deletion_approvedby ON public.organization_deletion_requests USING btree ("approvedBy");

CREATE INDEX idx_org_deletion_cancelledby ON public.organization_deletion_requests USING btree ("cancelledBy");

CREATE INDEX "IDX_7701d7f3a6e20c14f04bcaf69c" ON public.organization_deletion_requests USING btree ("organizationId", status);

CREATE INDEX "IDX_fe315a04d228e831b5d820bdff" ON public.organization_deletion_requests USING btree ("organizationId");

CREATE INDEX idx_org_deletion_rejectedby ON public.organization_deletion_requests USING btree ("rejectedBy");

CREATE INDEX idx_org_deletion_requestedby ON public.organization_deletion_requests USING btree ("requestedBy");

CREATE INDEX "IDX_2da2b98fea18b842831a7e8fcd" ON public.organizations USING btree (path);

CREATE INDEX "IDX_51a0d77657b9149118d74f2505" ON public.organizations USING btree (level);

CREATE INDEX "IDX_5a8e0c18328a68facab7f01132" ON public.organizations USING btree (type);

CREATE INDEX "IDX_f3770f157bd77d83ab022e92fc" ON public.organizations USING btree (status);

CREATE INDEX "IDX_organizations_rsiSid" ON public.organizations USING btree ("rsiSid");

CREATE UNIQUE INDEX "PK_6b031fcd0863e3f6b44230163f9" ON public.organizations USING btree (id);

CREATE INDEX "IDX_26cf7afbdebb645d1b5c9ad5b6" ON public.organizations USING btree ("parentOrgId");

CREATE INDEX "IDX_945c94aa7a221161a060f28441" ON public.tickets USING btree ("organizationId", status);

CREATE UNIQUE INDEX "PK_343bc942ae261cf7a1377f48fd0" ON public.tickets USING btree (id);

CREATE INDEX "IDX_98f00985a13412ab11f4d1c100" ON public.tickets USING btree ("organizationId");

CREATE INDEX "IDX_b43668a1ce622f8e4f0e40c765" ON public.tickets USING btree ("organizationId", category);

CREATE INDEX "IDX_dbde8805e774a4bd56e7d9d237" ON public.tickets USING btree ("organizationId", "createdAt");

CREATE UNIQUE INDEX "UQ_e99bd0f51b92896fdaf99ebb715" ON public.tickets USING btree ("ticketNumber");

CREATE INDEX "IDX_34a00da6659fae3d5b5a98ce7c" ON public.tickets USING btree (category, status);

CREATE INDEX "IDX_4f127f7c92139971ec4cbbe0bd" ON public.tickets USING btree ("assigneeId");

CREATE INDEX "IDX_63feb59883a12a746bcb870b76" ON public.tickets USING btree ("creatorId");

CREATE INDEX "IDX_tickets_recipientId" ON public.tickets USING btree ("recipientId");

CREATE UNIQUE INDEX "PK_3acec0bb1e14326f32046337c62" ON public.wiki_page_revisions USING btree (id);

CREATE INDEX idx_revision_page ON public.wiki_page_revisions USING btree ("pageId");

CREATE INDEX idx_revision_page_version ON public.wiki_page_revisions USING btree ("pageId", version);

CREATE UNIQUE INDEX "PK_64a45c85ec750d46917cafaeac7" ON public.moderation_incidents USING btree (id);

CREATE INDEX "IDX_07d935487788e3141251065c56" ON public.moderation_incidents USING btree ("targetDiscordId");

CREATE INDEX "IDX_0c1b4762d7f72fbb91d9500622" ON public.moderation_incidents USING btree (status);

CREATE INDEX "IDX_2fa9e5348c52420055e71bad31" ON public.moderation_incidents USING btree ("isShared");

CREATE INDEX "IDX_57e865b654aee2ee7b7e8e754a" ON public.moderation_incidents USING btree ("guildId");

CREATE INDEX "IDX_689c767f4f74c3a8188ccd7cf1" ON public.moderation_incidents USING btree (severity);

CREATE INDEX "IDX_8696e91489c3065aa57100e8f8" ON public.moderation_incidents USING btree ("createdAt");

CREATE INDEX "IDX_ebfb60277a329b1935b080de6c" ON public.moderation_incidents USING btree ("incidentType");

CREATE INDEX "IDX_5bd6df80755a7e7256bc713871" ON public.moderation_incidents USING btree ("organizationId");

CREATE INDEX "IDX_6fb89194d5523e4330a09e3e52" ON public.moderation_incidents USING btree ("organizationId", "targetDiscordId");

CREATE UNIQUE INDEX "PK_1194941540acb3e297dd468b2bd" ON public.federations USING btree (id);

CREATE INDEX idx_federation_founder_org ON public.federations USING btree ("founderOrgId");

CREATE INDEX idx_federation_status ON public.federations USING btree (status);

CREATE INDEX idx_federation_public_active ON public.federations USING btree ("isPublic", status);

CREATE UNIQUE INDEX "IDX_scstats_csv_imports_userId" ON public.scstats_csv_imports USING btree ("userId");

CREATE UNIQUE INDEX "PK_e7700ab01613b562fb82e397368" ON public.scstats_csv_imports USING btree (id);

CREATE UNIQUE INDEX "PK_fabfb4a24c1c5c5506f318f8187" ON public.federation_proposals USING btree (id);

CREATE INDEX idx_fed_proposal_federation ON public.federation_proposals USING btree ("federationId");

CREATE INDEX idx_fed_proposal_status ON public.federation_proposals USING btree (status);

CREATE INDEX idx_fed_proposal_federation_status ON public.federation_proposals USING btree ("federationId", status);

CREATE INDEX idx_fed_member_org ON public.federation_members USING btree ("organizationId");

CREATE UNIQUE INDEX idx_fed_member_unique ON public.federation_members USING btree ("federationId", "organizationId");

CREATE UNIQUE INDEX "PK_c39c4445081d554daadda5e8982" ON public.federation_members USING btree (id);

CREATE INDEX idx_fed_member_federation ON public.federation_members USING btree ("federationId");

CREATE UNIQUE INDEX "PK_3e37528d03f0bd5335874afa48d" ON public.token_blacklist USING btree (id);

CREATE INDEX "IDX_cde27adb955c236798ccf3b9d5" ON public.token_blacklist USING btree ("userId");

CREATE UNIQUE INDEX "UQ_cdae079f3ade88775b9abbce907" ON public.token_blacklist USING btree ("tokenJti");

CREATE INDEX "IDX_1cebed586d3a7c46f3f9b76cf1" ON public.token_blacklist USING btree ("expiresAt");

CREATE INDEX idx_roles_organization ON public.roles USING btree ("organizationId");

CREATE UNIQUE INDEX idx_roles_name_org ON public.roles USING btree (name, COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'::uuid));

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);

CREATE INDEX idx_roles_system ON public.roles USING btree ("isSystemRole");

CREATE UNIQUE INDEX "IDX_ai_usage_org_feature_date" ON public.ai_usage_tracking USING btree ("organizationId", "featureType", "usageDate");

CREATE INDEX "IDX_ai_usage_org_date" ON public.ai_usage_tracking USING btree ("organizationId", "usageDate");

CREATE UNIQUE INDEX "PK_ai_usage_tracking" ON public.ai_usage_tracking USING btree (id);

CREATE UNIQUE INDEX "PK_missions" ON public.missions USING btree (id);

CREATE INDEX "IDX_missions_org_createdBy" ON public.missions USING btree ("organizationId", "createdBy");

CREATE INDEX idx_missions_fleetid ON public.missions USING btree ("fleetId");

CREATE INDEX "IDX_missions_org_status" ON public.missions USING btree ("organizationId", status);

CREATE INDEX "IDX_missions_org_type" ON public.missions USING btree ("organizationId", "missionType");

CREATE INDEX "IDX_missions_org_createdAt" ON public.missions USING btree ("organizationId", "createdAt");

CREATE INDEX "IDX_missions_organizationId" ON public.missions USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_notification_preferences" ON public.notification_preferences USING btree (id);

CREATE UNIQUE INDEX "notification_preferences_userId_key" ON public.notification_preferences USING btree ("userId");

CREATE UNIQUE INDEX "PK_notifications" ON public.notifications USING btree (id);

CREATE INDEX "IDX_notifications_type" ON public.notifications USING btree (type);

CREATE INDEX idx_notifications_senderid ON public.notifications USING btree ("senderId");

CREATE INDEX "IDX_notifications_userId" ON public.notifications USING btree ("userId");

CREATE INDEX "IDX_notifications_userId_read" ON public.notifications USING btree ("userId", read);

CREATE INDEX "IDX_notifications_userId_createdAt" ON public.notifications USING btree ("userId", "createdAt");

CREATE INDEX "IDX_4f899eb581225d47e3ed5b801a" ON public.public_job_listings USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_d25470ca0f3a94adc67182a6871" ON public.public_job_listings USING btree (id);

CREATE INDEX "IDX_79ab63bd35b43ed041ef00a8e8" ON public.public_job_listings USING btree ("jobType");

CREATE INDEX "IDX_8926c3aac7683366da783328c3" ON public.public_job_listings USING btree ("isActive");

CREATE INDEX "IDX_a02d35deec54c33b4af607265b" ON public.public_job_listings USING btree ("allianceId");

CREATE INDEX "IDX_a4807d604e4a609adbe3d31f0b" ON public.public_job_listings USING btree (focus);

CREATE INDEX "IDX_a8172409924bea902c8f2636ef" ON public.public_job_listings USING btree ("postedAt");

CREATE INDEX "IDX_c5e7aa9eb486a6432a8f8c3619" ON public.public_job_listings USING btree ("expiresAt");

CREATE INDEX "IDX_e06c0eb566ad9b9e3a387f39fb" ON public.public_job_listings USING btree ("ownerType");

CREATE INDEX "IDX_public_job_listings_listingCategory" ON public.public_job_listings USING btree ("listingCategory");

CREATE INDEX "IDX_d1623ce96eb58dbfc177e00e41" ON public.trusted_devices USING btree ("userId");

CREATE UNIQUE INDEX "PK_bc545fd72c357ff2edc8bbc7deb" ON public.trusted_devices USING btree (id);

CREATE INDEX "IDX_35bf5370fd816553f24aee32a9" ON public.trusted_devices USING btree ("deviceFingerprint");

CREATE UNIQUE INDEX "PK_1245d4d2cf04ba7743f2924d951" ON public.user_activities USING btree (id);

CREATE INDEX "IDX_38f47397f1794059eb2f84508f" ON public.user_activities USING btree ("userId", "timestamp");

CREATE INDEX "IDX_5618ade060df353e3965b75999" ON public.user_activities USING btree ("userId");

CREATE INDEX "IDX_3385731ac0e74b04dd9c09ef01" ON public.user_activities USING btree ("timestamp");

CREATE INDEX "IDX_9ea72d7b7c7c3f0535f57a4f2a" ON public.user_activities USING btree (action);

CREATE UNIQUE INDEX organization_encryption_keys_pkey ON public.organization_encryption_keys USING btree (id);

CREATE UNIQUE INDEX "organization_encryption_keys_keyId_key" ON public.organization_encryption_keys USING btree ("keyId");

CREATE INDEX idx_org_encryption_keys_org ON public.organization_encryption_keys USING btree ("organizationId");

CREATE INDEX "IDX_org_applications_applicantUserId" ON public.org_applications USING btree ("applicantUserId");

CREATE INDEX "IDX_org_applications_organizationId" ON public.org_applications USING btree ("organizationId");

CREATE INDEX "IDX_org_applications_org_status" ON public.org_applications USING btree ("organizationId", status);

CREATE INDEX "IDX_org_applications_targetType_org_status" ON public.org_applications USING btree ("targetType", "organizationId", status);

CREATE UNIQUE INDEX org_applications_pkey ON public.org_applications USING btree (id);

CREATE INDEX "IDX_org_applications_status" ON public.org_applications USING btree (status);

CREATE INDEX "IDX_org_applications_targetType" ON public.org_applications USING btree ("targetType");

CREATE INDEX "IDX_job_applications_applicantUserId" ON public.job_applications USING btree ("applicantUserId");

CREATE UNIQUE INDEX job_applications_pkey ON public.job_applications USING btree (id);

CREATE INDEX "IDX_job_applications_jobListingId" ON public.job_applications USING btree ("jobListingId");

CREATE INDEX "IDX_job_applications_status" ON public.job_applications USING btree (status);

CREATE INDEX "IDX_job_applications_applicationType" ON public.job_applications USING btree ("applicationType");

CREATE INDEX idx_crew_assignment_org ON public.crew_assignments USING btree ("organizationId");

CREATE INDEX idx_crew_assignment_ship ON public.crew_assignments USING btree ("shipId");

CREATE UNIQUE INDEX "PK_8a8c48b395cb80b00283f1e8479" ON public.crew_assignments USING btree (id);

CREATE INDEX idx_avail_user_org ON public.user_availability USING btree ("userId", "organizationId");

CREATE INDEX idx_avail_org_day ON public.user_availability USING btree ("organizationId", "dayOfWeek");

CREATE UNIQUE INDEX user_availability_pkey ON public.user_availability USING btree (id);

CREATE UNIQUE INDEX "PK_65e4c6d6204ad8719abf4b30326" ON public.user_consents USING btree (id);

CREATE UNIQUE INDEX "IDX_3c31a97366cc959b570ac74e1d" ON public.user_consents USING btree ("userId", "consentType");

CREATE INDEX "IDX_7a8097efad75fcbc548d467d64" ON public.user_consents USING btree ("userId");

CREATE UNIQUE INDEX "PK_db4ed19dd254e031e93d63351e4" ON public.user_gameplay_preferences USING btree (id);

CREATE UNIQUE INDEX "IDX_78417b82615ef520a036550d64" ON public.user_gameplay_preferences USING btree ("userId");

CREATE INDEX idx_ugp_scstats_kd ON public.user_gameplay_preferences USING btree (scstats_kd_ratio) WHERE (scstats_kd_ratio IS NOT NULL);

CREATE INDEX idx_ugp_scstats_hours ON public.user_gameplay_preferences USING btree (scstats_total_hours) WHERE (scstats_total_hours IS NOT NULL);

CREATE UNIQUE INDEX "PK_e93e031a5fed190d4789b6bfd83" ON public.user_sessions USING btree (id);

CREATE INDEX "IDX_36cbbaa23a16cc814fc39f1a7e" ON public.user_sessions USING btree ("userId", "isActive");

CREATE INDEX "IDX_55fa4db8406ed66bc704432842" ON public.user_sessions USING btree ("userId");

CREATE UNIQUE INDEX "UQ_cd183bcb9ffe40bd858ed6b6b87" ON public.user_sessions USING btree ("sessionToken");

CREATE INDEX "IDX_a5f2c875043dcf84df7b73ed73" ON public.user_sessions USING btree ("expiresAt");

CREATE UNIQUE INDEX "PK_715956816823f385ae6fd210bee" ON public.user_ships USING btree (id);

CREATE INDEX "IDX_14bb77319c99fce307c26b63a9" ON public.user_ships USING btree ("organizationId", "shipId");

CREATE INDEX "IDX_283e469484293d1a34034b6980" ON public.user_ships USING btree ("organizationId", "userId");

CREATE INDEX "IDX_2a98b8b3f713f033f26b9fbe8d" ON public.user_ships USING btree ("organizationId", status);

CREATE INDEX "IDX_a9d055678779c3f4fe2c5b678e" ON public.user_ships USING btree ("organizationId");

CREATE INDEX "IDX_375cc17ce557f122d4c9f11b2c" ON public.user_ships USING btree ("shipId");

CREATE INDEX "IDX_user_ships_userId_shipId" ON public.user_ships USING btree ("userId", "shipId") WHERE ("deletedAt" IS NULL);

CREATE INDEX "IDX_fec89481700b378ca9570222ae" ON public.user_ships USING btree ("userId");

CREATE INDEX "IDX_user_ships_userId_status" ON public.user_ships USING btree ("userId", status) WHERE ("deletedAt" IS NULL);

CREATE INDEX "IDX_user_ships_userId_sharingLevel" ON public.user_ships USING btree ("userId", "sharingLevel") WHERE ("deletedAt" IS NULL);

CREATE INDEX "IDX_user_ships_userId_insuranceExpires" ON public.user_ships USING btree ("userId", "insuranceExpires") WHERE (("deletedAt" IS NULL) AND ("insuranceExpires" IS NOT NULL));

CREATE INDEX "IDX_57d70bd726558fd54505b167f0" ON public.user_ships USING btree ("sharingLevel");

CREATE INDEX "IDX_user_ships_insuranceExpires" ON public.user_ships USING btree ("insuranceExpires") WHERE (("deletedAt" IS NULL) AND ("insuranceExpires" IS NOT NULL));

CREATE INDEX "IDX_9f4c5a88fe1c2aa898be3f59b8" ON public.intel_approvals USING btree ("createdAt");

CREATE INDEX "IDX_af07d24ee507a1519f17a479cb" ON public.intel_approvals USING btree (status);

CREATE UNIQUE INDEX "PK_f7e5857845171ba301cc4465b29" ON public.intel_approvals USING btree (id);

CREATE INDEX "IDX_3ab83c66acd9c1816e1a2967f6" ON public.intel_approvals USING btree ("organizationId");

CREATE INDEX idx_intel_approvals_completedby ON public.intel_approvals USING btree ("completedBy");

CREATE INDEX idx_intel_approvals_requestedby ON public.intel_approvals USING btree ("requestedBy");

CREATE INDEX "IDX_28c189ec44db164f57e6a5b112" ON public.intel_approvals USING btree ("intelEntryId");

CREATE INDEX "IDX_418e069254fdc191389c855c8f" ON public.intel_audit_logs USING btree ("createdAt");

CREATE INDEX "IDX_be06513205455aab99ebae374a" ON public.intel_audit_logs USING btree (action);

CREATE INDEX "IDX_c5aa240abc272acb3211b9e5fa" ON public.intel_audit_logs USING btree (severity);

CREATE UNIQUE INDEX "PK_f9bc498bbf14ef7eb7cfcfaac09" ON public.intel_audit_logs USING btree (id);

CREATE INDEX "IDX_6a7bdc0f231ab3c02996f0b4c5" ON public.intel_audit_logs USING btree ("organizationId");

CREATE INDEX "IDX_22cd7c839f8d879e12f58cef1a" ON public.intel_audit_logs USING btree ("userId");

CREATE INDEX "IDX_8ac4738a1e415797b925f2580f" ON public.intel_audit_logs USING btree ("intelEntryId");

CREATE INDEX "IDX_0bde04dd0dc046607fe45eab9e" ON public.intel_entries USING btree ("createdAt");

CREATE INDEX "IDX_62bca0b0df54007e04b7cdab46" ON public.intel_entries USING btree (classification);

CREATE INDEX "IDX_67d0cdc84dee8e2207e8e5df2f" ON public.intel_entries USING btree (category);

CREATE INDEX "IDX_c20a50c8309201fa6a2b0e0931" ON public.intel_entries USING btree ("isArchived");

CREATE INDEX "IDX_c9618a2fc84a7b9670a5625f9d" ON public.intel_entries USING btree ("reviewDate");

CREATE INDEX "IDX_eab3cd3a8e0be634a086b13058" ON public.intel_entries USING btree ("declassificationDate");

CREATE UNIQUE INDEX "PK_c080fddb6573048217e04407f65" ON public.intel_entries USING btree (id);

CREATE INDEX "IDX_e388c6a53a19b648645a24c2f0" ON public.intel_entries USING btree ("organizationId");

CREATE INDEX "IDX_41ae4a605d1c80afc0a7498f28" ON public.intel_entries USING btree ("createdBy");

CREATE INDEX idx_intel_entries_updatedby ON public.intel_entries USING btree ("updatedBy");

CREATE UNIQUE INDEX "PK_f5a100358f652926a5abae5e431" ON public.webauthn_credentials USING btree (id);

CREATE INDEX "IDX_4e5d1a5131f49fdbc410b8ded0" ON public.webauthn_credentials USING btree ("userId");

CREATE INDEX "IDX_be2025ac9c82bdadcf340b3dfc" ON public.webauthn_credentials USING btree ("credentialId");

CREATE UNIQUE INDEX "PK_fec12a29de16de94eb6ae8ce5b7" ON public.webhook_retry_queue USING btree (id);

CREATE INDEX "IDX_1589e15ca3645ba5f49d1343a6" ON public.webhook_retry_queue USING btree ("webhookId", status);

CREATE INDEX "IDX_161dc1fee9d869f9463ad80325" ON public.webhook_retry_queue USING btree ("webhookId");

CREATE INDEX "IDX_1a6bd7016a02eb1e41da1560ec" ON public.webhook_retry_queue USING btree ("nextRetryAt");

CREATE INDEX "IDX_8a6c466c7e6084ab0bc0195e96" ON public.webhook_retry_queue USING btree (status, "nextRetryAt");

CREATE INDEX "IDX_32ed69df6b7272ee00f58262f8" ON public.intel_officers USING btree ("isActive");

CREATE UNIQUE INDEX "PK_a12c53f473051421f800f1fc9e5" ON public.intel_officers USING btree (id);

CREATE INDEX "IDX_1c61bfb6e081f22c1c3d8ac47f" ON public.intel_officers USING btree ("organizationId");

CREATE INDEX "IDX_940e215a0181b80122fb22e62f" ON public.intel_officers USING btree ("organizationId", rank);

CREATE UNIQUE INDEX "IDX_cd45224c6132d1a74a3ea8dd3f" ON public.intel_officers USING btree ("organizationId", "userId");

CREATE INDEX idx_intel_officers_appointedby ON public.intel_officers USING btree ("appointedBy");

CREATE INDEX idx_intel_officers_revokedby ON public.intel_officers USING btree ("revokedBy");

CREATE INDEX "IDX_8633cca695eddc21df7e36d20b" ON public.intel_officers USING btree ("userId");

CREATE INDEX "IDX_8a5ff913279749778c5ea4a010" ON public.intel_shares USING btree ("expiresAt");

CREATE INDEX "IDX_a24a468390dd5a2940dff6339e" ON public.intel_shares USING btree (status);

CREATE INDEX "IDX_f8949a12d8b6dd64abc45f179f" ON public.intel_shares USING btree ("createdAt");

CREATE UNIQUE INDEX "PK_a6977679bac5dfdbdc2a7657c59" ON public.intel_shares USING btree (id);

CREATE INDEX "IDX_05f86e63fb0a2ff40091dddd98" ON public.intel_shares USING btree ("sourceOrganizationId");

CREATE INDEX "IDX_e2526c9e2e367cb9f13641cccd" ON public.intel_shares USING btree ("targetOrganizationId");

CREATE INDEX idx_intel_shares_acceptedby ON public.intel_shares USING btree ("acceptedBy");

CREATE INDEX idx_intel_shares_revokedby ON public.intel_shares USING btree ("revokedBy");

CREATE INDEX idx_intel_shares_sharedby ON public.intel_shares USING btree ("sharedBy");

CREATE INDEX "IDX_12708b41a21b41e0a2725a59cd" ON public.intel_shares USING btree ("intelEntryId");

CREATE UNIQUE INDEX "PK_9e8795cfc899ab7bdaa831e8527" ON public.webhooks USING btree (id);

CREATE INDEX "IDX_4365d6d8132402e77fda204eec" ON public.webhooks USING btree ("organizationId", status);

CREATE INDEX "IDX_7d1a0f8cca8281a48ace5e20e1" ON public.webhooks USING btree ("organizationId", type);

CREATE INDEX "IDX_dbecd97048eef1ff16f24a0131" ON public.webhooks USING btree ("organizationId");

CREATE UNIQUE INDEX idx_wiki_org_slug ON public.wiki_pages USING btree ("organizationId", slug);

CREATE INDEX idx_wiki_org_created ON public.wiki_pages USING btree ("organizationId", "createdAt");

CREATE UNIQUE INDEX "PK_ff448f4c3a7b7a87331e2e8eddb" ON public.wiki_pages USING btree (id);

CREATE INDEX idx_wiki_parent ON public.wiki_pages USING btree ("parentPageId");

CREATE INDEX idx_wiki_search ON public.wiki_pages USING gin (search_vector);

CREATE INDEX "IDX_53e27c8ad5aac896b898baa827" ON public.trading_routes USING btree ("creatorId", status);

CREATE UNIQUE INDEX "PK_4452a00d6ed579add9c9b06854e" ON public.trading_routes USING btree (id);

CREATE INDEX "IDX_1953c95dfeac3784af0a133f05" ON public.trading_routes USING btree ("organizationId");

CREATE INDEX "IDX_5dbc6f2bfdc6c0ede9697f8e2e" ON public.trading_routes USING btree ("organizationId", status);

CREATE UNIQUE INDEX "PK_3fbdf81d4f41de370e8e0ad9135" ON public.tunnels USING btree (id);

CREATE INDEX idx_tunnels_orgid ON public.tunnels USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_b3ad760876ff2e19d58e05dc8b0" ON public.announcements USING btree (id);

CREATE INDEX "IDX_73611c6e4b340c85e69f605ff4" ON public.announcements USING btree (status, "scheduledAt");

CREATE INDEX "IDX_8e7ed0f476c3e846b2c9aedb37" ON public.announcements USING btree ("createdBy");

CREATE INDEX "IDX_975f378b3b51598f987640b9cd" ON public.announcements USING btree ("organizationId", "createdAt");

CREATE INDEX "IDX_9f7aad9ecbc4e6f88f1a092c6b" ON public.announcements USING btree ("organizationId");

CREATE INDEX "IDX_edd343f523c4e3cd3abffdc40a" ON public.announcements USING btree ("organizationId", status);

CREATE UNIQUE INDEX "PK_7f4004429f731ffb9c88eb486a8" ON public.activities USING btree (id);

CREATE INDEX "IDX_ad36aa725c81817cef2ea263ff" ON public.activities USING btree ("scheduledStartDate");

CREATE INDEX "IDX_c4f65b254c9e315c16566bd710" ON public.activities USING btree ("creatorId");

CREATE INDEX idx_activity_creator_status_date ON public.activities USING btree ("creatorId", status, "scheduledStartDate");

CREATE INDEX idx_activity_participating_orgs ON public.activities USING gin ("participatingOrgs");

CREATE INDEX "IDX_activity_team_id" ON public.activities USING btree ("teamId");

CREATE INDEX "IDX_activities_org_created" ON public.activities USING btree ("organizationId", "createdAt");

CREATE INDEX "IDX_activities_org_type" ON public.activities USING btree ("organizationId", "activityType");

CREATE INDEX "IDX_activities_org_status" ON public.activities USING btree ("organizationId", status);

CREATE INDEX idx_activity_org_status_date ON public.activities USING btree ("organizationId", status, "scheduledStartDate");

CREATE INDEX idx_activity_org_type_status ON public.activities USING btree ("organizationId", "activityType", status);

CREATE INDEX idx_activity_org_visibility_date ON public.activities USING btree ("organizationId", visibility, "scheduledStartDate");

CREATE INDEX idx_activities_org_date ON public.activities USING btree ("organizationId", "scheduledStartDate");

CREATE INDEX "IDX_activity_org_team" ON public.activities USING btree ("organizationId", "teamId");

CREATE UNIQUE INDEX "PK_fb646e18c393738dce7bc99fdb4" ON public.blacklist_sharing_config USING btree (id);

CREATE INDEX "IDX_47e7f43a0f30af2bb0f57f2743" ON public.blacklist_sharing_config USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_335c87017bcb2fa9bc15678f385" ON public.bounties USING btree (id);

CREATE INDEX "IDX_586891210375d357098e68f73f" ON public.bounties USING btree ("expiresAt");

CREATE INDEX "IDX_6d71056897ccb08ca85637c3fb" ON public.bounties USING btree ("bountyType", status);

CREATE INDEX "IDX_b9f9994ee08841b0db45f74a79" ON public.bounties USING btree ("claimedBy");

CREATE INDEX "IDX_84ee4d598b499b3f37e837506d" ON public.bounties USING btree ("organizationId", "createdAt");

CREATE INDEX "IDX_89cd0b397dfff8bff4910edd32" ON public.bounties USING btree ("organizationId", status);

CREATE INDEX "IDX_fc2ce2a4b57fa19e3c59a918d9" ON public.bounties USING btree ("organizationId");

CREATE UNIQUE INDEX contact_request_replies_pkey ON public.contact_request_replies USING btree (id);

CREATE INDEX "IDX_contact_request_replies_contactRequestId" ON public.contact_request_replies USING btree ("contactRequestId");

CREATE INDEX "IDX_contact_request_replies_contactRequestId_createdAt" ON public.contact_request_replies USING btree ("contactRequestId", "createdAt");

CREATE INDEX "IDX_contact_request_replies_senderUserId" ON public.contact_request_replies USING btree ("senderUserId");

CREATE UNIQUE INDEX "PK_f8ee986c713abeb93129e4bab0b" ON public.deletion_requests USING btree (id);

CREATE INDEX "IDX_6e91e6a8c528ecf906c92a20b2" ON public.deletion_requests USING btree ("userId");

CREATE INDEX "IDX_c171a6b589c45c32b7df18bd45" ON public.deletion_requests USING btree ("userId", status);

CREATE UNIQUE INDEX encrypted_data_pkey ON public.encrypted_data USING btree (id);

CREATE INDEX idx_encrypted_data_resource ON public.encrypted_data USING btree ("resourceId") WHERE ("resourceId" IS NOT NULL);

CREATE INDEX idx_encrypted_data_key ON public.encrypted_data USING btree ("keyId");

CREATE INDEX idx_encrypted_data_org ON public.encrypted_data USING btree ("organizationId");

CREATE INDEX idx_encrypted_data_type ON public.encrypted_data USING btree ("organizationId", "dataType");

CREATE INDEX idx_encrypted_data_not_deleted ON public.encrypted_data USING btree ("organizationId", "isDeleted") WHERE ("isDeleted" = false);

CREATE UNIQUE INDEX "PK_5fc5cfa569e4e66051c6acde3b9" ON public.contact_requests USING btree (id);

CREATE INDEX "IDX_2ddc128fb97027f5432a2d78d1" ON public.contact_requests USING btree ("senderEmail");

CREATE INDEX "IDX_64b51be5dafdfc20ddcca28a71" ON public.contact_requests USING btree ("targetType");

CREATE INDEX "IDX_d1285e1251870f8412f2df1832" ON public.contact_requests USING btree ("allianceId", "createdAt");

CREATE INDEX "IDX_e7a216b9fbcafa08b71d1eef61" ON public.contact_requests USING btree (status);

CREATE INDEX "IDX_f336574fc9bc62d53c18c32e50" ON public.contact_requests USING btree ("allianceId", status);

CREATE INDEX "IDX_f8868598f4e183d5a22ecb6196" ON public.contact_requests USING btree ("allianceId");

CREATE INDEX "IDX_contact_requests_visibility" ON public.contact_requests USING btree (visibility);

CREATE INDEX "IDX_7a6dab221f470c75ee3cfe1557" ON public.contact_requests USING btree ("organizationId", status);

CREATE INDEX "IDX_a461b86c2672dae9a19e9f4afc" ON public.contact_requests USING btree ("organizationId", "createdAt");

CREATE INDEX "IDX_cf6a23aa7baad6f29d8d0e7008" ON public.contact_requests USING btree ("organizationId");

CREATE INDEX "IDX_contact_requests_senderUserId" ON public.contact_requests USING btree ("senderUserId");

CREATE INDEX idx_encryption_audit_user ON public.encryption_audit_log USING btree ("userId");

CREATE UNIQUE INDEX encryption_audit_log_pkey ON public.encryption_audit_log USING btree (id);

CREATE INDEX idx_encryption_audit_type ON public.encryption_audit_log USING btree ("eventType");

CREATE INDEX idx_encryption_audit_created ON public.encryption_audit_log USING btree ("createdAt" DESC);

CREATE INDEX idx_encryption_audit_org ON public.encryption_audit_log USING btree ("organizationId");

CREATE UNIQUE INDEX "PK_a40b708f0558a4f1dc012360ad9" ON public.event_attendance_confirmations USING btree (id);

CREATE INDEX "IDX_a23ac8336221bb8411823893d1" ON public.event_attendance_confirmations USING btree ("eventId", status);

CREATE INDEX "IDX_301f5ecae1aad6beebead44bfd" ON public.event_attendance_confirmations USING btree ("eventId", "userId");

CREATE INDEX "IDX_6688a43c6e3912e238b16b2756" ON public.event_attendance_confirmations USING btree ("userId");

CREATE INDEX "IDX_58c800cdd9a7679b90dd6fe662" ON public.event_attendance_confirmations USING btree ("organizationId", "userId");

CREATE INDEX idx_event_attendance_user_status ON public.event_attendance_confirmations USING btree ("userId", status);

CREATE INDEX "IDX_fc126ae68572fb40ef28b8e250" ON public.event_attendance_confirmations USING btree ("confirmedAt");

CREATE INDEX "IDX_fed85bab615e8d96adb02dafc2" ON public.event_attendance_confirmations USING btree ("eventId");

CREATE INDEX "IDX_32254e21beb0d0725b338ef5fd" ON public.event_attendance_confirmations USING btree ("organizationId", "eventId");

CREATE INDEX "IDX_6546e15586c8516e5d0b2dfe1c" ON public.event_attendance_confirmations USING btree ("organizationId", status);

CREATE INDEX "IDX_ff407a1b0695f94f9fa291e99d" ON public.event_attendance_confirmations USING btree ("organizationId");

CREATE INDEX idx_event_attendance_org_event_status ON public.event_attendance_confirmations USING btree ("organizationId", "eventId", status);

CREATE INDEX idx_key_claims_status ON public.encryption_key_claims USING btree (status, "expiresAt");

CREATE UNIQUE INDEX encryption_key_claims_pkey ON public.encryption_key_claims USING btree (id);

CREATE INDEX idx_key_claims_org ON public.encryption_key_claims USING btree ("organizationId");

CREATE INDEX idx_encryption_key_claims_claimedby ON public.encryption_key_claims USING btree ("claimedBy");

CREATE INDEX idx_key_claims_creator ON public.encryption_key_claims USING btree ("createdBy");

CREATE UNIQUE INDEX "PK_c1447734294baee42649c066afe" ON public.export_requests USING btree (id);

CREATE INDEX "IDX_243c6a9d4f0b77bc3007d47be1" ON public.export_requests USING btree ("expiresAt");

CREATE INDEX "IDX_213b9c8a94581a8b567fa29f40" ON public.export_requests USING btree ("userId");

CREATE INDEX "IDX_c227bf75fee66a215b06109489" ON public.export_requests USING btree ("userId", status);

CREATE UNIQUE INDEX "PK_997d7181651683618dfc4dffd51" ON public.fleet_members USING btree (id);

CREATE INDEX "IDX_d8a342b66a2763363bdb8c868c" ON public.fleet_members USING btree (status);

CREATE INDEX "IDX_02bb6dd6e3398aa70f38116bb4" ON public.fleet_members USING btree ("organizationId", "fleetId");

CREATE INDEX "IDX_a8e245df88e3212e4a6ce716e8" ON public.fleet_members USING btree ("organizationId", status);

CREATE INDEX "IDX_b7780cac595879616919f9a554" ON public.fleet_members USING btree ("organizationId", "userId");

CREATE INDEX "IDX_cf1212e908b0a1040c668d8abc" ON public.fleet_members USING btree ("organizationId");

CREATE INDEX idx_fleet_member_org_fleet_status ON public.fleet_members USING btree ("organizationId", "fleetId", status);

CREATE INDEX idx_fleet_member_user_org_status ON public.fleet_members USING btree ("userId", "organizationId", status);

CREATE INDEX "IDX_0bc753edc19aab517a88c79644" ON public.fleet_members USING btree ("userId");

CREATE UNIQUE INDEX "IDX_dad19b00f0ab935030f1a6fcd3" ON public.fleet_members USING btree ("userId", "fleetId");

CREATE INDEX "IDX_78077b4056498fe2b126d76586" ON public.fleet_members USING btree ("fleetId");

CREATE UNIQUE INDEX "PK_f1f7f553e4a84585a44a435df66" ON public.guild_organizations USING btree ("guildId");

CREATE INDEX "IDX_3137b93ce0a56d95b72e840ab8" ON public.guild_organizations USING btree ("isPrimary");

CREATE INDEX "IDX_c87fcd3f2294aebedead74d46d" ON public.guild_organizations USING btree ("organizationId");

CREATE UNIQUE INDEX invitations_pkey ON public.invitations USING btree (id);

CREATE INDEX "IDX_invitations_status" ON public.invitations USING btree (status);

CREATE UNIQUE INDEX "IDX_invitations_token" ON public.invitations USING btree (token);

CREATE INDEX "IDX_invitations_organizationId" ON public.invitations USING btree ("organizationId");

CREATE INDEX "IDX_invitations_org_status" ON public.invitations USING btree ("organizationId", status);

CREATE INDEX "IDX_invitations_inviteeUserId" ON public.invitations USING btree ("inviteeUserId");

CREATE INDEX idx_invitations_inviterid ON public.invitations USING btree ("inviterId");

-- Extension: uuid-ossp

CREATE OR REPLACE FUNCTION public.uuid_nil()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_nil$function$;


CREATE OR REPLACE FUNCTION public.uuid_ns_dns()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_dns$function$;


CREATE OR REPLACE FUNCTION public.uuid_ns_url()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_url$function$;


CREATE OR REPLACE FUNCTION public.uuid_ns_oid()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_oid$function$;


CREATE OR REPLACE FUNCTION public.uuid_ns_x500()
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_ns_x500$function$;


CREATE OR REPLACE FUNCTION public.uuid_generate_v1()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1$function$;


CREATE OR REPLACE FUNCTION public.uuid_generate_v1mc()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1mc$function$;


CREATE OR REPLACE FUNCTION public.uuid_generate_v3(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v3$function$;


CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v4$function$;


CREATE OR REPLACE FUNCTION public.uuid_generate_v5(namespace uuid, name text)
 RETURNS uuid
 LANGUAGE c
 IMMUTABLE PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v5$function$;


GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "public"."migrations" TO 25197;

GRANT INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "public"."migrations" TO 24811;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."migrations_id_seq" TO 24811;

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."migrations_id_seq" TO 25197;

GRANT USAGE, CREATE ON SCHEMA "public" TO azure_pg_admin;

GRANT USAGE ON SCHEMA "public" TO PUBLIC;

GRANT CREATE ON SCHEMA "public" TO aad_postgresql_6ff78;



































































































































