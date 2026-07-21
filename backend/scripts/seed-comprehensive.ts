#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
/**
 * Comprehensive Data Seeding Script
 *
 * Seeds ALL remaining database entities not covered by seed-demo-data.ts.
 *
 * This script extends the demo data with 98 sections covering:
 *   - Roles & Permissions (system + org-specific)
 *   - Feature Flags
 *   - Teams & Team Members
 *   - Notification Preferences & Notifications
 *   - User Consent (GDPR)
 *   - User Gameplay Preferences
 *   - Reputation
 *   - Organization Ships
 *   - Organization Permissions
 *   - Bounties, Bounty Claims & Hunter Profiles
 *   - Intel Entries
 *   - Wiki Pages & Revisions
 *   - Missions & Operations
 *   - Mining Operations & Trading Routes
 *   - Tickets
 *   - Crew Assignments & Ship Loadouts
 *   - Fleet & Organization Inventory
 *   - Federations & Federation Members
 *   - Security Levels
 *   - Discord Guild Settings & Guild Organizations
 *   - Blacklist Sharing Config
 *
 * Usage:
 *   npm run seed:comprehensive
 *
 * Prerequisites:
 *   - Database must be initialized (migrations run)
 *   - Run seed:ships first, then seed:demo, then this script
 *   - Alternatively: npm run seed:full
 */

import dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from '../src/config/database';
import { ConsentType, UserConsent } from '../src/models/UserConsent';
import { UserGameplayPreferences } from '../src/models/UserGameplayPreferences';
import { ShipCondition, ShipOwnershipStatus, ShipSharingLevel } from '../src/models/UserShip';
import { WikiPage } from '../src/models/WikiPage';
import { WikiPageRevision } from '../src/models/WikiPageRevision';

// ─── New Entity Imports (Sections 34–76) ──────────────────────────────────────
import { ActivityReminder } from '../src/models/ActivityReminder';
import { AIUsageTracking } from '../src/models/AIUsageTracking';
import { Announcement } from '../src/models/Announcement';
import { AnnouncementDelivery } from '../src/models/AnnouncementDelivery';
import { AnnouncementTemplate } from '../src/models/AnnouncementTemplate';
import { BlacklistSharingConfig } from '../src/models/BlacklistSharingConfig';
import { Bounty } from '../src/models/Bounty';
import { BountyClaim } from '../src/models/BountyClaim';
import { BountyEvidence } from '../src/models/BountyEvidence';
import { Briefing } from '../src/models/Briefing';
import { CargoManifest } from '../src/models/CargoManifest';
import { ContactRequest } from '../src/models/ContactRequest';
import { ContactRequestReply } from '../src/models/ContactRequestReply';
import { CrewAssignment } from '../src/models/CrewAssignment';
import { DataBreachNotification } from '../src/models/DataBreachNotification';
import { DiscordGuildSettings } from '../src/models/DiscordGuildSettings';
import { EventAttendanceConfirmation } from '../src/models/EventAttendanceConfirmation';
import { ExternalIntegration } from '../src/models/ExternalIntegration';
import { FeatureFlag, FeatureFlagScope, FeatureFlagStatus } from '../src/models/FeatureFlag';
import { Federation } from '../src/models/Federation';
import { FederationMember } from '../src/models/FederationMember';
import { FederationProposal } from '../src/models/FederationProposal';
import { FleetInventory } from '../src/models/FleetInventory';
import { FleetLogistics } from '../src/models/FleetLogistics';
import { GuildOrganization } from '../src/models/GuildOrganization';
import { HunterProfile } from '../src/models/HunterProfile';
import { IntelApproval } from '../src/models/IntelApproval';
import { IntelEntry } from '../src/models/IntelEntry';
import { IntelOfficer } from '../src/models/IntelOfficer';
import { IntelShare } from '../src/models/IntelShare';
import { Invitation } from '../src/models/Invitation';
import { JobApplication } from '../src/models/JobApplication';
import { LFGGroupHistory } from '../src/models/LFGGroupHistory';
import { LFGReputationRating } from '../src/models/LFGReputationRating';
import { LFGUserReputation } from '../src/models/LFGUserReputation';
import { LogisticsAlert } from '../src/models/LogisticsAlert';
import { MemberAuditEvent } from '../src/models/MemberAuditEvent';
import { MiningOperation } from '../src/models/MiningOperation';
import { MirrorAction } from '../src/models/MirrorAction';
import { MirroredActivity } from '../src/models/MirroredActivity';
import { Mission } from '../src/models/Mission';
import { ModerationIncident } from '../src/models/ModerationIncident';
import { Notification, NotificationPriority, NotificationType } from '../src/models/Notification';
import { NotificationPreferences } from '../src/models/NotificationPreferences';
import { Operation } from '../src/models/Operation';
import { OrganizationActivity } from '../src/models/OrganizationActivity';
import { OrganizationAnalytics } from '../src/models/OrganizationAnalytics';
import { OrganizationInventory } from '../src/models/OrganizationInventory';
import {
  OrganizationPermission,
  PermissionAction,
  PermissionScope,
  ResourceType,
} from '../src/models/OrganizationPermission';
import { OrganizationShip, OrgShipRole } from '../src/models/OrganizationShip';
import {
  OrganizationTemplate,
  TemplateCategory,
  TemplateVisibility,
} from '../src/models/OrganizationTemplate';
import { OrgApplication } from '../src/models/OrgApplication';
import { OrgWatchlistEntry } from '../src/models/OrgWatchlistEntry';
import { Permission } from '../src/models/Permission';
import { PriceAlert } from '../src/models/PriceAlert';
import { RelationshipHistory } from '../src/models/RelationshipHistory';
import { Reputation } from '../src/models/Reputation';
import { Role } from '../src/models/Role';
import { RsiRoleMapping } from '../src/models/RsiRoleMapping';
import { RsiUserLink } from '../src/models/RsiUserLink';
import { SecurityLevel } from '../src/models/SecurityLevel';
import { Ship } from '../src/models/Ship';
import { ShipLoadout } from '../src/models/ShipLoadout';
import { ShipLoan } from '../src/models/ShipLoan';
import { ShipMaintenance } from '../src/models/ShipMaintenance';
import { Team } from '../src/models/Team';
import { TeamMember } from '../src/models/TeamMember';
import { Ticket } from '../src/models/Ticket';
import { Tournament } from '../src/models/Tournament';
import { TradingRoute } from '../src/models/TradingRoute';
import { Tunnel } from '../src/models/Tunnel';
import { UserAvailability } from '../src/models/UserAvailability';
import { Webhook } from '../src/models/Webhook';

// ─── Additional Entity Imports (Sections 77–97) ──────────────────────────────
import { Achievement, AchievementRarity } from '../src/models/Achievement';
import { ActivityTemplate, ActivityTemplateCategory } from '../src/models/ActivityTemplate';
import { Certification } from '../src/models/Certification';
import { Comment } from '../src/models/Comment';
import { CommentLike } from '../src/models/CommentLike';
import { Dashboard, DashboardLayout, DashboardType } from '../src/models/Dashboard';
import { DashboardWidget } from '../src/models/DashboardWidget';
import { Equipment, EquipmentRarity, EquipmentStatus } from '../src/models/Equipment';
import { OrgFocusPreference } from '../src/models/OrgFocusPreference';
import { Skill, SkillCategory } from '../src/models/Skill';
import { SkillEndorsement } from '../src/models/SkillEndorsement';
import { Tag } from '../src/models/Tag';
import { TagAssignment } from '../src/models/TagAssignment';
import { TradeTransaction, TradeTransactionStatus } from '../src/models/TradeTransaction';
import { TradeUserReputation } from '../src/models/TradeUserReputation';
import { TunnelBan } from '../src/models/TunnelBan';
import { TunnelMessage } from '../src/models/TunnelMessage';
import { UserAchievement } from '../src/models/UserAchievement';
import { UserActivity } from '../src/models/UserActivity';
import { CertificationStatus, UserCertification } from '../src/models/UserCertification';
import { UserFocusPreference } from '../src/models/UserFocusPreference';
import { SkillLevel, UserSkill } from '../src/models/UserSkill';
import { WorkflowDefinition, WorkflowStatus } from '../src/models/WorkflowDefinition';
import { WorkflowExecution } from '../src/models/WorkflowExecution';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function _hoursFromNow(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function findShipId(name: string): Promise<string | null> {
  const shipRepo = AppDataSource.getRepository(Ship);
  const ship = await shipRepo.findOne({ where: { name } });
  return ship?.id ?? null;
}

// ─── Reference IDs from seed-demo-data.ts ─────────────────────────────────────

const USER_IDS = {
  commander: 'demo-user-commander-001',
  admiral: 'demo-user-admiral-002',
  trader: 'demo-user-trader-003',
  miner: 'demo-user-miner-004',
  bountyHunter: 'demo-user-hunter-005',
  medic: 'demo-user-medic-006',
  explorer: 'demo-user-explorer-007',
  engineer: 'demo-user-engineer-008',
  smuggler: 'demo-user-smuggler-009',
  rookie: 'demo-user-rookie-010',
  diplomat: 'demo-user-diplomat-011',
  pirate: 'demo-user-pirate-012',
  verifiedOnly: 'demo-user-verified-013',
  verifiedWithOrg: 'demo-user-verified-org-014',
  verifiedBoth: 'demo-user-verified-both-015',
};

// UUID-format user IDs for entities that declare their user columns as type: 'uuid'
// (Bounty, BountyClaim, HunterProfile, WikiPage, WikiPageRevision, Notification, NotificationPreferences)
const USER_UUIDS = {
  commander: 'cc000000-0000-4000-a000-000000000001',
  admiral: 'cc000000-0000-4000-a000-000000000002',
  trader: 'cc000000-0000-4000-a000-000000000003',
  miner: 'cc000000-0000-4000-a000-000000000004',
  bountyHunter: 'cc000000-0000-4000-a000-000000000005',
  medic: 'cc000000-0000-4000-a000-000000000006',
  explorer: 'cc000000-0000-4000-a000-000000000007',
  engineer: 'cc000000-0000-4000-a000-000000000008',
  smuggler: 'cc000000-0000-4000-a000-000000000009',
  rookie: 'cc000000-0000-4000-a000-00000000000a',
  diplomat: 'cc000000-0000-4000-a000-00000000000b',
  pirate: 'cc000000-0000-4000-a000-00000000000c',
  verifiedOnly: 'cc000000-0000-4000-a000-00000000000d',
  verifiedWithOrg: 'cc000000-0000-4000-a000-00000000000e',
  verifiedBoth: 'cc000000-0000-4000-a000-00000000000f',
};

const ORG_IDS = {
  fleet: '00000000-0000-4000-a000-000000000001',
  mining: '00000000-0000-4000-a000-000000000002',
  mercenary: '00000000-0000-4000-a000-000000000003',
  trading: '00000000-0000-4000-a000-000000000004',
  syndicate: '00000000-0000-4000-a000-000000000005',
  intel: '00000000-0000-4000-a000-000000000006',
  testOrg: '00000000-0000-4000-a000-000000000007',
  testOrgVerified: '00000000-0000-4000-a000-000000000008',
};

const FLEET_IDS = {
  alpha: 'demo-fleet-alpha-strike',
  mining: 'demo-fleet-deep-drill',
  trade: 'demo-fleet-silk-road',
};

// ─── New Static IDs ───────────────────────────────────────────────────────────

const ROLE_IDS = {
  sysAdmin: '10000000-0000-4000-a000-000000000001',
  sysModerator: '10000000-0000-4000-a000-000000000002',
  sysUser: '10000000-0000-4000-a000-000000000003',
  orgOwner: '10000000-0000-4000-a000-000000000004',
  orgAdmin: '10000000-0000-4000-a000-000000000005',
  orgOfficer: '10000000-0000-4000-a000-000000000006',
  orgMember: '10000000-0000-4000-a000-000000000007',
  orgRecruit: '10000000-0000-4000-a000-000000000008',
  fleetCommander: '10000000-0000-4000-a000-000000000009',
  fleetPilot: '10000000-0000-4000-a000-000000000010',
};

const TEAM_IDS = {
  alphaSquad: '40000000-0000-4000-a000-000000000001',
  bravoSquad: '40000000-0000-4000-a000-000000000002',
  miningDiv: '40000000-0000-4000-a000-000000000003',
  logisticsPlatoon: '40000000-0000-4000-a000-000000000004',
  intelFlight: '40000000-0000-4000-a000-000000000005',
  tradingCrew: '40000000-0000-4000-a000-000000000006',
};

const BOUNTY_IDS = {
  pirateLord: '80000000-0000-4000-a000-000000000001',
  cargoThief: '80000000-0000-4000-a000-000000000002',
  intelGather: '80000000-0000-4000-a000-000000000003',
  rescuePilot: '80000000-0000-4000-a000-000000000004',
  vanduulAce: '80000000-0000-4000-a000-000000000005',
};

const WIKI_IDS = {
  gettingStarted: '90000000-0000-4000-a000-000000000001',
  shipGuide: '90000000-0000-4000-a000-000000000002',
  miningOps: '90000000-0000-4000-a000-000000000003',
  combatTactics: '90000000-0000-4000-a000-000000000004',
  tradingRoutes: '90000000-0000-4000-a000-000000000005',
  orgRules: '90000000-0000-4000-a000-000000000006',
};

const MISSION_IDS = {
  patrolCrusader: 'a0000000-0000-4000-a000-000000000001',
  mineAaron: 'a0000000-0000-4000-a000-000000000002',
  escortConvoy: 'a0000000-0000-4000-a000-000000000003',
  salvageReclaim: 'a0000000-0000-4000-a000-000000000004',
  reconVanduul: 'a0000000-0000-4000-a000-000000000005',
};

const FEDERATION_IDS = {
  stantonAlliance: 'e0000000-0000-4000-a000-000000000001',
};

const TICKET_IDS = {
  recruitIssue: 'b0000000-0000-4000-a000-000000000001',
  shipDispute: 'b0000000-0000-4000-a000-000000000002',
  diplomaticRequest: 'b0000000-0000-4000-a000-000000000003',
  bugReport: 'b0000000-0000-4000-a000-000000000004',
};

const ORG_SHIP_IDS = {
  fleetIdris: '70000000-0000-4000-a000-000000000001',
  fleetJavelin: '70000000-0000-4000-a000-000000000002',
  fleetHammerhead: '70000000-0000-4000-a000-000000000003',
  miningOrion: '70000000-0000-4000-a000-000000000004',
  miningMole: '70000000-0000-4000-a000-000000000005',
  tradingBMM: '70000000-0000-4000-a000-000000000006',
  tradingHull: '70000000-0000-4000-a000-000000000007',
  mercRetaliator: '70000000-0000-4000-a000-000000000008',
};

const GUILD_IDS_MAP = {
  fleet: '1234567890123456789',
  mining: '9876543210987654321',
};

// ─── New Static IDs (Sections 34–76) ──────────────────────────────────────────

const ANNOUNCEMENT_IDS = {
  fleetAlert: 'aa000000-0000-4000-a000-000000000001',
  miningEvent: 'aa000000-0000-4000-a000-000000000002',
  tradeOpportunity: 'aa000000-0000-4000-a000-000000000003',
};

const ANN_TEMPLATE_IDS = {
  eventTemplate: 'ab000000-0000-4000-a000-000000000001',
  alertTemplate: 'ab000000-0000-4000-a000-000000000002',
};

const ORG_TEMPLATE_IDS = {
  militaryTemplate: 'ac000000-0000-4000-a000-000000000001',
  miningGuild: 'ac000000-0000-4000-a000-000000000002',
};

const CONTACT_REQUEST_IDS = {
  recruitmentInquiry: 'ad000000-0000-4000-a000-000000000001',
  diplomaticMessage: 'ad000000-0000-4000-a000-000000000002',
};

const BRIEFING_IDS = {
  operationBrief: 'ae000000-0000-4000-a000-000000000001',
  miningBrief: 'ae000000-0000-4000-a000-000000000002',
};

const PRICE_ALERT_IDS = {
  laraniteAbove: 'price-alert-laranite-above-001',
  titaniumBelow: 'price-alert-titanium-below-002',
  astatineChange: 'price-alert-astatine-change-003',
};

const SHIP_LOAN_IDS = {
  gladiusLoan: 'ship-loan-gladius-001',
  cutlassLoan: 'ship-loan-cutlass-002',
};

const SHIP_MAINT_IDS = {
  prospectorRoutine: 'ship-maint-prospector-001',
  hammerheadRepair: 'ship-maint-hammerhead-002',
  freelancerUpgrade: 'ship-maint-freelancer-003',
};

const CARGO_MANIFEST_IDS = {
  laraniteHaul: 'cargo-manifest-laranite-001',
  medSupplies: 'cargo-manifest-medsupply-002',
};

const FLEET_LOGISTICS_IDS = {
  operationStarfall: 'fleet-log-starfall-001',
  miningExpedition: 'fleet-log-mining-exp-002',
};

const TUNNEL_IDS = {
  stantonBridge: 'tunnel-stanton-bridge-001',
  intelChannel: 'tunnel-intel-channel-002',
};

const INTEL_APPROVAL_IDS = {
  vanduulMovement: 'intel-approval-vanduul-001',
  pirateBase: 'intel-approval-pirate-002',
};

const INTEL_OFFICER_IDS = {
  commanderOfficer: 'intel-officer-commander-001',
  diplomatOfficer: 'intel-officer-diplomat-002',
  explorerOfficer: 'intel-officer-explorer-003',
};

const INTEL_SHARE_IDS = {
  vanduulIntel: 'intel-share-vanduul-001',
  tradeRoutes: 'intel-share-trade-002',
};

const TOURNAMENT_IDS = {
  arenaCommander: 'tournament-arena-cmd-001',
  miningChampionship: 'tournament-mining-champ-002',
};

// ─── Main Seeding Function ────────────────────────────────────────────────────

// ─── Section Seed Functions ─────────────────────────────────────────────────

async function seedRoles(): Promise<void> {
  // ─── 1. Roles ──────────────────────────────────────────────────────────────
  console.log('─── Seeding Roles ───');
  const roleRepo = AppDataSource.getRepository(Role);
  const roles = [
    {
      id: ROLE_IDS.sysAdmin,
      name: 'System Admin',
      description: 'Full platform administrative access',
      isSystemRole: true,
      priority: 100,
      permissions: ['*'],
      organizationId: null as any,
    },
    {
      id: ROLE_IDS.sysModerator,
      name: 'System Moderator',
      description: 'Platform-level content moderation',
      isSystemRole: true,
      priority: 80,
      permissions: [
        'user.view',
        'user.moderate',
        'content.view',
        'content.moderate',
        'report.view',
        'report.manage',
      ],
      organizationId: null as any,
    },
    {
      id: ROLE_IDS.sysUser,
      name: 'User',
      description: 'Default platform user role',
      isSystemRole: true,
      priority: 10,
      permissions: ['profile.view', 'profile.edit', 'fleet.view', 'org.view', 'activity.view'],
      organizationId: null as any,
    },
    {
      id: ROLE_IDS.orgOwner,
      name: 'Owner',
      description: 'Organization owner — full administrative control',
      isSystemRole: false,
      priority: 100,
      permissions: ['*'],
      organizationId: ORG_IDS.fleet,
    },
    {
      id: ROLE_IDS.orgAdmin,
      name: 'Admin',
      description: 'Organization administrator',
      isSystemRole: false,
      priority: 80,
      permissions: [
        'member.manage',
        'fleet.manage',
        'ship.manage',
        'event.manage',
        'settings.view',
        'analytics.view',
        'recruitment.manage',
      ],
      organizationId: ORG_IDS.fleet,
    },
    {
      id: ROLE_IDS.orgOfficer,
      name: 'Officer',
      description: 'Organization officer with operational permissions',
      isSystemRole: false,
      priority: 60,
      permissions: [
        'member.view',
        'fleet.view',
        'fleet.create',
        'ship.view',
        'event.create',
        'event.edit',
        'activity.create',
      ],
      organizationId: ORG_IDS.fleet,
    },
    {
      id: ROLE_IDS.orgMember,
      name: 'Member',
      description: 'Standard organization member',
      isSystemRole: false,
      priority: 30,
      permissions: [
        'member.view',
        'fleet.view',
        'ship.view',
        'event.view',
        'activity.view',
        'activity.join',
      ],
      organizationId: ORG_IDS.fleet,
    },
    {
      id: ROLE_IDS.orgRecruit,
      name: 'Recruit',
      description: 'Probationary member with limited access',
      isSystemRole: false,
      priority: 10,
      permissions: ['fleet.view', 'event.view', 'activity.view'],
      organizationId: ORG_IDS.fleet,
    },
    {
      id: ROLE_IDS.fleetCommander,
      name: 'Fleet Commander',
      description: 'Tactical fleet command authority',
      isSystemRole: false,
      priority: 70,
      permissions: [
        'fleet.manage',
        'fleet.deploy',
        'fleet.assign',
        'ship.view',
        'member.view',
        'mission.create',
        'mission.manage',
      ],
      organizationId: ORG_IDS.fleet,
    },
    {
      id: ROLE_IDS.fleetPilot,
      name: 'Fleet Pilot',
      description: 'Authorized pilot for fleet operations',
      isSystemRole: false,
      priority: 40,
      permissions: ['fleet.view', 'ship.view', 'mission.view', 'mission.join'],
      organizationId: ORG_IDS.fleet,
    },
  ];

  for (const roleData of roles) {
    const exists = await roleRepo.findOne({ where: { id: roleData.id } });
    if (exists) {
      console.log(`  ○ Role already exists: ${roleData.name}`);
    } else {
      await roleRepo.save(roleRepo.create(roleData));
      console.log(`  ✓ Role: ${roleData.name}`);
    }
  }
}

async function seedPermissions(): Promise<void> {
  // ─── 2. Permissions ────────────────────────────────────────────────────────
  console.log('\n─── Seeding Permissions ───');
  const permRepo = AppDataSource.getRepository(Permission);
  const PERM_IDS = {
    admiralFleetRead: '20000000-0000-4000-a000-000000000001',
    admiralFleetManage: '20000000-0000-4000-a000-000000000002',
    commanderEventCreate: '20000000-0000-4000-a000-000000000003',
    traderShipView: '20000000-0000-4000-a000-000000000004',
    minerMiningManage: '20000000-0000-4000-a000-000000000005',
    hunterBountyManage: '20000000-0000-4000-a000-000000000006',
    medicMemberView: '20000000-0000-4000-a000-000000000007',
    engineerShipManage: '20000000-0000-4000-a000-000000000008',
  };
  const permissions = [
    {
      id: PERM_IDS.admiralFleetRead,
      userId: USER_IDS.admiral,
      organizationId: ORG_IDS.fleet,
      resource: 'fleet',
      action: 'read',
      granted: true,
      grantedBy: USER_IDS.admiral,
    },
    {
      id: PERM_IDS.admiralFleetManage,
      userId: USER_IDS.admiral,
      organizationId: ORG_IDS.fleet,
      resource: 'fleet',
      action: 'manage',
      granted: true,
      grantedBy: USER_IDS.admiral,
    },
    {
      id: PERM_IDS.commanderEventCreate,
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      resource: 'events',
      action: 'create',
      granted: true,
      grantedBy: USER_IDS.admiral,
    },
    {
      id: PERM_IDS.traderShipView,
      userId: USER_IDS.trader,
      organizationId: ORG_IDS.trading,
      resource: 'ships',
      action: 'read',
      granted: true,
      grantedBy: USER_IDS.trader,
    },
    {
      id: PERM_IDS.minerMiningManage,
      userId: USER_IDS.miner,
      organizationId: ORG_IDS.mining,
      resource: 'mining',
      action: 'manage',
      granted: true,
      grantedBy: USER_IDS.miner,
    },
    {
      id: PERM_IDS.hunterBountyManage,
      userId: USER_IDS.bountyHunter,
      organizationId: ORG_IDS.mercenary,
      resource: 'bounty',
      action: 'manage',
      granted: true,
      grantedBy: USER_IDS.bountyHunter,
    },
    {
      id: PERM_IDS.medicMemberView,
      userId: USER_IDS.medic,
      organizationId: ORG_IDS.fleet,
      resource: 'members',
      action: 'read',
      granted: true,
      grantedBy: USER_IDS.admiral,
    },
    {
      id: PERM_IDS.engineerShipManage,
      userId: USER_IDS.engineer,
      organizationId: ORG_IDS.fleet,
      resource: 'ships',
      action: 'manage',
      granted: true,
      grantedBy: USER_IDS.admiral,
    },
  ];

  for (const permData of permissions) {
    const exists = await permRepo.findOne({ where: { id: permData.id } });
    if (exists) {
      console.log(`  ○ Permission already exists: ${permData.resource}.${permData.action}`);
    } else {
      await permRepo.save(permRepo.create(permData));
      console.log(
        `  ✓ Permission: ${permData.userId.split('-').pop()} → ${permData.resource}.${permData.action}`
      );
    }
  }
}

async function seedOrganizationPermissions(): Promise<void> {
  // ─── 3. Organization Permissions ───────────────────────────────────────────
  console.log('\n─── Seeding Organization Permissions ───');
  const orgPermRepo = AppDataSource.getRepository(OrganizationPermission);
  const ORG_PERM_IDS = {
    fleetAdminAll: '30000000-0000-4000-a000-000000000001',
    fleetMemberView: '30000000-0000-4000-a000-000000000002',
    miningAdminAll: '30000000-0000-4000-a000-000000000003',
    tradingShipManage: '30000000-0000-4000-a000-000000000004',
  };
  const orgPermissions = [
    {
      id: ORG_PERM_IDS.fleetAdminAll,
      organizationId: ORG_IDS.fleet,
      roleId: ROLE_IDS.orgAdmin,
      resource: ResourceType.FLEET,
      actions: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.EDIT,
        PermissionAction.DELETE,
        PermissionAction.MANAGE,
      ],
      scope: PermissionScope.ORGANIZATION,
      inheritable: true,
      inherited: false,
      priority: 80,
      isActive: true,
      grantedBy: USER_IDS.admiral,
      reason: 'Admin fleet management permissions',
    },
    {
      id: ORG_PERM_IDS.fleetMemberView,
      organizationId: ORG_IDS.fleet,
      roleId: ROLE_IDS.orgMember,
      resource: ResourceType.FLEET,
      actions: [PermissionAction.VIEW],
      scope: PermissionScope.ORGANIZATION,
      inheritable: true,
      inherited: false,
      priority: 30,
      isActive: true,
      grantedBy: USER_IDS.admiral,
      reason: 'Members can view fleets',
    },
    {
      id: ORG_PERM_IDS.miningAdminAll,
      organizationId: ORG_IDS.mining,
      userId: USER_IDS.miner,
      resource: ResourceType.SHIP,
      actions: [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.EDIT,
        PermissionAction.MANAGE,
      ],
      scope: PermissionScope.ORGANIZATION,
      inheritable: false,
      inherited: false,
      priority: 70,
      isActive: true,
      grantedBy: USER_IDS.miner,
      reason: 'Mining lead ship management',
    },
    {
      id: ORG_PERM_IDS.tradingShipManage,
      organizationId: ORG_IDS.trading,
      userId: USER_IDS.trader,
      resource: ResourceType.LOGISTICS,
      actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT],
      scope: PermissionScope.ORGANIZATION,
      inheritable: true,
      inherited: false,
      priority: 60,
      isActive: true,
      grantedBy: USER_IDS.trader,
      reason: 'Trade logistics management',
    },
  ];

  for (const opData of orgPermissions) {
    const exists = await orgPermRepo.findOne({ where: { id: opData.id } });
    if (exists) {
      console.log(`  ○ OrgPermission already exists: ${opData.resource}`);
    } else {
      await orgPermRepo.save(orgPermRepo.create(opData as any));
      console.log(`  ✓ OrgPermission: ${opData.resource} in ${opData.organizationId.slice(-1)}`);
    }
  }
}

async function seedFeatureFlags(): Promise<void> {
  // ─── 4. Feature Flags ─────────────────────────────────────────────────────
  console.log('\n─── Seeding Feature Flags ───');
  const ffRepo = AppDataSource.getRepository(FeatureFlag);
  const featureFlags = [
    {
      id: 'mining-operations',
      name: 'Mining Operations Module',
      description: 'Enable the mining operations planning and tracking module',
      status: FeatureFlagStatus.ENABLED,
      scope: FeatureFlagScope.GLOBAL,
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'trading-routes',
      name: 'Trading Routes',
      description: 'Enable trading route planning and optimization tools',
      status: FeatureFlagStatus.ENABLED,
      scope: FeatureFlagScope.GLOBAL,
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'bounty-board',
      name: 'Bounty Board',
      description: 'Enable the bounty hunting board and hunter profiles',
      status: FeatureFlagStatus.ENABLED,
      scope: FeatureFlagScope.GLOBAL,
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'intel-system',
      name: 'Intelligence System',
      description: 'Enable classified intelligence entry management',
      status: FeatureFlagStatus.ENABLED,
      scope: FeatureFlagScope.GLOBAL,
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'wiki-module',
      name: 'Organization Wiki',
      description: 'Enable organization-level wikis with version control',
      status: FeatureFlagStatus.ENABLED,
      scope: FeatureFlagScope.GLOBAL,
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'federation-system',
      name: 'Federation System',
      description: 'Enable multi-org federation governance tools',
      status: FeatureFlagStatus.BETA,
      scope: FeatureFlagScope.BETA_USERS,
      targetOrganizations: [ORG_IDS.fleet, ORG_IDS.mining, ORG_IDS.trading],
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'ai-briefings',
      name: 'AI Briefings',
      description: 'AI-generated operational briefings and summaries (Wave 3.1)',
      status: FeatureFlagStatus.BETA,
      scope: FeatureFlagScope.BETA_USERS,
      targetUsers: [USER_IDS.admiral, USER_IDS.commander],
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'ship-loadouts',
      name: 'Ship Loadout Builder',
      description: 'Interactive ship component configuration tool with erkul.games integration',
      status: FeatureFlagStatus.ENABLED,
      scope: FeatureFlagScope.GLOBAL,
      createdBy: USER_IDS.engineer,
    },
    {
      id: 'ticket-system',
      name: 'Ticket System',
      description: 'Internal support ticket management with Discord integration',
      status: FeatureFlagStatus.ENABLED,
      scope: FeatureFlagScope.GLOBAL,
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'org-inventory',
      name: 'Organization Inventory',
      description: 'Organization-level asset and inventory tracking',
      status: FeatureFlagStatus.PERCENTAGE,
      scope: FeatureFlagScope.ORGANIZATION,
      percentage: 50,
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'dark-mode-v2',
      name: 'Dark Mode V2',
      description: 'Enhanced dark mode theme with OLED-optimized colors',
      status: FeatureFlagStatus.DISABLED,
      scope: FeatureFlagScope.GLOBAL,
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'crew-assignments',
      name: 'Crew Assignment System',
      description: 'Mission-based crew assignment and rotation management',
      status: FeatureFlagStatus.ENABLED,
      scope: FeatureFlagScope.GLOBAL,
      createdBy: USER_IDS.commander,
    },
  ];

  for (const ffData of featureFlags) {
    const exists = await ffRepo.findOne({ where: { id: ffData.id } });
    if (exists) {
      console.log(`  ○ FeatureFlag already exists: ${ffData.name}`);
    } else {
      await ffRepo.save(ffRepo.create(ffData as any));
      console.log(`  ✓ FeatureFlag: ${ffData.name} [${ffData.status}]`);
    }
  }
}

async function seedTeams(): Promise<void> {
  // ─── 5. Teams ──────────────────────────────────────────────────────────────
  console.log('\n─── Seeding Teams ───');
  const teamRepo = AppDataSource.getRepository(Team);
  const teams = [
    {
      id: TEAM_IDS.alphaSquad,
      name: 'Alpha Squadron',
      description: 'First response combat unit. Elite pilots and gunners.',
      type: 'squad',
      organizationId: ORG_IDS.fleet,
      level: 0,
      sortOrder: 1,
      maxMembers: 12,
      isActive: true,
    },
    {
      id: TEAM_IDS.bravoSquad,
      name: 'Bravo Wing',
      description: 'Heavy assault and capital ship boarding specialists.',
      type: 'squad',
      organizationId: ORG_IDS.fleet,
      level: 0,
      sortOrder: 2,
      maxMembers: 12,
      isActive: true,
    },
    {
      id: TEAM_IDS.miningDiv,
      name: 'Deep Core Division',
      description: 'Primary mining operations. Quantanium and rare mineral extraction.',
      type: 'division',
      organizationId: ORG_IDS.mining,
      level: 0,
      sortOrder: 1,
      maxMembers: 30,
      isActive: true,
    },
    {
      id: TEAM_IDS.logisticsPlatoon,
      name: 'Logistics Platoon',
      description: 'Supply chain management, cargo hauling, and fleet resupply.',
      type: 'platoon',
      organizationId: ORG_IDS.fleet,
      level: 0,
      sortOrder: 3,
      maxMembers: 20,
      isActive: true,
    },
    {
      id: TEAM_IDS.intelFlight,
      name: 'Ghost Flight',
      description: 'Covert reconnaissance and intelligence gathering.',
      type: 'flight',
      organizationId: ORG_IDS.intel,
      level: 0,
      sortOrder: 1,
      maxMembers: 8,
      isActive: true,
    },
    {
      id: TEAM_IDS.tradingCrew,
      name: 'Silk Road Crew',
      description: 'Primary trading convoy crew. Route planning and market analysis.',
      type: 'custom',
      organizationId: ORG_IDS.trading,
      level: 0,
      sortOrder: 1,
      maxMembers: 15,
      isActive: true,
    },
  ];

  for (const teamData of teams) {
    const exists = await teamRepo.findOne({ where: { id: teamData.id } });
    if (exists) {
      console.log(`  ○ Team already exists: ${teamData.name}`);
    } else {
      await teamRepo.save(teamRepo.create(teamData as any));
      console.log(`  ✓ Team: ${teamData.name}`);
    }
  }
}

async function seedTeamMembers(): Promise<void> {
  // ─── 6. Team Members ──────────────────────────────────────────────────────
  console.log('\n─── Seeding Team Members ───');
  const tmRepo = AppDataSource.getRepository(TeamMember);
  const TM_IDS = {
    admiralAlpha: '50000000-0000-4000-a000-000000000001',
    commanderAlpha: '50000000-0000-4000-a000-000000000002',
    hunterAlpha: '50000000-0000-4000-a000-000000000003',
    explorerAlpha: '50000000-0000-4000-a000-000000000004',
    engineerBravo: '50000000-0000-4000-a000-000000000005',
    medicBravo: '50000000-0000-4000-a000-000000000006',
    minerDeepCore: '50000000-0000-4000-a000-000000000007',
    rookieMining: '50000000-0000-4000-a000-000000000008',
    traderSilk: '50000000-0000-4000-a000-000000000009',
    smugglerSilk: '50000000-0000-4000-a000-000000000010',
    explorerIntel: '50000000-0000-4000-a000-000000000011',
    diplomatIntel: '50000000-0000-4000-a000-000000000012',
    commanderLogistics: '50000000-0000-4000-a000-000000000013',
  };
  const teamMembers = [
    // Alpha Squadron
    {
      id: TM_IDS.admiralAlpha,
      teamId: TEAM_IDS.alphaSquad,
      userId: USER_IDS.admiral,
      organizationId: ORG_IDS.fleet,
      role: 'leader',
      status: 'active',
      joinedAt: daysAgo(180),
    },
    {
      id: TM_IDS.commanderAlpha,
      teamId: TEAM_IDS.alphaSquad,
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      role: 'officer',
      status: 'active',
      joinedAt: daysAgo(150),
    },
    {
      id: TM_IDS.hunterAlpha,
      teamId: TEAM_IDS.alphaSquad,
      userId: USER_IDS.bountyHunter,
      organizationId: ORG_IDS.fleet,
      role: 'member',
      status: 'active',
      joinedAt: daysAgo(90),
    },
    {
      id: TM_IDS.explorerAlpha,
      teamId: TEAM_IDS.alphaSquad,
      userId: USER_IDS.explorer,
      organizationId: ORG_IDS.fleet,
      role: 'member',
      status: 'active',
      joinedAt: daysAgo(60),
    },
    // Bravo Wing
    {
      id: TM_IDS.engineerBravo,
      teamId: TEAM_IDS.bravoSquad,
      userId: USER_IDS.engineer,
      organizationId: ORG_IDS.fleet,
      role: 'leader',
      status: 'active',
      joinedAt: daysAgo(120),
    },
    {
      id: TM_IDS.medicBravo,
      teamId: TEAM_IDS.bravoSquad,
      userId: USER_IDS.medic,
      organizationId: ORG_IDS.fleet,
      role: 'member',
      status: 'active',
      joinedAt: daysAgo(100),
    },
    // Deep Core Division
    {
      id: TM_IDS.minerDeepCore,
      teamId: TEAM_IDS.miningDiv,
      userId: USER_IDS.miner,
      organizationId: ORG_IDS.mining,
      role: 'leader',
      status: 'active',
      joinedAt: daysAgo(200),
    },
    {
      id: TM_IDS.rookieMining,
      teamId: TEAM_IDS.miningDiv,
      userId: USER_IDS.rookie,
      organizationId: ORG_IDS.mining,
      role: 'member',
      status: 'active',
      joinedAt: daysAgo(14),
    },
    // Silk Road Crew
    {
      id: TM_IDS.traderSilk,
      teamId: TEAM_IDS.tradingCrew,
      userId: USER_IDS.trader,
      organizationId: ORG_IDS.trading,
      role: 'leader',
      status: 'active',
      joinedAt: daysAgo(160),
    },
    {
      id: TM_IDS.smugglerSilk,
      teamId: TEAM_IDS.tradingCrew,
      userId: USER_IDS.smuggler,
      organizationId: ORG_IDS.trading,
      role: 'member',
      status: 'active',
      joinedAt: daysAgo(80),
    },
    // Ghost Flight
    {
      id: TM_IDS.explorerIntel,
      teamId: TEAM_IDS.intelFlight,
      userId: USER_IDS.explorer,
      organizationId: ORG_IDS.intel,
      role: 'officer',
      status: 'active',
      joinedAt: daysAgo(90),
    },
    {
      id: TM_IDS.diplomatIntel,
      teamId: TEAM_IDS.intelFlight,
      userId: USER_IDS.diplomat,
      organizationId: ORG_IDS.intel,
      role: 'member',
      status: 'active',
      joinedAt: daysAgo(45),
    },
    // Logistics Platoon
    {
      id: TM_IDS.commanderLogistics,
      teamId: TEAM_IDS.logisticsPlatoon,
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      role: 'leader',
      status: 'active',
      joinedAt: daysAgo(140),
    },
  ];

  for (const tmData of teamMembers) {
    const exists = await tmRepo.findOne({ where: { id: tmData.id } });
    if (exists) {
      console.log(`  ○ TeamMember already exists`);
    } else {
      await tmRepo.save(tmRepo.create(tmData as any));
      console.log(
        `  ✓ TeamMember: ${tmData.userId.split('-').pop()} → ${tmData.teamId.split('-').pop()}`
      );
    }
  }
}

async function seedNotificationPreferences(): Promise<void> {
  // ─── 7. Notification Preferences ──────────────────────────────────────────
  console.log('\n─── Seeding Notification Preferences ───');
  const npRepo = AppDataSource.getRepository(NotificationPreferences);
  const notifPrefUsers = [
    {
      userId: USER_IDS.admiral,
      muteAll: false,
      channels: { inApp: true, email: true, discord: true },
      digestFrequency: 'daily',
    },
    {
      userId: USER_IDS.commander,
      muteAll: false,
      channels: { inApp: true, email: false, discord: true },
      digestFrequency: 'daily',
    },
    {
      userId: USER_IDS.trader,
      muteAll: false,
      channels: { inApp: true, email: true, discord: false },
      digestFrequency: 'weekly',
    },
    {
      userId: USER_IDS.miner,
      muteAll: false,
      channels: { inApp: true, email: false, discord: true },
      digestFrequency: 'daily',
    },
    {
      userId: USER_IDS.bountyHunter,
      muteAll: false,
      channels: { inApp: true, email: false, discord: true },
      digestFrequency: 'none',
    },
    {
      userId: USER_IDS.medic,
      muteAll: false,
      channels: { inApp: true, email: true, discord: true },
      digestFrequency: 'daily',
    },
    {
      userId: USER_IDS.explorer,
      muteAll: false,
      channels: { inApp: true, email: false, discord: false },
      digestFrequency: 'weekly',
    },
    {
      userId: USER_IDS.engineer,
      muteAll: false,
      channels: { inApp: true, email: false, discord: true },
      digestFrequency: 'daily',
    },
    {
      userId: USER_IDS.smuggler,
      muteAll: true,
      channels: { inApp: false, email: false, discord: false },
      digestFrequency: 'none',
    },
    {
      userId: USER_IDS.rookie,
      muteAll: false,
      channels: { inApp: true, email: true, discord: true },
      digestFrequency: 'daily',
    },
  ];

  for (const npData of notifPrefUsers) {
    const exists = await npRepo.findOne({ where: { userId: npData.userId } });
    if (exists) {
      console.log(`  ○ NotifPrefs already exist: ${npData.userId.split('-').pop()}`);
    } else {
      await npRepo.save(
        npRepo.create({
          ...npData,
          categories: {
            fleet_updates: true,
            org_announcements: true,
            mission_alerts: true,
            trading_alerts: npData.userId === USER_IDS.trader,
            bounty_alerts: npData.userId === USER_IDS.bountyHunter,
            social: true,
            system: true,
          },
        } as any)
      );
      console.log(`  ✓ NotifPrefs: ${npData.userId.split('-').pop()}`);
    }
  }
}

async function seedNotifications(): Promise<void> {
  // ─── 8. Notifications ─────────────────────────────────────────────────────
  console.log('\n─── Seeding Notifications ───');
  const notifRepo = AppDataSource.getRepository(Notification);
  const NOTIF_IDS = {
    welcomeRookie: '60000000-0000-4000-a000-000000000001',
    fleetDeployed: '60000000-0000-4000-a000-000000000002',
    bountyPosted: '60000000-0000-4000-a000-000000000003',
    missionInvite: '60000000-0000-4000-a000-000000000004',
    tradeAlert: '60000000-0000-4000-a000-000000000005',
    orgAnnouncement: '60000000-0000-4000-a000-000000000006',
    allianceFormed: '60000000-0000-4000-a000-000000000007',
    securityWarning: '60000000-0000-4000-a000-000000000008',
  };
  const notifications = [
    {
      id: NOTIF_IDS.welcomeRookie,
      userId: USER_IDS.rookie,
      senderId: USER_IDS.admiral,
      type: NotificationType.INFO,
      priority: NotificationPriority.NORMAL,
      title: 'Welcome to Stardust Expeditionary Fleet!',
      message:
        'Welcome aboard, recruit! Check out the Getting Started wiki page to learn the ropes. Your first fleet assignment begins tomorrow.',
      read: false,
      data: { link: '/wiki/getting-started' },
    },
    {
      id: NOTIF_IDS.fleetDeployed,
      userId: USER_IDS.commander,
      senderId: USER_IDS.admiral,
      type: NotificationType.FLEET_DEPLOYED,
      priority: NotificationPriority.HIGH,
      title: 'Alpha Strike Wing Deployed',
      message:
        'Alpha Strike Wing has been deployed to Stanton system. All assigned personnel report to stations.',
      read: true,
      readAt: daysAgo(1),
      data: { fleetId: FLEET_IDS.alpha },
    },
    {
      id: NOTIF_IDS.bountyPosted,
      userId: USER_IDS.bountyHunter,
      type: NotificationType.INFO,
      priority: NotificationPriority.NORMAL,
      title: 'New High-Value Bounty Posted',
      message:
        'A new 250,000 aUEC bounty has been posted on the Crimson Syndicate pirate lord "Scar" Kowalski.',
      read: false,
      data: { bountyId: BOUNTY_IDS.pirateLord },
    },
    {
      id: NOTIF_IDS.missionInvite,
      userId: USER_IDS.medic,
      senderId: USER_IDS.commander,
      type: NotificationType.ACTIVITY_INVITATION,
      priority: NotificationPriority.HIGH,
      title: 'Mission Invitation: Patrol Crusader',
      message:
        'You have been invited to join the Crusader Patrol mission as the medical officer. Accept or decline within 24 hours.',
      read: false,
      data: { missionId: MISSION_IDS.patrolCrusader },
    },
    {
      id: NOTIF_IDS.tradeAlert,
      userId: USER_IDS.trader,
      type: NotificationType.TRADE_OPERATION_CREATED,
      priority: NotificationPriority.NORMAL,
      title: 'New Trading Opportunity',
      message:
        'Laranite prices at Area18 have increased 40%. Recommended route: Lathan → Area18 for maximum profit.',
      read: true,
      readAt: daysAgo(2),
      data: { commodity: 'Laranite', origin: 'Lathan', destination: 'Area18' },
    },
    {
      id: NOTIF_IDS.orgAnnouncement,
      userId: USER_IDS.admiral,
      type: NotificationType.ANNOUNCEMENT,
      priority: NotificationPriority.HIGH,
      title: 'Organization-Wide Drill Scheduled',
      message:
        'All hands: Fleet readiness drill scheduled for this Saturday at 20:00 UTC. Mandatory attendance for all combat-rated personnel.',
      read: false,
      data: { eventDate: daysFromNow(3).toISOString() },
    },
    {
      id: NOTIF_IDS.allianceFormed,
      userId: USER_IDS.diplomat,
      senderId: USER_IDS.admiral,
      type: NotificationType.SUCCESS,
      priority: NotificationPriority.NORMAL,
      title: 'Alliance Treaty Ratified',
      message:
        'The Stanton Corridor Alliance treaty has been ratified by all member organizations. Diplomatic channels are now open.',
      read: true,
      readAt: daysAgo(5),
      data: { federationId: FEDERATION_IDS.stantonAlliance },
    },
    {
      id: NOTIF_IDS.securityWarning,
      userId: USER_IDS.commander,
      type: NotificationType.WARNING,
      priority: NotificationPriority.URGENT,
      title: 'Security Alert: Crimson Syndicate Activity',
      message:
        'Intel reports increased Crimson Syndicate pirate activity near Yela asteroid belt. Exercise caution during mining and trading operations.',
      read: false,
      data: { threatLevel: 'high', region: 'Yela' },
    },
  ];

  for (const nData of notifications) {
    const exists = await notifRepo.findOne({ where: { id: nData.id } });
    if (exists) {
      console.log(`  ○ Notification already exists: ${nData.title.substring(0, 40)}...`);
    } else {
      await notifRepo.save(notifRepo.create(nData as any));
      console.log(`  ✓ Notification: ${nData.title.substring(0, 40)}...`);
    }
  }
}

async function seedUserConsent(): Promise<number> {
  // ─── 9. User Consent (GDPR) ───────────────────────────────────────────────
  console.log('\n─── Seeding User Consent (GDPR) ───');
  const consentRepo = AppDataSource.getRepository(UserConsent);
  const consentRecords: Array<{
    userId: string;
    consentType: ConsentType;
    granted: boolean;
    purpose: string;
    version: string;
  }> = [];
  // All users grant essential consent
  for (const userId of Object.values(USER_IDS)) {
    consentRecords.push({
      userId,
      consentType: ConsentType.ESSENTIAL,
      granted: true,
      purpose: 'Essential cookies and services required for account functionality',
      version: '2.0',
    });
  }
  // Most users grant analytics
  const analyticsUsers = [
    USER_IDS.admiral,
    USER_IDS.commander,
    USER_IDS.trader,
    USER_IDS.miner,
    USER_IDS.medic,
    USER_IDS.explorer,
    USER_IDS.engineer,
    USER_IDS.rookie,
  ];
  for (const userId of analyticsUsers) {
    consentRecords.push({
      userId,
      consentType: ConsentType.ANALYTICS,
      granted: true,
      purpose: 'Usage analytics to improve the platform experience',
      version: '2.0',
    });
  }
  // Some users grant data processing
  const dpUsers = [USER_IDS.admiral, USER_IDS.commander, USER_IDS.trader, USER_IDS.miner];
  for (const userId of dpUsers) {
    consentRecords.push({
      userId,
      consentType: ConsentType.DATA_PROCESSING,
      granted: true,
      purpose: 'Processing gameplay statistics and performance data for matchmaking',
      version: '2.0',
    });
  }

  let consentCount = 0;
  for (const cData of consentRecords) {
    const exists = await consentRepo.findOne({
      where: { userId: cData.userId, consentType: cData.consentType },
    });
    if (!exists) {
      await consentRepo.save(consentRepo.create(cData as any));
      consentCount++;
    }
  }
  console.log(
    `  ✓ Created ${consentCount} consent records (${consentRecords.length} total attempted)`
  );
  return consentCount;
}

async function seedUserGameplayPreferences(): Promise<void> {
  // ─── 10. User Gameplay Preferences ────────────────────────────────────────
  console.log('\n─── Seeding User Gameplay Preferences ───');
  const ugpRepo = AppDataSource.getRepository(UserGameplayPreferences);
  const gameplayPrefs = [
    {
      userId: USER_IDS.admiral,
      activityPreferences: {
        combat: 90,
        mining: 20,
        trading: 30,
        exploration: 50,
        logistics: 40,
        rescue: 60,
      },
      playstyles: ['hardcore', 'competitive'],
      preferredGroupSizeMin: 8,
      preferredGroupSizeMax: 50,
      requiresVoiceChat: true,
      timezone: 'America/New_York',
      availability: ['weekdays_evening', 'weekends_afternoon', 'weekends_evening'],
      preferredRoles: ['commander', 'captain', 'leader'],
      languages: ['english'],
      combatSkill: 95,
      pilotingSkill: 88,
      tradingSkill: 40,
      miningSkill: 25,
    },
    {
      userId: USER_IDS.commander,
      activityPreferences: {
        combat: 85,
        mining: 15,
        trading: 20,
        exploration: 60,
        logistics: 70,
        rescue: 50,
      },
      playstyles: ['hardcore', 'roleplay'],
      preferredGroupSizeMin: 4,
      preferredGroupSizeMax: 20,
      requiresVoiceChat: true,
      timezone: 'Europe/London',
      availability: ['weekdays_evening', 'weekends_morning', 'weekends_afternoon'],
      preferredRoles: ['commander', 'navigator', 'pilot'],
      languages: ['english', 'french'],
      combatSkill: 85,
      pilotingSkill: 92,
      tradingSkill: 35,
      miningSkill: 20,
    },
    {
      userId: USER_IDS.trader,
      activityPreferences: {
        combat: 10,
        mining: 20,
        trading: 95,
        exploration: 40,
        logistics: 80,
        rescue: 15,
      },
      playstyles: ['casual', 'social'],
      preferredGroupSizeMin: 2,
      preferredGroupSizeMax: 8,
      requiresVoiceChat: false,
      timezone: 'Asia/Tokyo',
      availability: ['weekdays_afternoon', 'weekdays_evening'],
      preferredRoles: ['cargo', 'navigator'],
      languages: ['english', 'japanese'],
      combatSkill: 20,
      pilotingSkill: 60,
      tradingSkill: 98,
      miningSkill: 30,
    },
    {
      userId: USER_IDS.miner,
      activityPreferences: {
        combat: 15,
        mining: 98,
        trading: 50,
        exploration: 30,
        logistics: 40,
        rescue: 20,
      },
      playstyles: ['casual', 'social'],
      preferredGroupSizeMin: 3,
      preferredGroupSizeMax: 10,
      requiresVoiceChat: true,
      timezone: 'Europe/Berlin',
      availability: [
        'weekdays_evening',
        'weekends_morning',
        'weekends_afternoon',
        'weekends_evening',
      ],
      preferredRoles: ['engineer', 'pilot'],
      languages: ['english', 'german'],
      combatSkill: 30,
      pilotingSkill: 70,
      tradingSkill: 55,
      miningSkill: 97,
    },
    {
      userId: USER_IDS.bountyHunter,
      activityPreferences: {
        combat: 95,
        mining: 5,
        trading: 10,
        exploration: 60,
        logistics: 10,
        rescue: 30,
      },
      playstyles: ['hardcore', 'competitive'],
      preferredGroupSizeMin: 1,
      preferredGroupSizeMax: 4,
      requiresVoiceChat: false,
      prefersSilentPlay: true,
      timezone: 'America/Los_Angeles',
      availability: ['weekdays_night', 'weekends_night'],
      preferredRoles: ['pilot', 'gunner'],
      languages: ['english'],
      combatSkill: 98,
      pilotingSkill: 90,
      tradingSkill: 15,
      miningSkill: 5,
    },
    {
      userId: USER_IDS.medic,
      activityPreferences: {
        combat: 30,
        mining: 10,
        trading: 15,
        exploration: 40,
        logistics: 50,
        rescue: 95,
      },
      playstyles: ['roleplay', 'social'],
      preferredGroupSizeMin: 4,
      preferredGroupSizeMax: 12,
      requiresVoiceChat: true,
      timezone: 'Australia/Sydney',
      availability: ['weekends_afternoon', 'weekends_evening'],
      preferredRoles: ['medic', 'engineer'],
      languages: ['english'],
      combatSkill: 40,
      pilotingSkill: 55,
      tradingSkill: 20,
      miningSkill: 15,
    },
    {
      userId: USER_IDS.explorer,
      activityPreferences: {
        combat: 25,
        mining: 30,
        trading: 20,
        exploration: 98,
        logistics: 15,
        rescue: 40,
      },
      playstyles: ['casual', 'roleplay'],
      preferredGroupSizeMin: 1,
      preferredGroupSizeMax: 6,
      requiresVoiceChat: false,
      timezone: 'America/Chicago',
      availability: ['weekdays_evening', 'weekends_morning', 'weekends_afternoon'],
      preferredRoles: ['navigator', 'pilot', 'captain'],
      languages: ['english', 'spanish'],
      combatSkill: 45,
      pilotingSkill: 85,
      tradingSkill: 30,
      miningSkill: 40,
    },
    {
      userId: USER_IDS.rookie,
      activityPreferences: {
        combat: 50,
        mining: 50,
        trading: 50,
        exploration: 50,
        logistics: 50,
        rescue: 50,
      },
      playstyles: ['casual', 'social'],
      preferredGroupSizeMin: 4,
      preferredGroupSizeMax: 12,
      requiresVoiceChat: false,
      timezone: 'Europe/Paris',
      availability: ['weekends_afternoon', 'weekends_evening'],
      preferredRoles: ['member'],
      languages: ['english', 'french'],
      combatSkill: 25,
      pilotingSkill: 30,
      tradingSkill: 20,
      miningSkill: 20,
    },
  ];

  for (const gpData of gameplayPrefs) {
    const exists = await ugpRepo.findOne({ where: { userId: gpData.userId } });
    if (exists) {
      console.log(`  ○ GameplayPrefs already exist: ${gpData.userId.split('-').pop()}`);
    } else {
      await ugpRepo.save(ugpRepo.create(gpData as any));
      console.log(`  ✓ GameplayPrefs: ${gpData.userId.split('-').pop()}`);
    }
  }
}

async function seedReputation(): Promise<void> {
  // ─── 11. Reputation ───────────────────────────────────────────────────────
  console.log('\n─── Seeding Reputation ───');
  const repRepo = AppDataSource.getRepository(Reputation);
  const reputations = [
    {
      id: `rep-${USER_IDS.admiral}`,
      userId: USER_IDS.admiral,
      overallScore: 920,
      scores: [
        { category: 'combat', score: 95, totalEvents: 180 },
        { category: 'leadership', score: 98, totalEvents: 220 },
        { category: 'reliability', score: 92, totalEvents: 400 },
        { category: 'trading', score: 40, totalEvents: 15 },
        { category: 'mining', score: 20, totalEvents: 5 },
        { category: 'exploration', score: 60, totalEvents: 30 },
      ],
      history: [
        {
          type: 'mission_complete',
          change: 5,
          category: 'combat',
          timestamp: daysAgo(2).toISOString(),
          description: 'Completed patrol mission',
        },
        {
          type: 'fleet_command',
          change: 10,
          category: 'leadership',
          timestamp: daysAgo(5).toISOString(),
          description: 'Successful fleet deployment',
        },
      ],
    },
    {
      id: `rep-${USER_IDS.commander}`,
      userId: USER_IDS.commander,
      overallScore: 850,
      scores: [
        { category: 'combat', score: 88, totalEvents: 150 },
        { category: 'leadership', score: 85, totalEvents: 120 },
        { category: 'reliability', score: 90, totalEvents: 300 },
        { category: 'exploration', score: 72, totalEvents: 45 },
      ],
      history: [
        {
          type: 'mission_complete',
          change: 3,
          category: 'combat',
          timestamp: daysAgo(1).toISOString(),
          description: 'Escort mission success',
        },
      ],
    },
    {
      id: `rep-${USER_IDS.trader}`,
      userId: USER_IDS.trader,
      overallScore: 780,
      scores: [
        { category: 'trading', score: 96, totalEvents: 500 },
        { category: 'reliability', score: 88, totalEvents: 350 },
        { category: 'combat', score: 15, totalEvents: 8 },
      ],
      history: [
        {
          type: 'trade_complete',
          change: 8,
          category: 'trading',
          timestamp: daysAgo(1).toISOString(),
          description: 'Profitable Laranite run',
        },
      ],
    },
    {
      id: `rep-${USER_IDS.miner}`,
      userId: USER_IDS.miner,
      overallScore: 810,
      scores: [
        { category: 'mining', score: 97, totalEvents: 420 },
        { category: 'reliability', score: 94, totalEvents: 380 },
        { category: 'trading', score: 55, totalEvents: 60 },
      ],
      history: [
        {
          type: 'mining_complete',
          change: 5,
          category: 'mining',
          timestamp: daysAgo(1).toISOString(),
          description: 'Quantanium extraction — full yield',
        },
      ],
    },
    {
      id: `rep-${USER_IDS.bountyHunter}`,
      userId: USER_IDS.bountyHunter,
      overallScore: 870,
      scores: [
        { category: 'combat', score: 97, totalEvents: 320 },
        { category: 'reliability', score: 75, totalEvents: 200 },
        { category: 'exploration', score: 65, totalEvents: 40 },
      ],
      history: [
        {
          type: 'bounty_complete',
          change: 15,
          category: 'combat',
          timestamp: daysAgo(3).toISOString(),
          description: 'High-value target eliminated',
        },
      ],
    },
    {
      id: `rep-${USER_IDS.rookie}`,
      userId: USER_IDS.rookie,
      overallScore: 120,
      scores: [
        { category: 'combat', score: 15, totalEvents: 3 },
        { category: 'reliability', score: 30, totalEvents: 5 },
      ],
      history: [
        {
          type: 'mission_join',
          change: 2,
          category: 'reliability',
          timestamp: daysAgo(1).toISOString(),
          description: 'First fleet operation',
        },
      ],
    },
  ];

  for (const repData of reputations) {
    const exists = await repRepo.findOne({ where: { id: repData.id } });
    if (exists) {
      console.log(`  ○ Reputation already exists: ${repData.userId.split('-').pop()}`);
    } else {
      await repRepo.save(repRepo.create(repData as any));
      console.log(
        `  ✓ Reputation: ${repData.userId.split('-').pop()} (score: ${repData.overallScore})`
      );
    }
  }
}

async function seedOrganizationShips(): Promise<void> {
  // ─── 12. Organization Ships ───────────────────────────────────────────────
  console.log('\n─── Seeding Organization Ships ───');
  const orgShipRepo = AppDataSource.getRepository(OrganizationShip);
  const _shipRepo = AppDataSource.getRepository(Ship);

  const orgShipDefs = [
    {
      id: ORG_SHIP_IDS.fleetIdris,
      shipName: 'Idris-M',
      customName: 'SEF Vengeance',
      organizationId: ORG_IDS.fleet,
      role: OrgShipRole.COMMAND,
      status: ShipOwnershipStatus.OWNED,
      condition: ShipCondition.EXCELLENT,
      sharingLevel: ShipSharingLevel.ORGANIZATION,
      assignedCaptain: USER_IDS.admiral,
      location: 'Port Olisar',
      homeBase: 'Port Olisar',
      isCapital: true,
      flightHours: 1240,
      missionsCompleted: 87,
      notes: 'Flagship of the Stardust Expeditionary Fleet',
    },
    {
      id: ORG_SHIP_IDS.fleetJavelin,
      shipName: 'Javelin',
      customName: 'SEF Sovereign',
      organizationId: ORG_IDS.fleet,
      role: OrgShipRole.COMMAND,
      status: ShipOwnershipStatus.OWNED,
      condition: ShipCondition.GOOD,
      sharingLevel: ShipSharingLevel.ORGANIZATION,
      assignedCaptain: USER_IDS.commander,
      location: 'Everus Harbor',
      homeBase: 'Everus Harbor',
      isCapital: true,
      requiresPermission: true,
      flightHours: 890,
      missionsCompleted: 45,
      notes: 'Reserve capital ship — requires Fleet Commander authorization',
    },
    {
      id: ORG_SHIP_IDS.fleetHammerhead,
      shipName: 'Hammerhead',
      customName: 'Iron Curtain',
      organizationId: ORG_IDS.fleet,
      role: OrgShipRole.COMBAT,
      status: ShipOwnershipStatus.OWNED,
      condition: ShipCondition.GOOD,
      sharingLevel: ShipSharingLevel.ORGANIZATION,
      location: 'Port Olisar',
      homeBase: 'Port Olisar',
      isCapital: false,
      flightHours: 560,
      missionsCompleted: 34,
    },
    {
      id: ORG_SHIP_IDS.miningOrion,
      shipName: 'Orion',
      customName: 'Deep Core Alpha',
      organizationId: ORG_IDS.mining,
      role: OrgShipRole.MINING,
      status: ShipOwnershipStatus.OWNED,
      condition: ShipCondition.EXCELLENT,
      sharingLevel: ShipSharingLevel.ORGANIZATION,
      assignedCaptain: USER_IDS.miner,
      location: 'ARC-L1',
      homeBase: 'ARC-L1',
      isCapital: true,
      flightHours: 2100,
      missionsCompleted: 210,
      notes: 'Primary deep-space mining platform',
    },
    {
      id: ORG_SHIP_IDS.miningMole,
      shipName: 'MOLE',
      customName: 'Rockjaw',
      organizationId: ORG_IDS.mining,
      role: OrgShipRole.MINING,
      status: ShipOwnershipStatus.OWNED,
      condition: ShipCondition.FAIR,
      sharingLevel: ShipSharingLevel.ORGANIZATION,
      location: 'Lyria',
      homeBase: 'ARC-L1',
      flightHours: 3400,
      missionsCompleted: 480,
    },
    {
      id: ORG_SHIP_IDS.tradingBMM,
      shipName: 'Merchantman',
      customName: 'Golden Passage',
      organizationId: ORG_IDS.trading,
      role: OrgShipRole.TRANSPORT,
      status: ShipOwnershipStatus.OWNED,
      condition: ShipCondition.PRISTINE,
      sharingLevel: ShipSharingLevel.ORGANIZATION,
      assignedCaptain: USER_IDS.trader,
      location: 'Area18',
      homeBase: 'Area18',
      isCapital: true,
      flightHours: 780,
      missionsCompleted: 120,
      notes: 'Primary bazaar vessel for Quantum Trade Network',
    },
    {
      id: ORG_SHIP_IDS.tradingHull,
      shipName: 'Hull C',
      customName: 'Silk Runner',
      organizationId: ORG_IDS.trading,
      role: OrgShipRole.LOGISTICS,
      status: ShipOwnershipStatus.OWNED,
      condition: ShipCondition.GOOD,
      sharingLevel: ShipSharingLevel.ORGANIZATION,
      location: 'Lorville',
      homeBase: 'Area18',
      flightHours: 1500,
      missionsCompleted: 340,
    },
    {
      id: ORG_SHIP_IDS.mercRetaliator,
      shipName: 'Retaliator Bomber',
      customName: "Hades' Wrath",
      organizationId: ORG_IDS.mercenary,
      role: OrgShipRole.COMBAT,
      status: ShipOwnershipStatus.OWNED,
      condition: ShipCondition.GOOD,
      sharingLevel: ShipSharingLevel.ORGANIZATION,
      location: 'GrimHEX',
      homeBase: 'GrimHEX',
      flightHours: 920,
      missionsCompleted: 65,
    },
  ];

  for (const osData of orgShipDefs) {
    const exists = await orgShipRepo.findOne({ where: { id: osData.id } });
    if (exists) {
      console.log(`  ○ OrgShip already exists: ${osData.customName || osData.shipName}`);
    } else {
      // Look up catalog ship ID
      const catalogShipId = await findShipId(osData.shipName);
      await orgShipRepo.save(
        orgShipRepo.create({
          ...osData,
          shipId: catalogShipId || osData.id,
          isAvailable: true,
          isActive: true,
        } as any)
      );
      console.log(
        `  ✓ OrgShip: ${osData.customName || osData.shipName} (${osData.organizationId.slice(-1)})`
      );
    }
  }
}

async function seedBounties(): Promise<void> {
  // ─── 13. Bounties ─────────────────────────────────────────────────────────
  console.log('\n─── Seeding Bounties ───');
  const bountyRepo = AppDataSource.getRepository(Bounty);
  const bounties = [
    {
      id: BOUNTY_IDS.pirateLord,
      organizationId: ORG_IDS.mercenary,
      createdBy: USER_UUIDS.commander,
      createdByName: 'Commander Nova',
      title: 'Eliminate "Scar" Kowalski — Crimson Syndicate Pirate Lord',
      description:
        'The pirate lord known as "Scar" Kowalski has been terrorizing trade routes in the Crusader sector. Multiple cargo ships lost. Eliminate with extreme prejudice. Last seen near Yela.',
      bountyType: 'kill',
      targetType: 'player',
      targetName: '"Scar" Kowalski',
      targetIdentifier: 'ScarKowalski_SC',
      targetDetails: {
        faction: 'Crimson Syndicate',
        shipType: 'Cutlass Black',
        crimeRating: 5,
        lastKnownLocation: 'Yela asteroid belt',
      },
      rewardType: 'credits',
      rewardAmount: 250000,
      status: 'active',
      difficulty: 'expert',
      location: 'Crusader — Yela Asteroid Belt',
      systemLocation: 'Stanton',
      visibility: 'public',
      tags: ['priority', 'pirate', 'crusader', 'combat'],
      expiresAt: daysFromNow(14),
    },
    {
      id: BOUNTY_IDS.cargoThief,
      organizationId: ORG_IDS.trading,
      createdBy: USER_UUIDS.trader,
      createdByName: 'Silkroad Sam',
      title: 'Recover Stolen Laranite Shipment',
      description:
        'A Caterpillar loaded with 576 SCU of Laranite was hijacked near CRU-L5. Track the cargo and either recover it or capture the thief. Evidence required for full payout.',
      bountyType: 'capture',
      targetType: 'ship',
      targetName: 'Modified Caterpillar "Ghost Cat"',
      targetDetails: {
        cargoType: 'Laranite',
        cargoSCU: 576,
        estimatedValue: 480000,
        lastPing: 'CRU-L5',
      },
      rewardType: 'credits',
      rewardAmount: 150000,
      rewardDescription: 'Full payout for cargo recovery. 75k for capture only.',
      status: 'in_progress',
      difficulty: 'hard',
      location: 'CRU-L5 vicinity',
      systemLocation: 'Stanton',
      claimedBy: USER_UUIDS.bountyHunter,
      claimedByName: 'Shadowfang',
      claimedAt: daysAgo(2),
      visibility: 'organization',
      tags: ['cargo', 'recovery', 'trading'],
      expiresAt: daysFromNow(7),
    },
    {
      id: BOUNTY_IDS.intelGather,
      organizationId: ORG_IDS.intel,
      createdBy: USER_UUIDS.explorer,
      createdByName: 'Star Walker Zhi',
      title: 'Gather Intelligence on Crimson Syndicate Hideout',
      description:
        'We need eyes on the suspected Crimson Syndicate base near Grim HEX. Fly recon, scan ships, photograph defenses. Do NOT engage. Stealth required.',
      bountyType: 'intel',
      targetType: 'location',
      targetName: 'Grim HEX Perimeter',
      targetDetails: {
        requiredScans: 5,
        minPhotos: 10,
        dangerZone: true,
        requiredShipType: 'stealth-capable',
      },
      rewardType: 'reputation',
      rewardAmount: 50,
      rewardDescription: '+50 Intel reputation + 30,000 aUEC bonus upon verification',
      status: 'active',
      difficulty: 'hard',
      location: 'Grim HEX perimeter',
      systemLocation: 'Stanton',
      visibility: 'private',
      tags: ['intel', 'stealth', 'recon', 'classified'],
      expiresAt: daysFromNow(10),
    },
    {
      id: BOUNTY_IDS.rescuePilot,
      organizationId: ORG_IDS.fleet,
      createdBy: USER_UUIDS.medic,
      createdByName: 'Doc Valentina',
      title: 'Rescue Stranded Pilot at Microtech',
      description:
        'One of our pilots ejected during a training accident near MIC-L1. Ship is disabled. Pilot has limited oxygen. Medical evacuation required ASAP. Bring a medical-capable ship.',
      bountyType: 'rescue',
      targetType: 'player',
      targetName: 'Pilot Rookie_010',
      targetDetails: {
        oxygenRemaining: '6 hours',
        injuryLevel: 'moderate',
        coordinates: 'MIC-L1 sector 7',
      },
      rewardType: 'mixed',
      rewardAmount: 20000,
      rewardDescription: '20,000 aUEC + combat medic reputation boost',
      status: 'completed',
      difficulty: 'medium',
      location: 'MIC-L1, Microtech',
      systemLocation: 'Stanton',
      claimedBy: USER_UUIDS.medic,
      claimedByName: 'Doc Valentina',
      claimedAt: daysAgo(5),
      completedAt: daysAgo(5),
      verifiedBy: USER_UUIDS.commander,
      verifiedAt: daysAgo(4),
      visibility: 'organization',
      tags: ['rescue', 'medical', 'urgent'],
    },
    {
      id: BOUNTY_IDS.vanduulAce,
      organizationId: ORG_IDS.fleet,
      createdBy: USER_UUIDS.admiral,
      createdByName: 'Admiral Chen Wei',
      title: 'Vanduul Ace Hunt — Operation Talon',
      description:
        'A Vanduul ace pilot, designation "Talon-7", has been stalking convoys in the outer reaches of Stanton. Coordinated strike authorized. Wing formation recommended.',
      bountyType: 'kill',
      targetType: 'npc',
      targetName: 'Vanduul Ace "Talon-7"',
      targetDetails: {
        shipType: 'Vanduul Blade',
        threatLevel: 'extreme',
        escortCount: 3,
        requiredSquadSize: 4,
      },
      rewardType: 'mixed',
      rewardAmount: 500000,
      rewardDescription: '500,000 aUEC + "Vanduul Hunter" achievement',
      status: 'active',
      difficulty: 'expert',
      location: 'Outer Stanton — near jump point',
      systemLocation: 'Stanton',
      visibility: 'alliance',
      tags: ['vanduul', 'combat', 'high-priority', 'squad'],
      expiresAt: daysFromNow(30),
    },
  ];

  for (const bData of bounties) {
    const exists = await bountyRepo.findOne({ where: { id: bData.id } });
    if (exists) {
      console.log(`  ○ Bounty already exists: ${bData.title.substring(0, 50)}...`);
    } else {
      await bountyRepo.save(bountyRepo.create(bData as any));
      console.log(`  ✓ Bounty: ${bData.title.substring(0, 50)}...`);
    }
  }
}

async function seedBountyClaims(): Promise<void> {
  // ─── 14. Bounty Claims ────────────────────────────────────────────────────
  console.log('\n─── Seeding Bounty Claims ───');
  const claimRepo = AppDataSource.getRepository(BountyClaim);
  const CLAIM_IDS = {
    hunterCargo: '81000000-0000-4000-a000-000000000001',
    medicRescue: '81000000-0000-4000-a000-000000000002',
  };
  const bountyClaims = [
    {
      id: CLAIM_IDS.hunterCargo,
      bountyId: BOUNTY_IDS.cargoThief,
      hunterId: USER_UUIDS.bountyHunter,
      hunterName: 'Shadowfang',
      organizationId: ORG_IDS.mercenary,
      status: 'active',
      notes: 'Tracking Ghost Cat transponder signature near CRU-L5. Moving to intercept.',
      claimedAt: daysAgo(2),
    },
    {
      id: CLAIM_IDS.medicRescue,
      bountyId: BOUNTY_IDS.rescuePilot,
      hunterId: USER_UUIDS.medic,
      hunterName: 'Doc Valentina',
      organizationId: ORG_IDS.fleet,
      status: 'completed',
      notes: 'Pilot recovered. Treated for minor decompression injuries. Full recovery expected.',
      claimedAt: daysAgo(5),
      submittedAt: daysAgo(5),
      completedAt: daysAgo(5),
    },
  ];

  for (const bcData of bountyClaims) {
    const exists = await claimRepo.findOne({ where: { id: bcData.id } });
    if (exists) {
      console.log(`  ○ BountyClaim already exists`);
    } else {
      await claimRepo.save(claimRepo.create(bcData as any));
      console.log(`  ✓ BountyClaim: ${bcData.hunterName} → ${bcData.bountyId.split('-').pop()}`);
    }
  }
}

async function seedHunterProfiles(): Promise<void> {
  // ─── 15. Hunter Profiles ──────────────────────────────────────────────────
  console.log('\n─── Seeding Hunter Profiles ───');
  const hunterRepo = AppDataSource.getRepository(HunterProfile);
  const HUNTER_IDS = {
    shadowfang: '82000000-0000-4000-a000-000000000001',
    commander: '82000000-0000-4000-a000-000000000002',
  };
  const hunterProfiles = [
    {
      id: HUNTER_IDS.shadowfang,
      userId: USER_UUIDS.bountyHunter,
      userName: 'Shadowfang',
      organizationId: ORG_IDS.mercenary,
      totalBountiesCompleted: 214,
      totalBountiesClaimed: 230,
      totalBountiesAbandoned: 8,
      totalBountiesRejected: 2,
      totalRewardsEarned: 12500000,
      successRate: 93.04,
      averageCompletionTimeMinutes: 180,
      rank: 'elite',
      reputationScore: 870,
      killBountiesCompleted: 142,
      captureBountiesCompleted: 38,
      intelBountiesCompleted: 18,
      transportBountiesCompleted: 6,
      rescueBountiesCompleted: 4,
      customBountiesCompleted: 6,
      lastBountyCompletedAt: daysAgo(3),
      currentStreak: 12,
      longestStreak: 34,
    },
    {
      id: HUNTER_IDS.commander,
      userId: USER_UUIDS.commander,
      userName: 'Commander Nova',
      organizationId: ORG_IDS.fleet,
      totalBountiesCompleted: 45,
      totalBountiesClaimed: 50,
      totalBountiesAbandoned: 3,
      totalBountiesRejected: 0,
      totalRewardsEarned: 3200000,
      successRate: 90,
      averageCompletionTimeMinutes: 240,
      rank: 'veteran',
      reputationScore: 650,
      killBountiesCompleted: 30,
      captureBountiesCompleted: 8,
      intelBountiesCompleted: 5,
      rescueBountiesCompleted: 2,
      lastBountyCompletedAt: daysAgo(14),
      currentStreak: 3,
      longestStreak: 11,
    },
  ];

  for (const hpData of hunterProfiles) {
    const exists = await hunterRepo.findOne({ where: { id: hpData.id } });
    if (exists) {
      console.log(`  ○ HunterProfile already exists: ${hpData.userName}`);
    } else {
      await hunterRepo.save(hunterRepo.create(hpData as any));
      console.log(`  ✓ HunterProfile: ${hpData.userName} [${hpData.rank}]`);
    }
  }
}

async function seedIntelEntries(): Promise<void> {
  // ─── 16. Intel Entries ─────────────────────────────────────────────────────
  console.log('\n─── Seeding Intel Entries ───');
  const intelRepo = AppDataSource.getRepository(IntelEntry);
  const INTEL_IDS = {
    syndicateBase: 'demo-intel-syndicate-base',
    vanduulMovement: 'demo-intel-vanduul-movement',
    tradeDisruption: 'demo-intel-trade-disruption',
    allianceComms: 'demo-intel-alliance-comms',
    miningClaim: 'demo-intel-mining-claim',
  };
  const intelEntries = [
    {
      id: INTEL_IDS.syndicateBase,
      organizationId: ORG_IDS.intel,
      title: 'Crimson Syndicate Forward Operating Base — Confirmed',
      content:
        "Reconnaissance confirms a Crimson Syndicate FOB in the shadow of Yela's third asteroid cluster. Facility includes: 2x landing pads (Cutlass-class), fuel depot, communications array. Estimated garrison: 12-15 hostiles. Defensive perimeter includes 2 automated turret emplacements. Recommend surgical strike at 0300 UTC for minimal resistance.",
      classification: 'secret',
      category: 'strategic',
      tags: ['syndicate', 'base', 'confirmed', 'high-priority'],
      location: 'Yela Asteroid Belt, Cluster 3',
      eventDate: daysAgo(3),
      createdBy: USER_IDS.explorer,
      isArchived: false,
      autoDeclassify: true,
      declassificationDate: daysFromNow(90),
      reviewIntervalDays: 30,
      metadata: {
        sourceReliability: 'A',
        informationConfidence: '1',
        handlerNotes: 'Multiple sorties confirm layout',
      },
    },
    {
      id: INTEL_IDS.vanduulMovement,
      organizationId: ORG_IDS.fleet,
      title: 'Vanduul Scout Formation — Stanton Perimeter',
      content:
        'Long-range scanners detected a Vanduul scout formation of 3 Blades and 1 Hunter at the outer edge of Stanton. Formation is consistent with pre-raid reconnaissance patterns. Alert all combat-rated personnel. Keep scanning stations manned 24/7 until formation exits the system.',
      classification: 'top_secret',
      category: 'tactical',
      tags: ['vanduul', 'threat', 'immediate', 'stanton'],
      location: 'Stanton System — Outer Perimeter',
      eventDate: daysAgo(1),
      createdBy: USER_IDS.commander,
      isArchived: false,
      autoDeclassify: false,
      reviewIntervalDays: 7,
      metadata: { sourceReliability: 'B', informationConfidence: '2', threatLevel: 'critical' },
    },
    {
      id: INTEL_IDS.tradeDisruption,
      organizationId: ORG_IDS.trading,
      title: 'Trade Route Disruption — Lorville to Area18',
      content:
        'Increased pirate activity has been reported along the Lorville–Area18 corridor. Three cargo haulers intercepted in the past week. Recommend temporary route diversion via HUR-L2 waypoint. Additional escort recommended for high-value shipments exceeding 200 SCU.',
      classification: 'restricted',
      category: 'economic',
      tags: ['trade', 'pirate', 'route', 'advisory'],
      location: 'Lorville–Area18 Corridor',
      eventDate: daysAgo(2),
      createdBy: USER_IDS.trader,
      isArchived: false,
      metadata: {
        lossEstimate: '1.2M aUEC',
        affectedRoutes: ['Lorville-Area18', 'Lorville-HUR-L2-Area18'],
      },
    },
    {
      id: INTEL_IDS.allianceComms,
      organizationId: ORG_IDS.fleet,
      title: 'Alliance Communication Intercept — Pyro Gate',
      content:
        'Intercepted encrypted communications suggest an unknown organization is planning to contest the Pyro jump point when the gate opens. Content could not be fully decrypted but key phrases include "first strike", "resource claim", and "blockade formation". Further cryptoanalysis in progress.',
      classification: 'confidential',
      category: 'alliance',
      tags: ['pyro', 'communications', 'encrypted', 'analysis'],
      location: 'Stanton–Pyro Jump Point',
      eventDate: daysAgo(5),
      createdBy: USER_IDS.diplomat,
      isArchived: false,
      metadata: { decryptionProgress: 0.45, estimatedCompletion: daysFromNow(3).toISOString() },
    },
    {
      id: INTEL_IDS.miningClaim,
      organizationId: ORG_IDS.mining,
      title: 'High-Yield Quantanium Deposit — Aaron Halo',
      content:
        'Survey drone detected an exceptional Quantanium deposit in the Aaron Halo belt at coordinates AH-7742. Estimated yield: 4,200 SCU of refined Quantanium. Area is currently uncontested but expect claim jumpers within 72 hours of first extraction. Recommend immediate deployment of mining fleet with escort.',
      classification: 'restricted',
      category: 'economic',
      tags: ['mining', 'quantanium', 'high-value', 'time-sensitive'],
      location: 'Aaron Halo Belt — AH-7742',
      eventDate: daysAgo(1),
      createdBy: USER_IDS.miner,
      isArchived: false,
      metadata: { estimatedValueAUEC: 8400000, requiredShips: ['Orion', 'MOLE x2', 'Escort x2'] },
    },
  ];

  for (const iData of intelEntries) {
    const exists = await intelRepo.findOne({ where: { id: iData.id } });
    if (exists) {
      console.log(`  ○ Intel already exists: ${iData.title.substring(0, 50)}...`);
    } else {
      await intelRepo.save(intelRepo.create(iData as any));
      console.log(`  ✓ Intel: ${iData.title.substring(0, 50)}...`);
    }
  }
}

async function seedWikiPages(): Promise<void> {
  // ─── 17. Wiki Pages ───────────────────────────────────────────────────────
  console.log('\n─── Seeding Wiki Pages ───');
  const wikiRepo = AppDataSource.getRepository(WikiPage);
  const wikiPages = [
    {
      id: WIKI_IDS.gettingStarted,
      organizationId: ORG_IDS.fleet,
      title: 'Getting Started',
      slug: 'getting-started',
      content: `# Welcome to Stardust Expeditionary Fleet\n\n## First Steps\n1. **Join Discord** — Our primary communication channel. Link your account in Settings.\n2. **Register your ships** — Go to My Ships and add your fleet.\n3. **Introduce yourself** — Post in #introductions on Discord.\n4. **Attend a training op** — Check the Activities tab for upcoming training sessions.\n\n## Ranks & Promotions\n- **Recruit** → Complete 3 training missions\n- **Member** → 30 days active + 10 operations\n- **Officer** → Nomination by existing officers\n- **Commander** → Fleet Commander appointment\n\n## Rules\n1. Respect all members\n2. No griefing or piracy against allies\n3. Attend at least 2 operations per month\n4. Use push-to-talk in fleet comms`,
      sortOrder: 1,
      tags: ['guide', 'new-member', 'rules'],
      version: 2,
      createdBy: USER_UUIDS.admiral,
      lastEditedBy: USER_UUIDS.commander,
    },
    {
      id: WIKI_IDS.shipGuide,
      organizationId: ORG_IDS.fleet,
      title: 'Ship Classification Guide',
      slug: 'ship-classification',
      content: `# Ship Classifications\n\n## Combat Ships\n| Class | Examples | Role |\n|-------|----------|------|\n| Fighter | Gladius, Arrow, Sabre | Dogfighting, escort |\n| Heavy Fighter | Vanguard, Hurricane | Anti-capital, assault |\n| Bomber | Retaliator, Eclipse | Strike missions |\n| Gunship | Hammerhead, Redeemer | Anti-fighter screen |\n\n## Capital Ships\n| Class | Examples | Role |\n|-------|----------|------|\n| Frigate | Idris-M, Idris-P | Fleet command |\n| Destroyer | Javelin | System control |\n\n## Support Ships\n| Class | Examples | Role |\n|-------|----------|------|\n| Medical | Cutlass Red, Apollo | Search & rescue |\n| Repair | Vulcan, Crucible | Field repair |\n| Refuel | Starfarer | Extended ops |\n\n## Multicrew Requirements\nAll ships with crew > 2 require a registered crew assignment before deployment.`,
      sortOrder: 2,
      tags: ['ships', 'classification', 'reference'],
      version: 3,
      createdBy: USER_UUIDS.commander,
      lastEditedBy: USER_UUIDS.engineer,
    },
    {
      id: WIKI_IDS.miningOps,
      organizationId: ORG_IDS.mining,
      title: 'Mining Operations Handbook',
      slug: 'mining-ops-handbook',
      content: `# Deep Core Mining Handbook\n\n## Safety Protocols\n1. Always file a mining plan before departure\n2. Escort required for Quantanium operations\n3. Emergency beacon must be active at all times\n4. Maximum 80% cargo load for Quantanium (explosion risk)\n\n## Mineral Value Guide\n| Mineral | Value/SCU | Risk Level | Best Location |\n|---------|-----------|------------|---------------|\n| Quantanium | 88 aUEC | EXTREME | Aaron Halo |\n| Bexalite | 44.9 aUEC | HIGH | Aberdeen |\n| Taranite | 34.8 aUEC | MEDIUM | Daymar |\n| Laranite | 27.5 aUEC | LOW | Multiple |\n\n## Fleet Mining Procedure\n1. Scout sends ahead for deposits\n2. MOLE operators position on rock\n3. Orion handles large deposits\n4. Haulers shuttle refined material to station\n5. Escort maintains perimeter security`,
      sortOrder: 1,
      tags: ['mining', 'handbook', 'safety', 'procedures'],
      version: 4,
      createdBy: USER_UUIDS.miner,
      lastEditedBy: USER_UUIDS.miner,
    },
    {
      id: WIKI_IDS.combatTactics,
      organizationId: ORG_IDS.fleet,
      title: 'Combat Tactics & Formations',
      slug: 'combat-tactics',
      content: `# Combat Tactics Manual\n\n## Standard Formations\n### Arrow Formation\n- Lead + 2 wingmen in V shape\n- Best for: Patrol, escort\n- Spacing: 500m between ships\n\n### Wall Formation\n- Side-by-side line abreast\n- Best for: Area denial, blockade\n- Spacing: 300m between ships\n\n### Diamond Formation\n- Lead, 2 flanks, rear guard\n- Best for: VIP escort, capital ship defense\n- Spacing: 400m between ships\n\n## Engagement Rules\n1. **Green** — Weapons cold, scan only\n2. **Yellow** — Weapons hot, do not fire unless fired upon\n3. **Red** — Weapons free, engage all hostiles\n\n## Comms Protocol\n- Channel 1: Fleet command\n- Channel 2: Wing-to-wing\n- Channel 3: Emergency only`,
      sortOrder: 3,
      tags: ['combat', 'tactics', 'formations', 'military'],
      version: 2,
      createdBy: USER_UUIDS.commander,
      lastEditedBy: USER_UUIDS.admiral,
    },
    {
      id: WIKI_IDS.tradingRoutes,
      organizationId: ORG_IDS.trading,
      title: 'Approved Trading Routes',
      slug: 'trading-routes',
      content: `# Quantum Trade Network — Approved Routes\n\n## Tier 1 (Low Risk, Steady Profit)\n- **Lorville → Area18** — Agricultural supplies. 12% margin.\n- **New Babbage → Lorville** — Medical supplies. 15% margin.\n\n## Tier 2 (Medium Risk, Good Profit)\n- **Area18 → GrimHEX** — Black market goods. 25% margin. Escort recommended.\n- **HUR-L2 → MIC-L1** — Processed minerals. 20% margin.\n\n## Tier 3 (High Risk, Maximum Profit)\n- **Aaron Halo → Lorville** — Quantanium. 40%+ margin. MUST have escort.\n- **Pyro (future)** — TBD. Extreme risk.\n\n## Convoy Procedures\n1. File route plan 24h in advance\n2. Minimum 2 escorts for Tier 2+\n3. Use quantum-snare countermeasures\n4. Stagger departure times to avoid ambush`,
      sortOrder: 1,
      tags: ['trading', 'routes', 'guide', 'economy'],
      version: 5,
      createdBy: USER_UUIDS.trader,
      lastEditedBy: USER_UUIDS.trader,
    },
    {
      id: WIKI_IDS.orgRules,
      organizationId: ORG_IDS.fleet,
      title: 'Organization Rules & Code of Conduct',
      slug: 'rules-code-of-conduct',
      content: `# Code of Conduct\n\n## Core Values\n- **Honor** — We fight fair and keep our word\n- **Duty** — We show up for our teammates\n- **Stars** — We push the frontier together\n\n## Prohibited Behavior\n- Griefing allied organizations\n- Piracy against neutral parties without authorization\n- Sharing classified intel outside the org\n- Toxic behavior in comms\n- Multi-org conflicts of interest without disclosure\n\n## Disciplinary Process\n1. **Warning** — First offense, documented\n2. **Suspension** — 7-day access restriction\n3. **Demotion** — Rank reduction\n4. **Expulsion** — Permanent removal\n\n## Appeals\nSubmit a support ticket under the HR category within 48 hours.`,
      sortOrder: 0,
      tags: ['rules', 'conduct', 'policy', 'important'],
      version: 3,
      createdBy: USER_UUIDS.admiral,
      lastEditedBy: USER_UUIDS.diplomat,
      isLocked: true,
    },
  ];

  for (const wpData of wikiPages) {
    const exists = await wikiRepo.findOne({ where: { id: wpData.id } });
    if (exists) {
      console.log(`  ○ WikiPage already exists: ${wpData.title}`);
    } else {
      await wikiRepo.save(wikiRepo.create(wpData as any));
      console.log(`  ✓ WikiPage: ${wpData.title}`);
    }
  }
}

async function seedWikiPageRevisions(): Promise<void> {
  // ─── 18. Wiki Page Revisions ──────────────────────────────────────────────
  console.log('\n─── Seeding Wiki Page Revisions ───');
  const wikiRevRepo = AppDataSource.getRepository(WikiPageRevision);
  const WIKI_REV_IDS = {
    gettingStartedV1: '91000000-0000-4000-a000-000000000001',
    shipGuideV1: '91000000-0000-4000-a000-000000000002',
    shipGuideV2: '91000000-0000-4000-a000-000000000003',
    miningOpsV1: '91000000-0000-4000-a000-000000000004',
  };
  const wikiRevisions = [
    {
      id: WIKI_REV_IDS.gettingStartedV1,
      pageId: WIKI_IDS.gettingStarted,
      content: '# Welcome\n\nWelcome to the org! More info coming soon.',
      editedBy: USER_UUIDS.admiral,
      changeDescription: 'Initial page creation',
      version: 1,
    },
    {
      id: WIKI_REV_IDS.shipGuideV1,
      pageId: WIKI_IDS.shipGuide,
      content: '# Ships\n\n## Fighters\n- Gladius\n- Arrow\n\n## Capital\n- Idris',
      editedBy: USER_UUIDS.commander,
      changeDescription: 'Initial ship classification',
      version: 1,
    },
    {
      id: WIKI_REV_IDS.shipGuideV2,
      pageId: WIKI_IDS.shipGuide,
      content:
        '# Ship Classifications\n\n## Combat\n| Ship | Role |\n|------|------|\n| Gladius | Fighter |\n| Arrow | Light Fighter |\n| Sabre | Stealth Fighter |\n\n## Capital\n- Idris-M\n- Javelin',
      editedBy: USER_UUIDS.engineer,
      changeDescription: 'Added table format and more ships',
      version: 2,
    },
    {
      id: WIKI_REV_IDS.miningOpsV1,
      pageId: WIKI_IDS.miningOps,
      content: '# Mining\n\nBasic mining guide. Use Prospector or MOLE.',
      editedBy: USER_UUIDS.miner,
      changeDescription: 'Initial mining handbook draft',
      version: 1,
    },
  ];

  for (const wrData of wikiRevisions) {
    const exists = await wikiRevRepo.findOne({ where: { id: wrData.id } });
    if (exists) {
      console.log(`  ○ WikiRevision already exists`);
    } else {
      await wikiRevRepo.save(wikiRevRepo.create(wrData as any));
      console.log(`  ✓ WikiRevision: page=${wrData.pageId.split('-').pop()} v${wrData.version}`);
    }
  }
}

async function seedMissions(): Promise<void> {
  // ─── 19. Missions ─────────────────────────────────────────────────────────
  console.log('\n─── Seeding Missions ───');
  const missionRepo = AppDataSource.getRepository(Mission);
  const missions = [
    {
      id: MISSION_IDS.patrolCrusader,
      organizationId: ORG_IDS.fleet,
      title: 'Patrol Crusader — Sector 7',
      description:
        'Standard patrol sweep of Crusader sector 7. Check known pirate waypoints, scan for unauthorized vessels, and report any Vanduul activity. Maintain formation discipline.',
      missionType: 'combat',
      status: 'in_progress',
      difficulty: 'medium',
      priority: 'high',
      createdBy: USER_IDS.commander,
      assignedTo: USER_IDS.admiral,
      fleetId: FLEET_IDS.alpha,
      location: 'Crusader — Sector 7',
      objectives: [
        { id: 'obj-1', description: 'Scan waypoints Alpha through Delta', completed: true },
        { id: 'obj-2', description: 'Investigate anomaly at waypoint Charlie', completed: false },
        { id: 'obj-3', description: 'Report findings to fleet command', completed: false },
      ],
      participants: [
        { userId: USER_IDS.admiral, role: 'commander', status: 'active' },
        { userId: USER_IDS.commander, role: 'wing_lead', status: 'active' },
        { userId: USER_IDS.bountyHunter, role: 'fighter', status: 'active' },
        { userId: USER_IDS.medic, role: 'medical', status: 'standby' },
      ],
      tags: ['patrol', 'combat', 'crusader'],
      reward: '50,000 aUEC + combat reputation',
      startDate: daysAgo(1),
      endDate: daysFromNow(1),
    },
    {
      id: MISSION_IDS.mineAaron,
      organizationId: ORG_IDS.mining,
      title: 'Operation Deep Strike — Aaron Halo Quantanium',
      description:
        'Deploy mining fleet to Aaron Halo Belt coordinate AH-7742 for a high-yield Quantanium extraction. Expected duration: 6 hours. Full escort required.',
      missionType: 'mining',
      status: 'planned',
      difficulty: 'hard',
      priority: 'critical',
      createdBy: USER_IDS.miner,
      location: 'Aaron Halo Belt — AH-7742',
      objectives: [
        { id: 'obj-1', description: 'Secure mining perimeter', completed: false },
        { id: 'obj-2', description: 'Extract minimum 2000 SCU Quantanium', completed: false },
        { id: 'obj-3', description: 'Transport refined material to ARC-L1', completed: false },
      ],
      participants: [
        { userId: USER_IDS.miner, role: 'mining_lead', status: 'confirmed' },
        { userId: USER_IDS.rookie, role: 'miner', status: 'confirmed' },
      ],
      tags: ['mining', 'quantanium', 'high-value'],
      reward: 'Profit share — estimated 4.2M aUEC total',
      startDate: daysFromNow(2),
      endDate: daysFromNow(2),
    },
    {
      id: MISSION_IDS.escortConvoy,
      organizationId: ORG_IDS.fleet,
      title: 'Convoy Escort — Silk Road Run',
      description:
        'Escort the Quantum Trade Network convoy from Lorville to Area18 via the safe corridor. High-value cargo. Expect pirate interdiction attempts.',
      missionType: 'escort',
      status: 'planned',
      difficulty: 'medium',
      priority: 'normal',
      createdBy: USER_IDS.admiral,
      fleetId: FLEET_IDS.trade,
      location: 'Lorville → Area18',
      objectives: [
        { id: 'obj-1', description: 'Rendezvous with convoy at Lorville', completed: false },
        { id: 'obj-2', description: 'Escort through HUR-L2 waypoint', completed: false },
        { id: 'obj-3', description: 'Deliver convoy safely to Area18', completed: false },
      ],
      participants: [
        { userId: USER_IDS.commander, role: 'escort_lead', status: 'confirmed' },
        { userId: USER_IDS.trader, role: 'convoy_lead', status: 'confirmed' },
        { userId: USER_IDS.bountyHunter, role: 'point_fighter', status: 'confirmed' },
      ],
      tags: ['escort', 'convoy', 'trading'],
      reward: '80,000 aUEC + trading reputation',
      startDate: daysFromNow(3),
      endDate: daysFromNow(3),
    },
    {
      id: MISSION_IDS.salvageReclaim,
      organizationId: ORG_IDS.fleet,
      title: 'Salvage Operation — Wreck of the Starbound',
      description:
        'A destroyed Caterpillar "Starbound" has been located near CRU-L4. Salvage all recoverable components and cargo. Area may contain hostile scavengers.',
      missionType: 'salvage',
      status: 'completed',
      difficulty: 'easy',
      priority: 'low',
      createdBy: USER_IDS.engineer,
      location: 'CRU-L4',
      objectives: [
        { id: 'obj-1', description: 'Locate wreck at CRU-L4', completed: true },
        { id: 'obj-2', description: 'Salvage components', completed: true },
        { id: 'obj-3', description: 'Return to Port Olisar', completed: true },
      ],
      participants: [
        { userId: USER_IDS.engineer, role: 'salvage_lead', status: 'completed' },
        { userId: USER_IDS.rookie, role: 'assistant', status: 'completed' },
      ],
      tags: ['salvage', 'low-risk', 'training'],
      reward: '25,000 aUEC in salvaged components',
      startDate: daysAgo(7),
      endDate: daysAgo(7),
      completedAt: daysAgo(7),
    },
    {
      id: MISSION_IDS.reconVanduul,
      organizationId: ORG_IDS.intel,
      title: 'Reconnaissance — Vanduul Staging Area',
      description:
        'Classified recon mission to observe suspected Vanduul staging area at the edge of Stanton. Stealth-capable ships only. No engagement under any circumstances.',
      missionType: 'reconnaissance',
      status: 'briefed',
      difficulty: 'extreme',
      priority: 'critical',
      createdBy: USER_IDS.admiral,
      location: 'Stanton Outer Perimeter — Sector 12',
      objectives: [
        { id: 'obj-1', description: 'Approach staging area undetected', completed: false },
        { id: 'obj-2', description: 'Scan all Vanduul ships in area', completed: false },
        { id: 'obj-3', description: 'Record 30 minutes of surveillance data', completed: false },
        { id: 'obj-4', description: 'Exfiltrate without detection', completed: false },
      ],
      participants: [
        { userId: USER_IDS.explorer, role: 'recon_lead', status: 'confirmed' },
        { userId: USER_IDS.diplomat, role: 'signals_analyst', status: 'confirmed' },
      ],
      tags: ['recon', 'vanduul', 'classified', 'stealth'],
      reward: 'Classified — reputation + bonus',
      startDate: daysFromNow(5),
      endDate: daysFromNow(5),
    },
  ];

  for (const mData of missions) {
    const exists = await missionRepo.findOne({ where: { id: mData.id } });
    if (exists) {
      console.log(`  ○ Mission already exists: ${mData.title.substring(0, 50)}...`);
    } else {
      await missionRepo.save(missionRepo.create(mData as any));
      console.log(`  ✓ Mission: ${mData.title.substring(0, 50)}...`);
    }
  }
}

async function seedOperations(): Promise<void> {
  // ─── 20. Operations ───────────────────────────────────────────────────────
  console.log('\n─── Seeding Operations ───');
  const opRepo = AppDataSource.getRepository(Operation);
  const OP_IDS = {
    ironShield: 'a1000000-0000-4000-a000-000000000001',
    goldRush: 'a1000000-0000-4000-a000-000000000002',
    silentWatch: 'a1000000-0000-4000-a000-000000000003',
  };
  const operations = [
    {
      id: OP_IDS.ironShield,
      organizationId: ORG_IDS.fleet,
      type: 'mission',
      name: 'Operation Iron Shield',
      description:
        'Full-scale defensive operation protecting Stardust assets from Crimson Syndicate aggression. All combat-rated personnel to battle stations.',
      status: 'in-progress',
      startDate: daysAgo(2),
      endDate: daysFromNow(5),
      participants: [
        USER_IDS.admiral,
        USER_IDS.commander,
        USER_IDS.bountyHunter,
        USER_IDS.medic,
        USER_IDS.engineer,
      ],
      createdBy: USER_IDS.admiral,
    },
    {
      id: OP_IDS.goldRush,
      organizationId: ORG_IDS.mining,
      type: 'mining',
      name: 'Operation Gold Rush',
      description:
        'Coordinated multi-fleet mining operation in Aaron Halo. Target: maximum Quantanium extraction over 48-hour window.',
      status: 'planned',
      startDate: daysFromNow(7),
      endDate: daysFromNow(9),
      participants: [USER_IDS.miner, USER_IDS.rookie, USER_IDS.trader],
      createdBy: USER_IDS.miner,
    },
    {
      id: OP_IDS.silentWatch,
      organizationId: ORG_IDS.intel,
      type: 'intel',
      name: 'Operation Silent Watch',
      description:
        'Long-term intelligence monitoring of Crimson Syndicate communications and movements. Duration: 30 days minimum.',
      status: 'in-progress',
      startDate: daysAgo(15),
      endDate: daysFromNow(15),
      participants: [USER_IDS.explorer, USER_IDS.diplomat],
      createdBy: USER_IDS.explorer,
    },
  ];

  for (const opData of operations) {
    const exists = await opRepo.findOne({ where: { id: opData.id } });
    if (exists) {
      console.log(`  ○ Operation already exists: ${opData.name}`);
    } else {
      await opRepo.save(opRepo.create(opData as any));
      console.log(`  ✓ Operation: ${opData.name}`);
    }
  }
}

async function seedMiningOperations(): Promise<void> {
  // ─── 21. Mining Operations ─────────────────────────────────────────────────
  console.log('\n─── Seeding Mining Operations ───');
  const miningOpRepo = AppDataSource.getRepository(MiningOperation);
  const MINING_OP_IDS = {
    lyriaSweep: 'demo-miningop-lyria-sweep',
    aaronHalo: 'demo-miningop-aaron-halo',
    daymarTraining: 'demo-miningop-daymar-training',
  };
  const miningOps = [
    {
      id: MINING_OP_IDS.lyriaSweep,
      name: 'Lyria Surface Sweep #47',
      description:
        'Standard surface mining operation on Lyria. Focus on Hadanite deposits in the northern hemisphere.',
      location: 'Lyria — Northern Hemisphere, Grid N-14',
      coordinatorId: USER_IDS.miner,
      scheduledDate: daysAgo(3),
      completedDate: daysAgo(3),
      status: 'completed',
      crew: [
        { userId: USER_IDS.miner, role: 'coordinator', ship: 'MOLE' },
        { userId: USER_IDS.rookie, role: 'miner', ship: 'Prospector' },
      ],
      resourcesFound: [
        { mineral: 'Hadanite', quantity: 128, unit: 'SCU', value: 12800 },
        { mineral: 'Aphorite', quantity: 34, unit: 'SCU', value: 3060 },
      ],
      totalValue: 15860,
      notes: 'Good yield. Rookie performed well on first MOLE operation.',
    },
    {
      id: MINING_OP_IDS.aaronHalo,
      name: 'Aaron Halo Deep Space Extraction',
      description:
        'Deep space Quantanium mining run in the Aaron Halo belt. High risk, high reward. Full escort deployed.',
      location: 'Aaron Halo Belt — Sector AH-7742',
      coordinatorId: USER_IDS.miner,
      scheduledDate: daysFromNow(2),
      status: 'planned',
      crew: [
        { userId: USER_IDS.miner, role: 'coordinator', ship: 'Orion' },
        { userId: USER_IDS.rookie, role: 'miner', ship: 'MOLE' },
        { userId: USER_IDS.commander, role: 'escort_lead', ship: 'Hammerhead' },
      ],
      resourcesFound: [],
      totalValue: 0,
      notes: 'Pending deployment. Estimated yield: 2000+ SCU Quantanium.',
    },
    {
      id: MINING_OP_IDS.daymarTraining,
      name: 'Daymar Training Run — New Pilots',
      description:
        'Training operation for new mining pilots. Low-risk surface mining on Daymar. Focus on proper scanning technique and laser management.',
      location: 'Daymar — Shubin Mining Facility vicinity',
      coordinatorId: USER_IDS.miner,
      scheduledDate: daysAgo(7),
      completedDate: daysAgo(7),
      status: 'completed',
      crew: [
        { userId: USER_IDS.miner, role: 'instructor', ship: 'MOLE' },
        { userId: USER_IDS.rookie, role: 'trainee', ship: 'Prospector' },
      ],
      resourcesFound: [
        { mineral: 'Taranite', quantity: 64, unit: 'SCU', value: 2227 },
        { mineral: 'Borase', quantity: 42, unit: 'SCU', value: 1470 },
      ],
      totalValue: 3697,
      notes: 'Training successful. Rookie cleared for solo Prospector operations.',
    },
  ];

  for (const moData of miningOps) {
    const exists = await miningOpRepo.findOne({ where: { id: moData.id } });
    if (exists) {
      console.log(`  ○ MiningOp already exists: ${moData.name}`);
    } else {
      await miningOpRepo.save(miningOpRepo.create(moData as any));
      console.log(`  ✓ MiningOp: ${moData.name}`);
    }
  }
}

async function seedTradingRoutes(): Promise<void> {
  // ─── 22. Trading Routes ────────────────────────────────────────────────────
  console.log('\n─── Seeding Trading Routes ───');
  const tradeRouteRepo = AppDataSource.getRepository(TradingRoute);
  const ROUTE_IDS = {
    silkRoad: 'demo-route-silk-road',
    quantaniumExpress: 'demo-route-quantanium-express',
    blackMarket: 'demo-route-black-market',
    medicalRun: 'demo-route-medical-run',
  };
  const tradingRoutes = [
    {
      id: ROUTE_IDS.silkRoad,
      name: 'Silk Road — Lorville to Area18',
      description:
        'The primary trade route for the Quantum Trade Network. Agricultural supplies outbound, refined metals inbound. Consistent profit with low risk.',
      creatorId: USER_IDS.trader,
      organizationId: ORG_IDS.trading,
      visibility: 'organization',
      stops: [
        {
          location: 'Lorville — CBD',
          type: 'buy',
          commodity: 'Agricultural Supplies',
          price: 1.2,
          quantity: 400,
        },
        { location: 'HUR-L2 — Faithful Dream', type: 'waypoint', notes: 'Safe refuel point' },
        {
          location: 'Area18 — TDD',
          type: 'sell',
          commodity: 'Agricultural Supplies',
          price: 1.62,
          quantity: 400,
        },
        { location: 'Area18 — TDD', type: 'buy', commodity: 'Titanium', price: 8, quantity: 200 },
        {
          location: 'Lorville — CBD',
          type: 'sell',
          commodity: 'Titanium',
          price: 9.2,
          quantity: 200,
        },
      ],
      estimatedProfit: 408000,
      estimatedDuration: 45,
      minCargoCapacity: 400,
      status: 'active',
      tags: ['safe', 'consistent', 'agricultural'],
      notes: 'Run this route 3x daily for optimal profit. Avoid during CrimeStat events.',
    },
    {
      id: ROUTE_IDS.quantaniumExpress,
      name: 'Quantanium Express — Aaron Halo to Lorville',
      description:
        'High-value, high-risk Quantanium transport. Mine in Aaron Halo, sell at Lorville. MANDATORY escort.',
      creatorId: USER_IDS.miner,
      organizationId: ORG_IDS.mining,
      visibility: 'organization',
      stops: [
        {
          location: 'Aaron Halo Belt',
          type: 'mine',
          commodity: 'Quantanium',
          notes: 'Mine and refine on-site',
        },
        { location: 'ARC-L1', type: 'waypoint', notes: 'Refinery processing' },
        {
          location: 'Lorville — CBD',
          type: 'sell',
          commodity: 'Quantanium (Refined)',
          price: 88,
          quantity: 200,
        },
      ],
      estimatedProfit: 1760000,
      estimatedDuration: 180,
      minCargoCapacity: 200,
      fleetComposition: { miners: 2, escorts: 2, haulers: 1 },
      status: 'active',
      tags: ['high-value', 'dangerous', 'quantanium', 'escort-required'],
    },
    {
      id: ROUTE_IDS.blackMarket,
      name: 'Shadow Circuit — GrimHEX Network',
      description:
        'Discreet trade route for high-margin goods through GrimHEX. Not for the faint of heart. Plausible deniability recommended.',
      creatorId: USER_IDS.smuggler,
      organizationId: ORG_IDS.syndicate,
      visibility: 'private',
      stops: [
        { location: 'GrimHEX', type: 'buy', commodity: 'Maze', price: 50, quantity: 50 },
        { location: 'CRU-L5', type: 'waypoint', notes: 'Scanner avoidance route' },
        {
          location: 'Area18 — Back Alley',
          type: 'sell',
          commodity: 'Maze',
          price: 92,
          quantity: 50,
        },
      ],
      estimatedProfit: 210000,
      estimatedDuration: 30,
      minCargoCapacity: 50,
      status: 'active',
      tags: ['black-market', 'stealth', 'high-margin'],
      notes: 'Never run with CrimeStat. Use Q-drive jammer countermeasures.',
    },
    {
      id: ROUTE_IDS.medicalRun,
      name: 'Mercy Run — New Babbage Medical Supply',
      description:
        'Medical supply distribution from New Babbage hospitals to frontier outposts. Low-profit but essential for org reputation.',
      creatorId: USER_IDS.medic,
      organizationId: ORG_IDS.fleet,
      visibility: 'public',
      stops: [
        {
          location: 'New Babbage — Medical Center',
          type: 'buy',
          commodity: 'Medical Supplies',
          price: 17,
          quantity: 100,
        },
        {
          location: 'MIC-L1',
          type: 'sell',
          commodity: 'Medical Supplies',
          price: 18.5,
          quantity: 50,
        },
        {
          location: 'Lorville — Hospital',
          type: 'sell',
          commodity: 'Medical Supplies',
          price: 19,
          quantity: 50,
        },
      ],
      estimatedProfit: 25000,
      estimatedDuration: 60,
      minCargoCapacity: 100,
      status: 'active',
      tags: ['medical', 'humanitarian', 'reputation'],
      notes: "Reputation boost for org. Good for new members' first trade run.",
    },
  ];

  for (const trData of tradingRoutes) {
    const exists = await tradeRouteRepo.findOne({ where: { id: trData.id } });
    if (exists) {
      console.log(`  ○ TradingRoute already exists: ${trData.name}`);
    } else {
      await tradeRouteRepo.save(tradeRouteRepo.create(trData as any));
      console.log(`  ✓ TradingRoute: ${trData.name}`);
    }
  }
}

async function seedTickets(): Promise<void> {
  // ─── 23. Tickets ──────────────────────────────────────────────────────────
  console.log('\n─── Seeding Tickets ───');
  const ticketRepo = AppDataSource.getRepository(Ticket);
  const tickets = [
    {
      id: TICKET_IDS.recruitIssue,
      organizationId: ORG_IDS.fleet,
      ticketNumber: 'TK-2025-001',
      subject: 'New Recruit Application — Delayed Processing',
      description:
        'I applied to join the Stardust Expeditionary Fleet 2 weeks ago but haven\'t received a response yet. My RSI handle is "NewPilot_2025" and I was referred by Commander Nova.',
      category: 'recruitment',
      priority: 'medium',
      status: 'in_progress',
      creatorId: USER_IDS.rookie,
      creatorName: 'Rookie McNewface',
      assigneeId: USER_IDS.commander,
      assigneeName: 'Commander Nova',
      assignmentHistory: [
        {
          assigneeId: USER_IDS.commander,
          assigneeName: 'Commander Nova',
          assignedAt: daysAgo(5).toISOString(),
          assignedBy: USER_IDS.admiral,
        },
      ],
      messages: [
        {
          senderId: USER_IDS.rookie,
          senderName: 'Rookie McNewface',
          content: 'Any update on my application?',
          timestamp: daysAgo(3).toISOString(),
        },
        {
          senderId: USER_IDS.commander,
          senderName: 'Commander Nova',
          content: "We're reviewing your application now. Expect a response within 48 hours.",
          timestamp: daysAgo(2).toISOString(),
        },
      ],
      tags: ['recruitment', 'pending'],
      firstResponseAt: daysAgo(2),
    },
    {
      id: TICKET_IDS.shipDispute,
      organizationId: ORG_IDS.fleet,
      ticketNumber: 'TK-2025-002',
      subject: 'Ship Assignment Dispute — Unauthorized Use',
      description:
        'My Cutlass Black "Night Razor" was used by another member without my permission during last Saturday\'s operation. Ship sustained hull damage. Requesting repair compensation and investigation.',
      category: 'general',
      priority: 'high',
      status: 'awaiting_response',
      creatorId: USER_IDS.bountyHunter,
      creatorName: 'Shadowfang',
      assigneeId: USER_IDS.admiral,
      assigneeName: 'Admiral Chen Wei',
      assignmentHistory: [
        {
          assigneeId: USER_IDS.admiral,
          assigneeName: 'Admiral Chen Wei',
          assignedAt: daysAgo(3).toISOString(),
          assignedBy: USER_IDS.admiral,
        },
      ],
      messages: [
        {
          senderId: USER_IDS.bountyHunter,
          senderName: 'Shadowfang',
          content:
            'Ship was taken from Port Olisar during Operation Iron Shield without my authorization. 15% hull damage.',
          timestamp: daysAgo(3).toISOString(),
        },
        {
          senderId: USER_IDS.admiral,
          senderName: 'Admiral Chen Wei',
          content:
            "I'm looking into this. Can you provide the exact time and the pilot's name if known?",
          timestamp: daysAgo(2).toISOString(),
        },
      ],
      tags: ['ship', 'dispute', 'damage'],
      firstResponseAt: daysAgo(2),
    },
    {
      id: TICKET_IDS.diplomaticRequest,
      organizationId: ORG_IDS.fleet,
      ticketNumber: 'TK-2025-003',
      subject: 'Diplomatic Channel Request — Orion Rising',
      description:
        'Request to establish formal diplomatic channels with the "Orion Rising" organization. They\'ve expressed interest in a mutual defense pact and trade agreement.',
      category: 'diplomacy',
      priority: 'medium',
      status: 'open',
      creatorId: USER_IDS.diplomat,
      creatorName: 'Ambassador Kai',
      tags: ['diplomacy', 'alliance', 'new-contact'],
    },
    {
      id: TICKET_IDS.bugReport,
      organizationId: ORG_IDS.fleet,
      ticketNumber: 'TK-2025-004',
      subject: 'Bug: Fleet Dashboard Not Loading Ship Count',
      description:
        'The fleet dashboard shows 0 ships even though Alpha Strike Wing has 10 ships assigned. Tried clearing cache and different browsers. Issue persists.',
      category: 'support',
      priority: 'high',
      status: 'resolved',
      creatorId: USER_IDS.engineer,
      creatorName: 'Chief Engineer Marcus',
      assigneeId: USER_IDS.admiral,
      assigneeName: 'Admiral Chen Wei',
      assignmentHistory: [
        {
          assigneeId: USER_IDS.admiral,
          assigneeName: 'Admiral Chen Wei',
          assignedAt: daysAgo(10).toISOString(),
          assignedBy: USER_IDS.admiral,
        },
      ],
      messages: [
        {
          senderId: USER_IDS.engineer,
          senderName: 'Chief Engineer Marcus',
          content: 'Screenshots attached showing the zero count.',
          timestamp: daysAgo(10).toISOString(),
        },
        {
          senderId: USER_IDS.admiral,
          senderName: 'Admiral Chen Wei',
          content: 'Fixed the data sync issue. Should be working now. Please verify.',
          timestamp: daysAgo(8).toISOString(),
        },
        {
          senderId: USER_IDS.engineer,
          senderName: 'Chief Engineer Marcus',
          content: 'Confirmed fixed. Ship count showing correctly now. Thanks!',
          timestamp: daysAgo(7).toISOString(),
        },
      ],
      resolution:
        'Data sync issue between fleet ship assignments and dashboard cache. Cleared stale cache entries and added cache invalidation on ship assignment.',
      resolvedAt: daysAgo(8),
      resolvedBy: USER_IDS.admiral,
      satisfactionRating: 5,
      feedback: 'Quick fix, great communication.',
      tags: ['bug', 'dashboard', 'resolved'],
      firstResponseAt: daysAgo(8),
      closedAt: daysAgo(7),
    },
  ];

  for (const tData of tickets) {
    const exists = await ticketRepo.findOne({ where: { id: tData.id } });
    if (exists) {
      console.log(`  ○ Ticket already exists: ${tData.ticketNumber}`);
    } else {
      await ticketRepo.save(ticketRepo.create(tData as any));
      console.log(`  ✓ Ticket: ${tData.ticketNumber} — ${tData.subject.substring(0, 40)}...`);
    }
  }
}

async function seedCrewAssignments(): Promise<void> {
  // ─── 24. Crew Assignments ─────────────────────────────────────────────────
  console.log('\n─── Seeding Crew Assignments ───');
  const crewRepo = AppDataSource.getRepository(CrewAssignment);
  const CREW_IDS = {
    hammerheadCrew: 'demo-crew-hammerhead',
    moleCrew: 'demo-crew-mole',
  };
  const crewAssignments = [
    {
      id: CREW_IDS.hammerheadCrew,
      organizationId: ORG_IDS.fleet,
      shipId: ORG_SHIP_IDS.fleetHammerhead,
      missionId: MISSION_IDS.patrolCrusader,
      assignerId: USER_IDS.commander,
      crew: [
        { userId: USER_IDS.commander, role: 'captain', name: 'Commander Nova' },
        { userId: USER_IDS.bountyHunter, role: 'gunner', name: 'Shadowfang' },
        { userId: USER_IDS.engineer, role: 'engineer', name: 'Chief Engineer Marcus' },
        { userId: USER_IDS.medic, role: 'medic', name: 'Doc Valentina' },
        { userId: USER_IDS.explorer, role: 'navigator', name: 'Star Walker Zhi' },
      ],
      startDate: daysAgo(1),
      endDate: daysFromNow(1),
      status: 'active',
      notes: 'Patrol Crusader Sector 7 crew rotation',
    },
    {
      id: CREW_IDS.moleCrew,
      organizationId: ORG_IDS.mining,
      shipId: ORG_SHIP_IDS.miningMole,
      assignerId: USER_IDS.miner,
      crew: [
        { userId: USER_IDS.miner, role: 'pilot', name: 'Rockbreaker Yusuf' },
        { userId: USER_IDS.rookie, role: 'gunner', name: 'Rookie McNewface' },
      ],
      startDate: daysAgo(3),
      endDate: daysAgo(3),
      status: 'completed',
      notes: 'Lyria surface sweep crew',
    },
  ];

  for (const crData of crewAssignments) {
    const exists = await crewRepo.findOne({ where: { id: crData.id } });
    if (exists) {
      console.log(`  ○ CrewAssignment already exists`);
    } else {
      await crewRepo.save(crewRepo.create(crData as any));
      console.log(`  ✓ CrewAssignment: ${crData.id.split('-').pop()}`);
    }
  }
}

async function seedShipLoadouts(): Promise<void> {
  // ─── 25. Ship Loadouts ────────────────────────────────────────────────────
  console.log('\n─── Seeding Ship Loadouts ───');
  const loadoutRepo = AppDataSource.getRepository(ShipLoadout);
  const LOADOUT_IDS = {
    gladiusPvP: 'c0000000-0000-4000-a000-000000000001',
    cutlassBounty: 'c0000000-0000-4000-a000-000000000002',
    prospectorQuant: 'c0000000-0000-4000-a000-000000000003',
    freelancerTrade: 'c0000000-0000-4000-a000-000000000004',
  };
  const shipLoadouts = [
    {
      id: LOADOUT_IDS.gladiusPvP,
      name: 'Gladius PvP Meta Build',
      ownerId: USER_IDS.bountyHunter,
      shipName: 'Gladius',
      components: [
        {
          slot: 'weapon_s3_nose',
          componentName: 'FL-33 Laser Cannon',
          componentType: 'weapon',
          manufacturer: 'Behring',
        },
        {
          slot: 'weapon_s3_left',
          componentName: 'CF-337 Panther Repeater',
          componentType: 'weapon',
          manufacturer: 'Klaus & Werner',
        },
        {
          slot: 'weapon_s3_right',
          componentName: 'CF-337 Panther Repeater',
          componentType: 'weapon',
          manufacturer: 'Klaus & Werner',
        },
        {
          slot: 'shield_s1',
          componentName: 'Sukoran',
          componentType: 'shield',
          manufacturer: 'Shimapan',
        },
        {
          slot: 'powerplant_s1',
          componentName: 'Fierell Cascade',
          componentType: 'power_plant',
          manufacturer: 'Lightning Power',
        },
        {
          slot: 'cooler_s1_1',
          componentName: 'Zero-Rush',
          componentType: 'cooler',
          manufacturer: 'J-Span',
        },
        {
          slot: 'cooler_s1_2',
          componentName: 'Zero-Rush',
          componentType: 'cooler',
          manufacturer: 'J-Span',
        },
        {
          slot: 'qd_s1',
          componentName: 'VK-00',
          componentType: 'quantum_drive',
          manufacturer: 'ArcCorp',
        },
      ],
      description:
        'Optimized Gladius loadout for PvP bounty hunting. Balanced firepower and survivability.',
      statistics: { dps: 1850, totalHp: 4200, quantumSpeed: 283000 },
      version: 2,
      sharedWithOrg: true,
      sharedWithFleet: true,
      notes: 'Updated for 3.24. Panther repeaters outperform Attritions at current patch.',
    },
    {
      id: LOADOUT_IDS.cutlassBounty,
      name: 'Cutlass Black — Bounty Hunter Special',
      ownerId: USER_IDS.bountyHunter,
      shipName: 'Cutlass Black',
      components: [
        {
          slot: 'weapon_s3_1',
          componentName: 'CF-337 Panther Repeater',
          componentType: 'weapon',
          manufacturer: 'Klaus & Werner',
        },
        {
          slot: 'weapon_s3_2',
          componentName: 'CF-337 Panther Repeater',
          componentType: 'weapon',
          manufacturer: 'Klaus & Werner',
        },
        {
          slot: 'turret_s4_1',
          componentName: 'CF-447 Rhino Repeater',
          componentType: 'weapon',
          manufacturer: 'Klaus & Werner',
        },
        {
          slot: 'turret_s4_2',
          componentName: 'CF-447 Rhino Repeater',
          componentType: 'weapon',
          manufacturer: 'Klaus & Werner',
        },
        {
          slot: 'shield_s2',
          componentName: 'Shimmer',
          componentType: 'shield',
          manufacturer: 'Basilisk',
        },
      ],
      description: 'Multi-role Cutlass Black for bounty hunting. Good for group PvE and solo VHRT.',
      statistics: { dps: 2400, totalHp: 8500, cargoCapacity: 46 },
      version: 1,
      sharedWithOrg: true,
      notes: 'Solid all-rounder. Can handle VHRT bounties.',
    },
    {
      id: LOADOUT_IDS.prospectorQuant,
      name: 'Prospector — Quantanium Specialist',
      ownerId: USER_IDS.miner,
      shipName: 'Prospector',
      components: [
        {
          slot: 'mining_laser_s1',
          componentName: 'Lancet MH1',
          componentType: 'mining_laser',
          manufacturer: 'Thermyte Concern',
        },
        { slot: 'mining_module_1', componentName: 'Brandt', componentType: 'mining_module' },
        { slot: 'mining_module_2', componentName: 'Stampede', componentType: 'mining_module' },
        { slot: 'mining_module_3', componentName: 'Surge', componentType: 'mining_module' },
        {
          slot: 'powerplant_s1',
          componentName: 'Genoa',
          componentType: 'power_plant',
          manufacturer: 'Lightning Power',
        },
        { slot: 'qd_s1', componentName: 'Beacon', componentType: 'quantum_drive' },
      ],
      description:
        'Optimized for Quantanium mining in Aaron Halo. Lancet laser with Brandt for controlled cracking.',
      statistics: { cargoCapacity: 32 },
      version: 3,
      sharedWithOrg: true,
      notes:
        'Brandt is essential for Quantanium — prevents overcharge explosions. Always carry Stampede as backup.',
    },
    {
      id: LOADOUT_IDS.freelancerTrade,
      name: 'Freelancer MAX — Maximum Cargo',
      ownerId: USER_IDS.trader,
      shipName: 'Freelancer MAX',
      components: [
        {
          slot: 'weapon_s3_1',
          componentName: 'M5A Laser Cannon',
          componentType: 'weapon',
          manufacturer: 'Behring',
        },
        {
          slot: 'weapon_s3_2',
          componentName: 'M5A Laser Cannon',
          componentType: 'weapon',
          manufacturer: 'Behring',
        },
        {
          slot: 'shield_s2',
          componentName: 'FR-76',
          componentType: 'shield',
          manufacturer: 'Basilisk',
        },
        {
          slot: 'qd_s2',
          componentName: 'Odyssey',
          componentType: 'quantum_drive',
          manufacturer: 'Roberts Space Industries',
        },
      ],
      description:
        'Max cargo capacity build for trade runs. Fastest quantum drive for route efficiency.',
      statistics: { cargoCapacity: 120, quantumSpeed: 283000 },
      version: 1,
      sharedWithOrg: true,
      notes: 'Best cargo-to-price ratio for solo traders.',
    },
  ];

  for (const slData of shipLoadouts) {
    const exists = await loadoutRepo.findOne({ where: { id: slData.id } });
    if (exists) {
      console.log(`  ○ ShipLoadout already exists: ${slData.name}`);
    } else {
      await loadoutRepo.save(loadoutRepo.create(slData as any));
      console.log(`  ✓ ShipLoadout: ${slData.name}`);
    }
  }
}

async function seedFleetInventory(): Promise<void> {
  // ─── 26. Fleet Inventory ──────────────────────────────────────────────────
  console.log('\n─── Seeding Fleet Inventory ───');
  const fleetInvRepo = AppDataSource.getRepository(FleetInventory);
  const FLEET_INV_IDS = {
    alphaFuel: 'd0000000-0000-4000-a000-000000000001',
    alphaAmmo: 'd0000000-0000-4000-a000-000000000002',
    alphaMedical: 'd0000000-0000-4000-a000-000000000003',
    miningFuel: 'd0000000-0000-4000-a000-000000000004',
    miningRepair: 'd0000000-0000-4000-a000-000000000005',
    tradeCargo: 'd0000000-0000-4000-a000-000000000006',
  };
  const fleetInventory = [
    {
      id: FLEET_INV_IDS.alphaFuel,
      organizationId: ORG_IDS.fleet,
      fleetId: FLEET_IDS.alpha,
      itemName: 'Hydrogen Fuel',
      description: 'Standard hydrogen propellant for fleet operations',
      category: 'fuel',
      quantity: 8500,
      unit: 'liters',
      thresholds: { warning: 5000, critical: 2000 },
      status: 'adequate',
      unitCost: 1.2,
      totalValue: 10200,
      managerId: USER_IDS.commander,
      alertEnabled: true,
    },
    {
      id: FLEET_INV_IDS.alphaAmmo,
      organizationId: ORG_IDS.fleet,
      fleetId: FLEET_IDS.alpha,
      itemName: 'S3 Ballistic Ammunition',
      description: 'Size 3 ballistic weapon ammunition crates',
      category: 'ammunition',
      quantity: 240,
      unit: 'units',
      thresholds: { warning: 100, critical: 30 },
      status: 'adequate',
      unitCost: 150,
      totalValue: 36000,
      managerId: USER_IDS.commander,
      alertEnabled: true,
      notes: 'Resupply at Port Olisar every 3 operations',
    },
    {
      id: FLEET_INV_IDS.alphaMedical,
      organizationId: ORG_IDS.fleet,
      fleetId: FLEET_IDS.alpha,
      itemName: 'Emergency Medical Kits',
      description: 'Trauma kits with med-pens and bandages',
      category: 'medical',
      quantity: 15,
      unit: 'units',
      thresholds: { warning: 10, critical: 3 },
      status: 'adequate',
      unitCost: 500,
      totalValue: 7500,
      managerId: USER_IDS.medic,
      alertEnabled: true,
    },
    {
      id: FLEET_INV_IDS.miningFuel,
      organizationId: ORG_IDS.mining,
      fleetId: FLEET_IDS.mining,
      itemName: 'Quantum Fuel',
      description: 'Quantum drive fuel for long-range mining trips',
      category: 'fuel',
      quantity: 3200,
      unit: 'liters',
      thresholds: { warning: 2000, critical: 800 },
      status: 'adequate',
      unitCost: 3.5,
      totalValue: 11200,
      managerId: USER_IDS.miner,
      alertEnabled: true,
    },
    {
      id: FLEET_INV_IDS.miningRepair,
      organizationId: ORG_IDS.mining,
      fleetId: FLEET_IDS.mining,
      itemName: 'Hull Repair Materials',
      description: 'Emergency hull patching and repair composite',
      category: 'repair',
      quantity: 8,
      unit: 'units',
      thresholds: { warning: 5, critical: 2 },
      status: 'low',
      unitCost: 800,
      totalValue: 6400,
      managerId: USER_IDS.miner,
      alertEnabled: true,
      notes: 'RESTOCK NEEDED before next Aaron Halo run',
    },
    {
      id: FLEET_INV_IDS.tradeCargo,
      organizationId: ORG_IDS.trading,
      fleetId: FLEET_IDS.trade,
      itemName: 'Trade Goods (Mixed)',
      description: 'Mixed commodity inventory for trade operations',
      category: 'trade',
      quantity: 1200,
      unit: 'scu',
      thresholds: { warning: 500, critical: 100 },
      status: 'adequate',
      unitCost: 25,
      totalValue: 30000,
      managerId: USER_IDS.trader,
      alertEnabled: true,
    },
  ];

  for (const fiData of fleetInventory) {
    const exists = await fleetInvRepo.findOne({ where: { id: fiData.id } });
    if (exists) {
      console.log(`  ○ FleetInventory already exists: ${fiData.itemName}`);
    } else {
      await fleetInvRepo.save(fleetInvRepo.create(fiData as any));
      console.log(`  ✓ FleetInventory: ${fiData.itemName} (${fiData.fleetId.split('-').pop()})`);
    }
  }
}

async function seedOrganizationInventory(): Promise<void> {
  // ─── 27. Organization Inventory ───────────────────────────────────────────
  console.log('\n─── Seeding Organization Inventory ───');
  const orgInvRepo = AppDataSource.getRepository(OrganizationInventory);
  const ORG_INV_IDS = {
    fleetShips: 'd1000000-0000-4000-a000-000000000001',
    fleetComponents: 'd1000000-0000-4000-a000-000000000002',
    miningCommodities: 'd1000000-0000-4000-a000-000000000003',
    tradingReserves: 'd1000000-0000-4000-a000-000000000004',
  };
  const orgInventory = [
    {
      id: ORG_INV_IDS.fleetShips,
      organizationId: ORG_IDS.fleet,
      itemName: 'Registered Fleet Vessels',
      description: 'Total org-owned ships including capital ships, fighters, and support craft',
      category: 'ships',
      quantity: 12,
      unitValue: 850000,
      totalValue: 10200000,
      location: 'Various — Port Olisar, Everus Harbor',
    },
    {
      id: ORG_INV_IDS.fleetComponents,
      organizationId: ORG_IDS.fleet,
      itemName: 'Spare Ship Components',
      description: 'Replacement shields, power plants, and weapons in org storage',
      category: 'components',
      quantity: 34,
      unitValue: 15000,
      totalValue: 510000,
      location: 'Port Olisar — Hangar Bay 3',
      assignedTo: USER_IDS.engineer,
    },
    {
      id: ORG_INV_IDS.miningCommodities,
      organizationId: ORG_IDS.mining,
      itemName: 'Refined Mineral Stockpile',
      description: 'Refined minerals awaiting sale or distribution — Laranite, Taranite, Bexalite',
      category: 'commodities',
      quantity: 450,
      unit: 'SCU',
      unitValue: 35,
      totalValue: 15750,
      location: 'ARC-L1 Refinery Storage',
    },
    {
      id: ORG_INV_IDS.tradingReserves,
      organizationId: ORG_IDS.trading,
      itemName: 'Trading Capital Reserves',
      description: 'Liquid aUEC reserves for trading operations',
      category: 'commodities',
      quantity: 1,
      unitValue: 5000000,
      totalValue: 5000000,
      notes: 'Managed by Silkroad Sam. Minimum reserve: 2M aUEC.',
      assignedTo: USER_IDS.trader,
    },
  ];

  for (const oiData of orgInventory) {
    const exists = await orgInvRepo.findOne({ where: { id: oiData.id } });
    if (exists) {
      console.log(`  ○ OrgInventory already exists: ${oiData.itemName}`);
    } else {
      await orgInvRepo.save(orgInvRepo.create(oiData as any));
      console.log(`  ✓ OrgInventory: ${oiData.itemName}`);
    }
  }
}

async function seedFederation(): Promise<void> {
  // ─── 28. Federation ───────────────────────────────────────────────────────
  console.log('\n─── Seeding Federation ───');
  const fedRepo = AppDataSource.getRepository(Federation);
  const federation = {
    id: FEDERATION_IDS.stantonAlliance,
    name: 'Stanton Corridor Alliance',
    description:
      'A collaborative federation of organizations united to protect trade routes, share intelligence, and maintain stability in the Stanton system. Founded on principles of mutual defense and economic cooperation.',
    founderId: USER_IDS.admiral,
    founderOrgId: ORG_IDS.fleet,
    governance: {
      votingSystem: 'weighted',
      quorum: 0.6,
      proposalMinDuration: 72,
      founderVeto: true,
    },
    sharedResources: [
      { type: 'intelligence', description: 'Shared threat intel and pirate tracking' },
      { type: 'trade_routes', description: 'Approved safe corridor trade routes' },
      { type: 'mutual_defense', description: 'Collective defense pacts' },
    ],
    treaties: [
      {
        id: 'treaty-mutual-defense',
        name: 'Mutual Defense Pact',
        description:
          'Attack on one member is an attack on all. Mandatory response within 24 hours.',
        status: 'active',
        ratifiedAt: daysAgo(30).toISOString(),
      },
      {
        id: 'treaty-trade-agreement',
        name: 'Free Trade Agreement',
        description: 'Zero tariffs on goods traded between member organizations.',
        status: 'active',
        ratifiedAt: daysAgo(25).toISOString(),
      },
    ],
    status: 'active',
    isPublic: true,
    tags: ['defense', 'trade', 'intelligence', 'stanton'],
    discordUrl: 'https://discord.gg/stanton-alliance',
    websiteUrl: 'https://stanton-alliance.example.com',
  };

  const fedExists = await fedRepo.findOne({ where: { id: federation.id } });
  if (fedExists) {
    console.log(`  ○ Federation already exists: ${federation.name}`);
  } else {
    await fedRepo.save(fedRepo.create(federation as any));
    console.log(`  ✓ Federation: ${federation.name}`);
  }
}

async function seedFederationMembers(): Promise<void> {
  // ─── 29. Federation Members ───────────────────────────────────────────────
  console.log('\n─── Seeding Federation Members ───');
  const fedMemRepo = AppDataSource.getRepository(FederationMember);
  const FED_MEM_IDS = {
    fleet: 'e1000000-0000-4000-a000-000000000001',
    mining: 'e1000000-0000-4000-a000-000000000002',
    trading: 'e1000000-0000-4000-a000-000000000003',
    mercenary: 'e1000000-0000-4000-a000-000000000004',
  };
  const fedMembers = [
    {
      id: FED_MEM_IDS.fleet,
      federationId: FEDERATION_IDS.stantonAlliance,
      organizationId: ORG_IDS.fleet,
      organizationName: 'Stardust Expeditionary Fleet',
      role: 'founder',
      status: 'active',
      votingPower: 3,
      contributions: 15,
    },
    {
      id: FED_MEM_IDS.mining,
      federationId: FEDERATION_IDS.stantonAlliance,
      organizationId: ORG_IDS.mining,
      organizationName: 'Deep Core Mining Consortium',
      role: 'council',
      status: 'active',
      votingPower: 2,
      contributions: 8,
    },
    {
      id: FED_MEM_IDS.trading,
      federationId: FEDERATION_IDS.stantonAlliance,
      organizationId: ORG_IDS.trading,
      organizationName: 'Quantum Trade Network',
      role: 'council',
      status: 'active',
      votingPower: 2,
      contributions: 10,
    },
    {
      id: FED_MEM_IDS.mercenary,
      federationId: FEDERATION_IDS.stantonAlliance,
      organizationId: ORG_IDS.mercenary,
      organizationName: 'Ironwolf Mercenary Company',
      role: 'member',
      status: 'active',
      votingPower: 1,
      contributions: 5,
    },
  ];

  for (const fmData of fedMembers) {
    const exists = await fedMemRepo.findOne({ where: { id: fmData.id } });
    if (exists) {
      console.log(`  ○ FedMember already exists: ${fmData.organizationName}`);
    } else {
      await fedMemRepo.save(fedMemRepo.create(fmData as any));
      console.log(`  ✓ FedMember: ${fmData.organizationName} [${fmData.role}]`);
    }
  }
}

async function seedSecurityLevels(): Promise<void> {
  // ─── 30. Security Levels ──────────────────────────────────────────────────
  console.log('\n─── Seeding Security Levels ───');
  const secRepo = AppDataSource.getRepository(SecurityLevel);
  const SEC_IDS = {
    fleetMining: 'f0000000-0000-4000-a000-000000000001',
    fleetTrading: 'f0000000-0000-4000-a000-000000000002',
    fleetIntel: 'f0000000-0000-4000-a000-000000000003',
    intelFleet: 'f0000000-0000-4000-a000-000000000004',
    miningTrading: 'f0000000-0000-4000-a000-000000000005',
  };
  const securityLevels = [
    {
      id: SEC_IDS.fleetMining,
      sourceOrgId: ORG_IDS.fleet,
      targetOrgId: ORG_IDS.mining,
      level: 7,
      resourceType: 'fleet',
      accessLevel: 'read',
      notes: 'Mining consortium can view fleet positions for escort coordination',
      isActive: true,
      approvedBy: USER_IDS.admiral,
    },
    {
      id: SEC_IDS.fleetTrading,
      sourceOrgId: ORG_IDS.fleet,
      targetOrgId: ORG_IDS.trading,
      level: 6,
      resourceType: 'fleet',
      accessLevel: 'read',
      notes: 'Trading network can view fleet positions for convoy scheduling',
      isActive: true,
      approvedBy: USER_IDS.admiral,
    },
    {
      id: SEC_IDS.fleetIntel,
      sourceOrgId: ORG_IDS.fleet,
      targetOrgId: ORG_IDS.intel,
      level: 9,
      resourceType: 'intelligence',
      accessLevel: 'full',
      notes: 'Full intelligence sharing with Ghost Division',
      isActive: true,
      approvedBy: USER_IDS.admiral,
    },
    {
      id: SEC_IDS.intelFleet,
      sourceOrgId: ORG_IDS.intel,
      targetOrgId: ORG_IDS.fleet,
      level: 8,
      resourceType: 'intelligence',
      accessLevel: 'read',
      notes: 'Fleet command can access classified intel reports',
      isActive: true,
      approvedBy: USER_IDS.explorer,
    },
    {
      id: SEC_IDS.miningTrading,
      sourceOrgId: ORG_IDS.mining,
      targetOrgId: ORG_IDS.trading,
      level: 5,
      resourceType: '*',
      accessLevel: 'read',
      notes: 'General read access for trade coordination',
      isActive: true,
      approvedBy: USER_IDS.miner,
    },
  ];

  for (const slData of securityLevels) {
    const exists = await secRepo.findOne({ where: { id: slData.id } });
    if (exists) {
      console.log(`  ○ SecurityLevel already exists`);
    } else {
      await secRepo.save(secRepo.create(slData as any));
      console.log(
        `  ✓ SecurityLevel: ${slData.sourceOrgId.slice(-1)} → ${slData.targetOrgId.slice(-1)} (${slData.resourceType})`
      );
    }
  }
}

async function seedDiscordGuildSettings(): Promise<void> {
  // ─── 31. Discord Guild Settings ───────────────────────────────────────────
  console.log('\n─── Seeding Discord Guild Settings ───');
  try {
    const dgsRepo = AppDataSource.getRepository(DiscordGuildSettings);
    const discordGuildSettings = [
      {
        id: `${ORG_IDS.fleet}:${GUILD_IDS_MAP.fleet}`,
        organizationId: ORG_IDS.fleet,
        guildId: GUILD_IDS_MAP.fleet,
        guildName: 'Stardust Expeditionary Fleet',
        settingsEnabled: true,
        eventSettings: {
          enabled: true,
          defaultChannelId: '1111111111111111111',
          reminderMinutesBefore: [60, 15],
          autoCreateThreads: true,
        },
        voiceChannelSettings: {
          enabled: true,
          dynamicChannels: true,
          defaultCategoryId: '2222222222222222222',
        },
        notificationPreferences: {
          fleetUpdates: true,
          memberJoinLeave: true,
          missionAlerts: true,
          bountyAlerts: false,
        },
        roleSyncSettings: {
          enabled: true,
          mappings: [
            { orgRole: 'owner', discordRoleId: '3333333333333333333' },
            { orgRole: 'admin', discordRoleId: '4444444444444444444' },
            { orgRole: 'officer', discordRoleId: '5555555555555555555' },
            { orgRole: 'member', discordRoleId: '6666666666666666666' },
          ],
        },
        ticketSettings: {
          enabled: true,
          categoryId: '7777777777777777777',
          supportRoleId: '8888888888888888888',
        },
        adminUserIds: [USER_IDS.admiral, USER_IDS.commander],
      },
      {
        id: `${ORG_IDS.mining}:${GUILD_IDS_MAP.mining}`,
        organizationId: ORG_IDS.mining,
        guildId: GUILD_IDS_MAP.mining,
        guildName: 'Deep Core Mining Hub',
        settingsEnabled: true,
        eventSettings: {
          enabled: true,
          defaultChannelId: '1010101010101010101',
          reminderMinutesBefore: [30],
        },
        notificationPreferences: {
          fleetUpdates: false,
          memberJoinLeave: true,
          missionAlerts: true,
          bountyAlerts: false,
        },
        roleSyncSettings: {
          enabled: false,
        },
        adminUserIds: [USER_IDS.miner],
      },
    ];

    for (const dgsData of discordGuildSettings) {
      const exists = await dgsRepo.findOne({ where: { id: dgsData.id } });
      if (exists) {
        console.log(`  ○ DiscordGuildSettings already exists: ${dgsData.guildName}`);
      } else {
        await dgsRepo.save(dgsRepo.create(dgsData as any));
        console.log(`  ✓ DiscordGuildSettings: ${dgsData.guildName}`);
      }
    }
  } catch {
    console.log('  ⚠ Skipped — DiscordGuildSettings entity not registered in DataSource');
  }
}

async function seedGuildOrganizations(): Promise<void> {
  // ─── 32. Guild Organizations ──────────────────────────────────────────────
  console.log('\n─── Seeding Guild Organizations ───');
  const goRepo = AppDataSource.getRepository(GuildOrganization);
  const guildOrgs = [
    {
      guildId: GUILD_IDS_MAP.fleet,
      organizationId: ORG_IDS.fleet,
      guildName: 'Stardust Expeditionary Fleet',
      isPrimary: true,
      isActive: true,
      createdBy: USER_IDS.admiral,
    },
    {
      guildId: GUILD_IDS_MAP.mining,
      organizationId: ORG_IDS.mining,
      guildName: 'Deep Core Mining Hub',
      isPrimary: true,
      isActive: true,
      createdBy: USER_IDS.miner,
    },
  ];

  for (const goData of guildOrgs) {
    const exists = await goRepo.findOne({ where: { guildId: goData.guildId } });
    if (exists) {
      console.log(`  ○ GuildOrganization already exists: ${goData.guildName}`);
    } else {
      await goRepo.save(goRepo.create(goData as any));
      console.log(`  ✓ GuildOrganization: ${goData.guildName}`);
    }
  }
}

async function seedBlacklistSharingConfig(): Promise<void> {
  // ─── 33. Blacklist Sharing Config ─────────────────────────────────────────
  console.log('\n─── Seeding Blacklist Sharing Config ───');
  const blkRepo = AppDataSource.getRepository(BlacklistSharingConfig);
  const BLK_IDS = {
    fleet: 'f1000000-0000-4000-a000-000000000001',
    mining: 'f1000000-0000-4000-a000-000000000002',
    mercenary: 'f1000000-0000-4000-a000-000000000003',
  };
  const blacklistConfigs = [
    {
      id: BLK_IDS.fleet,
      organizationId: ORG_IDS.fleet,
      shareWarnings: false,
      shareTimeouts: true,
      shareKicks: true,
      shareBans: true,
      receiveAlerts: true,
      minAlertSeverity: 2,
      autoShareWithAllies: true,
      autoShareMinSeverity: 3,
    },
    {
      id: BLK_IDS.mining,
      organizationId: ORG_IDS.mining,
      shareWarnings: false,
      shareTimeouts: false,
      shareKicks: true,
      shareBans: true,
      receiveAlerts: true,
      minAlertSeverity: 3,
      autoShareWithAllies: false,
    },
    {
      id: BLK_IDS.mercenary,
      organizationId: ORG_IDS.mercenary,
      shareWarnings: true,
      shareTimeouts: true,
      shareKicks: true,
      shareBans: true,
      receiveAlerts: true,
      minAlertSeverity: 1,
      autoShareWithAllies: true,
      autoShareMinSeverity: 2,
    },
  ];

  for (const blData of blacklistConfigs) {
    const exists = await blkRepo.findOne({ where: { id: blData.id } });
    if (exists) {
      console.log(`  ○ BlacklistConfig already exists: org ${blData.organizationId.slice(-1)}`);
    } else {
      await blkRepo.save(blkRepo.create(blData as any));
      console.log(`  ✓ BlacklistConfig: org ${blData.organizationId.slice(-1)}`);
    }
  }
}

// ─── 34. Announcements ──────────────────────────────────────────────────────

async function seedAnnouncements(): Promise<void> {
  console.log('─── Seeding Announcements ───');
  const repo = AppDataSource.getRepository(Announcement);
  const items = [
    {
      id: ANNOUNCEMENT_IDS.fleetAlert,
      organizationId: ORG_IDS.fleet,
      title: 'Fleet Mobilization — Operation Starfall',
      content:
        'All Alpha Strike pilots report to Crusader sector. Full combat loadout required. Briefing at 20:00 UTC.',
      targetType: 'all',
      status: 'sent',
      createdBy: USER_IDS.commander,
      createdByName: 'Commander Shepard',
      sentAt: daysAgo(2),
    },
    {
      id: ANNOUNCEMENT_IDS.miningEvent,
      organizationId: ORG_IDS.mining,
      title: 'Quantanium Motherlode — Aaron Halo',
      content:
        'High-yield quantanium deposit confirmed. Mining Division deploying all Prospectors and Moles.',
      targetType: 'single',
      status: 'sent',
      createdBy: USER_IDS.miner,
      createdByName: 'Mike Miller',
      sentAt: daysAgo(1),
    },
    {
      id: ANNOUNCEMENT_IDS.tradeOpportunity,
      organizationId: ORG_IDS.trading,
      title: 'Laranite Shortage at Area18',
      content:
        'Laranite prices spiking. All Hull-series captains coordinate for maximum haul. Current margin: 42%.',
      targetType: 'all',
      status: 'draft',
      createdBy: USER_IDS.trader,
      createdByName: 'Sarah Chen',
      scheduledAt: daysFromNow(1),
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ Announcement already exists: ${d.title.slice(0, 40)}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ Announcement: ${d.title.slice(0, 40)}`);
    }
  }
}

// ─── 35. Announcement Templates ─────────────────────────────────────────────

async function seedAnnouncementTemplates(): Promise<void> {
  console.log('─── Seeding Announcement Templates ───');
  const repo = AppDataSource.getRepository(AnnouncementTemplate);
  const items = [
    {
      id: ANN_TEMPLATE_IDS.eventTemplate,
      name: 'Event Announcement',
      title: 'Upcoming Event: {{event_name}}',
      content: '**{{event_name}}**\n\nDate: {{date}}\nLocation: {{location}}\n\n{{description}}',
      isGlobal: true,
      createdBy: USER_IDS.commander,
      createdByName: 'System',
    },
    {
      id: ANN_TEMPLATE_IDS.alertTemplate,
      name: 'Alert Template',
      title: 'Alert: {{alert_title}}',
      content: '**Priority: {{priority}}**\n\n{{message}}\n\nAction Required: {{action}}',
      isGlobal: false,
      organizationId: ORG_IDS.fleet,
      createdBy: USER_IDS.admiral,
      createdByName: 'Admiral',
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ AnnouncementTemplate already exists: ${d.name}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ AnnouncementTemplate: ${d.name}`);
    }
  }
}

// ─── 36. Announcement Deliveries ────────────────────────────────────────────

async function seedAnnouncementDeliveries(): Promise<void> {
  console.log('─── Seeding Announcement Deliveries ───');
  const repo = AppDataSource.getRepository(AnnouncementDelivery);
  const items = [
    {
      announcementId: ANNOUNCEMENT_IDS.fleetAlert,
      guildId: GUILD_IDS_MAP.fleet,
      channelId: '1111111111111111111',
      messageId: '2222222222222222222',
      status: 'delivered',
      deliveredAt: daysAgo(2),
      retryCount: 0,
    },
    {
      announcementId: ANNOUNCEMENT_IDS.miningEvent,
      guildId: GUILD_IDS_MAP.mining,
      channelId: '3333333333333333333',
      messageId: '4444444444444444444',
      status: 'delivered',
      deliveredAt: daysAgo(1),
      retryCount: 0,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { announcementId: d.announcementId, guildId: d.guildId },
    });
    if (exists) {
      console.log(`  ○ AnnouncementDelivery already exists: guild ${d.guildId.slice(0, 8)}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ AnnouncementDelivery: guild ${d.guildId.slice(0, 8)}`);
    }
  }
}

// ─── 37. Organization Templates ─────────────────────────────────────────────

async function seedOrganizationTemplates(): Promise<void> {
  console.log('─── Seeding Organization Templates ───');
  const repo = AppDataSource.getRepository(OrganizationTemplate);
  const items = [
    {
      id: ORG_TEMPLATE_IDS.militaryTemplate,
      name: 'Military Fleet Organization',
      description: 'Template for combat-focused organizations with military-style hierarchy.',
      category: TemplateCategory.MILITARY,
      visibility: TemplateVisibility.PUBLIC,
      createdBy: USER_UUIDS.commander,
      creatorName: 'Commander Shepard',
      structure: { divisions: ['Command', 'Fighter Wing', 'Capital Ships', 'Support'] },
      defaultRoles: [
        { name: 'Fleet Commander', priority: 100 },
        { name: 'Wing Leader', priority: 80 },
      ],
      defaultPermissions: [{ resource: 'fleet', actions: ['view', 'manage'] }],
      defaultSettings: { requireTwoFactor: true, minRank: 'officer' },
      applicationConfig: { requireMessage: true, minAccountAge: 30 },
      tags: ['military', 'combat', 'fleet'],
      isActive: true,
      isPublic: true,
      version: '1.0.0',
    },
    {
      id: ORG_TEMPLATE_IDS.miningGuild,
      name: 'Mining Guild',
      description: 'Template for mining-focused organizations with crew rotation system.',
      category: TemplateCategory.GUILD,
      visibility: TemplateVisibility.PUBLIC,
      createdBy: USER_UUIDS.miner,
      creatorName: 'Mike Miller',
      structure: { teams: ['Alpha Shift', 'Bravo Shift', 'Logistics', 'Security'] },
      defaultRoles: [
        { name: 'Foreman', priority: 90 },
        { name: 'Miner', priority: 50 },
      ],
      defaultPermissions: [{ resource: 'mining', actions: ['view', 'operate'] }],
      defaultSettings: { profitSharing: true, minimumHours: 10 },
      applicationConfig: { requireShip: true },
      tags: ['mining', 'industrial', 'guild'],
      isActive: true,
      isPublic: true,
      version: '1.0.0',
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ OrgTemplate already exists: ${d.name}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ OrgTemplate: ${d.name}`);
    }
  }
}

// ─── 38. Organization Activities ────────────────────────────────────────────

async function seedOrganizationActivities(): Promise<void> {
  console.log('─── Seeding Organization Activities ───');
  const repo = AppDataSource.getRepository(OrganizationActivity);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      action: 'member.added',
      severity: 'info',
      actorId: USER_IDS.rookie,
      actorType: 'user',
      actorName: 'Jake Torres',
      description: 'New member joined the organization.',
      requiresReview: false,
      reviewed: false,
    },
    {
      organizationId: ORG_IDS.fleet,
      action: 'permission.role_created',
      severity: 'info',
      actorId: USER_IDS.commander,
      actorType: 'user',
      actorName: 'Commander Shepard',
      description: 'Created new role: Wing Commander.',
      after: { roleName: 'Wing Commander', priority: 85 },
      requiresReview: false,
      reviewed: false,
    },
    {
      organizationId: ORG_IDS.mining,
      action: 'settings.updated',
      severity: 'warning',
      actorId: USER_IDS.miner,
      actorType: 'user',
      actorName: 'Mike Miller',
      description: 'Updated profit sharing configuration.',
      before: { profitShare: 50 },
      after: { profitShare: 60 },
      requiresReview: true,
      reviewed: false,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { organizationId: d.organizationId, action: d.action as any, actorId: d.actorId },
    });
    if (exists) {
      console.log(`  ○ OrgActivity already exists: ${d.action}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ OrgActivity: ${d.action}`);
    }
  }
}

// ─── 39. Organization Analytics ─────────────────────────────────────────────

async function seedOrganizationAnalytics(): Promise<void> {
  console.log('─── Seeding Organization Analytics ───');
  const repo = AppDataSource.getRepository(OrganizationAnalytics);
  const now = new Date();
  const weekAgo = daysAgo(7);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      period: 'WEEKLY',
      periodStart: weekAgo,
      periodEnd: now,
      memberStats: { total: 45, active: 38, new: 3, departed: 1 },
      activityMetrics: { totalActions: 256, averagePerMember: 6.7 },
      engagementMetrics: { eventParticipation: 0.78, chatActivity: 0.85 },
      growthMetrics: { netGrowth: 2, retentionRate: 0.95 },
      hierarchyHealth: { filledRoles: 38, unfilledRoles: 7 },
      resourceUsage: { shipsActive: 22, totalValue: 15000000 },
      overallHealthScore: 87.5,
    },
    {
      organizationId: ORG_IDS.mining,
      period: 'WEEKLY',
      periodStart: weekAgo,
      periodEnd: now,
      memberStats: { total: 28, active: 22, new: 2, departed: 0 },
      activityMetrics: { totalActions: 145, averagePerMember: 6.6 },
      engagementMetrics: { eventParticipation: 0.82, chatActivity: 0.71 },
      growthMetrics: { netGrowth: 2, retentionRate: 0.98 },
      hierarchyHealth: { filledRoles: 24, unfilledRoles: 4 },
      resourceUsage: { shipsActive: 15, totalValue: 8500000 },
      overallHealthScore: 91.2,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { organizationId: d.organizationId, period: d.period as any },
    });
    if (exists) {
      console.log(`  ○ OrgAnalytics already exists: org ${d.organizationId.slice(-1)}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ OrgAnalytics: org ${d.organizationId.slice(-1)}`);
    }
  }
}

// ─── 40. User Availability ──────────────────────────────────────────────────

async function seedUserAvailability(): Promise<void> {
  console.log('─── Seeding User Availability ───');
  const repo = AppDataSource.getRepository(UserAvailability);
  const items = [
    {
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      dayOfWeek: 1,
      startMinute: 1080,
      endMinute: 1380,
      isRecurring: true,
    },
    {
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      dayOfWeek: 3,
      startMinute: 1080,
      endMinute: 1380,
      isRecurring: true,
    },
    {
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      dayOfWeek: 5,
      startMinute: 1200,
      endMinute: 1440,
      isRecurring: true,
    },
    {
      userId: USER_IDS.miner,
      organizationId: ORG_IDS.mining,
      dayOfWeek: 6,
      startMinute: 600,
      endMinute: 1080,
      isRecurring: true,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { userId: d.userId, organizationId: d.organizationId, dayOfWeek: d.dayOfWeek },
    });
    if (exists) {
      console.log(
        `  ○ UserAvailability already exists: user ${d.userId.slice(-3)} day ${d.dayOfWeek}`
      );
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ UserAvailability: user ${d.userId.slice(-3)} day ${d.dayOfWeek}`);
    }
  }
}

// ─── 41. Invitations ────────────────────────────────────────────────────────

async function seedInvitations(): Promise<void> {
  console.log('─── Seeding Invitations ───');
  const repo = AppDataSource.getRepository(Invitation);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      inviteeUserId: USER_IDS.rookie,
      inviterId: USER_IDS.commander,
      inviterRole: 'owner',
      status: 'accepted',
      token: 'inv-token-fleet-rookie-001',
      expiresAt: daysFromNow(7),
      message: 'Welcome aboard, pilot. Report to Alpha Strike wing.',
    },
    {
      organizationId: ORG_IDS.mining,
      inviteeUserId: USER_IDS.engineer,
      inviterId: USER_IDS.miner,
      inviterRole: 'admin',
      status: 'pending',
      token: 'inv-token-mining-eng-002',
      expiresAt: daysFromNow(5),
      message: 'We need skilled engineers for mining operations.',
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { token: d.token } });
    if (exists) {
      console.log(`  ○ Invitation already exists: ${d.token}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ Invitation: ${d.token}`);
    }
  }
}

// ─── 42. Job Applications ───────────────────────────────────────────────────

async function seedJobApplications(): Promise<void> {
  console.log('─── Seeding Job Applications ───');
  const repo = AppDataSource.getRepository(JobApplication);
  const { PublicJobListing } = await import('../src/models/PublicJobListing');
  const listingRepo = AppDataSource.getRepository(PublicJobListing);
  const listing = await listingRepo.findOne({ where: { organizationId: ORG_IDS.fleet } });
  if (!listing) {
    console.log('  ⚠ No job listings found — skipping JobApplications');
    return;
  }
  const items = [
    {
      jobListingId: listing.id,
      applicantUserId: USER_IDS.rookie,
      applicationType: 'crew',
      status: 'pending',
      applicantDisplayName: 'Jake Torres',
      message: 'Experienced Gladius pilot looking to join. 200+ hours PvP combat.',
    },
    {
      jobListingId: listing.id,
      applicantUserId: USER_IDS.engineer,
      applicationType: 'crew',
      status: 'approved',
      applicantDisplayName: 'Raj Patel',
      message: 'Engineer specializing in ship systems and repair. Own a Vulcan.',
      reviewedBy: USER_IDS.commander,
      reviewNote: 'Strong candidate — assign to support wing.',
      reviewedAt: daysAgo(1),
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { jobListingId: d.jobListingId, applicantUserId: d.applicantUserId },
    });
    if (exists) {
      console.log(`  ○ JobApplication already exists: ${d.applicantDisplayName}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ JobApplication: ${d.applicantDisplayName}`);
    }
  }
}

// ─── 43. Org Applications ───────────────────────────────────────────────────

async function seedOrgApplications(): Promise<void> {
  console.log('─── Seeding Org Applications ───');
  const repo = AppDataSource.getRepository(OrgApplication);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      applicantUserId: USER_IDS.smuggler,
      targetType: 'organization',
      applicantType: 'user',
      status: 'pending',
      message: 'Former freelance pilot seeking structured fleet operations. Strong combat record.',
    },
    {
      organizationId: ORG_IDS.trading,
      applicantUserId: USER_IDS.explorer,
      targetType: 'organization',
      applicantType: 'user',
      status: 'approved',
      message: 'Experienced explorer with trade route knowledge. Own a Carrack and Mercury.',
      reviewedBy: USER_IDS.trader,
      reviewNote: 'Excellent fit — route knowledge valuable.',
      reviewedAt: daysAgo(3),
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { organizationId: d.organizationId, applicantUserId: d.applicantUserId },
    });
    if (exists) {
      console.log(`  ○ OrgApplication already exists: user ${d.applicantUserId.slice(-3)}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ OrgApplication: user ${d.applicantUserId.slice(-3)}`);
    }
  }
}

// ─── 44. Citizen Watchlist Entries ───────────────────────────────────────────────

async function seedOrgWatchlistEntries(): Promise<void> {
  console.log('─── Seeding Citizen Watchlist Entries ───');
  const repo = AppDataSource.getRepository(OrgWatchlistEntry);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      rsiHandle: 'CRIMSONSHADOW',
      citizenName: 'CrimsonShadow',
      reason: 'hostile',
      threatLevel: 'high',
      addedBy: USER_UUIDS.commander,
      notes: 'Known pirate. Multiple hostile engagements in Stanton.',
    },
    {
      organizationId: ORG_IDS.fleet,
      rsiHandle: 'VOIDRUNNER',
      citizenName: 'VoidRunner',
      reason: 'suspicious',
      threatLevel: 'moderate',
      addedBy: USER_UUIDS.diplomat,
      notes: 'Reported involvement in smuggling. Monitor communications.',
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { organizationId: d.organizationId, rsiHandle: d.rsiHandle },
    });
    if (exists) {
      console.log(`  ○ OrgWatchlistEntry already exists: ${d.rsiHandle}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ OrgWatchlistEntry: ${d.rsiHandle}`);
    }
  }
}

// ─── 45. Price Alerts ───────────────────────────────────────────────────────

async function seedPriceAlerts(): Promise<void> {
  console.log('─── Seeding Price Alerts ───');
  const repo = AppDataSource.getRepository(PriceAlert);
  const items = [
    {
      id: PRICE_ALERT_IDS.laraniteAbove,
      userId: USER_IDS.trader,
      commodity: 'Laranite',
      location: 'Area18',
      condition: 'above',
      threshold: 28.5,
      enabled: true,
    },
    {
      id: PRICE_ALERT_IDS.titaniumBelow,
      userId: USER_IDS.miner,
      commodity: 'Titanium',
      location: 'Lorville',
      condition: 'below',
      threshold: 8,
      enabled: true,
    },
    {
      id: PRICE_ALERT_IDS.astatineChange,
      userId: USER_IDS.trader,
      commodity: 'Astatine',
      condition: 'change_percent',
      threshold: 15,
      enabled: true,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ PriceAlert already exists: ${d.commodity}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ PriceAlert: ${d.commodity}`);
    }
  }
}

// ─── 46. Contact Requests ───────────────────────────────────────────────────

async function seedContactRequests(): Promise<void> {
  console.log('─── Seeding Contact Requests ───');
  const repo = AppDataSource.getRepository(ContactRequest);
  const items = [
    {
      id: CONTACT_REQUEST_IDS.recruitmentInquiry,
      organizationId: ORG_IDS.fleet,
      targetType: 'organization',
      senderName: 'Nova Blackwell',
      senderEmail: 'nova@example.com',
      rsiHandle: 'NovaBlack',
      subject: 'Recruitment Inquiry — Combat Pilot',
      message: 'Interested in joining. I have 500+ hours in Arena Commander and own a Sabre.',
      contactType: 'recruitment',
      status: 'pending',
      visibility: 'all',
    },
    {
      id: CONTACT_REQUEST_IDS.diplomaticMessage,
      organizationId: ORG_IDS.fleet,
      targetType: 'organization',
      senderName: 'Ambassador Kovacs',
      rsiHandle: 'AmbKovacs',
      subject: 'Alliance Proposal — Iron Wolves',
      message: 'The Iron Wolves Federation proposes a mutual defense pact for Stanton operations.',
      contactType: 'diplomacy',
      status: 'read',
      visibility: 'leadership',
      senderUserId: USER_IDS.diplomat,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ ContactRequest already exists: ${d.senderName}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ ContactRequest: ${d.senderName}`);
    }
  }
}

// ─── 47. Contact Request Replies ────────────────────────────────────────────

async function seedContactRequestReplies(): Promise<void> {
  console.log('─── Seeding Contact Request Replies ───');
  const repo = AppDataSource.getRepository(ContactRequestReply);
  const exists = await repo.findOne({
    where: { contactRequestId: CONTACT_REQUEST_IDS.diplomaticMessage },
  });
  if (exists) {
    console.log('  ○ ContactRequestReply already exists');
    return;
  }
  await repo.save(
    repo.create({
      contactRequestId: CONTACT_REQUEST_IDS.diplomaticMessage,
      senderUserId: USER_IDS.commander,
      message:
        'Thank you for the proposal. We are reviewing it with our council. Expect a formal response within 48 hours.',
      isOrgReply: true,
    } as any)
  );
  console.log('  ✓ ContactRequestReply: diplomatic response');
}

// ─── 48. Federation Proposals ───────────────────────────────────────────────

async function seedFederationProposals(): Promise<void> {
  console.log('─── Seeding Federation Proposals ───');
  const repo = AppDataSource.getRepository(FederationProposal);
  const items = [
    {
      federationId: FEDERATION_IDS.stantonAlliance,
      type: 'amendment',
      title: 'Shared Defense Protocol',
      description:
        'Proposal to establish a rapid response fleet composed of ships from all member organizations.',
      proposedBy: 'Commander Shepard',
      proposedByOrg: ORG_IDS.fleet,
      status: 'open',
      votes: [
        { orgId: ORG_IDS.fleet, vote: 'yes', votedAt: daysAgo(2).toISOString() },
        { orgId: ORG_IDS.mining, vote: 'yes', votedAt: daysAgo(1).toISOString() },
      ],
      requiredApproval: 3,
      votingEndsAt: daysFromNow(5),
    },
    {
      federationId: FEDERATION_IDS.stantonAlliance,
      type: 'membership',
      title: 'Admit Quantum Dynamics Trading Co.',
      description: 'Motion to admit Quantum Dynamics as a full member of the Stanton Alliance.',
      proposedBy: 'Sarah Chen',
      proposedByOrg: ORG_IDS.trading,
      status: 'open',
      votes: [],
      requiredApproval: 4,
      votingEndsAt: daysFromNow(10),
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { federationId: d.federationId, title: d.title },
    });
    if (exists) {
      console.log(`  ○ FederationProposal already exists: ${d.title.slice(0, 30)}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ FederationProposal: ${d.title.slice(0, 30)}`);
    }
  }
}

// ─── 49. Relationship History ───────────────────────────────────────────────

async function seedRelationshipHistory(): Promise<void> {
  console.log('─── Seeding Relationship History ───');
  const repo = AppDataSource.getRepository(RelationshipHistory);
  const { OrganizationRelationship } = await import('../src/models/OrganizationRelationship');
  const relRepo = AppDataSource.getRepository(OrganizationRelationship);
  const rel = await relRepo.findOne({ where: { organizationId: ORG_IDS.fleet } });
  if (!rel) {
    console.log('  ⚠ No relationships found — skipping RelationshipHistory');
    return;
  }
  const items = [
    {
      relationshipId: rel.id,
      organizationId: ORG_IDS.fleet,
      targetOrganizationId: ORG_IDS.mining,
      changeType: 'created',
      description:
        'Diplomatic relationship established between Stardust Expeditionary and Deep Core Mining.',
      isSystemGenerated: true,
      isSignificant: true,
      requiresNotification: true,
      notificationSent: true,
      actorId: USER_IDS.diplomat,
      actorName: 'Ambassador Lee',
    },
    {
      relationshipId: rel.id,
      organizationId: ORG_IDS.fleet,
      targetOrganizationId: ORG_IDS.mining,
      changeType: 'trust_level_changed',
      description: 'Trust level upgraded from neutral to allied following joint mining operation.',
      previousValue: { trustLevel: 'neutral' },
      newValue: { trustLevel: 'allied' },
      isSystemGenerated: false,
      isSignificant: true,
      requiresNotification: true,
      notificationSent: true,
      actorId: USER_IDS.commander,
      actorName: 'Commander Shepard',
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { relationshipId: d.relationshipId, changeType: d.changeType as any },
    });
    if (exists) {
      console.log(`  ○ RelationshipHistory already exists: ${d.changeType}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ RelationshipHistory: ${d.changeType}`);
    }
  }
}

// ─── 50. LFG User Reputation ───────────────────────────────────────────────

async function seedLFGUserReputation(): Promise<void> {
  console.log('─── Seeding LFG User Reputation ───');
  const repo = AppDataSource.getRepository(LFGUserReputation);
  const items = [
    {
      userId: USER_IDS.commander,
      totalSessions: 45,
      successfulSessions: 42,
      failedSessions: 3,
      successRate: 93.33,
      totalRatingsReceived: 38,
      averageRating: 4.7,
      positiveRatings: 36,
      negativeRatings: 2,
      overallScore: 92.5,
      sessionsAsLeader: 30,
      successfulLeaderSessions: 28,
      leadershipSuccessRate: 93.33,
      currentSuccessStreak: 12,
      longestSuccessStreak: 18,
    },
    {
      userId: USER_IDS.miner,
      totalSessions: 32,
      successfulSessions: 30,
      failedSessions: 2,
      successRate: 93.75,
      totalRatingsReceived: 28,
      averageRating: 4.5,
      positiveRatings: 26,
      negativeRatings: 2,
      overallScore: 88,
      sessionsAsLeader: 15,
      successfulLeaderSessions: 14,
      leadershipSuccessRate: 93.33,
      currentSuccessStreak: 8,
      longestSuccessStreak: 14,
    },
    {
      userId: USER_IDS.bountyHunter,
      totalSessions: 58,
      successfulSessions: 52,
      failedSessions: 6,
      successRate: 89.66,
      totalRatingsReceived: 50,
      averageRating: 4.3,
      positiveRatings: 44,
      negativeRatings: 6,
      overallScore: 85,
      sessionsAsLeader: 10,
      successfulLeaderSessions: 9,
      leadershipSuccessRate: 90,
      currentSuccessStreak: 5,
      longestSuccessStreak: 11,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { userId: d.userId } });
    if (exists) {
      console.log(`  ○ LFGUserReputation already exists: user ${d.userId.slice(-3)}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ LFGUserReputation: user ${d.userId.slice(-3)}`);
    }
  }
}

// ─── 51. LFG Reputation Ratings ─────────────────────────────────────────────

async function seedLFGReputationRatings(): Promise<void> {
  console.log('─── Seeding LFG Reputation Ratings ───');
  const repo = AppDataSource.getRepository(LFGReputationRating);
  const items = [
    {
      sessionId: 'lfg-session-mining-001',
      userId: USER_IDS.miner,
      raterId: USER_IDS.commander,
      overallRating: 5,
      isPositive: true,
      categoryRatings: { communication: 5, teamwork: 5, skill: 4, reliability: 5, leadership: 4 },
      comment: 'Excellent mining lead. Efficient extraction and great coordination.',
    },
    {
      sessionId: 'lfg-session-combat-001',
      userId: USER_IDS.commander,
      raterId: USER_IDS.bountyHunter,
      overallRating: 4,
      isPositive: true,
      categoryRatings: { communication: 5, teamwork: 4, skill: 5, reliability: 4, leadership: 5 },
      comment: 'Strong tactical leader. Clear callouts and decisive command.',
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { userId: d.userId, raterId: d.raterId } });
    if (exists) {
      console.log(`  ○ LFGReputationRating already exists: user ${d.userId.slice(-3)}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ LFGReputationRating: user ${d.userId.slice(-3)}`);
    }
  }
}

// ─── 52. LFG Group History ──────────────────────────────────────────────────

async function seedLFGGroupHistory(): Promise<void> {
  console.log('─── Seeding LFG Group History ───');
  const repo = AppDataSource.getRepository(LFGGroupHistory);
  const items = [
    {
      lfgPostId: 'lfg-post-mining-001',
      activity: 'Mining',
      description: 'Aaron Halo quantanium mining run — 4 person crew',
      creatorId: USER_IDS.miner,
      creatorName: 'Mike Miller',
      participantIds: [USER_IDS.miner, USER_IDS.engineer, USER_IDS.rookie, USER_IDS.trader],
      participantCount: 4,
      guildId: GUILD_IDS_MAP.mining,
      channelId: '5555555555555555555',
      wasSuccessful: true,
      durationMinutes: 120,
      userId: USER_IDS.miner,
    },
    {
      lfgPostId: 'lfg-post-bounty-001',
      activity: 'Bounty Hunting',
      description: 'Pirate hideout raid — Yela asteroid belt',
      creatorId: USER_IDS.bountyHunter,
      creatorName: 'Helena Voss',
      participantIds: [USER_IDS.bountyHunter, USER_IDS.commander, USER_IDS.medic],
      participantCount: 3,
      guildId: GUILD_IDS_MAP.fleet,
      channelId: '6666666666666666666',
      wasSuccessful: true,
      durationMinutes: 90,
      userId: USER_IDS.bountyHunter,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { lfgPostId: d.lfgPostId } });
    if (exists) {
      console.log(`  ○ LFGGroupHistory already exists: ${d.activity}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ LFGGroupHistory: ${d.activity}`);
    }
  }
}

// ─── 53. Ship Loans ─────────────────────────────────────────────────────────

async function seedShipLoans(): Promise<void> {
  console.log('─── Seeding Ship Loans ───');
  const repo = AppDataSource.getRepository(ShipLoan);
  const gladiusId = await findShipId('Aegis Gladius');
  const cutlassId = await findShipId('Drake Cutlass Black');
  const items = [
    {
      id: SHIP_LOAN_IDS.gladiusLoan,
      shipId: gladiusId || 'ship-gladius-placeholder',
      lenderId: USER_IDS.commander,
      borrowerId: USER_IDS.rookie,
      requestDate: daysAgo(5),
      startDate: daysAgo(4),
      expectedReturnDate: daysFromNow(3),
      status: 'active',
      insuranceRequired: true,
      terms: 'Return in same condition. No modifications. Insurance required.',
      approvedDate: daysAgo(4),
    },
    {
      id: SHIP_LOAN_IDS.cutlassLoan,
      shipId: cutlassId || 'ship-cutlass-placeholder',
      lenderId: USER_IDS.smuggler,
      borrowerId: USER_IDS.trader,
      requestDate: daysAgo(10),
      startDate: daysAgo(9),
      expectedReturnDate: daysAgo(2),
      actualReturnDate: daysAgo(2),
      status: 'returned',
      insuranceRequired: false,
      terms: 'Short-term loan for cargo run.',
      approvedDate: daysAgo(9),
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ ShipLoan already exists: ${d.id}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ ShipLoan: ${d.id}`);
    }
  }
}

// ─── 54. Ship Maintenance ───────────────────────────────────────────────────

async function seedShipMaintenance(): Promise<void> {
  console.log('─── Seeding Ship Maintenance ───');
  const repo = AppDataSource.getRepository(ShipMaintenance);
  const prospectorId = await findShipId('MISC Prospector');
  const items = [
    {
      id: SHIP_MAINT_IDS.prospectorRoutine,
      shipId: prospectorId || 'ship-prospector-placeholder',
      ownerId: USER_IDS.miner,
      maintenanceType: 'routine',
      scheduledDate: daysAgo(3),
      completedDate: daysAgo(3),
      status: 'completed',
      description: 'Routine mining laser calibration and hull inspection.',
      cost: 2500,
      performedBy: USER_IDS.engineer,
    },
    {
      id: SHIP_MAINT_IDS.hammerheadRepair,
      shipId: ORG_SHIP_IDS.fleetHammerhead,
      ownerId: USER_IDS.commander,
      maintenanceType: 'repair',
      scheduledDate: daysAgo(1),
      status: 'in_progress',
      description: 'Battle damage repair — port turret and shield generator replacement.',
      cost: 45000,
    },
    {
      id: SHIP_MAINT_IDS.freelancerUpgrade,
      shipId: prospectorId || 'ship-freelancer-placeholder',
      ownerId: USER_IDS.trader,
      maintenanceType: 'upgrade',
      scheduledDate: daysFromNow(2),
      status: 'scheduled',
      description: 'Cargo bay expansion and quantum drive upgrade to XL-1.',
      cost: 15000,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ ShipMaintenance already exists: ${d.id}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ ShipMaintenance: ${d.id}`);
    }
  }
}

// ─── 55. Cargo Manifests ────────────────────────────────────────────────────

async function seedCargoManifests(): Promise<void> {
  console.log('─── Seeding Cargo Manifests ───');
  const repo = AppDataSource.getRepository(CargoManifest);
  const items = [
    {
      id: CARGO_MANIFEST_IDS.laraniteHaul,
      shipId: ORG_SHIP_IDS.tradingHull,
      ownerId: USER_IDS.trader,
      cargo: [
        { name: 'Laranite', quantity: 400, unit: 'SCU', value: 11400 },
        { name: 'Titanium', quantity: 200, unit: 'SCU', value: 1600 },
      ],
      status: 'in_transit',
      origin: 'Lorville',
      destination: 'Area18',
      departureDate: daysAgo(1),
      sharedWithFleet: true,
    },
    {
      id: CARGO_MANIFEST_IDS.medSupplies,
      shipId: ORG_SHIP_IDS.tradingBMM,
      ownerId: USER_IDS.medic,
      cargo: [
        { name: 'Medical Supplies', quantity: 100, unit: 'SCU', value: 5000 },
        { name: 'Stims', quantity: 50, unit: 'SCU', value: 2000 },
      ],
      status: 'loading',
      origin: 'Orison',
      destination: 'GrimHEX',
      sharedWithFleet: false,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ CargoManifest already exists: ${d.id}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ CargoManifest: ${d.id}`);
    }
  }
}

// ─── 56. Fleet Logistics ────────────────────────────────────────────────────

async function seedFleetLogistics(): Promise<void> {
  console.log('─── Seeding Fleet Logistics ───');
  const repo = AppDataSource.getRepository(FleetLogistics);
  const items = [
    {
      id: FLEET_LOGISTICS_IDS.operationStarfall,
      fleetId: FLEET_IDS.alpha,
      operationName: 'Operation Starfall',
      coordinatorId: USER_IDS.commander,
      status: 'planning',
      description: 'Multi-ship assault on pirate stronghold in Yela asteroid belt.',
      ships: [
        { shipId: ORG_SHIP_IDS.fleetHammerhead, role: 'flagship' },
        { shipId: ORG_SHIP_IDS.fleetIdris, role: 'capital' },
      ],
      resources: [{ type: 'fuel', required: 5000, available: 4200 }],
      route: [
        { name: 'Port Olisar', type: 'staging' },
        { name: 'Yela Asteroid Belt', type: 'objective' },
      ],
      totalFuelCapacity: 8000,
      totalCargoCapacity: 2000,
      totalFuelRequired: 5000,
      totalCargoUsed: 500,
    },
    {
      id: FLEET_LOGISTICS_IDS.miningExpedition,
      fleetId: FLEET_IDS.mining,
      operationName: 'Deep Core Expedition',
      coordinatorId: USER_IDS.miner,
      status: 'in_progress',
      description: 'Extended mining operation in Aaron Halo.',
      ships: [
        { shipId: ORG_SHIP_IDS.miningOrion, role: 'main' },
        { shipId: ORG_SHIP_IDS.miningMole, role: 'support' },
      ],
      resources: [{ type: 'fuel', required: 3000, available: 3000 }],
      route: [
        { name: 'Lorville', type: 'staging' },
        { name: 'Aaron Halo Belt', type: 'objective' },
      ],
      totalFuelCapacity: 6000,
      totalCargoCapacity: 10000,
      totalFuelRequired: 3000,
      totalCargoUsed: 4500,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ FleetLogistics already exists: ${d.operationName}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ FleetLogistics: ${d.operationName}`);
    }
  }
}

// ─── 57. Logistics Alerts ───────────────────────────────────────────────────

async function seedLogisticsAlerts(): Promise<void> {
  console.log('─── Seeding Logistics Alerts ───');
  const repo = AppDataSource.getRepository(LogisticsAlert);
  const items = [
    {
      fleetId: FLEET_IDS.alpha,
      inventoryItemId: 'inv-fuel-alpha',
      itemName: 'Hydrogen Fuel',
      type: 'low_stock',
      severity: 'warning',
      status: 'active',
      title: 'Low Fuel Warning — Alpha Strike Fleet',
      message: 'Hydrogen fuel reserves at 35%. Refuel before Operation Starfall.',
      recipients: [USER_IDS.commander, USER_IDS.engineer],
      notificationChannels: ['in_app', 'discord'],
      autoResolve: true,
    },
    {
      fleetId: FLEET_IDS.mining,
      inventoryItemId: 'inv-repair-kits',
      itemName: 'Repair Kits',
      type: 'reorder_point',
      severity: 'info',
      status: 'acknowledged',
      title: 'Reorder Point — Mining Repair Kits',
      message: 'Repair kit stock has reached reorder threshold. 15 units remaining.',
      recipients: [USER_IDS.miner],
      notificationChannels: ['in_app'],
      acknowledgedBy: USER_IDS.miner,
      acknowledgedAt: daysAgo(1),
      autoResolve: false,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { fleetId: d.fleetId, itemName: d.itemName } });
    if (exists) {
      console.log(`  ○ LogisticsAlert already exists: ${d.itemName}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ LogisticsAlert: ${d.itemName}`);
    }
  }
}

// ─── 58. Event Attendance Confirmations ─────────────────────────────────────

async function seedEventAttendanceConfirmations(): Promise<void> {
  console.log('─── Seeding Event Attendance Confirmations ───');
  const repo = AppDataSource.getRepository(EventAttendanceConfirmation);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      eventId: MISSION_IDS.patrolCrusader,
      userId: USER_IDS.commander,
      status: 'attended',
      rsvpStatus: 'accepted',
      rsvpRole: 'Fleet Commander',
      actualRole: 'Fleet Commander',
      checkInTime: daysAgo(5),
      checkOutTime: daysAgo(5),
      durationMinutes: 180,
      autoConfirmed: false,
      excusedAbsence: false,
      notificationSent: true,
      confirmedBy: USER_IDS.admiral,
      confirmedAt: daysAgo(5),
    },
    {
      organizationId: ORG_IDS.fleet,
      eventId: MISSION_IDS.patrolCrusader,
      userId: USER_IDS.rookie,
      status: 'no_show',
      rsvpStatus: 'accepted',
      autoConfirmed: false,
      excusedAbsence: true,
      absenceReason: 'Ship malfunction — thrusters offline.',
      notificationSent: true,
    },
    {
      organizationId: ORG_IDS.mining,
      eventId: MISSION_IDS.mineAaron,
      userId: USER_IDS.miner,
      status: 'attended',
      rsvpStatus: 'accepted',
      rsvpRole: 'Mining Lead',
      actualRole: 'Mining Lead',
      checkInTime: daysAgo(3),
      durationMinutes: 240,
      autoConfirmed: true,
      excusedAbsence: false,
      notificationSent: true,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { eventId: d.eventId, userId: d.userId } });
    if (exists) {
      console.log(
        `  ○ EventAttendance already exists: event ${d.eventId.slice(-1)} user ${d.userId.slice(-3)}`
      );
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ EventAttendance: event ${d.eventId.slice(-1)} user ${d.userId.slice(-3)}`);
    }
  }
}

// ─── 59. Activity Reminders ─────────────────────────────────────────────────

async function seedActivityReminders(): Promise<void> {
  console.log('─── Seeding Activity Reminders ───');
  const repo = AppDataSource.getRepository(ActivityReminder);
  const items = [
    {
      activityId: MISSION_IDS.escortConvoy,
      reminderType: '1_hour_before',
      channel: 'discord',
      scheduledTime: daysFromNow(1),
      deliveryStatus: 'pending',
      messageTemplate: 'Reminder: **Convoy Escort** starts in 1 hour! Check your loadout.',
      recipientUserIds: [USER_IDS.commander, USER_IDS.bountyHunter, USER_IDS.medic],
      discordChannelId: '7777777777777777777',
      isEnabled: true,
      createdBy: USER_IDS.commander,
    },
    {
      activityId: MISSION_IDS.mineAaron,
      reminderType: '1_day_before',
      channel: 'discord',
      scheduledTime: daysAgo(1),
      deliveryStatus: 'sent',
      sentAt: daysAgo(1),
      messageTemplate: 'Mining operation tomorrow at Aaron Halo. Prospectors report to Lorville.',
      recipientUserIds: [USER_IDS.miner, USER_IDS.engineer],
      discordChannelId: '8888888888888888888',
      isEnabled: true,
      createdBy: USER_IDS.miner,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { activityId: d.activityId, reminderType: d.reminderType as any },
    });
    if (exists) {
      console.log(`  ○ ActivityReminder already exists: ${d.reminderType}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ ActivityReminder: ${d.reminderType}`);
    }
  }
}

// ─── 60. Member Audit Events ────────────────────────────────────────────────

async function seedMemberAuditEvents(): Promise<void> {
  console.log('─── Seeding Member Audit Events ───');
  const repo = AppDataSource.getRepository(MemberAuditEvent);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.pirate,
      flagType: 'suspicious_activity',
      severity: 'HIGH',
      status: 'OPEN',
      description: 'Multiple failed login attempts from unknown IP addresses detected.',
      isAutoGenerated: true,
      metadata: { failedAttempts: 5, ipAddresses: ['192.168.1.100', '10.0.0.50'] },
    },
    {
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.rookie,
      flagType: 'inactivity',
      severity: 'INFO',
      status: 'OPEN',
      description: 'Member has not participated in any activities for 14 days.',
      isAutoGenerated: true,
    },
    {
      organizationId: ORG_IDS.mining,
      userId: USER_IDS.miner,
      flagType: 'role_change',
      severity: 'MEDIUM',
      status: 'OPEN',
      description: 'Member promoted to Mining Lead. Awaiting admin review.',
      isAutoGenerated: false,
      resolvedBy: USER_IDS.commander,
      resolvedAt: daysAgo(1),
      resolutionNote: 'Approved — excellent performance record.',
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { organizationId: d.organizationId, userId: d.userId, flagType: d.flagType as any },
    });
    if (exists) {
      console.log(`  ○ MemberAuditEvent already exists: ${d.flagType}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ MemberAuditEvent: ${d.flagType}`);
    }
  }
}

// ─── 61. Bounty Evidence ────────────────────────────────────────────────────

async function seedBountyEvidence(): Promise<void> {
  console.log('─── Seeding Bounty Evidence ───');
  const repo = AppDataSource.getRepository(BountyEvidence);
  const claimRepo = AppDataSource.getRepository(BountyClaim);
  const claim = await claimRepo.findOne({ where: { bountyId: BOUNTY_IDS.pirateLord } });
  if (!claim) {
    console.log('  ⚠ No bounty claims found — skipping BountyEvidence');
    return;
  }
  const items = [
    {
      claimId: claim.id,
      evidenceType: 'screenshot',
      content: 'Combat engagement recording showing pirate lord destruction at Yela.',
      fileUrl: '/evidence/pirate-lord-kill-001.png',
      fileName: 'pirate-lord-kill-001.png',
      fileSize: 2048000,
      mimeType: 'image/png',
      submittedBy: USER_UUIDS.bountyHunter,
      submittedAt: daysAgo(3),
    },
    {
      claimId: claim.id,
      evidenceType: 'text',
      content:
        'Witness testimony: Confirmed kill by Helena Voss at coordinates 23.4, -45.6, Yela orbit.',
      submittedBy: USER_UUIDS.commander,
      submittedAt: daysAgo(3),
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: {
        claimId: d.claimId,
        evidenceType: d.evidenceType as any,
        submittedBy: d.submittedBy,
      },
    });
    if (exists) {
      console.log(`  ○ BountyEvidence already exists: ${d.evidenceType}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ BountyEvidence: ${d.evidenceType}`);
    }
  }
}

// ─── 62. Intel Approvals ────────────────────────────────────────────────────

async function seedIntelApprovals(): Promise<void> {
  console.log('─── Seeding Intel Approvals ───');
  const repo = AppDataSource.getRepository(IntelApproval);
  const intelRepo = AppDataSource.getRepository(IntelEntry);
  const intelEntries = await intelRepo.find({ take: 2 });
  if (intelEntries.length === 0) {
    console.log('  ⚠ No intel entries found — skipping IntelApprovals');
    return;
  }
  const items = [
    {
      id: INTEL_APPROVAL_IDS.vanduulMovement,
      organizationId: ORG_IDS.intel,
      intelEntryId: intelEntries[0].id,
      requestedBy: USER_IDS.explorer,
      status: 'approved',
      reason: 'Critical Vanduul fleet movement intelligence for alliance defense.',
      requiredApprovals: 2,
      approvers: [USER_IDS.commander, USER_IDS.diplomat],
      completedAt: daysAgo(2),
      completedBy: USER_IDS.commander,
    },
    ...(intelEntries.length > 1
      ? [
          {
            id: INTEL_APPROVAL_IDS.pirateBase,
            organizationId: ORG_IDS.intel,
            intelEntryId: intelEntries[1].id,
            requestedBy: USER_IDS.bountyHunter,
            status: 'pending',
            reason: 'Pirate base location — requesting approval for wider distribution.',
            requiredApprovals: 2,
            expiresAt: daysFromNow(5),
          },
        ]
      : []),
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ IntelApproval already exists: ${d.id}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ IntelApproval: ${d.id}`);
    }
  }
}

// ─── 63. Intel Officers ─────────────────────────────────────────────────────

async function seedIntelOfficers(): Promise<void> {
  console.log('─── Seeding Intel Officers ───');
  const repo = AppDataSource.getRepository(IntelOfficer);
  const items = [
    {
      id: INTEL_OFFICER_IDS.commanderOfficer,
      organizationId: ORG_IDS.intel,
      userId: USER_IDS.commander,
      rank: 'chief',
      accessLevel: 'full',
      isActive: true,
      appointedBy: USER_IDS.admiral,
      specializations: 'military,vanduul,strategic',
    },
    {
      id: INTEL_OFFICER_IDS.diplomatOfficer,
      organizationId: ORG_IDS.intel,
      userId: USER_IDS.diplomat,
      rank: 'senior',
      accessLevel: 'full',
      isActive: true,
      appointedBy: USER_IDS.commander,
      specializations: 'diplomatic,economic,alliance',
    },
    {
      id: INTEL_OFFICER_IDS.explorerOfficer,
      organizationId: ORG_IDS.intel,
      userId: USER_IDS.explorer,
      rank: 'officer',
      accessLevel: 'read',
      isActive: true,
      appointedBy: USER_IDS.commander,
      specializations: 'exploration,mapping,recon',
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ IntelOfficer already exists: ${d.rank}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ IntelOfficer: ${d.rank}`);
    }
  }
}

// ─── 64. Intel Shares ───────────────────────────────────────────────────────

async function seedIntelShares(): Promise<void> {
  console.log('─── Seeding Intel Shares ───');
  const repo = AppDataSource.getRepository(IntelShare);
  const intelRepo = AppDataSource.getRepository(IntelEntry);
  const intelEntry = await intelRepo.findOne({ where: { organizationId: ORG_IDS.intel } });
  if (!intelEntry) {
    console.log('  ⚠ No intel entries found — skipping IntelShares');
    return;
  }
  const items = [
    {
      id: INTEL_SHARE_IDS.vanduulIntel,
      intelEntryId: intelEntry.id,
      sourceOrganizationId: ORG_IDS.intel,
      targetOrganizationId: ORG_IDS.fleet,
      permission: 'view',
      status: 'active',
      maxClassification: 'restricted',
      sharedBy: USER_IDS.commander,
      acceptedBy: USER_IDS.admiral,
      acceptedAt: daysAgo(2),
      shareReason: 'Critical defense intelligence sharing per alliance agreement.',
      viewCount: 5,
    },
    {
      id: INTEL_SHARE_IDS.tradeRoutes,
      intelEntryId: intelEntry.id,
      sourceOrganizationId: ORG_IDS.intel,
      targetOrganizationId: ORG_IDS.trading,
      permission: 'view',
      status: 'pending',
      maxClassification: 'restricted',
      sharedBy: USER_IDS.diplomat,
      shareReason: 'Trade route safety data for partner organization.',
      viewCount: 0,
      expiresAt: daysFromNow(30),
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ IntelShare already exists: ${d.id}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ IntelShare: ${d.id}`);
    }
  }
}

// ─── 65. Tunnels ────────────────────────────────────────────────────────────

async function seedTunnels(): Promise<void> {
  console.log('─── Seeding Tunnels ───');
  const repo = AppDataSource.getRepository(Tunnel);
  const items = [
    {
      id: TUNNEL_IDS.stantonBridge,
      name: 'Stanton Alliance Bridge',
      creatorGuildId: GUILD_IDS_MAP.fleet,
      creatorChannelId: '1100000000000000001',
      isPublic: true,
      connectedChannels: [
        { guildId: GUILD_IDS_MAP.fleet, channelId: '1100000000000000001' },
        { guildId: GUILD_IDS_MAP.mining, channelId: '1100000000000000002' },
      ],
      contentFilterEnabled: true,
      organizationId: ORG_IDS.fleet,
    },
    {
      id: TUNNEL_IDS.intelChannel,
      name: 'Intel Secure Channel',
      creatorGuildId: GUILD_IDS_MAP.fleet,
      creatorChannelId: '1100000000000000003',
      isPublic: false,
      connectedChannels: [{ guildId: GUILD_IDS_MAP.fleet, channelId: '1100000000000000003' }],
      contentFilterEnabled: true,
      organizationId: ORG_IDS.intel,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ Tunnel already exists: ${d.name}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ Tunnel: ${d.name}`);
    }
  }

  // Seed sample tunnels for any real connected guilds (non-demo)
  const goRepo = AppDataSource.getRepository(GuildOrganization);
  const realGuilds = await goRepo.find({ where: { isActive: true } });
  const demoGuildIds = new Set(Object.values(GUILD_IDS_MAP));

  for (const guild of realGuilds) {
    if (demoGuildIds.has(guild.guildId)) continue;

    const dynamicId = `tunnel-dynamic-${guild.guildId.slice(-8)}-001`;
    const exists = await repo.findOne({ where: { id: dynamicId } });
    if (exists) {
      console.log(
        `  ○ Dynamic tunnel already exists for guild ${guild.guildName ?? guild.guildId}`
      );
      continue;
    }

    const sampleTunnels = [
      {
        id: dynamicId,
        name: 'Alliance Comms',
        inviteCode: guild.guildId.slice(-6),
        creatorGuildId: guild.guildId,
        creatorChannelId: `${guild.guildId}-ch1`,
        isPublic: true,
        connectedChannels: [
          { guildId: guild.guildId, channelId: `${guild.guildId}-ch1`, connectedAt: new Date() },
        ],
        contentFilterEnabled: true,
        allowBotMessages: true,
        maxConnectedServers: 0,
        organizationId: guild.organizationId,
      },
      {
        id: `tunnel-dynamic-${guild.guildId.slice(-8)}-002`,
        name: 'Intel Relay',
        inviteCode: guild.guildId.slice(-7, -1),
        creatorGuildId: guild.guildId,
        creatorChannelId: `${guild.guildId}-ch2`,
        isPublic: false,
        connectedChannels: [
          { guildId: guild.guildId, channelId: `${guild.guildId}-ch2`, connectedAt: new Date() },
        ],
        contentFilterEnabled: true,
        allowBotMessages: true,
        maxConnectedServers: 0,
        organizationId: guild.organizationId,
      },
      {
        id: `tunnel-dynamic-${guild.guildId.slice(-8)}-003`,
        name: 'Trade Network',
        inviteCode: guild.guildId.slice(-5) + 'T',
        creatorGuildId: guild.guildId,
        creatorChannelId: `${guild.guildId}-ch3`,
        isPublic: true,
        connectedChannels: [
          { guildId: guild.guildId, channelId: `${guild.guildId}-ch3`, connectedAt: new Date() },
        ],
        contentFilterEnabled: false,
        allowBotMessages: true,
        maxConnectedServers: 10,
        organizationId: guild.organizationId,
      },
    ];

    for (const t of sampleTunnels) {
      const tExists = await repo.findOne({ where: { id: t.id } });
      if (!tExists) {
        await repo.save(repo.create(t as any));
        console.log(`  ✓ Dynamic tunnel: ${t.name} (guild: ${guild.guildName ?? guild.guildId})`);
      }
    }
  }
}

// ─── 66. RSI User Links ────────────────────────────────────────────────────

async function seedRsiUserLinks(): Promise<void> {
  console.log('─── Seeding RSI User Links ───');
  const repo = AppDataSource.getRepository(RsiUserLink);
  const items = [
    {
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      rsiHandle: 'CommanderShepard',
      verificationMethod: 'bio_code',
      syncStatus: 'synced',
      verifiedAt: daysAgo(30),
      lastSyncedAt: daysAgo(1),
      lastKnownRank: 'Commanding Officer',
      isAffiliate: false,
    },
    {
      userId: USER_IDS.miner,
      organizationId: ORG_IDS.mining,
      rsiHandle: 'DeepCoreMike',
      verificationMethod: 'bio_code',
      syncStatus: 'synced',
      verifiedAt: daysAgo(25),
      lastSyncedAt: daysAgo(1),
      lastKnownRank: 'Foreman',
      isAffiliate: false,
    },
    {
      userId: USER_IDS.diplomat,
      organizationId: ORG_IDS.fleet,
      rsiHandle: 'AmbassadorLee',
      verificationMethod: 'manual',
      syncStatus: 'synced',
      verifiedAt: daysAgo(20),
      lastSyncedAt: daysAgo(2),
      lastKnownRank: 'Diplomat',
      isAffiliate: true,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { userId: d.userId, organizationId: d.organizationId },
    });
    if (exists) {
      console.log(`  ○ RsiUserLink already exists: ${d.rsiHandle}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ RsiUserLink: ${d.rsiHandle}`);
    }
  }
}

// ─── 67. RSI Role Mappings ──────────────────────────────────────────────────

async function seedRsiRoleMappings(): Promise<void> {
  console.log('─── Seeding RSI Role Mappings ───');
  const repo = AppDataSource.getRepository(RsiRoleMapping);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      rsiRank: 'Commanding Officer',
      discordRoleId: '9900000000000000001',
      isActive: true,
      priority: 100,
      description: 'Maps RSI Commanding Officer rank to Discord Fleet Commander role.',
    },
    {
      organizationId: ORG_IDS.fleet,
      rsiRank: 'Officer',
      discordRoleId: '9900000000000000002',
      isActive: true,
      priority: 80,
      description: 'Maps RSI Officer rank to Discord Officer role.',
    },
    {
      organizationId: ORG_IDS.mining,
      rsiRank: 'Foreman',
      discordRoleId: '9900000000000000003',
      isActive: true,
      priority: 90,
      description: 'Maps RSI Foreman rank to Discord Mining Lead role.',
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { organizationId: d.organizationId, rsiRank: d.rsiRank },
    });
    if (exists) {
      console.log(`  ○ RsiRoleMapping already exists: ${d.rsiRank}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ RsiRoleMapping: ${d.rsiRank}`);
    }
  }
}

// ─── 68. External Integrations ──────────────────────────────────────────────

async function seedExternalIntegrations(): Promise<void> {
  console.log('─── Seeding External Integrations ───');
  const repo = AppDataSource.getRepository(ExternalIntegration);
  const items = [
    {
      fleetId: FLEET_IDS.alpha,
      name: 'Fleet Tracker API',
      type: 'rest_api',
      status: 'active',
      syncDirection: 'outbound',
      description: 'Exports fleet composition data to external tracker.',
      authConfig: { type: 'api_key', key: 'demo-key-placeholder' },
      fieldMappings: [
        { source: 'shipName', target: 'name' },
        { source: 'status', target: 'state' },
      ],
      autoSync: true,
      syncIntervalMinutes: 60,
      totalSyncs: 24,
      successfulSyncs: 22,
      failedSyncs: 2,
      enabled: true,
      createdBy: USER_IDS.engineer,
    },
    {
      fleetId: FLEET_IDS.trade,
      name: 'Trade Data Webhook',
      type: 'webhook',
      status: 'active',
      syncDirection: 'inbound',
      description: 'Receives commodity price updates from external source.',
      authConfig: { type: 'hmac', secret: 'SEED_DATA_NOT_A_REAL_SECRET' },
      fieldMappings: [{ source: 'price', target: 'currentPrice' }],
      autoSync: false,
      totalSyncs: 150,
      successfulSyncs: 148,
      failedSyncs: 2,
      enabled: true,
      createdBy: USER_IDS.trader,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { fleetId: d.fleetId, name: d.name } });
    if (exists) {
      console.log(`  ○ ExternalIntegration already exists: ${d.name}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ ExternalIntegration: ${d.name}`);
    }
  }
}

// ─── 69. Webhooks ───────────────────────────────────────────────────────────

async function seedWebhooks(): Promise<void> {
  console.log('─── Seeding Webhooks ───');
  const repo = AppDataSource.getRepository(Webhook);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      name: 'Fleet Activity Notifications',
      type: 'discord',
      status: 'active',
      enabled: true,
      events: ['fleet_updated', 'member_joined', 'operation_started'],
      discordConfig: { webhookUrl: 'https://discord.com/api/webhooks/demo/fleet-alerts' },
      description: 'Posts fleet activity notifications to Discord.',
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 30000,
      totalDeliveries: 45,
      successfulDeliveries: 44,
      failedDeliveries: 1,
      createdBy: USER_IDS.commander,
    },
    {
      organizationId: ORG_IDS.mining,
      name: 'Mining Operation Alerts',
      type: 'discord',
      status: 'active',
      enabled: true,
      events: ['mining_operation_started', 'mining_operation_completed'],
      discordConfig: { webhookUrl: 'https://discord.com/api/webhooks/demo/mining-alerts' },
      description: 'Posts mining operation status updates.',
      maxRetries: 3,
      totalDeliveries: 28,
      successfulDeliveries: 28,
      failedDeliveries: 0,
      createdBy: USER_IDS.miner,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: { organizationId: d.organizationId, name: d.name },
    });
    if (exists) {
      console.log(`  ○ Webhook already exists: ${d.name}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ Webhook: ${d.name}`);
    }
  }
}

// ─── 70. Briefings ──────────────────────────────────────────────────────────

async function seedBriefings(): Promise<void> {
  console.log('─── Seeding Briefings ───');
  const repo = AppDataSource.getRepository(Briefing);
  const items = [
    {
      id: BRIEFING_IDS.operationBrief,
      title: 'Operation Starfall Briefing',
      organizationId: ORG_IDS.fleet,
      creatorId: USER_IDS.commander,
      missionId: MISSION_IDS.patrolCrusader,
      elements: [
        { type: 'header', content: 'Operation Starfall — Combat Briefing' },
        { type: 'text', content: 'Objective: Neutralize pirate stronghold in Yela asteroid belt.' },
        {
          type: 'waypoint',
          content: 'Staging: Port Olisar > Transit: Yela > Target: Asteroid Base',
        },
        { type: 'text', content: 'Rules of Engagement: Weapons free on hostile contacts.' },
      ],
      status: 'active',
      participants: [USER_IDS.commander, USER_IDS.bountyHunter, USER_IDS.medic, USER_IDS.engineer],
      tags: ['combat', 'pirate', 'yela'],
      version: 1,
    },
    {
      id: BRIEFING_IDS.miningBrief,
      title: 'Deep Core Mining Expedition',
      organizationId: ORG_IDS.mining,
      creatorId: USER_IDS.miner,
      elements: [
        { type: 'header', content: 'Deep Core Expedition — Mining Briefing' },
        { type: 'text', content: 'Target: High-yield quantanium deposits in Aaron Halo.' },
        {
          type: 'text',
          content: 'Safety: All ships maintain 500m safe distance during extraction.',
        },
      ],
      status: 'active',
      participants: [USER_IDS.miner, USER_IDS.engineer, USER_IDS.rookie],
      tags: ['mining', 'quantanium', 'aaron-halo'],
      version: 1,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ Briefing already exists: ${d.title.slice(0, 30)}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ Briefing: ${d.title.slice(0, 30)}`);
    }
  }
}

// ─── 71. AI Usage Tracking ──────────────────────────────────────────────────

async function seedAIUsageTracking(): Promise<void> {
  console.log('─── Seeding AI Usage Tracking ───');
  const repo = AppDataSource.getRepository(AIUsageTracking);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      featureType: 'briefing_generation',
      usageDate: yesterday,
      requestCount: 3,
      promptTokens: 1500,
      completionTokens: 2000,
      totalTokens: 3500,
      lastModelUsed: 'gpt-4o-mini',
      lastRequestByUserId: USER_IDS.commander,
    },
    {
      organizationId: ORG_IDS.mining,
      featureType: 'briefing_generation',
      usageDate: today,
      requestCount: 1,
      promptTokens: 500,
      completionTokens: 800,
      totalTokens: 1300,
      lastModelUsed: 'gpt-4o-mini',
      lastRequestByUserId: USER_IDS.miner,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: {
        organizationId: d.organizationId,
        featureType: d.featureType as any,
        usageDate: d.usageDate,
      },
    });
    if (exists) {
      console.log(`  ○ AIUsageTracking already exists: ${d.featureType} ${d.usageDate}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ AIUsageTracking: ${d.featureType} ${d.usageDate}`);
    }
  }
}

// ─── 72. Tournaments ────────────────────────────────────────────────────────

async function seedTournaments(): Promise<void> {
  console.log('─── Seeding Tournaments ───');
  const repo = AppDataSource.getRepository(Tournament);
  const items = [
    {
      id: TOURNAMENT_IDS.arenaCommander,
      name: 'Stanton Arena Commander Championship',
      description:
        'Annual 1v1 dogfight tournament. All ship classes welcome. Double elimination bracket.',
      organizerId: USER_IDS.commander,
      startDate: daysFromNow(7),
      endDate: daysFromNow(14),
      status: 'registration',
      maxParticipants: 16,
      prizePool: '500,000 aUEC + Rare Ship Skin',
      rules: '1v1 dogfight. No ramming. Standard loadouts only. Best of 3 rounds.',
      participants: [
        {
          userId: USER_IDS.commander,
          name: 'Commander Shepard',
          registeredAt: new Date().toISOString(),
        },
        {
          userId: USER_IDS.bountyHunter,
          name: 'Helena Voss',
          registeredAt: new Date().toISOString(),
        },
        {
          userId: USER_IDS.pirate,
          name: 'Blackjack Morgan',
          registeredAt: new Date().toISOString(),
        },
      ],
      matches: [],
    },
    {
      id: TOURNAMENT_IDS.miningChampionship,
      name: 'Deep Core Mining Championship',
      description:
        'Speed mining competition in Aaron Halo. Most refined ore value in 2 hours wins.',
      organizerId: USER_IDS.miner,
      startDate: daysFromNow(14),
      status: 'registration',
      maxParticipants: 8,
      prizePool: '250,000 aUEC',
      rules: 'Solo mining only. Prospector/Mole class. 2-hour timer. Highest ore value wins.',
      participants: [
        { userId: USER_IDS.miner, name: 'Mike Miller', registeredAt: new Date().toISOString() },
      ],
      matches: [],
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (exists) {
      console.log(`  ○ Tournament already exists: ${d.name.slice(0, 30)}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ Tournament: ${d.name.slice(0, 30)}`);
    }
  }
}

// ─── 73. Moderation Incidents ───────────────────────────────────────────────

async function seedModerationIncidents(): Promise<void> {
  console.log('─── Seeding Moderation Incidents ───');
  const repo = AppDataSource.getRepository(ModerationIncident);
  const items = [
    {
      organizationId: ORG_IDS.fleet,
      guildId: GUILD_IDS_MAP.fleet,
      guildName: 'Stardust Expeditionary',
      targetDiscordId: '5500000000000000001',
      targetUsername: 'toxic_pilot_99',
      moderatorId: USER_IDS.commander,
      moderatorDiscordId: '5500000000000000002',
      moderatorUsername: 'CommanderShepard',
      incidentType: 'warning',
      severity: 1,
      status: 'active',
      reason: 'Toxic behavior in voice chat during fleet operation. First offense.',
      isShared: false,
      isAutoDetected: false,
    },
    {
      organizationId: ORG_IDS.fleet,
      guildId: GUILD_IDS_MAP.fleet,
      guildName: 'Stardust Expeditionary',
      targetDiscordId: '5500000000000000003',
      targetUsername: 'spammer_bot_42',
      moderatorId: USER_IDS.admiral,
      moderatorDiscordId: '5500000000000000004',
      moderatorUsername: 'AdmiralChen',
      incidentType: 'ban',
      severity: 5,
      status: 'active',
      reason: 'Automated spam bot detected. Permanent ban.',
      isShared: true,
      isAutoDetected: true,
    },
  ];
  for (const d of items) {
    const exists = await repo.findOne({
      where: {
        guildId: d.guildId,
        targetDiscordId: d.targetDiscordId,
        incidentType: d.incidentType as any,
      },
    });
    if (exists) {
      console.log(`  ○ ModerationIncident already exists: ${d.targetUsername}`);
    } else {
      await repo.save(repo.create(d as any));
      console.log(`  ✓ ModerationIncident: ${d.targetUsername}`);
    }
  }
}

// ─── 74. Mirror Actions ─────────────────────────────────────────────────────

async function seedMirrorActions(): Promise<void> {
  console.log('─── Seeding Mirror Actions ───');
  const repo = AppDataSource.getRepository(MirrorAction);
  const incidentRepo = AppDataSource.getRepository(ModerationIncident);
  const incident = await incidentRepo.findOne({
    where: { guildId: GUILD_IDS_MAP.fleet, isShared: true },
  });
  if (!incident) {
    console.log('  ⚠ No shared incidents found — skipping MirrorActions');
    return;
  }
  const d = {
    organizationId: ORG_IDS.fleet,
    sourceIncidentId: incident.id,
    sourceOrganizationId: ORG_IDS.fleet,
    sourceGuildId: GUILD_IDS_MAP.fleet,
    sourceGuildName: 'Stardust Expeditionary',
    targetDiscordId: '5500000000000000003',
    targetUsername: 'spammer_bot_42',
    targetGuildId: GUILD_IDS_MAP.mining,
    targetGuildName: 'Deep Core Mining',
    actionType: 'ban',
    severity: 5,
    status: 'confirmed',
    reason: 'Mirrored ban: Automated spam bot.',
    originalReason: 'Automated spam bot detected. Permanent ban.',
    moderatorId: USER_UUIDS.commander,
    moderatorUsername: 'CommanderShepard',
    confirmationRequired: false,
    confirmedAt: daysAgo(1),
    executedAt: daysAgo(1),
    isBulkMirror: false,
  };
  const exists = await repo.findOne({
    where: { targetDiscordId: d.targetDiscordId, targetGuildId: d.targetGuildId },
  });
  if (exists) {
    console.log('  ○ MirrorAction already exists');
  } else {
    await repo.save(repo.create(d as any));
    console.log('  ✓ MirrorAction: spam bot ban mirror');
  }
}

// ─── 75. Mirrored Activities ────────────────────────────────────────────────

async function seedMirroredActivities(): Promise<void> {
  console.log('─── Seeding Mirrored Activities ───');
  const repo = AppDataSource.getRepository(MirroredActivity);
  const d = {
    organizationId: ORG_IDS.fleet,
    sourceActivityId: 'demo-activity-fleet-001',
    sourceGuildId: GUILD_IDS_MAP.fleet,
    sourceOrganizationId: ORG_IDS.fleet,
    mirrorGuildId: GUILD_IDS_MAP.mining,
    mirrorChannelId: '1100000000000000002',
    status: 'active',
    syncEnabled: true,
    mirrorKey: 'fleet-activity-mirror-001',
  };
  const exists = await repo.findOne({
    where: { sourceActivityId: d.sourceActivityId, mirrorGuildId: d.mirrorGuildId },
  });
  if (exists) {
    console.log('  ○ MirroredActivity already exists');
  } else {
    await repo.save(repo.create(d as any));
    console.log('  ✓ MirroredActivity: fleet mirror to mining');
  }
}

// ─── 76. Data Breach Notifications ──────────────────────────────────────────

async function seedDataBreachNotifications(): Promise<void> {
  console.log('─── Seeding Data Breach Notifications ───');
  const repo = AppDataSource.getRepository(DataBreachNotification);
  const d = {
    title: 'Historical Test Breach — Resolved',
    description: 'Test breach notification for compliance verification. No real data was affected.',
    severity: 'low',
    affectedUsers: [USER_IDS.commander],
    affectedDataTypes: ['email', 'username'],
    status: 'RESOLVED',
    notifiedUsers: [{ userId: USER_IDS.commander, notifiedAt: daysAgo(30).toISOString() }],
    notificationErrors: [],
    remediationSteps: ['Password reset enforced', 'Session tokens revoked'],
    recommendations: ['Enable 2FA', 'Review account activity'],
    containedAt: daysAgo(30),
    notifiedAt: daysAgo(30),
    resolvedAt: daysAgo(29),
    internalNotes: 'Compliance drill — not a real breach. Used for testing notification pipeline.',
  };
  const exists = await repo.findOne({ where: { title: d.title } });
  if (exists) {
    console.log('  ○ DataBreachNotification already exists');
  } else {
    await repo.save(repo.create(d as any));
    console.log('  ✓ DataBreachNotification: historical test');
  }
}

// ─── 77. Tags ───────────────────────────────────────────────────────────────

async function seedTags(): Promise<void> {
  console.log('─── Seeding Tags ───');
  const repo = AppDataSource.getRepository(Tag);
  const tags = [
    {
      id: 'dd000000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      name: 'Priority',
      color: '#ef4444',
      description: 'High-priority items',
      createdBy: USER_IDS.commander,
    },
    {
      id: 'dd000000-0000-4000-a000-000000000002',
      organizationId: ORG_IDS.fleet,
      name: 'Combat',
      color: '#f97316',
      description: 'Combat-related',
      createdBy: USER_IDS.commander,
    },
    {
      id: 'dd000000-0000-4000-a000-000000000003',
      organizationId: ORG_IDS.mining,
      name: 'Quantanium',
      color: '#eab308',
      description: 'Quantanium mining ops',
      createdBy: USER_IDS.miner,
    },
    {
      id: 'dd000000-0000-4000-a000-000000000004',
      organizationId: ORG_IDS.trading,
      name: 'Profitable',
      color: '#22c55e',
      description: 'High-profit routes',
      createdBy: USER_IDS.trader,
    },
    {
      id: 'dd000000-0000-4000-a000-000000000005',
      organizationId: ORG_IDS.fleet,
      name: 'Training',
      color: '#3b82f6',
      description: 'Training exercises',
      createdBy: USER_IDS.admiral,
    },
  ];
  let created = 0;
  for (const t of tags) {
    const exists = await repo.findOne({ where: { id: t.id } });
    if (!exists) {
      await repo.save(repo.create(t as any));
      created++;
    }
  }
  console.log(`  ✓ Tags: ${created} created (${tags.length - created} existed)`);
}

// ─── 78. Tag Assignments ────────────────────────────────────────────────────

async function seedTagAssignments(): Promise<void> {
  console.log('─── Seeding Tag Assignments ───');
  const repo = AppDataSource.getRepository(TagAssignment);
  const assignments = [
    {
      tagId: 'dd000000-0000-4000-a000-000000000001',
      resourceType: 'fleet',
      resourceId: FLEET_IDS.alpha,
      assignedBy: USER_IDS.commander,
    },
    {
      tagId: 'dd000000-0000-4000-a000-000000000002',
      resourceType: 'fleet',
      resourceId: FLEET_IDS.alpha,
      assignedBy: USER_IDS.commander,
    },
    {
      tagId: 'dd000000-0000-4000-a000-000000000003',
      resourceType: 'fleet',
      resourceId: FLEET_IDS.mining,
      assignedBy: USER_IDS.miner,
    },
    {
      tagId: 'dd000000-0000-4000-a000-000000000004',
      resourceType: 'fleet',
      resourceId: FLEET_IDS.trade,
      assignedBy: USER_IDS.trader,
    },
    {
      tagId: 'dd000000-0000-4000-a000-000000000005',
      resourceType: 'organization',
      resourceId: ORG_IDS.fleet,
      assignedBy: USER_IDS.admiral,
    },
  ];
  let created = 0;
  for (const a of assignments) {
    const exists = await repo.findOne({
      where: { tagId: a.tagId, resourceType: a.resourceType, resourceId: a.resourceId },
    });
    if (!exists) {
      await repo.save(repo.create(a));
      created++;
    }
  }
  console.log(`  ✓ TagAssignments: ${created} created`);
}

// ─── 79. Comments ───────────────────────────────────────────────────────────

async function seedComments(): Promise<void> {
  console.log('─── Seeding Comments ───');
  const repo = AppDataSource.getRepository(Comment);
  const comments = [
    {
      id: 'ee000000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      content: "Great mission briefing, team! Let's keep this energy going.",
      resourceType: 'fleet',
      resourceId: FLEET_IDS.alpha,
      createdBy: USER_IDS.commander,
      createdByName: 'Cmdr Nova',
    },
    {
      id: 'ee000000-0000-4000-a000-000000000002',
      organizationId: ORG_IDS.fleet,
      content: 'Roger that, Commander. Alpha wing is prepped and ready.',
      resourceType: 'fleet',
      resourceId: FLEET_IDS.alpha,
      createdBy: USER_IDS.admiral,
      createdByName: 'Admiral Sterling',
      parentId: 'ee000000-0000-4000-a000-000000000001',
    },
    {
      id: 'ee000000-0000-4000-a000-000000000003',
      organizationId: ORG_IDS.mining,
      content: 'Found a rich quantanium deposit at Lyria — coordinates shared in the ops channel.',
      resourceType: 'organization',
      resourceId: ORG_IDS.mining,
      createdBy: USER_IDS.miner,
      createdByName: 'Miner Blake',
    },
    {
      id: 'ee000000-0000-4000-a000-000000000004',
      organizationId: ORG_IDS.trading,
      content: 'Laranite prices are spiking at Lorville — great time to sell!',
      resourceType: 'organization',
      resourceId: ORG_IDS.trading,
      createdBy: USER_IDS.trader,
      createdByName: 'Trader Mark',
    },
  ];
  let created = 0;
  for (const c of comments) {
    const exists = await repo.findOne({ where: { id: c.id } });
    if (!exists) {
      await repo.save(repo.create(c as any));
      created++;
    }
  }
  console.log(`  ✓ Comments: ${created} created`);
}

// ─── 80. Comment Likes ──────────────────────────────────────────────────────

async function seedCommentLikes(): Promise<void> {
  console.log('─── Seeding Comment Likes ───');
  const repo = AppDataSource.getRepository(CommentLike);
  const likes = [
    { commentId: 'ee000000-0000-4000-a000-000000000001', userId: USER_IDS.admiral },
    { commentId: 'ee000000-0000-4000-a000-000000000001', userId: USER_IDS.medic },
    { commentId: 'ee000000-0000-4000-a000-000000000003', userId: USER_IDS.engineer },
  ];
  let created = 0;
  for (const l of likes) {
    const exists = await repo.findOne({ where: { commentId: l.commentId, userId: l.userId } });
    if (!exists) {
      await repo.save(repo.create(l));
      created++;
    }
  }
  console.log(`  ✓ CommentLikes: ${created} created`);
}

// ─── 81. Skills ─────────────────────────────────────────────────────────────

async function seedSkills(): Promise<void> {
  console.log('─── Seeding Skills ───');
  const repo = AppDataSource.getRepository(Skill);
  const skills = [
    {
      id: 'ff000000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      name: 'Dogfighting',
      category: SkillCategory.COMBAT,
      createdBy: USER_IDS.commander,
      description: 'Close-range ship-to-ship combat',
    },
    {
      id: 'ff000000-0000-4000-a000-000000000002',
      organizationId: ORG_IDS.fleet,
      name: 'Capital Ship Operations',
      category: SkillCategory.PILOTING,
      createdBy: USER_IDS.admiral,
      description: 'Operating capital-class vessels',
    },
    {
      id: 'ff000000-0000-4000-a000-000000000003',
      organizationId: ORG_IDS.mining,
      name: 'Quantanium Extraction',
      category: SkillCategory.MINING,
      createdBy: USER_IDS.miner,
      description: 'Safe extraction of volatile quantanium',
    },
    {
      id: 'ff000000-0000-4000-a000-000000000004',
      organizationId: ORG_IDS.trading,
      name: 'Commodity Trading',
      category: SkillCategory.TRADING,
      createdBy: USER_IDS.trader,
      description: 'Market analysis and commodity trading',
    },
    {
      id: 'ff000000-0000-4000-a000-000000000005',
      organizationId: ORG_IDS.fleet,
      name: 'Combat Medic',
      category: SkillCategory.MEDICAL,
      createdBy: USER_IDS.medic,
      description: 'Field medical support during combat',
    },
    {
      id: 'ff000000-0000-4000-a000-000000000006',
      organizationId: ORG_IDS.fleet,
      name: 'Field Engineering',
      category: SkillCategory.ENGINEERING,
      createdBy: USER_IDS.engineer,
      description: 'In-field ship repairs and modifications',
    },
  ];
  let created = 0;
  for (const s of skills) {
    const exists = await repo.findOne({ where: { id: s.id } });
    if (!exists) {
      await repo.save(repo.create(s as any));
      created++;
    }
  }
  console.log(`  ✓ Skills: ${created} created`);
}

// ─── 82. User Skills ───────────────────────────────────────────────────────

async function seedUserSkills(): Promise<void> {
  console.log('─── Seeding User Skills ───');
  const repo = AppDataSource.getRepository(UserSkill);
  const userSkills = [
    {
      id: 'ff100000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.commander,
      skillId: 'ff000000-0000-4000-a000-000000000001',
      level: SkillLevel.EXPERT,
      endorsementCount: 5,
    },
    {
      id: 'ff100000-0000-4000-a000-000000000002',
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.admiral,
      skillId: 'ff000000-0000-4000-a000-000000000002',
      level: SkillLevel.EXPERT,
      endorsementCount: 3,
    },
    {
      id: 'ff100000-0000-4000-a000-000000000003',
      organizationId: ORG_IDS.mining,
      userId: USER_IDS.miner,
      skillId: 'ff000000-0000-4000-a000-000000000003',
      level: SkillLevel.ADVANCED,
      endorsementCount: 2,
    },
    {
      id: 'ff100000-0000-4000-a000-000000000004',
      organizationId: ORG_IDS.trading,
      userId: USER_IDS.trader,
      skillId: 'ff000000-0000-4000-a000-000000000004',
      level: SkillLevel.EXPERT,
      endorsementCount: 4,
    },
    {
      id: 'ff100000-0000-4000-a000-000000000005',
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.medic,
      skillId: 'ff000000-0000-4000-a000-000000000005',
      level: SkillLevel.ADVANCED,
      endorsementCount: 3,
    },
    {
      id: 'ff100000-0000-4000-a000-000000000006',
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.engineer,
      skillId: 'ff000000-0000-4000-a000-000000000006',
      level: SkillLevel.INTERMEDIATE,
      endorsementCount: 1,
    },
    {
      id: 'ff100000-0000-4000-a000-000000000007',
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.rookie,
      skillId: 'ff000000-0000-4000-a000-000000000001',
      level: SkillLevel.BEGINNER,
      endorsementCount: 0,
    },
  ];
  let created = 0;
  for (const us of userSkills) {
    const exists = await repo.findOne({ where: { id: us.id } });
    if (!exists) {
      await repo.save(repo.create(us as any));
      created++;
    }
  }
  console.log(`  ✓ UserSkills: ${created} created`);
}

// ─── 83. Skill Endorsements ─────────────────────────────────────────────────

async function seedSkillEndorsements(): Promise<void> {
  console.log('─── Seeding Skill Endorsements ───');
  const repo = AppDataSource.getRepository(SkillEndorsement);
  const endorsements = [
    { userSkillId: 'ff100000-0000-4000-a000-000000000001', endorsedBy: USER_IDS.admiral },
    { userSkillId: 'ff100000-0000-4000-a000-000000000001', endorsedBy: USER_IDS.medic },
    { userSkillId: 'ff100000-0000-4000-a000-000000000002', endorsedBy: USER_IDS.commander },
    { userSkillId: 'ff100000-0000-4000-a000-000000000003', endorsedBy: USER_IDS.engineer },
  ];
  let created = 0;
  for (const e of endorsements) {
    const exists = await repo.findOne({
      where: { userSkillId: e.userSkillId, endorsedBy: e.endorsedBy },
    });
    if (!exists) {
      await repo.save(repo.create(e));
      created++;
    }
  }
  console.log(`  ✓ SkillEndorsements: ${created} created`);
}

// ─── 84. Certifications ─────────────────────────────────────────────────────

async function seedCertifications(): Promise<void> {
  console.log('─── Seeding Certifications ───');
  const repo = AppDataSource.getRepository(Certification);
  const certs = [
    {
      id: 'ff200000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      name: 'Fighter Pilot Certification',
      description: 'Certified combat pilot — passed dogfight evaluation',
      requirements: 'Complete 10 combat missions, pass flight exam',
      createdBy: USER_IDS.commander,
    },
    {
      id: 'ff200000-0000-4000-a000-000000000002',
      organizationId: ORG_IDS.mining,
      name: 'Quantanium Handler',
      description: 'Certified to handle volatile quantanium ore',
      requirements: 'Complete safety training, 5 successful q-mining runs',
      createdBy: USER_IDS.miner,
    },
    {
      id: 'ff200000-0000-4000-a000-000000000003',
      organizationId: ORG_IDS.fleet,
      name: 'Capital Ship Bridge Crew',
      description: 'Qualified to serve on capital ship bridge',
      requirements: 'Bridge duties training, 20 hours crewed ops',
      createdBy: USER_IDS.admiral,
    },
  ];
  let created = 0;
  for (const c of certs) {
    const exists = await repo.findOne({ where: { id: c.id } });
    if (!exists) {
      await repo.save(repo.create(c as any));
      created++;
    }
  }
  console.log(`  ✓ Certifications: ${created} created`);
}

// ─── 85. User Certifications ────────────────────────────────────────────────

async function seedUserCertifications(): Promise<void> {
  console.log('─── Seeding User Certifications ───');
  const repo = AppDataSource.getRepository(UserCertification);
  const userCerts = [
    {
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.commander,
      certificationId: 'ff200000-0000-4000-a000-000000000001',
      status: CertificationStatus.ACTIVE,
      awardedBy: USER_IDS.admiral,
      awardedAt: daysAgo(90),
    },
    {
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.admiral,
      certificationId: 'ff200000-0000-4000-a000-000000000003',
      status: CertificationStatus.ACTIVE,
      awardedBy: USER_IDS.commander,
      awardedAt: daysAgo(120),
    },
    {
      organizationId: ORG_IDS.mining,
      userId: USER_IDS.miner,
      certificationId: 'ff200000-0000-4000-a000-000000000002',
      status: CertificationStatus.ACTIVE,
      awardedBy: USER_IDS.miner,
      awardedAt: daysAgo(60),
    },
    {
      organizationId: ORG_IDS.fleet,
      userId: USER_IDS.bountyHunter,
      certificationId: 'ff200000-0000-4000-a000-000000000001',
      status: CertificationStatus.ACTIVE,
      awardedBy: USER_IDS.commander,
      awardedAt: daysAgo(45),
    },
  ];
  let created = 0;
  for (const uc of userCerts) {
    const exists = await repo.findOne({
      where: {
        organizationId: uc.organizationId,
        userId: uc.userId,
        certificationId: uc.certificationId,
      },
    });
    if (!exists) {
      await repo.save(repo.create(uc as any));
      created++;
    }
  }
  console.log(`  ✓ UserCertifications: ${created} created`);
}

// ─── 86. Achievements ───────────────────────────────────────────────────────

async function seedAchievements(): Promise<void> {
  console.log('─── Seeding Achievements ───');
  const repo = AppDataSource.getRepository(Achievement);
  const achievements = [
    {
      id: 'ff300000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      name: 'First Blood',
      description: 'Participate in your first combat operation',
      category: 'combat',
      rarity: AchievementRarity.COMMON,
      icon: '⚔️',
      createdBy: USER_IDS.commander,
    },
    {
      id: 'ff300000-0000-4000-a000-000000000002',
      organizationId: ORG_IDS.fleet,
      name: 'Ace Pilot',
      description: 'Complete 50 combat sorties with zero losses',
      category: 'combat',
      rarity: AchievementRarity.EPIC,
      icon: '🎖️',
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'ff300000-0000-4000-a000-000000000003',
      organizationId: ORG_IDS.mining,
      name: 'Quantanium King',
      description: 'Successfully mine and sell 100 SCU of quantanium',
      category: 'mining',
      rarity: AchievementRarity.RARE,
      icon: '💎',
      createdBy: USER_IDS.miner,
    },
    {
      id: 'ff300000-0000-4000-a000-000000000004',
      organizationId: ORG_IDS.trading,
      name: 'Trade Baron',
      description: 'Generate 1M aUEC in trade profits',
      category: 'trading',
      rarity: AchievementRarity.LEGENDARY,
      icon: '🏆',
      createdBy: USER_IDS.trader,
    },
    {
      id: 'ff300000-0000-4000-a000-000000000005',
      organizationId: ORG_IDS.fleet,
      name: 'Welcome Aboard',
      description: 'Complete onboarding and first org event',
      category: 'social',
      rarity: AchievementRarity.COMMON,
      icon: '🤝',
      createdBy: USER_IDS.commander,
    },
  ];
  let created = 0;
  for (const a of achievements) {
    const exists = await repo.findOne({ where: { id: a.id } });
    if (!exists) {
      await repo.save(repo.create(a as any));
      created++;
    }
  }
  console.log(`  ✓ Achievements: ${created} created`);
}

// ─── 87. User Achievements ──────────────────────────────────────────────────

async function seedUserAchievements(): Promise<void> {
  console.log('─── Seeding User Achievements ───');
  const repo = AppDataSource.getRepository(UserAchievement);
  const userAchievements = [
    {
      achievementId: 'ff300000-0000-4000-a000-000000000001',
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      awardedBy: USER_IDS.admiral,
      isDisplayed: true,
      displaySlot: 1,
    },
    {
      achievementId: 'ff300000-0000-4000-a000-000000000002',
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      awardedBy: USER_IDS.admiral,
      isDisplayed: true,
      displaySlot: 2,
    },
    {
      achievementId: 'ff300000-0000-4000-a000-000000000005',
      userId: USER_IDS.rookie,
      organizationId: ORG_IDS.fleet,
      awardedBy: USER_IDS.commander,
      isDisplayed: true,
      displaySlot: 1,
    },
    {
      achievementId: 'ff300000-0000-4000-a000-000000000003',
      userId: USER_IDS.miner,
      organizationId: ORG_IDS.mining,
      awardedBy: USER_IDS.miner,
      isDisplayed: true,
      displaySlot: 1,
    },
    {
      achievementId: 'ff300000-0000-4000-a000-000000000004',
      userId: USER_IDS.trader,
      organizationId: ORG_IDS.trading,
      awardedBy: USER_IDS.trader,
      isDisplayed: true,
      displaySlot: 1,
    },
  ];
  let created = 0;
  for (const ua of userAchievements) {
    const exists = await repo.findOne({
      where: { achievementId: ua.achievementId, userId: ua.userId },
    });
    if (!exists) {
      await repo.save(repo.create(ua as any));
      created++;
    }
  }
  console.log(`  ✓ UserAchievements: ${created} created`);
}

// ─── 88. Dashboards ─────────────────────────────────────────────────────────

async function seedDashboards(): Promise<void> {
  console.log('─── Seeding Dashboards ───');
  const repo = AppDataSource.getRepository(Dashboard);
  const dashboards = [
    {
      id: 'ff400000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      name: 'Fleet Command Overview',
      description: 'Real-time fleet status and operations',
      type: DashboardType.FLEET,
      layout: DashboardLayout.GRID,
      createdBy: USER_IDS.commander,
      isDefault: true,
    },
    {
      id: 'ff400000-0000-4000-a000-000000000002',
      organizationId: ORG_IDS.mining,
      name: 'Mining Analytics',
      description: 'Mining operations and yield tracking',
      type: DashboardType.ANALYTICS,
      layout: DashboardLayout.GRID,
      createdBy: USER_IDS.miner,
      isDefault: true,
    },
    {
      id: 'ff400000-0000-4000-a000-000000000003',
      organizationId: ORG_IDS.trading,
      name: 'Trade Operations',
      description: 'Commodity prices and route performance',
      type: DashboardType.OPERATIONS,
      layout: DashboardLayout.LIST,
      createdBy: USER_IDS.trader,
      isDefault: false,
    },
  ];
  let created = 0;
  for (const d of dashboards) {
    const exists = await repo.findOne({ where: { id: d.id } });
    if (!exists) {
      await repo.save(repo.create(d as any));
      created++;
    }
  }
  console.log(`  ✓ Dashboards: ${created} created`);
}

// ─── 89. Dashboard Widgets ──────────────────────────────────────────────────

async function seedDashboardWidgets(): Promise<void> {
  console.log('─── Seeding Dashboard Widgets ───');
  const repo = AppDataSource.getRepository(DashboardWidget);
  const widgets = [
    {
      dashboardId: 'ff400000-0000-4000-a000-000000000001',
      type: 'fleet-status',
      title: 'Fleet Readiness',
      config: { showInactive: false },
      position: { x: 0, y: 0, w: 6, h: 4 },
      sortOrder: 0,
    },
    {
      dashboardId: 'ff400000-0000-4000-a000-000000000001',
      type: 'member-activity',
      title: 'Member Activity Feed',
      config: { limit: 20 },
      position: { x: 6, y: 0, w: 6, h: 4 },
      sortOrder: 1,
    },
    {
      dashboardId: 'ff400000-0000-4000-a000-000000000001',
      type: 'ship-composition',
      title: 'Ship Composition',
      config: { chartType: 'pie' },
      position: { x: 0, y: 4, w: 4, h: 3 },
      sortOrder: 2,
    },
    {
      dashboardId: 'ff400000-0000-4000-a000-000000000002',
      type: 'mining-yield',
      title: 'Mining Yield Tracker',
      config: { period: '7d' },
      position: { x: 0, y: 0, w: 12, h: 4 },
      sortOrder: 0,
    },
    {
      dashboardId: 'ff400000-0000-4000-a000-000000000003',
      type: 'trade-routes',
      title: 'Active Trade Routes',
      config: { showProfit: true },
      position: { x: 0, y: 0, w: 12, h: 6 },
      sortOrder: 0,
    },
  ];
  let created = 0;
  for (const w of widgets) {
    const exists = await repo.findOne({ where: { dashboardId: w.dashboardId, title: w.title } });
    if (!exists) {
      await repo.save(repo.create(w as any));
      created++;
    }
  }
  console.log(`  ✓ DashboardWidgets: ${created} created`);
}

// ─── 90. Equipment ──────────────────────────────────────────────────────────

async function seedEquipment(): Promise<void> {
  console.log('─── Seeding Equipment ───');
  const repo = AppDataSource.getRepository(Equipment);
  const equipment = [
    {
      organizationId: ORG_IDS.fleet,
      name: 'Pembroke Armor Set',
      type: 'armor',
      rarity: EquipmentRarity.UNCOMMON,
      description: 'EVA-rated heavy armor',
      ownerId: USER_IDS.commander,
      status: EquipmentStatus.EQUIPPED,
      quantity: 1,
    },
    {
      organizationId: ORG_IDS.fleet,
      name: 'Behring GP-33 Grenade Launcher',
      type: 'weapon',
      rarity: EquipmentRarity.RARE,
      description: 'Heavy anti-personnel weapon',
      ownerId: USER_IDS.bountyHunter,
      status: EquipmentStatus.AVAILABLE,
      quantity: 2,
    },
    {
      organizationId: ORG_IDS.mining,
      name: 'Greycat Pyro RYT Multi-Tool',
      type: 'tool',
      rarity: EquipmentRarity.COMMON,
      description: 'Mining multi-tool attachment',
      ownerId: USER_IDS.miner,
      status: EquipmentStatus.EQUIPPED,
      quantity: 3,
    },
    {
      organizationId: ORG_IDS.fleet,
      name: 'Medpen Set (all types)',
      type: 'medical',
      rarity: EquipmentRarity.COMMON,
      description: 'Full set of medical pens',
      ownerId: USER_IDS.medic,
      status: EquipmentStatus.AVAILABLE,
      quantity: 20,
    },
    {
      organizationId: ORG_IDS.fleet,
      name: 'Size 5 Laser Repeater',
      type: 'ship_weapon',
      rarity: EquipmentRarity.EPIC,
      description: 'Capital-grade laser repeater',
      ownerId: USER_IDS.engineer,
      status: EquipmentStatus.IN_TRANSIT,
      quantity: 1,
    },
  ];
  let created = 0;
  for (const e of equipment) {
    const exists = await repo.findOne({
      where: { name: e.name, organizationId: e.organizationId },
    });
    if (!exists) {
      await repo.save(repo.create(e as any));
      created++;
    }
  }
  console.log(`  ✓ Equipment: ${created} created`);
}

// ─── 91. Trade Transactions ─────────────────────────────────────────────────

async function seedTradeTransactions(): Promise<void> {
  console.log('─── Seeding Trade Transactions ───');
  const repo = AppDataSource.getRepository(TradeTransaction);
  // Find trading route IDs from the DB
  const routeRepo = AppDataSource.getRepository(TradingRoute);
  const routes = await routeRepo.find({ take: 2 });
  if (routes.length === 0) {
    console.log('  ○ No trading routes found — skipping trade transactions');
    return;
  }
  const transactions = [
    {
      routeId: routes[0].id,
      userId: USER_IDS.trader,
      organizationId: ORG_IDS.trading,
      successStatus: TradeTransactionStatus.COMPLETED,
      estimatedProfit: 45000,
      actualProfit: 52000,
      durationMinutes: 35,
      completedAt: daysAgo(3),
    },
    {
      routeId: routes[0].id,
      userId: USER_IDS.trader,
      organizationId: ORG_IDS.trading,
      successStatus: TradeTransactionStatus.COMPLETED,
      estimatedProfit: 45000,
      actualProfit: 41000,
      durationMinutes: 42,
      completedAt: daysAgo(5),
    },
    {
      routeId: routes.length > 1 ? routes[1].id : routes[0].id,
      userId: USER_IDS.smuggler,
      organizationId: ORG_IDS.syndicate,
      successStatus: TradeTransactionStatus.FAILED,
      estimatedProfit: 80000,
      actualProfit: -5000,
      durationMinutes: 15,
      completedAt: daysAgo(7),
    },
    {
      routeId: routes[0].id,
      userId: USER_IDS.commander,
      organizationId: ORG_IDS.fleet,
      successStatus: TradeTransactionStatus.COMPLETED,
      estimatedProfit: 30000,
      actualProfit: 33500,
      durationMinutes: 28,
      completedAt: daysAgo(1),
    },
  ];
  let created = 0;
  for (const t of transactions) {
    await repo.save(repo.create(t as any));
    created++;
  }
  console.log(`  ✓ TradeTransactions: ${created} created`);
}

// ─── 92. Trade User Reputation ──────────────────────────────────────────────

async function seedTradeUserReputation(): Promise<void> {
  console.log('─── Seeding Trade User Reputation ───');
  const repo = AppDataSource.getRepository(TradeUserReputation);
  const reputations = [
    {
      userId: USER_IDS.trader,
      totalRuns: 85,
      successfulRuns: 78,
      failedRuns: 4,
      abortedRuns: 3,
      successRate: 91.76,
      totalProfitGenerated: 3500000,
      avgProfitPerRun: 41176,
      avgEstimateAccuracy: 87.5,
      profitConsistency: 82.0,
      currentSuccessStreak: 12,
      longestSuccessStreak: 25,
      overallScore: 85.0,
      lastRunAt: daysAgo(1),
    },
    {
      userId: USER_IDS.smuggler,
      totalRuns: 40,
      successfulRuns: 28,
      failedRuns: 8,
      abortedRuns: 4,
      successRate: 70.0,
      totalProfitGenerated: 1200000,
      avgProfitPerRun: 30000,
      avgEstimateAccuracy: 62.0,
      profitConsistency: 55.0,
      currentSuccessStreak: 2,
      longestSuccessStreak: 8,
      overallScore: 58.0,
      lastRunAt: daysAgo(3),
    },
    {
      userId: USER_IDS.commander,
      totalRuns: 25,
      successfulRuns: 22,
      failedRuns: 2,
      abortedRuns: 1,
      successRate: 88.0,
      totalProfitGenerated: 800000,
      avgProfitPerRun: 32000,
      avgEstimateAccuracy: 78.5,
      profitConsistency: 75.0,
      currentSuccessStreak: 5,
      longestSuccessStreak: 10,
      overallScore: 72.0,
      lastRunAt: daysAgo(2),
    },
  ];
  let created = 0;
  for (const r of reputations) {
    const exists = await repo.findOne({ where: { userId: r.userId } });
    if (!exists) {
      await repo.save(repo.create(r as any));
      created++;
    }
  }
  console.log(`  ✓ TradeUserReputation: ${created} created`);
}

// ─── 93. Activity Templates ─────────────────────────────────────────────────

async function seedActivityTemplates(): Promise<void> {
  console.log('─── Seeding Activity Templates ───');
  const repo = AppDataSource.getRepository(ActivityTemplate);
  const templates = [
    {
      organizationId: ORG_IDS.fleet,
      name: 'Standard Patrol Route',
      description: 'Template for routine patrol operations',
      activityType: 'mission' as any,
      category: ActivityTemplateCategory.COMBAT,
      templateData: {
        description: 'Patrol designated sectors, report contacts',
        maxParticipants: 8,
        minParticipants: 3,
        estimatedDuration: 120,
        requirements: ['Fighter ship required'],
        objectives: ['Complete patrol route', 'Report hostiles', 'Secure area'],
      } as any,
      isPublic: false,
      createdBy: USER_UUIDS.commander,
      createdByName: 'Cmdr Nova',
    },
    {
      organizationId: ORG_IDS.mining,
      name: 'MOLE Mining Operation',
      description: 'Multi-crew MOLE mining template',
      activityType: 'operation' as any,
      category: ActivityTemplateCategory.MINING,
      templateData: {
        description: 'Coordinated MOLE mining run',
        maxParticipants: 4,
        minParticipants: 3,
        estimatedDuration: 180,
        requirements: ['MOLE or mining ship'],
        objectives: ['Fill cargo hold', 'Deliver to refinery'],
      } as any,
      isPublic: true,
      createdBy: USER_UUIDS.miner,
      createdByName: 'Miner Blake',
    },
    {
      organizationId: ORG_IDS.trading,
      name: 'Cargo Trade Run',
      description: 'Standard cargo hauling template',
      activityType: 'contract' as any,
      category: ActivityTemplateCategory.TRADING,
      templateData: {
        description: 'Buy low, haul, sell high',
        maxParticipants: 3,
        minParticipants: 1,
        estimatedDuration: 60,
        requirements: ['Cargo ship required'],
      } as any,
      isPublic: true,
      createdBy: USER_UUIDS.trader,
      createdByName: 'Trader Mark',
    },
  ];
  let created = 0;
  for (const t of templates) {
    const exists = await repo.findOne({
      where: { name: t.name, organizationId: t.organizationId },
    });
    if (!exists) {
      await repo.save(repo.create(t as any));
      created++;
    }
  }
  console.log(`  ✓ ActivityTemplates: ${created} created`);
}

// ─── 94. Tunnel Messages ────────────────────────────────────────────────────

async function seedTunnelMessages(): Promise<void> {
  console.log('─── Seeding Tunnel Messages ───');
  const repo = AppDataSource.getRepository(TunnelMessage);
  const tunnelRepo = AppDataSource.getRepository(Tunnel);
  const tunnels = await tunnelRepo.find({ take: 2 });
  if (tunnels.length === 0) {
    console.log('  ○ No tunnels found — skipping tunnel messages');
    return;
  }
  const messages = [
    {
      tunnelId: tunnels[0].id,
      authorId: USER_IDS.commander,
      authorName: 'Cmdr Nova',
      content: 'Intel tunnel is now active. Share findings here.',
      isBot: false,
      wasBlocked: false,
    },
    {
      tunnelId: tunnels[0].id,
      authorId: USER_IDS.admiral,
      authorName: 'Admiral Sterling',
      content: 'Confirmed — sending recon data from Pyro jump point.',
      isBot: false,
      wasBlocked: false,
    },
    {
      tunnelId: tunnels[0].id,
      authorId: 'bot-relay-001',
      authorName: 'Fleet Bot',
      content: 'Automated relay: fleet status updated.',
      isBot: true,
      wasBlocked: false,
    },
    {
      tunnelId: tunnels.length > 1 ? tunnels[1].id : tunnels[0].id,
      authorId: USER_IDS.diplomat,
      authorName: 'Diplomat Elena',
      content: 'Alliance negotiations are proceeding well. Next meeting scheduled.',
      isBot: false,
      wasBlocked: false,
    },
  ];
  let created = 0;
  for (const m of messages) {
    await repo.save(repo.create(m as any));
    created++;
  }
  console.log(`  ✓ TunnelMessages: ${created} created`);
}

// ─── 95. Tunnel Bans ────────────────────────────────────────────────────────

async function seedTunnelBans(): Promise<void> {
  console.log('─── Seeding Tunnel Bans ───');
  const repo = AppDataSource.getRepository(TunnelBan);
  const tunnelRepo = AppDataSource.getRepository(Tunnel);
  const tunnels = await tunnelRepo.find({ take: 1 });
  if (tunnels.length === 0) {
    console.log('  ○ No tunnels found — skipping tunnel bans');
    return;
  }
  const bans = [
    {
      tunnelId: tunnels[0].id,
      userId: USER_IDS.pirate,
      username: 'void_reaper',
      type: 'ban' as const,
      issuedBy: USER_IDS.commander,
      reason: 'Posting hostile threats in alliance tunnel',
      expiresAt: daysFromNow(30),
    },
  ];
  let created = 0;
  for (const b of bans) {
    const exists = await repo.findOne({ where: { tunnelId: b.tunnelId, userId: b.userId } });
    if (!exists) {
      await repo.save(repo.create(b as any));
      created++;
    }
  }
  console.log(`  ✓ TunnelBans: ${created} created`);
}

// ─── 96. User Activity Log ──────────────────────────────────────────────────

async function seedUserActivities(): Promise<void> {
  console.log('─── Seeding User Activities ───');
  const repo = AppDataSource.getRepository(UserActivity);
  const activities = [
    {
      userId: USER_IDS.commander,
      action: 'auth.login',
      resource: '/api/v2/auth/login',
      method: 'POST',
      ipAddress: '10.0.0.1',
      statusCode: 200,
      duration: 150,
      metadata: { provider: 'discord' },
    },
    {
      userId: USER_IDS.commander,
      action: 'fleet.created',
      resource: '/api/v2/fleets',
      method: 'POST',
      ipAddress: '10.0.0.1',
      statusCode: 201,
      duration: 85,
      metadata: { fleetName: 'Alpha Strike' },
    },
    {
      userId: USER_IDS.trader,
      action: 'auth.login',
      resource: '/api/v2/auth/login',
      method: 'POST',
      ipAddress: '10.0.0.2',
      statusCode: 200,
      duration: 120,
    },
    {
      userId: USER_IDS.miner,
      action: 'ship.updated',
      resource: '/api/v2/ships/user-ships',
      method: 'PUT',
      ipAddress: '10.0.0.3',
      statusCode: 200,
      duration: 65,
    },
    {
      userId: USER_IDS.pirate,
      action: 'auth.login_failed',
      resource: '/api/v2/auth/login',
      method: 'POST',
      ipAddress: '10.0.0.99',
      statusCode: 401,
      duration: 45,
      metadata: { reason: 'invalid_credentials' },
    },
  ];
  let created = 0;
  for (const a of activities) {
    await repo.save(repo.create(a as any));
    created++;
  }
  console.log(`  ✓ UserActivities: ${created} created`);
}

// ─── 97. Workflow Definitions & Executions ──────────────────────────────────

async function seedWorkflowDefinitions(): Promise<void> {
  console.log('─── Seeding Workflow Definitions ───');
  const repo = AppDataSource.getRepository(WorkflowDefinition);
  const workflows = [
    {
      id: 'ff500000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      name: 'New Member Onboarding',
      type: 'onboarding',
      description: 'Automated workflow for new member processing',
      trigger: { event: 'member.joined' },
      actions: [
        { type: 'send_notification', config: { template: 'welcome' }, order: 1 },
        { type: 'assign_role', config: { role: 'recruit' }, order: 2 },
        { type: 'create_task', config: { title: 'Complete onboarding checklist' }, order: 3 },
      ],
      enabled: true,
      status: WorkflowStatus.ACTIVE,
      createdBy: USER_IDS.commander,
    },
    {
      id: 'ff500000-0000-4000-a000-000000000002',
      organizationId: ORG_IDS.fleet,
      name: 'Fleet Readiness Alert',
      type: 'alert',
      description: 'Alert when fleet readiness drops below threshold',
      trigger: { event: 'fleet.readiness_changed', condition: { readiness: { lt: 0.5 } } },
      actions: [
        {
          type: 'send_notification',
          config: { recipients: 'officers', priority: 'high' },
          order: 1,
        },
      ],
      enabled: true,
      status: WorkflowStatus.ACTIVE,
      createdBy: USER_IDS.admiral,
    },
    {
      id: 'ff500000-0000-4000-a000-000000000003',
      organizationId: ORG_IDS.trading,
      name: 'Price Spike Alert',
      type: 'market',
      description: 'Notify traders when commodity prices spike',
      trigger: { event: 'market.price_changed', condition: { changePercent: { gt: 15 } } },
      actions: [{ type: 'send_notification', config: { channel: 'trading-alerts' }, order: 1 }],
      enabled: false,
      status: WorkflowStatus.INACTIVE,
      createdBy: USER_IDS.trader,
    },
  ];
  let created = 0;
  for (const w of workflows) {
    const exists = await repo.findOne({ where: { id: w.id } });
    if (!exists) {
      await repo.save(repo.create(w as any));
      created++;
    }
  }
  console.log(`  ✓ WorkflowDefinitions: ${created} created`);
}

async function seedWorkflowExecutions(): Promise<void> {
  console.log('─── Seeding Workflow Executions ───');
  const repo = AppDataSource.getRepository(WorkflowExecution);
  const executions = [
    {
      workflowId: 'ff500000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      executedBy: 'system',
      status: 'completed',
      result: { stepsCompleted: 3, duration: 1200 },
      completedAt: daysAgo(5),
    },
    {
      workflowId: 'ff500000-0000-4000-a000-000000000001',
      organizationId: ORG_IDS.fleet,
      executedBy: 'system',
      status: 'completed',
      result: { stepsCompleted: 3, duration: 980 },
      completedAt: daysAgo(2),
    },
    {
      workflowId: 'ff500000-0000-4000-a000-000000000002',
      organizationId: ORG_IDS.fleet,
      executedBy: 'system',
      status: 'completed',
      result: { alertSent: true, recipients: 3 },
      completedAt: daysAgo(1),
    },
  ];
  let created = 0;
  for (const e of executions) {
    await repo.save(repo.create(e as any));
    created++;
  }
  console.log(`  ✓ WorkflowExecutions: ${created} created`);
}

// ─── 98. Focus Preferences ──────────────────────────────────────────────────

async function seedFocusPreferences(): Promise<void> {
  console.log('─── Seeding Focus Preferences ───');
  const userRepo = AppDataSource.getRepository(UserFocusPreference);
  const orgRepo = AppDataSource.getRepository(OrgFocusPreference);

  const userPrefs = [
    {
      userId: USER_IDS.commander,
      primaryFocuses: ['combat', 'leadership'],
      secondaryFocuses: ['exploration', 'trading'],
    },
    {
      userId: USER_IDS.miner,
      primaryFocuses: ['mining', 'engineering'],
      secondaryFocuses: ['trading'],
    },
    {
      userId: USER_IDS.trader,
      primaryFocuses: ['trading', 'logistics'],
      secondaryFocuses: ['exploration'],
    },
    {
      userId: USER_IDS.medic,
      primaryFocuses: ['medical', 'combat'],
      secondaryFocuses: ['exploration'],
    },
  ];
  let userCreated = 0;
  for (const p of userPrefs) {
    const exists = await userRepo.findOne({ where: { userId: p.userId } });
    if (!exists) {
      await userRepo.save(userRepo.create(p as any));
      userCreated++;
    }
  }

  const orgPrefs = [
    { orgId: ORG_IDS.fleet, focuses: ['combat', 'exploration', 'security'] },
    { orgId: ORG_IDS.mining, focuses: ['mining', 'engineering', 'trading'] },
    { orgId: ORG_IDS.trading, focuses: ['trading', 'logistics', 'exploration'] },
    { orgId: ORG_IDS.mercenary, focuses: ['combat', 'security', 'bounty_hunting'] },
  ];
  let orgCreated = 0;
  for (const p of orgPrefs) {
    const exists = await orgRepo.findOne({ where: { orgId: p.orgId } });
    if (!exists) {
      await orgRepo.save(orgRepo.create(p as any));
      orgCreated++;
    }
  }

  console.log(`  ✓ UserFocusPreferences: ${userCreated}, OrgFocusPreferences: ${orgCreated}`);
}

// ─── Main Orchestrator ──────────────────────────────────────────────────────

async function seedComprehensiveData(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🌟 Comprehensive Data Seeder — Star Citizen Fleet Manager');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Disable synchronize to avoid ALTER TABLE conflicts with stale schema data.
  // When running via seed:all, the prior seed:ships step handles schema sync.
  (AppDataSource.options as { synchronize: boolean }).synchronize = false;
  await AppDataSource.initialize();
  console.log('✅ Database connected\n');

  await seedRoles();
  await seedPermissions();
  await seedOrganizationPermissions();
  await seedFeatureFlags();
  await seedTeams();
  await seedTeamMembers();
  await seedNotificationPreferences();
  await seedNotifications();
  const consentCount = await seedUserConsent();
  await seedUserGameplayPreferences();
  await seedReputation();
  await seedOrganizationShips();
  await seedBounties();
  await seedBountyClaims();
  await seedHunterProfiles();
  await seedIntelEntries();
  await seedWikiPages();
  await seedWikiPageRevisions();
  await seedMissions();
  await seedOperations();
  await seedMiningOperations();
  await seedTradingRoutes();
  await seedTickets();
  await seedCrewAssignments();
  await seedShipLoadouts();
  await seedFleetInventory();
  await seedOrganizationInventory();
  await seedFederation();
  await seedFederationMembers();
  await seedSecurityLevels();
  await seedDiscordGuildSettings();
  await seedGuildOrganizations();
  await seedBlacklistSharingConfig();

  // ─── New Sections (34–76) ─────────────────────────────────────────────────
  await seedAnnouncements();
  await seedAnnouncementTemplates();
  await seedAnnouncementDeliveries();
  await seedOrganizationTemplates();
  await seedOrganizationActivities();
  await seedOrganizationAnalytics();
  await seedUserAvailability();
  await seedInvitations();
  await seedJobApplications();
  await seedOrgApplications();
  await seedOrgWatchlistEntries();
  await seedPriceAlerts();
  await seedContactRequests();
  await seedContactRequestReplies();
  await seedFederationProposals();
  await seedRelationshipHistory();
  await seedLFGUserReputation();
  await seedLFGReputationRatings();
  await seedLFGGroupHistory();
  await seedShipLoans();
  await seedShipMaintenance();
  await seedCargoManifests();
  await seedFleetLogistics();
  await seedLogisticsAlerts();
  await seedEventAttendanceConfirmations();
  await seedActivityReminders();
  await seedMemberAuditEvents();
  await seedBountyEvidence();
  await seedIntelApprovals();
  await seedIntelOfficers();
  await seedIntelShares();
  await seedTunnels();
  await seedRsiUserLinks();
  await seedRsiRoleMappings();
  await seedExternalIntegrations();
  await seedWebhooks();
  await seedBriefings();
  await seedAIUsageTracking();
  await seedTournaments();
  await seedModerationIncidents();
  await seedMirrorActions();
  await seedMirroredActivities();
  await seedDataBreachNotifications();

  // ─── New Sections (77–98) ─────────────────────────────────────────────────
  await seedTags();
  await seedTagAssignments();
  await seedComments();
  await seedCommentLikes();
  await seedSkills();
  await seedUserSkills();
  await seedSkillEndorsements();
  await seedCertifications();
  await seedUserCertifications();
  await seedAchievements();
  await seedUserAchievements();
  await seedDashboards();
  await seedDashboardWidgets();
  await seedEquipment();
  await seedTradeTransactions();
  await seedTradeUserReputation();
  await seedActivityTemplates();
  await seedTunnelMessages();
  await seedTunnelBans();
  await seedUserActivities();
  await seedWorkflowDefinitions();
  await seedWorkflowExecutions();
  await seedFocusPreferences();

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  ✅ Comprehensive seeding complete!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`
  Seeded entities (98 sections):
    ── Original (1–33) ──
    • Roles ....................... 10 (3 system + 7 org)
    • Permissions ................. 8
    • Organization Permissions .... 4
    • Feature Flags ............... 12
    • Teams ....................... 6
    • Team Members ................ 13
    • Notification Preferences .... 10
    • Notifications ............... 8
    • User Consent (GDPR) ........ ${consentCount}
    • User Gameplay Preferences ... 8
    • Reputation Profiles ......... 6
    • Organization Ships .......... 8
    • Bounties .................... 5
    • Bounty Claims ............... 2
    • Hunter Profiles ............. 2
    • Intel Entries ............... 5
    • Wiki Pages .................. 6
    • Wiki Page Revisions ......... 4
    • Missions .................... 5
    • Operations .................. 3
    • Mining Operations ........... 3
    • Trading Routes .............. 4
    • Tickets ..................... 4
    • Crew Assignments ............ 2
    • Ship Loadouts ............... 4
    • Fleet Inventory ............. 6
    • Organization Inventory ...... 4
    • Federation .................. 1
    • Federation Members .......... 4
    • Security Levels ............. 5
    • Discord Guild Settings ...... 2
    • Guild Organizations ......... 2
    • Blacklist Sharing Configs ... 3

    ── Expanded (34–76) ──
    • Announcements ............... 3
    • Announcement Templates ...... 2
    • Announcement Deliveries ..... 2
    • Organization Templates ...... 2
    • Organization Activities ..... 3
    • Organization Analytics ...... 2
    • User Availability ........... 4
    • Invitations ................. 2
    • Job Applications ............ 2
    • Org Applications ............ 2
    • Org Watchlist Entries ........ 2
    • Price Alerts ................ 3
    • Contact Requests ............ 2
    • Contact Request Replies ..... 1
    • Federation Proposals ........ 2
    • Relationship History ........ 2
    • LFG User Reputation ......... 3
    • LFG Reputation Ratings ...... 2
    • LFG Group History ........... 2
    • Ship Loans .................. 2
    • Ship Maintenance ............ 3
    • Cargo Manifests ............. 2
    • Fleet Logistics ............. 2
    • Logistics Alerts ............ 2
    • Event Attendance ............ 3
    • Activity Reminders .......... 2
    • Member Audit Events ......... 3
    • Bounty Evidence ............. 2
    • Intel Approvals ............. 2
    • Intel Officers .............. 3
    • Intel Shares ................ 2
    • Tunnels ..................... 2
    • RSI User Links .............. 3
    • RSI Role Mappings ........... 3
    • External Integrations ....... 2
    • Webhooks .................... 2
    • Briefings ................... 2
    • AI Usage Tracking ........... 2
    • Tournaments ................. 2
    • Moderation Incidents ........ 2
    • Mirror Actions .............. 1
    • Mirrored Activities ......... 1
    • Data Breach Notifications ... 1

    ── New (77–98) ──
    • Tags ....................... 5
    • Tag Assignments ............ 5
    • Comments ................... 4
    • Comment Likes .............. 3
    • Skills ..................... 6
    • User Skills ................ 7
    • Skill Endorsements ......... 4
    • Certifications ............. 3
    • User Certifications ........ 4
    • Achievements ............... 5
    • User Achievements .......... 5
    • Dashboards ................. 3
    • Dashboard Widgets .......... 5
    • Equipment .................. 5
    • Trade Transactions ......... 4
    • Trade User Reputation ...... 3
    • Activity Templates ......... 3
    • Tunnel Messages ............ 4
    • Tunnel Bans ................ 1
    • User Activities ............ 5
    • Workflow Definitions ....... 3
    • Workflow Executions ........ 3
    • Focus Preferences ......... 4+4
  `);

  await AppDataSource.destroy();
  console.log('Database connection closed.\n');
}

// ─── Run ────────────────────────────────────────────────────────────────────

seedComprehensiveData().catch(err => {
  // NOSONAR: Cannot use top-level await with CommonJS module system
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
