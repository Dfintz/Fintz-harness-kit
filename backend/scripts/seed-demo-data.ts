#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import dotenv from 'dotenv';
dotenv.config();

/**
 * Demo Data Seeding Script
 *
 * Seeds the database with realistic mock data for development and live demos:
 * - 12 users (with display names, bios, avatars, RSI handles)
 * - 4 organizations (different sizes and focuses)
 * - Organization memberships (roles: owner, admin, officer, member)
 * - 20+ user-owned ships (linked to catalog ships)
 * - 3 fleets with ship & member assignments
 * - 2 alliance/diplomacy relationships
 * - 18+ activities of various types (missions, contracts, events, LFG, jobs)
 * - executive-showcase records highlighting readiness, diplomacy, and governance workflows
 *
 * Usage:
 *   npm run seed:demo
 *
 * Prerequisites:
 *   - Database must be initialized (migrations run)
 *   - Ship catalog should be seeded first (npm run seed:ships)
 *
 * The script is idempotent — it checks for existing records before inserting.
 */

import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';

import { AppDataSource } from '../src/config/database';
import {
  Activity,
  ActivityStatus,
  ActivityType,
  ActivityVisibility,
  DifficultyLevel,
  PaymentType,
} from '../src/models/Activity';
import { AllianceDiplomacy, AllianceType, DiplomacyStatus } from '../src/models/AllianceDiplomacy';
import { Fleet, FleetStatus, FleetType } from '../src/models/Fleet';
import { FleetShip } from '../src/models/FleetShip';
import { Organization, OrganizationStatus, OrganizationType } from '../src/models/Organization';
import { OrganizationMembership } from '../src/models/OrganizationMembership';
import {
  OrganizationRelationship,
  RelationshipStatus,
} from '../src/models/OrganizationRelationship';
import {
  JobType,
  ListingOwnerType,
  PayType,
  PublicJobListing,
} from '../src/models/PublicJobListing';
import { ActivityLevel, OrgPrimaryFocus, PublicOrgProfile } from '../src/models/PublicOrgProfile';
import { Role } from '../src/models/Role';
import { Ship } from '../src/models/Ship';
import { User } from '../src/models/User';
import {
  ShipCondition,
  ShipOwnershipStatus,
  ShipSharingLevel,
  UserShip,
} from '../src/models/UserShip';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uuid(): string {
  return randomUUID();
}

function generateDemoAdminPassword(): string {
  const suffix = randomBytes(8).toString('base64url');
  return `DemoAdmin-${suffix}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursFromNow(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ─── Static IDs (stable for idempotence) ─────────────────────────────────────

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
  // Platform admin user
  admin: 'demo-user-admin-016',
};

const ORG_IDS = {
  fleet: '00000000-0000-4000-a000-000000000001',
  mining: '00000000-0000-4000-a000-000000000002',
  mercenary: '00000000-0000-4000-a000-000000000003',
  trading: '00000000-0000-4000-a000-000000000004',
  // Private orgs (not visible in public directory)
  syndicate: '00000000-0000-4000-a000-000000000005',
  intel: '00000000-0000-4000-a000-000000000006',
};

// Per-org role UUIDs — compatible with seed-comprehensive ROLE_IDS for the fleet org
const DEMO_ROLE_IDS: Record<string, Record<string, string>> = {
  [ORG_IDS.fleet]: {
    owner: '10000000-0000-4000-a000-000000000004',
    admin: '10000000-0000-4000-a000-000000000005',
    officer: '10000000-0000-4000-a000-000000000006',
    member: '10000000-0000-4000-a000-000000000007',
  },
  [ORG_IDS.mining]: {
    owner: '10000000-0002-4000-a000-000000000001',
    admin: '10000000-0002-4000-a000-000000000002',
    officer: '10000000-0002-4000-a000-000000000003',
    member: '10000000-0002-4000-a000-000000000004',
  },
  [ORG_IDS.mercenary]: {
    owner: '10000000-0003-4000-a000-000000000001',
    admin: '10000000-0003-4000-a000-000000000002',
    officer: '10000000-0003-4000-a000-000000000003',
    member: '10000000-0003-4000-a000-000000000004',
  },
  [ORG_IDS.trading]: {
    owner: '10000000-0004-4000-a000-000000000001',
    admin: '10000000-0004-4000-a000-000000000002',
    officer: '10000000-0004-4000-a000-000000000003',
    member: '10000000-0004-4000-a000-000000000004',
  },
  [ORG_IDS.syndicate]: {
    owner: '10000000-0005-4000-a000-000000000001',
    admin: '10000000-0005-4000-a000-000000000002',
    officer: '10000000-0005-4000-a000-000000000003',
    member: '10000000-0005-4000-a000-000000000004',
  },
  [ORG_IDS.intel]: {
    owner: '10000000-0006-4000-a000-000000000001',
    admin: '10000000-0006-4000-a000-000000000002',
    officer: '10000000-0006-4000-a000-000000000003',
    member: '10000000-0006-4000-a000-000000000004',
  },
};

const FLEET_IDS = {
  alpha: 'demo-fleet-alpha-strike',
  mining: 'demo-fleet-deep-drill',
  trade: 'demo-fleet-silk-road',
};

const ALLIANCE_IDS = {
  stardustDeepcore: 'demo-alliance-stardust-deepcore',
  ironwolfQuantum: 'demo-alliance-ironwolf-quantum',
};

// ─── Data Definitions ────────────────────────────────────────────────────────

const USERS = [
  {
    id: USER_IDS.commander,
    username: 'cmdr_nova',
    email: 'nova@demo.local',
    discordId: 'demo-discord-001',
    role: 'user',
    displayName: 'Commander Nova',
    bio: 'Veteran fleet commander with 5 years in the verse. Specialist in large-scale operations and tactical coordination.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=nova',
    rsiHandle: 'CMDR_Nova',
    rsiVerified: true,
    loginCount: 247,
    profileViews: 1830,
  },
  {
    id: USER_IDS.admiral,
    username: 'admiral_chen',
    email: 'chen@demo.local',
    discordId: 'demo-discord-002',
    role: 'user',
    displayName: 'Admiral Chen Wei',
    bio: 'Former UEE Navy. Now leading the Stardust Expeditionary Fleet. Honor. Duty. Stars.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=chen',
    rsiHandle: 'AdmiralChen',
    rsiVerified: true,
    loginCount: 582,
    profileViews: 3200,
  },
  {
    id: USER_IDS.trader,
    username: 'silkroad_sam',
    email: 'sam@demo.local',
    discordId: 'demo-discord-003',
    role: 'user',
    displayName: 'Silkroad Sam',
    bio: "If it moves, I can sell it. If it doesn't move, I can still sell it. Top 1% traders in Stanton.",
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=sam',
    rsiHandle: 'SilkroadSam',
    rsiVerified: false,
    loginCount: 312,
    profileViews: 890,
  },
  {
    id: USER_IDS.miner,
    username: 'rockbreaker',
    email: 'rock@demo.local',
    discordId: 'demo-discord-004',
    role: 'user',
    displayName: 'Rockbreaker Yusuf',
    bio: 'Deep Core Mining Division lead. Quantanium specialist. Safety record: 847 consecutive ops without incident.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=yusuf',
    rsiHandle: 'Rockbreaker',
    rsiVerified: true,
    loginCount: 189,
    profileViews: 540,
  },
  {
    id: USER_IDS.bountyHunter,
    username: 'shadowfang',
    email: 'shadow@demo.local',
    discordId: 'demo-discord-005',
    role: 'user',
    displayName: 'Shadowfang',
    bio: 'Licensed bounty hunter. 200+ contracts completed. I always collect.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=shadow',
    rsiHandle: 'Shadowfang_SC',
    rsiVerified: true,
    loginCount: 421,
    profileViews: 2100,
  },
  {
    id: USER_IDS.medic,
    username: 'doc_aurora',
    email: 'aurora@demo.local',
    discordId: 'demo-discord-006',
    role: 'user',
    displayName: 'Dr. Aurora Vex',
    bio: 'Combat medic and search & rescue specialist. Cutlass Red pilot. No citizen left behind.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=aurora',
    rsiHandle: 'DocAurora',
    rsiVerified: false,
    loginCount: 156,
    profileViews: 420,
  },
  {
    id: USER_IDS.explorer,
    username: 'stellarpath',
    email: 'stellar@demo.local',
    discordId: 'demo-discord-007',
    role: 'user',
    displayName: 'Stellarpath',
    bio: 'Cartographer and jump point scout. First contact protocols trained. Carrack owner and proud.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=stellar',
    rsiHandle: 'Stellarpath',
    rsiVerified: true,
    loginCount: 278,
    profileViews: 1650,
  },
  {
    id: USER_IDS.engineer,
    username: 'wrenchmonkey',
    email: 'wrench@demo.local',
    discordId: 'demo-discord-008',
    role: 'user',
    displayName: 'Wrench Monkey',
    bio: "Ship engineer and loadout optimizer. If your shields are down, I'm your guy. Erkul enthusiast.",
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=wrench',
    rsiHandle: 'WrenchMonkey',
    rsiVerified: false,
    loginCount: 95,
    profileViews: 310,
  },
  {
    id: USER_IDS.smuggler,
    username: 'ghost_runner',
    email: 'ghost@demo.local',
    discordId: 'demo-discord-009',
    role: 'user',
    displayName: 'Ghost Runner',
    bio: 'Cargo specialist. Discreet deliveries. No questions asked. Fast quantum, clean routes.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=ghost',
    rsiHandle: 'GhostRunner',
    rsiVerified: false,
    loginCount: 67,
    profileViews: 180,
  },
  {
    id: USER_IDS.rookie,
    username: 'star_cadet',
    email: 'cadet@demo.local',
    discordId: 'demo-discord-010',
    role: 'user',
    displayName: 'Star Cadet Luna',
    bio: 'Fresh out of training. Looking for a crew and an adventure! Eager to learn everything.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=luna',
    rsiHandle: 'StarCadetLuna',
    rsiVerified: false,
    loginCount: 12,
    profileViews: 45,
  },
  {
    id: USER_IDS.diplomat,
    username: 'peaceweaver',
    email: 'peace@demo.local',
    discordId: 'demo-discord-011',
    role: 'user',
    displayName: 'Ambassador Aria',
    bio: 'Inter-org diplomat and alliance broker. Bringing organizations together for a stronger verse.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=aria',
    rsiHandle: 'Peaceweaver',
    rsiVerified: true,
    loginCount: 340,
    profileViews: 2800,
  },
  {
    id: USER_IDS.pirate,
    username: 'void_reaper',
    email: 'void@demo.local',
    discordId: 'demo-discord-012',
    role: 'user',
    displayName: 'Void Reaper',
    bio: 'Ironwolf Mercenary Company. We solve problems. Permanently. Competitive rates.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=reaper',
    rsiHandle: 'VoidReaper',
    rsiVerified: true,
    loginCount: 198,
    profileViews: 960,
  },
  // ── Platform Admin ──
  {
    id: USER_IDS.admin,
    username: 'sysop_nexus',
    email: 'sysop@demo.local',
    discordId: 'demo-discord-016',
    role: 'admin',
    displayName: 'SysOp Nexus',
    bio: 'Platform administrator. System monitoring, user management, compliance, and security oversight.',
    avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=nexus',
    rsiHandle: 'SysOpNexus',
    rsiVerified: true,
    loginCount: 1024,
    profileViews: 50,
  },
];

const ORGANIZATIONS = [
  {
    id: ORG_IDS.fleet,
    name: 'Stardust Expeditionary Fleet',
    description:
      'Premier multi-role organization focused on exploration, combat operations, and territory control. ' +
      'Founded in 2949, we operate across all systems with a focus on professionalism and camaraderie. ' +
      'Active daily operations, weekly fleet events, and monthly grand campaigns.',
    type: OrganizationType.ROOT,
    status: OrganizationStatus.ACTIVE,
    ownerId: USER_IDS.admiral,
    totalMembers: 6,
    directMembers: 6,
    rsiSid: 'STARDUST',
    rsiVerified: true,
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=stardust',
    website: 'https://stardust-fleet.example.com',
    contactEmail: 'recruitment@stardust-fleet.example.com',
    tags: ['exploration', 'combat', 'multi-role', 'large-scale'],
    settings: {
      visibility: 'public',
      isPublic: true,
      allowApplications: true,
      requireApproval: true,
      defaultRole: 'member',
      maxMembers: 500,
    },
    metadata: {
      timezone: 'UTC',
      primaryLanguage: 'English',
      region: 'Global',
      founded: '2949',
      motto: 'Per Aspera Ad Astra',
    },
  },
  {
    id: ORG_IDS.mining,
    name: 'Deep Core Mining Consortium',
    description:
      'Industrial mining organization specializing in quantanium extraction and mineral processing. ' +
      'We run daily mining operations across Aaron Halo, Lyria, and Aberdeen. ' +
      'Competitive profit sharing. Safety-first culture. All experience levels welcome.',
    type: OrganizationType.ROOT,
    status: OrganizationStatus.ACTIVE,
    ownerId: USER_IDS.miner,
    totalMembers: 4,
    directMembers: 4,
    rsiSid: 'DEEPCORE',
    rsiVerified: true,
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=deepcore',
    website: 'https://deepcore-mining.example.com',
    contactEmail: 'ops@deepcore-mining.example.com',
    tags: ['mining', 'industrial', 'quantanium', 'profit-sharing'],
    settings: {
      visibility: 'public',
      isPublic: true,
      allowApplications: true,
      requireApproval: false,
      defaultRole: 'member',
      maxMembers: 200,
    },
    metadata: {
      timezone: 'US/Eastern',
      primaryLanguage: 'English',
      region: 'NA',
      specialization: 'Quantanium extraction',
    },
  },
  {
    id: ORG_IDS.mercenary,
    name: 'Ironwolf Mercenary Company',
    description:
      'Elite private military company offering escort, asset recovery, and tactical operations. ' +
      'Combat-focused with strict training requirements. ' +
      "We take contracts others won't. Professional operators only.",
    type: OrganizationType.ROOT,
    status: OrganizationStatus.ACTIVE,
    ownerId: USER_IDS.bountyHunter,
    totalMembers: 4,
    directMembers: 4,
    rsiSid: 'IRONWOLF',
    rsiVerified: false,
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=ironwolf',
    website: 'https://ironwolf-pmc.example.com',
    contactEmail: 'contracts@ironwolf-pmc.example.com',
    tags: ['mercenary', 'combat', 'bounty', 'escort', 'pvp'],
    settings: {
      visibility: 'public',
      isPublic: true,
      allowApplications: true,
      requireApproval: true,
      defaultRole: 'member',
      maxMembers: 100,
    },
    metadata: {
      timezone: 'Europe/Berlin',
      primaryLanguage: 'English',
      region: 'EU',
      specialization: 'Combat operations',
    },
  },
  {
    id: ORG_IDS.trading,
    name: 'Quantum Trade Network',
    description:
      'Interstellar trade conglomerate managing supply routes across Stanton and Pyro. ' +
      'We coordinate bulk cargo runs, manage trade agreements, and optimize profit margins. ' +
      'Always hiring pilots, navigators, and logistics coordinators.',
    type: OrganizationType.ROOT,
    status: OrganizationStatus.ACTIVE,
    ownerId: USER_IDS.trader,
    totalMembers: 3,
    directMembers: 3,
    rsiSid: 'QTNET',
    rsiVerified: false,
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=quantum',
    website: 'https://quantum-trade.example.com',
    contactEmail: 'logistics@quantum-trade.example.com',
    tags: ['trading', 'cargo', 'logistics', 'supply-chain'],
    settings: {
      visibility: 'public',
      isPublic: true,
      allowApplications: true,
      requireApproval: false,
      defaultRole: 'member',
      maxMembers: 300,
    },
    metadata: {
      timezone: 'US/Pacific',
      primaryLanguage: 'English',
      region: 'NA/EU',
      specialization: 'Interstellar trade',
    },
  },
  // ── Private Organizations ──
  {
    id: ORG_IDS.syndicate,
    name: 'Crimson Syndicate',
    description:
      'Underground smuggling and black-market operations ring. We move anything, anywhere, ' +
      'no questions asked. Discretion guaranteed. Operating out of Grim HEX with safe houses ' +
      'across Stanton and footholds in Pyro.',
    type: OrganizationType.ROOT,
    status: OrganizationStatus.ACTIVE,
    ownerId: USER_IDS.smuggler,
    totalMembers: 3,
    directMembers: 3,
    rsiSid: null,
    rsiVerified: false,
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=crimson',
    website: null,
    contactEmail: null,
    tags: ['smuggling', 'black-market', 'covert', 'cargo'],
    settings: {
      visibility: 'private',
      isPublic: false,
      allowApplications: false,
      requireApproval: true,
      defaultRole: 'member',
      maxMembers: 30,
    },
    metadata: {
      timezone: 'US/Pacific',
      primaryLanguage: 'English',
      region: 'NA',
      specialization: 'Discreet logistics',
    },
  },
  {
    id: ORG_IDS.intel,
    name: 'Ghost Division',
    description:
      'Covert intelligence-gathering and counter-intelligence unit. We monitor, infiltrate, and ' +
      'report. Our members are embedded in organizations across Stanton. If you know about us, ' +
      "we're not doing our job right.",
    type: OrganizationType.ROOT,
    status: OrganizationStatus.ACTIVE,
    ownerId: USER_IDS.diplomat,
    totalMembers: 3,
    directMembers: 3,
    rsiSid: null,
    rsiVerified: false,
    logoUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=ghost-div',
    website: null,
    contactEmail: null,
    tags: ['intelligence', 'covert', 'counter-intel', 'reconnaissance'],
    settings: {
      visibility: 'private',
      isPublic: false,
      allowApplications: false,
      requireApproval: true,
      defaultRole: 'member',
      maxMembers: 15,
    },
    metadata: {
      timezone: 'UTC',
      primaryLanguage: 'English',
      region: 'Global',
      specialization: 'SIGINT & HUMINT',
    },
  },
];

// orgId → [{ userId, role }]
const MEMBERSHIPS: Record<string, Array<{ userId: string; role: string; title?: string }>> = {
  [ORG_IDS.fleet]: [
    { userId: USER_IDS.admiral, role: 'owner', title: 'Fleet Admiral' },
    { userId: USER_IDS.commander, role: 'admin', title: 'Wing Commander' },
    { userId: USER_IDS.explorer, role: 'officer', title: 'Chief Navigator' },
    { userId: USER_IDS.medic, role: 'officer', title: 'Chief Medical Officer' },
    { userId: USER_IDS.engineer, role: 'member', title: 'Crew Engineer' },
    { userId: USER_IDS.rookie, role: 'member', title: 'Cadet' },
  ],
  [ORG_IDS.mining]: [
    { userId: USER_IDS.miner, role: 'owner', title: 'Foreman' },
    { userId: USER_IDS.engineer, role: 'officer', title: 'Equipment Lead' },
    { userId: USER_IDS.trader, role: 'member', title: 'Logistics' },
    { userId: USER_IDS.rookie, role: 'member' },
  ],
  [ORG_IDS.mercenary]: [
    { userId: USER_IDS.bountyHunter, role: 'owner', title: 'Company Commander' },
    { userId: USER_IDS.pirate, role: 'admin', title: 'Operations Chief' },
    { userId: USER_IDS.commander, role: 'officer', title: 'Tactical Advisor' },
    { userId: USER_IDS.smuggler, role: 'member', title: 'Field Operative' },
  ],
  [ORG_IDS.trading]: [
    { userId: USER_IDS.trader, role: 'owner', title: 'Trade Master' },
    { userId: USER_IDS.smuggler, role: 'officer', title: 'Route Planner' },
    { userId: USER_IDS.diplomat, role: 'member', title: 'Trade Liaison' },
  ],
  // Private organizations
  [ORG_IDS.syndicate]: [
    { userId: USER_IDS.smuggler, role: 'owner', title: 'Syndicate Boss' },
    { userId: USER_IDS.pirate, role: 'officer', title: 'Enforcer' },
    { userId: USER_IDS.rookie, role: 'member', title: 'Runner' },
  ],
  [ORG_IDS.intel]: [
    { userId: USER_IDS.diplomat, role: 'owner', title: 'Spymaster' },
    { userId: USER_IDS.explorer, role: 'officer', title: 'Field Agent' },
    { userId: USER_IDS.bountyHunter, role: 'member', title: 'Asset' },
  ],
};

// userId → [{ shipCatalogName, customName?, status, condition }]
const USER_SHIPS_DATA: Array<{
  userId: string;
  shipName: string;
  customName?: string;
  status: ShipOwnershipStatus;
  condition: ShipCondition;
  sharing: ShipSharingLevel;
  flightHours: number;
  notes?: string;
}> = [
  // Admiral Chen — capital ship commander
  {
    userId: USER_IDS.admiral,
    shipName: 'Hammerhead',
    customName: 'SEF Aegis',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.EXCELLENT,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 420,
    notes: 'Flagship of the Stardust Expeditionary Fleet',
  },
  {
    userId: USER_IDS.admiral,
    shipName: 'Carrack',
    customName: 'Pathfinder One',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 680,
    notes: 'Long-range exploration vessel',
  },
  {
    userId: USER_IDS.admiral,
    shipName: '890 Jump',
    customName: 'Ivory Tower',
    status: ShipOwnershipStatus.PLEDGED,
    condition: ShipCondition.PRISTINE,
    sharing: ShipSharingLevel.PERSONAL,
    flightHours: 35,
    notes: 'Diplomatic transport',
  },

  // Commander Nova — fighter pilot
  {
    userId: USER_IDS.commander,
    shipName: 'Gladius',
    customName: 'Red Talon',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 1200,
  },
  {
    userId: USER_IDS.commander,
    shipName: 'Vanguard Sentinel',
    customName: 'Ion Storm',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.FAIR,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 340,
    notes: 'EW warfare platform',
  },
  {
    userId: USER_IDS.commander,
    shipName: 'Constellation Andromeda',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 190,
  },

  // Trader Sam
  {
    userId: USER_IDS.trader,
    shipName: 'Caterpillar',
    customName: 'Golden Goose',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 890,
    notes: 'Primary trade hauler',
  },
  {
    userId: USER_IDS.trader,
    shipName: 'C2 Hercules',
    customName: 'Big Haul',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.EXCELLENT,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 560,
  },
  {
    userId: USER_IDS.trader,
    shipName: 'Mercury Star Runner',
    customName: 'Quick Silver',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.PERSONAL,
    flightHours: 345,
  },
  {
    userId: USER_IDS.trader,
    shipName: 'Hull C',
    status: ShipOwnershipStatus.PLEDGED,
    condition: ShipCondition.PRISTINE,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 0,
    notes: 'Awaiting full implementation',
  },

  // Miner Yusuf
  {
    userId: USER_IDS.miner,
    shipName: 'Prospector',
    customName: 'Rock Hound',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.FAIR,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 1540,
    notes: 'Workhorse solo miner',
  },
  {
    userId: USER_IDS.miner,
    shipName: 'MOLE',
    customName: 'Deep Drill',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 720,
    notes: 'Multi-crew mining platform',
  },

  // Bounty Hunter
  {
    userId: USER_IDS.bountyHunter,
    shipName: 'Sabre',
    customName: 'Silent Strike',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.EXCELLENT,
    sharing: ShipSharingLevel.PERSONAL,
    flightHours: 890,
  },
  {
    userId: USER_IDS.bountyHunter,
    shipName: 'Arrow',
    customName: 'Ghost Arrow',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.PERSONAL,
    flightHours: 450,
  },
  {
    userId: USER_IDS.bountyHunter,
    shipName: 'Cutlass Black',
    customName: 'Fang',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.FAIR,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 670,
  },

  // Medic
  {
    userId: USER_IDS.medic,
    shipName: 'Cutlass Red',
    customName: 'Angel of Mercy',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.EXCELLENT,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 580,
    notes: 'Primary SAR vessel',
  },
  {
    userId: USER_IDS.medic,
    shipName: 'Aurora MR',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.POOR,
    sharing: ShipSharingLevel.PERSONAL,
    flightHours: 40,
    notes: 'Starter ship, rarely used',
  },

  // Explorer
  {
    userId: USER_IDS.explorer,
    shipName: 'Carrack',
    customName: 'Horizon Walker',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.EXCELLENT,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 1100,
    notes: 'Primary exploration vessel',
  },
  {
    userId: USER_IDS.explorer,
    shipName: 'Freelancer',
    customName: 'Wayfinder',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.PERSONAL,
    flightHours: 320,
  },

  // Engineer
  {
    userId: USER_IDS.engineer,
    shipName: 'Vulture',
    customName: 'Scrap King',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 280,
    notes: 'Salvage operations',
  },
  {
    userId: USER_IDS.engineer,
    shipName: 'Avenger Titan',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.PERSONAL,
    flightHours: 190,
  },

  // Smuggler/Ghost
  {
    userId: USER_IDS.smuggler,
    shipName: 'Mercury Star Runner',
    customName: 'Phantom Express',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.EXCELLENT,
    sharing: ShipSharingLevel.PERSONAL,
    flightHours: 490,
    notes: 'Fast delivery specialist',
  },
  {
    userId: USER_IDS.smuggler,
    shipName: 'Freelancer MAX',
    customName: 'Max Payload',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 330,
  },

  // Rookie
  {
    userId: USER_IDS.rookie,
    shipName: 'Mustang Alpha',
    customName: 'First Wings',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.PERSONAL,
    flightHours: 24,
    notes: 'Starter package',
  },

  // Pirate / Void Reaper
  {
    userId: USER_IDS.pirate,
    shipName: 'Retaliator Bomber',
    customName: 'Death Blossom',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.FAIR,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 340,
  },
  {
    userId: USER_IDS.pirate,
    shipName: 'Cutlass Black',
    customName: 'War Hound',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.GOOD,
    sharing: ShipSharingLevel.ORGANIZATION,
    flightHours: 510,
  },

  // Diplomat
  {
    userId: USER_IDS.diplomat,
    shipName: 'Constellation Andromeda',
    customName: 'Olive Branch',
    status: ShipOwnershipStatus.OWNED,
    condition: ShipCondition.EXCELLENT,
    sharing: ShipSharingLevel.ALLIANCE,
    flightHours: 260,
    notes: 'Diplomatic mission vessel',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRoleSecurityLevel(role: string): number {
  switch (role) {
    case 'owner':
      return 5;
    case 'admin':
      return 4;
    case 'officer':
      return 3;
    default:
      return 1;
  }
}

// ─── Stable Activity IDs (deterministic, idempotent across re-runs) ──────────

const ACTIVITY_IDS = {
  // Missions
  crimsonDawn: 'a0000000-0000-4000-a000-000000000001',
  pyroRecon: 'a0000000-0000-4000-a000-000000000002',
  quantaniumRush: 'a0000000-0000-4000-a000-000000000003',
  // Contracts
  escortLorville: 'a0000000-0000-4000-a000-000000000004',
  salvageDaymar: 'a0000000-0000-4000-a000-000000000005',
  // Bounties
  bountyRedFox: 'a0000000-0000-4000-a000-000000000006',
  bountyKareah: 'a0000000-0000-4000-a000-000000000007',
  // Events
  fleetDay: 'a0000000-0000-4000-a000-000000000008',
  miningMasterclass: 'a0000000-0000-4000-a000-000000000009',
  // LFG
  lfgBunker: 'a0000000-0000-4000-a000-000000000010',
  lfgMole: 'a0000000-0000-4000-a000-000000000011',
  lfgHullC: 'a0000000-0000-4000-a000-000000000012',
  // Operations
  ironShield: 'a0000000-0000-4000-a000-000000000013',
  // Executive showcases
  allianceSummit: 'a0000000-0000-4000-a000-000000000014',
  complianceDrill: 'a0000000-0000-4000-a000-000000000015',
  fleetKpiReview: 'a0000000-0000-4000-a000-000000000016',
  // Job listing activities
  hiringPilots: 'a0000000-0000-4000-a000-000000000017',
  cargoHaulers: 'a0000000-0000-4000-a000-000000000018',
  // Non-public activities
  smugglingRoute: 'a0000000-0000-4000-a000-000000000019',
  intelDebrief: 'a0000000-0000-4000-a000-000000000020',
  moonshinRun: 'a0000000-0000-4000-a000-000000000021',
  safetyDrill: 'a0000000-0000-4000-a000-000000000022',
  // Open / social (public, not tied to an org)
  gameNight: 'a0000000-0000-4000-a000-000000000023',
  freelanceEscort: 'a0000000-0000-4000-a000-000000000024',
  shipRepair: 'a0000000-0000-4000-a000-000000000025',
  explorerMeetup: 'a0000000-0000-4000-a000-000000000026',
  // Completed — existing
  opStarfall: 'a0000000-0000-4000-a000-000000000027',
  miningMarathon: 'a0000000-0000-4000-a000-000000000028',
  // Completed — 30-day history for dashboard charts
  deepScoutSurvey: 'a0000000-0000-4000-a000-000000000029',
  aaronHaloSession: 'a0000000-0000-4000-a000-000000000030',
  escortHurston: 'a0000000-0000-4000-a000-000000000031',
  convoyStrike: 'a0000000-0000-4000-a000-000000000032',
  clioRecon: 'a0000000-0000-4000-a000-000000000033',
  zeroGDrill: 'a0000000-0000-4000-a000-000000000034',
  salvageYela: 'a0000000-0000-4000-a000-000000000035',
  patrolStanton: 'a0000000-0000-4000-a000-000000000036',
} as const;

// ─── Main Seeder ─────────────────────────────────────────────────────────────

async function seedDemoData(): Promise<void> {
  console.log('🌱 Starting demo data seeding...\n');

  try {
    await AppDataSource.initialize();
    console.log('✅ Database connected\n');

    // ── 1. Users ──────────────────────────────────────────────────────────
    console.log('👤 Seeding users...');
    const userRepo = AppDataSource.getRepository(User);
    let usersCreated = 0;

    // Pre-hash the admin password so the admin portal login works out-of-the-box
    const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD || generateDemoAdminPassword();
    if (!process.env.DEMO_ADMIN_PASSWORD) {
      console.warn(
        `DEMO_ADMIN_PASSWORD not set. Generated demo admin password: ${demoAdminPassword}`
      );
    }
    const adminPasswordHash = await bcrypt.hash(demoAdminPassword, 10);

    for (const userData of USERS) {
      const existsById = await userRepo.findOne({ where: { id: userData.id } });
      const existsByUsername = await userRepo.findOne({ where: { username: userData.username } });
      if (!existsById && !existsByUsername) {
        const user = userRepo.create({
          ...userData,
          password: userData.role === 'admin' ? adminPasswordHash : null,
          activeOrgId: null,
          twoFactorEnabled: false,
          failedLoginAttempts: 0,
          lastLoginAt: daysAgo(Math.floor(Math.random() * 7)),
          lastActiveAt: daysAgo(Math.floor(Math.random() * 2)),
          createdAt: daysAgo(90 + Math.floor(Math.random() * 270)),
        } as any);
        await userRepo.save(user);
        usersCreated++;
      } else if (!existsById && existsByUsername) {
        // User exists with this username but different ID — update to use expected ID
        await userRepo.update({ username: userData.username }, { id: userData.id });
        usersCreated++;
      }
    }
    console.log(
      `   Created ${usersCreated} users (${USERS.length - usersCreated} already existed)\n`
    );

    // ── 2. Organizations ──────────────────────────────────────────────────
    console.log('🏛️  Seeding organizations...');
    const orgRepo = AppDataSource.getRepository(Organization);
    let orgsCreated = 0;
    let orgsUpdated = 0;

    for (const orgData of ORGANIZATIONS) {
      const exists = await orgRepo.findOne({ where: { id: orgData.id } });
      if (!exists) {
        const org = orgRepo.create({
          ...orgData,
          members: [], // deprecated field, but required
          level: 0,
          path: '',
          childCount: 0,
          createdAt: daysAgo(180 + Math.floor(Math.random() * 180)),
        } as any);
        await orgRepo.save(org);
        orgsCreated++;
      } else {
        const merged = orgRepo.merge(exists, {
          ...orgData,
          members: exists.members ?? [],
          level: exists.level ?? 0,
          path: exists.path ?? '',
          childCount: exists.childCount ?? 0,
        } as any);
        await orgRepo.save(merged);
        orgsUpdated++;
      }
    }
    console.log(`   Created ${orgsCreated}, updated ${orgsUpdated} organizations\n`);

    // Set active org for users (primary org = the org they own, or first membership)
    // Owners get their owned org as primary
    for (const [orgId, members] of Object.entries(MEMBERSHIPS)) {
      const owner = members.find(m => m.role === 'owner');
      if (owner) {
        await userRepo.update(owner.userId, { activeOrgId: orgId });
      }
    }

    // Explicitly set activeOrgId for multi-org users who aren't owners
    // These users choose a "primary" org (the first org listed is their primary)
    const MULTI_ORG_ACTIVE_ORGS: Record<string, string> = {
      // Commander Nova: member of fleet (admin) + mercenary (officer) → primary: fleet
      [USER_IDS.commander]: ORG_IDS.fleet,
      // Engineer: member of fleet (member) + mining (officer) → primary: mining
      [USER_IDS.engineer]: ORG_IDS.mining,
      // Rookie: member of fleet (member) + mining (member) + syndicate (member) → primary: fleet
      [USER_IDS.rookie]: ORG_IDS.fleet,
      // Explorer: member of fleet (officer) + intel (officer) → primary: fleet
      [USER_IDS.explorer]: ORG_IDS.fleet,
      // Pirate: member of mercenary (admin) + syndicate (officer) → primary: mercenary
      [USER_IDS.pirate]: ORG_IDS.mercenary,
    };
    for (const [userId, orgId] of Object.entries(MULTI_ORG_ACTIVE_ORGS)) {
      await userRepo.update(userId, { activeOrgId: orgId });
    }
    console.log(
      `   Set activeOrgId (primary org) for ${Object.keys(MULTI_ORG_ACTIVE_ORGS).length} multi-org users\n`
    );

    // ── 2b. Organization Roles ────────────────────────────────────────────
    console.log('🎭 Seeding organization roles...');
    const roleRepo = AppDataSource.getRepository(Role);
    let rolesCreated = 0;
    const roleNameMap: Record<string, { description: string; priority: number }> = {
      owner: { description: 'Organization owner — full administrative control', priority: 100 },
      admin: { description: 'Organization administrator', priority: 80 },
      officer: { description: 'Organization officer with operational permissions', priority: 60 },
      member: { description: 'Standard organization member', priority: 30 },
    };
    for (const [orgId, roles] of Object.entries(DEMO_ROLE_IDS)) {
      for (const [roleName, roleId] of Object.entries(roles)) {
        const exists = await roleRepo.findOne({ where: { id: roleId } });
        if (!exists) {
          const meta = roleNameMap[roleName];
          await roleRepo.save(
            roleRepo.create({
              id: roleId,
              name: roleName.charAt(0).toUpperCase() + roleName.slice(1),
              description: meta.description,
              isSystemRole: false,
              priority: meta.priority,
              organizationId: orgId,
            })
          );
          rolesCreated++;
        }
      }
    }
    console.log(`   Created ${rolesCreated} organization roles\n`);

    // ── 3. Organization Memberships ───────────────────────────────────────
    console.log('🤝 Seeding organization memberships...');
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    let membershipsCreated = 0;

    for (const [orgId, members] of Object.entries(MEMBERSHIPS)) {
      for (const member of members) {
        const exists = await membershipRepo.findOne({
          where: { userId: member.userId, organizationId: orgId },
        });
        if (!exists) {
          const membership = membershipRepo.create({
            userId: member.userId,
            organizationId: orgId,
            roleId: DEMO_ROLE_IDS[orgId][member.role],
            title: member.title ?? null,
            isActive: true,
            joinedAt: daysAgo(60 + Math.floor(Math.random() * 120)),
            securityLevel: getRoleSecurityLevel(member.role),
          } as any);
          await membershipRepo.save(membership);
          membershipsCreated++;
        }
      }
    }
    console.log(`   Created ${membershipsCreated} memberships\n`);

    // ── 3b. Catch-all: ensure every member has activeOrgId ────────────────
    // Any user with at least one org membership but null activeOrgId
    // gets their first active membership's org set as primary
    const usersWithoutActiveOrg = await userRepo
      .createQueryBuilder('u')
      .where('u.activeOrgId IS NULL')
      .andWhere(
        'EXISTS (SELECT 1 FROM organization_memberships om WHERE om."userId" = u.id AND om."isActive" = true)'
      )
      .getMany();

    let backfilledCount = 0;
    for (const u of usersWithoutActiveOrg) {
      const firstMembership = await membershipRepo.findOne({
        where: { userId: u.id, isActive: true },
        order: { joinedAt: 'ASC' },
      });
      if (firstMembership) {
        await userRepo.update(u.id, { activeOrgId: firstMembership.organizationId });
        backfilledCount++;
      }
    }
    if (backfilledCount > 0) {
      console.log(`   Set activeOrgId for ${backfilledCount} members who were missing it\n`);
    }

    // ── 4. User Ships ─────────────────────────────────────────────────────
    console.log('🚀 Seeding user ships...');
    const shipCatalogRepo = AppDataSource.getRepository(Ship);
    const userShipRepo = AppDataSource.getRepository(UserShip);
    let userShipsCreated = 0;

    // Build a lookup: name → ship catalog ID
    const catalogShips = await shipCatalogRepo.find();
    const shipNameToId: Record<string, string> = {};
    for (const s of catalogShips) {
      shipNameToId[s.name] = s.id;
    }

    if (catalogShips.length === 0) {
      console.log(
        '   ⚠️  No ships in catalog — run "npm run seed:ships" first. Skipping user ships.\n'
      );
    } else {
      for (const shipData of USER_SHIPS_DATA) {
        const catalogId = shipNameToId[shipData.shipName];
        if (!catalogId) {
          console.log(`   ⚠️  Ship "${shipData.shipName}" not found in catalog, skipping`);
          continue;
        }

        // Check for existing (by userId + shipId + customName combo)
        const existingShips = await userShipRepo.find({
          where: { userId: shipData.userId, shipId: catalogId },
        });
        const alreadyExists = existingShips.some(
          s => (s.customName ?? '') === (shipData.customName ?? '')
        );

        if (!alreadyExists) {
          const userShip = userShipRepo.create({
            userId: shipData.userId,
            shipId: catalogId,
            shipName: shipData.shipName,
            customName: shipData.customName ?? null,
            status: shipData.status,
            condition: shipData.condition,
            sharingLevel: shipData.sharing,
            flightHours: shipData.flightHours,
            notes: shipData.notes ?? null,
            visibleToOrganization: shipData.sharing !== ShipSharingLevel.PERSONAL,
            isActive: true,
            acquiredDate: daysAgo(30 + Math.floor(Math.random() * 330)),
          } as any);
          await userShipRepo.save(userShip);
          userShipsCreated++;
        }
      }
      console.log(
        `   Created ${userShipsCreated} user ships (catalog has ${catalogShips.length} ships)\n`
      );
    }

    // ── 5. Fleets ─────────────────────────────────────────────────────────
    console.log('⚔️  Seeding fleets...');
    const fleetRepo = AppDataSource.getRepository(Fleet);
    let fleetsCreated = 0;
    let fleetsUpdated = 0;

    const FLEETS = [
      {
        id: FLEET_IDS.alpha,
        name: 'Alpha Strike Wing',
        description:
          'Primary combat task force of the Stardust Expeditionary Fleet. Rapid response and strike operations.',
        organizationId: ORG_IDS.fleet,
        status: FleetStatus.ACTIVE,
        type: FleetType.COMBAT,
        leaderId: USER_IDS.commander,
        secondInCommandId: USER_IDS.admiral,
        members: [USER_IDS.commander, USER_IDS.admiral, USER_IDS.medic, USER_IDS.engineer],
        maxMembers: 20,
        isPublic: true,
        visibility: 'public',
        color: '#ff4444',
        tags: ['combat', 'rapid-response', 'strike'],
        primaryActivity: 'Combat patrols and rapid response',
      },
      {
        id: FLEET_IDS.mining,
        name: 'Deep Drill Squadron',
        description:
          'Mining fleet specializing in quantanium and high-value mineral extraction across the Stanton system.',
        organizationId: ORG_IDS.mining,
        status: FleetStatus.DEPLOYED,
        type: FleetType.MINING,
        leaderId: USER_IDS.miner,
        members: [USER_IDS.miner, USER_IDS.engineer, USER_IDS.trader],
        maxMembers: 15,
        isPublic: true,
        visibility: 'public',
        color: '#ffaa00',
        tags: ['mining', 'quantanium', 'industrial'],
        deployedAt: daysAgo(2),
        deploymentLocation: 'Aaron Halo - ARC-L1',
        primaryActivity: 'Quantanium extraction operations',
      },
      {
        id: FLEET_IDS.trade,
        name: 'Silk Road Convoy',
        description:
          'Trade convoy running high-value cargo routes between major landing zones. Escort-supported.',
        organizationId: ORG_IDS.trading,
        status: FleetStatus.ACTIVE,
        type: FleetType.TRADING,
        leaderId: USER_IDS.trader,
        members: [USER_IDS.trader, USER_IDS.smuggler],
        maxMembers: 12,
        isPublic: true,
        visibility: 'public',
        color: '#00d9ff',
        tags: ['trade', 'cargo', 'convoy', 'escort'],
        primaryActivity: 'Bulk cargo hauling across Stanton',
      },
    ];

    for (const fleetData of FLEETS) {
      const exists = await fleetRepo.findOne({ where: { id: fleetData.id } });
      if (!exists) {
        const fleet = fleetRepo.create({
          ...fleetData,
          shipIds: [],
          allowApplications: true,
          createdAt: daysAgo(60 + Math.floor(Math.random() * 60)),
        });
        await fleetRepo.save(fleet);
        fleetsCreated++;
      } else {
        const merged = fleetRepo.merge(exists, fleetData);
        await fleetRepo.save(merged);
        fleetsUpdated++;
      }
    }
    console.log(`   Created ${fleetsCreated}, updated ${fleetsUpdated} fleets\n`);

    // ── 6. Fleet Members ──────────────────────────────────────────────────
    // Fleet members are stored in Fleet.members[] array (set during fleet creation above)
    console.log('👥 Fleet members already assigned via Fleet.members array\n');

    // ── 7. Fleet Ships ────────────────────────────────────────────────────
    console.log('🛸 Seeding fleet ship assignments...');
    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    let fleetShipsCreated = 0;

    const FLEET_SHIP_ASSIGNMENTS: Array<{
      fleetId: string;
      shipName: string;
      organizationId: string;
      role: string;
      assignedBy: string;
    }> = [
      // Alpha Strike Wing — combat ships
      {
        fleetId: FLEET_IDS.alpha,
        shipName: 'Hammerhead',
        organizationId: ORG_IDS.fleet,
        role: 'flagship',
        assignedBy: USER_IDS.admiral,
      },
      {
        fleetId: FLEET_IDS.alpha,
        shipName: 'Gladius',
        organizationId: ORG_IDS.fleet,
        role: 'fighter',
        assignedBy: USER_IDS.commander,
      },
      {
        fleetId: FLEET_IDS.alpha,
        shipName: 'Vanguard Sentinel',
        organizationId: ORG_IDS.fleet,
        role: 'electronic-warfare',
        assignedBy: USER_IDS.commander,
      },
      {
        fleetId: FLEET_IDS.alpha,
        shipName: 'Cutlass Red',
        organizationId: ORG_IDS.fleet,
        role: 'medical-support',
        assignedBy: USER_IDS.medic,
      },

      // Deep Drill Squadron — mining ships
      {
        fleetId: FLEET_IDS.mining,
        shipName: 'MOLE',
        organizationId: ORG_IDS.mining,
        role: 'primary-miner',
        assignedBy: USER_IDS.miner,
      },
      {
        fleetId: FLEET_IDS.mining,
        shipName: 'Prospector',
        organizationId: ORG_IDS.mining,
        role: 'scout-miner',
        assignedBy: USER_IDS.miner,
      },

      // Silk Road Convoy — trade ships
      {
        fleetId: FLEET_IDS.trade,
        shipName: 'Caterpillar',
        organizationId: ORG_IDS.trading,
        role: 'primary-hauler',
        assignedBy: USER_IDS.trader,
      },
      {
        fleetId: FLEET_IDS.trade,
        shipName: 'C2 Hercules',
        organizationId: ORG_IDS.trading,
        role: 'heavy-hauler',
        assignedBy: USER_IDS.trader,
      },
      {
        fleetId: FLEET_IDS.trade,
        shipName: 'Mercury Star Runner',
        organizationId: ORG_IDS.trading,
        role: 'fast-courier',
        assignedBy: USER_IDS.smuggler,
      },
    ];

    for (const fsa of FLEET_SHIP_ASSIGNMENTS) {
      const catalogId = shipNameToId[fsa.shipName];
      if (!catalogId) {
        continue;
      }

      const exists = await fleetShipRepo.findOne({
        where: { fleetId: fsa.fleetId, shipId: catalogId },
      });
      if (!exists) {
        const fleetShip = fleetShipRepo.create({
          fleetId: fsa.fleetId,
          shipId: catalogId,
          organizationId: fsa.organizationId,
          role: fsa.role,
          assignedBy: fsa.assignedBy,
          notes: `Assigned as ${fsa.role}`,
        });
        await fleetShipRepo.save(fleetShip);
        fleetShipsCreated++;
      }
    }
    console.log(`   Created ${fleetShipsCreated} fleet ship assignments\n`);

    // ── 8. Alliance Diplomacy ─────────────────────────────────────────────
    console.log('🤝 Seeding alliances & diplomacy...');
    const allianceRepo = AppDataSource.getRepository(AllianceDiplomacy);
    const orgRelRepo = AppDataSource.getRepository(OrganizationRelationship);
    let alliancesCreated = 0;
    let alliancesUpdated = 0;
    let relationsCreated = 0;
    let relationsUpdated = 0;

    // Alliance: Stardust ↔ Deep Core
    const alliance1Exists = await allianceRepo.findOne({
      where: { id: ALLIANCE_IDS.stardustDeepcore },
    });
    if (!alliance1Exists) {
      const alliance1 = allianceRepo.create({
        id: ALLIANCE_IDS.stardustDeepcore,
        orgId1: ORG_IDS.fleet,
        orgId2: ORG_IDS.mining,
        allianceType: AllianceType.FULL_ALLIANCE,
        status: DiplomacyStatus.ACTIVE,
        proposedBy: USER_IDS.admiral,
        approvedBy: USER_IDS.miner,
        terms: [
          {
            type: 'resource_sharing',
            description:
              'Shared mining yields — 20% of quantanium profits distributed to escort fleet',
            active: true,
          },
          {
            type: 'mutual_defense',
            description: 'Each org pledges combat support within 15 minutes of distress call',
            active: true,
          },
        ],
        incidents: [],
        startDate: daysAgo(120),
        notes:
          'Strategic partnership: Stardust provides combat escort for Deep Core mining operations',
      } as any);
      await allianceRepo.save(alliance1);
      alliancesCreated++;
    } else {
      const merged = allianceRepo.merge(alliance1Exists, {
        allianceType: AllianceType.FULL_ALLIANCE,
        status: DiplomacyStatus.ACTIVE,
        approvedBy: USER_IDS.miner,
        terms: [
          {
            type: 'resource_sharing',
            description: 'Shared mining yields — 20% of quantanium profits distributed to escort fleet',
            active: true,
          },
          {
            type: 'mutual_defense',
            description: 'Each org pledges combat support within 15 minutes of distress call',
            active: true,
          },
        ],
        notes: 'Strategic partnership: Stardust provides combat escort for Deep Core mining operations',
      } as any);
      await allianceRepo.save(merged);
      alliancesUpdated++;
    }

    // Alliance: Ironwolf ↔ Quantum Trade
    const alliance2Exists = await allianceRepo.findOne({
      where: { id: ALLIANCE_IDS.ironwolfQuantum },
    });
    if (!alliance2Exists) {
      const alliance2 = allianceRepo.create({
        id: ALLIANCE_IDS.ironwolfQuantum,
        orgId1: ORG_IDS.mercenary,
        orgId2: ORG_IDS.trading,
        allianceType: AllianceType.TRADE,
        status: DiplomacyStatus.ACTIVE,
        proposedBy: USER_IDS.trader,
        approvedBy: USER_IDS.bountyHunter,
        terms: [
          {
            type: 'escort_contract',
            description: 'Ironwolf provides convoy escort at preferential rates',
            active: true,
          },
          {
            type: 'priority_contracts',
            description: 'Ironwolf gets first pick of Quantum Trade security contracts',
            active: true,
          },
        ],
        incidents: [],
        startDate: daysAgo(45),
        notes: 'Business partnership: Ironwolf escorts Quantum Trade convoys through Pyro',
      } as any);
      await allianceRepo.save(alliance2);
      alliancesCreated++;
    } else {
      const merged = allianceRepo.merge(alliance2Exists, {
        allianceType: AllianceType.TRADE,
        status: DiplomacyStatus.ACTIVE,
        approvedBy: USER_IDS.bountyHunter,
        terms: [
          {
            type: 'escort_contract',
            description: 'Ironwolf provides convoy escort at preferential rates',
            active: true,
          },
          {
            type: 'priority_contracts',
            description: 'Ironwolf gets first pick of Quantum Trade security contracts',
            active: true,
          },
        ],
        notes: 'Business partnership: Ironwolf escorts Quantum Trade convoys through Pyro',
      } as any);
      await allianceRepo.save(merged);
      alliancesUpdated++;
    }

    // Organization Relationships (bidirectional pairs)
    const ORG_RELS = [
      {
        organizationId: ORG_IDS.fleet,
        targetOrganizationId: ORG_IDS.mining,
        type: 'allied',
        trustScore: 85,
        description: 'Full alliance — joint operations',
      },
      {
        organizationId: ORG_IDS.mining,
        targetOrganizationId: ORG_IDS.fleet,
        type: 'allied',
        trustScore: 85,
        description: 'Full alliance — joint operations',
      },
      {
        organizationId: ORG_IDS.mercenary,
        targetOrganizationId: ORG_IDS.trading,
        type: 'trading_partner',
        trustScore: 72,
        description: 'Escort and security services partnership',
      },
      {
        organizationId: ORG_IDS.trading,
        targetOrganizationId: ORG_IDS.mercenary,
        type: 'trading_partner',
        trustScore: 72,
        description: 'Escort and security services partnership',
      },
      {
        organizationId: ORG_IDS.fleet,
        targetOrganizationId: ORG_IDS.mercenary,
        type: 'neutral',
        trustScore: 50,
        description: 'Neutral — occasional joint operations',
      },
      {
        organizationId: ORG_IDS.mercenary,
        targetOrganizationId: ORG_IDS.fleet,
        type: 'neutral',
        trustScore: 50,
        description: 'Neutral — occasional joint operations',
      },
    ];

    for (const rel of ORG_RELS) {
      const exists = await orgRelRepo.findOne({
        where: {
          organizationId: rel.organizationId,
          targetOrganizationId: rel.targetOrganizationId,
        },
      });
      if (!exists) {
        const relationship = orgRelRepo.create({
          ...rel,
          status: RelationshipStatus.ACTIVE,
          relationshipStrength: rel.trustScore,
          interactionCount: Math.floor(Math.random() * 50) + 5,
          positiveInteractions: Math.floor(Math.random() * 30) + 5,
          negativeInteractions: Math.floor(Math.random() * 5),
          isMutual: true,
          isPublic: true,
          establishedDate: daysAgo(90 + Math.floor(Math.random() * 90)),
          lastInteractionDate: daysAgo(Math.floor(Math.random() * 7)),
          establishedBy: USER_IDS.diplomat,
        } as any);
        await orgRelRepo.save(relationship);
        relationsCreated++;
      } else {
        const merged = orgRelRepo.merge(exists, {
          type: rel.type,
          trustScore: rel.trustScore,
          description: rel.description,
          status: RelationshipStatus.ACTIVE,
          relationshipStrength: rel.trustScore,
          isMutual: true,
          isPublic: true,
          establishedBy: USER_IDS.diplomat,
        } as any);
        await orgRelRepo.save(merged);
        relationsUpdated++;
      }
    }
    console.log(
      `   Created ${alliancesCreated}, updated ${alliancesUpdated} alliances; created ${relationsCreated}, updated ${relationsUpdated} org relationships\n`
    );

    // ── 9. Activities (15+ of various types) ──────────────────────────────
    console.log('📋 Seeding activities...');
    const activityRepo = AppDataSource.getRepository(Activity);
    let activitiesCreated = 0;
    let activitiesUpdated = 0;

    const ACTIVITIES = [
      // ── Missions ──
      {
        id: ACTIVITY_IDS.crimsonDawn,
        title: 'Operation Crimson Dawn',
        description:
          'Joint strike operation to clear pirate encampment near CRU-L5. Multi-squadron coordinated assault with A2 bombing run followed by ground sweep. Full combat loadouts required.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.RECRUITING,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.commander,
        creatorName: 'Commander Nova',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 16,
        currentParticipants: 4,
        scheduledStartDate: daysFromNow(3),
        scheduledEndDate: daysFromNow(3),
        location: 'CRU-L5 — Pirate Outpost',
        tags: ['combat', 'strike', 'pirate-clearing', 'multi-crew'],
        difficulty: DifficultyLevel.HARD,
        rewardCredits: 150000,
        isFeatured: true,
        isUrgent: false,
        participants: [USER_IDS.bountyHunter, USER_IDS.engineer, USER_IDS.medic, USER_IDS.rookie],
      },
        title: 'Deep Space Reconnaissance — Pyro Gate',
        description:
          'Exploration mission to map jump point corridor and document new POIs near the Pyro-Stanton gate. Scouts and explorers needed. Carrack team preferred.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.explorer,
        creatorName: 'Stellarpath',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 8,
        currentParticipants: 2,
        scheduledStartDate: daysFromNow(5),
        scheduledEndDate: daysFromNow(6),
        location: 'Stanton-Pyro Jump Point',
        tags: ['exploration', 'mapping', 'pyro', 'jump-point'],
        difficulty: DifficultyLevel.MEDIUM,
        rewardCredits: 80000,
      },
      {
        id: ACTIVITY_IDS.quantaniumRush,
        title: 'Quantanium Rush — Aaron Halo Sprint',
        description:
          'Timed mining operation targeting high-yield quantanium clusters in the Aaron Halo belt. MOLE teams with Prospector scouts. Bring your A-game and your best mining heads.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.IN_PROGRESS,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.miner,
        creatorName: 'Rockbreaker Yusuf',
        organizationId: ORG_IDS.mining,
        organizationName: 'Deep Core Mining Consortium',
        maxParticipants: 6,
        currentParticipants: 4,
        scheduledStartDate: daysAgo(0),
        scheduledEndDate: hoursFromNow(4),
        location: 'Aaron Halo — ARC-L1 Cluster',
        tags: ['mining', 'quantanium', 'timed', 'competitive'],
        difficulty: DifficultyLevel.MEDIUM,
        rewardCredits: 120000,
      },

      // ── Contracts ──
      {
        id: ACTIVITY_IDS.escortLorville,
        title: 'Escort Contract: Lorville → Orison Cargo Run',
        description:
          'Need 2-3 combat pilots to escort a C2 Hercules loaded with medical supplies from Lorville to Orison. High-threat corridor through Crusader airspace. Payment on delivery.',
        activityType: ActivityType.CONTRACT,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.trader,
        creatorName: 'Silkroad Sam',
        organizationId: ORG_IDS.trading,
        organizationName: 'Quantum Trade Network',
        maxParticipants: 4,
        currentParticipants: 1,
        scheduledStartDate: daysFromNow(1),
        location: 'Lorville → Orison',
        tags: ['escort', 'cargo', 'combat', 'paid'],
        difficulty: DifficultyLevel.MEDIUM,
        rewardCredits: 45000,
        paymentType: PaymentType.FIXED,
      },
      {
        id: ACTIVITY_IDS.salvageDaymar,
        title: 'Salvage Recovery: Derelict Caterpillar (Daymar)',
        description:
          'Located a derelict Caterpillar in the dunes of Daymar. Need Vulture crew and a transport to strip it. 60/40 split — finder gets 40%.',
        activityType: ActivityType.CONTRACT,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.ALLIANCE,
        creatorId: USER_IDS.engineer,
        creatorName: 'Wrench Monkey',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 3,
        currentParticipants: 1,
        scheduledStartDate: daysFromNow(2),
        location: 'Daymar — Grid 22-F',
        tags: ['salvage', 'recovery', 'vulture', 'profit-sharing'],
        difficulty: DifficultyLevel.EASY,
        rewardCredits: 35000,
        paymentType: PaymentType.PERCENTAGE,
      },

      // ── Bounties ──
      {
        id: ACTIVITY_IDS.bountyRedFox,
        title: 'BOUNTY: "RedFox" — Serial Cargo Thief',
        description:
          'Known pirate handle "RedFox" has hit 3 Quantum Trade convoys in the past week. Last seen near Grim HEX. Wanted dead or alive. Evidence of neutralization required.',
        activityType: ActivityType.BOUNTY,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.bountyHunter,
        creatorName: 'Shadowfang',
        organizationId: ORG_IDS.mercenary,
        organizationName: 'Ironwolf Mercenary Company',
        maxParticipants: 2,
        currentParticipants: 0,
        location: 'Last seen: Grim HEX vicinity',
        tags: ['bounty', 'pvp', 'pirate', 'combat'],
        difficulty: DifficultyLevel.HARD,
        rewardCredits: 200000,
        isUrgent: true,
      },
      {
        id: ACTIVITY_IDS.bountyKareah,
        title: 'BOUNTY: Clear CS4+ at Kareah',
        description:
          'Looking for a partner to help clear crimestat at Security Post Kareah. Bring heavy armor and a fast ship for extraction. Split reward.',
        activityType: ActivityType.BOUNTY,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PRIVATE,
        creatorId: USER_IDS.pirate,
        creatorName: 'Void Reaper',
        organizationId: ORG_IDS.mercenary,
        organizationName: 'Ironwolf Mercenary Company',
        maxParticipants: 2,
        currentParticipants: 1,
        location: 'Security Post Kareah',
        tags: ['bounty', 'crimestat', 'kareah', 'extraction'],
        difficulty: DifficultyLevel.MEDIUM,
        rewardCredits: 30000,
      },

      // ── Events ──
      {
        id: ACTIVITY_IDS.fleetDay,
        title: 'Fleet Day 2953 — Annual Review & Awards',
        description:
          'Annual Stardust Expeditionary Fleet gathering. Ship showcase, formation flying, combat tournament, and crew awards ceremony. All members and allies welcome. Dress uniform optional.',
        activityType: ActivityType.EVENT,
        status: ActivityStatus.PLANNING,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.admiral,
        creatorName: 'Admiral Chen Wei',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 50,
        currentParticipants: 12,
        scheduledStartDate: daysFromNow(14),
        scheduledEndDate: daysFromNow(14),
        location: 'Area18 — Riker Memorial Spaceport',
        tags: ['event', 'fleet-day', 'awards', 'social', 'formation'],
        difficulty: DifficultyLevel.EASY,
        isFeatured: true,
      },
      {
        id: ACTIVITY_IDS.miningMasterclass,
        title: 'Mining Masterclass — Beginner Workshop',
        description:
          'Free workshop for new miners. Learn scanning techniques, fracturing theory, quantanium handling, and MOLE multi-crew procedures. Ships provided.',
        activityType: ActivityType.EVENT,
        status: ActivityStatus.RECRUITING,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.miner,
        creatorName: 'Rockbreaker Yusuf',
        organizationId: ORG_IDS.mining,
        organizationName: 'Deep Core Mining Consortium',
        maxParticipants: 10,
        currentParticipants: 3,
        scheduledStartDate: daysFromNow(7),
        location: 'Hurston — HDMS-Edmond',
        tags: ['event', 'workshop', 'mining', 'beginner', 'training'],
        difficulty: DifficultyLevel.EASY,
        participants: [USER_IDS.rookie, USER_IDS.engineer],
      },

      // ── LFG (Looking For Group) ──
      {
        id: ACTIVITY_IDS.lfgBunker,
        title: 'LFG: Bunker Clearing Team (3 more needed)',
        description:
          'Running bunker missions tonight. Need 3 more combat-capable players. Light to medium armor, bring your own weapons. Voice comms required.',
        activityType: ActivityType.LFG,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.commander,
        creatorName: 'Commander Nova',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 4,
        currentParticipants: 1,
        scheduledStartDate: hoursFromNow(2),
        location: 'microTech — various bunkers',
        tags: ['lfg', 'bunker', 'fps', 'combat', 'tonight'],
        difficulty: DifficultyLevel.MEDIUM,
      },
      {
        id: ACTIVITY_IDS.lfgMole,
        title: 'LFG: MOLE Crew — 2 Turret Operators Needed',
        description:
          'Solo MOLE pilot looking for 2 turret operators for a 3-hour mining session. 33% profit split. Experience preferred but not required.',
        activityType: ActivityType.LFG,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.miner,
        creatorName: 'Rockbreaker Yusuf',
        organizationId: ORG_IDS.mining,
        organizationName: 'Deep Core Mining Consortium',
        maxParticipants: 3,
        currentParticipants: 1,
        scheduledStartDate: hoursFromNow(1),
        location: 'Aaron Halo',
        tags: ['lfg', 'mining', 'mole', 'crew', 'profit-split'],
        difficulty: DifficultyLevel.EASY,
      },
      {
        id: ACTIVITY_IDS.lfgHullC,
        title: 'LFG: Cargo Run Partner — Hull C Test Flight',
        description:
          'Just got my Hull C flight-ready! Looking for an escort buddy to test cargo routes. First run is Lorville → Area18. Good vibes only.',
        activityType: ActivityType.LFG,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.trader,
        creatorName: 'Silkroad Sam',
        organizationId: ORG_IDS.trading,
        organizationName: 'Quantum Trade Network',
        maxParticipants: 2,
        currentParticipants: 1,
        scheduledStartDate: daysFromNow(1),
        location: 'Lorville → Area18',
        tags: ['lfg', 'cargo', 'hull-c', 'escort', 'chill'],
        difficulty: DifficultyLevel.EASY,
      },

      // ── Operations ──
      {
        id: ACTIVITY_IDS.ironShield,
        title: 'Operation Iron Shield — Convoy Defense Drill',
        description:
          'Multi-org joint exercise: Ironwolf provides aggressor force while Quantum Trade runs a convoy with Stardust escort. Real-time tactical coordination training.',
        activityType: ActivityType.OPERATION,
        status: ActivityStatus.PLANNING,
        visibility: ActivityVisibility.ALLIANCE,
        creatorId: USER_IDS.diplomat,
        creatorName: 'Ambassador Aria',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        participatingOrgs: [
          {
            organizationId: ORG_IDS.fleet,
            organizationName: 'Stardust Expeditionary Fleet',
            role: 'host' as const,
            memberCount: 4,
            status: 'accepted' as const,
            joinedAt: new Date(),
          },
          {
            organizationId: ORG_IDS.mercenary,
            organizationName: 'Ironwolf Mercenary Company',
            role: 'participant' as const,
            memberCount: 3,
            status: 'accepted' as const,
            joinedAt: new Date(),
          },
          {
            organizationId: ORG_IDS.trading,
            organizationName: 'Quantum Trade Network',
            role: 'participant' as const,
            memberCount: 2,
            status: 'accepted' as const,
            joinedAt: new Date(),
          },
        ],
        maxParticipants: 30,
        currentParticipants: 8,
        scheduledStartDate: daysFromNow(10),
        scheduledEndDate: daysFromNow(10),
        location: 'Crusader — Yela to Cellin corridor',
        tags: ['operation', 'multi-org', 'training', 'convoy', 'tactical'],
        difficulty: DifficultyLevel.EXPERT,
        isFeatured: true,
      },
      {
        id: ACTIVITY_IDS.allianceSummit,
        title: 'Executive Showcase: Alliance Command Summit',
        description:
          'Leadership summit demonstrating cross-organization command workflows: diplomacy updates, fleet readiness review, and multi-org operation planning with action tracking.',
        activityType: ActivityType.EVENT,
        status: ActivityStatus.PLANNING,
        visibility: ActivityVisibility.ALLIANCE,
        creatorId: USER_IDS.diplomat,
        creatorName: 'Ambassador Aria',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 24,
        currentParticipants: 11,
        scheduledStartDate: daysFromNow(9),
        scheduledEndDate: daysFromNow(9),
        location: 'Orison — Crusader Capitol Conference Hall',
        tags: ['executive', 'alliance', 'diplomacy', 'planning', 'live-demo'],
        difficulty: DifficultyLevel.MEDIUM,
        isFeatured: true,
        participants: [USER_IDS.commander, USER_IDS.diplomat, USER_IDS.trader, USER_IDS.admiral],
      },
      {
        id: ACTIVITY_IDS.complianceDrill,
        title: 'Executive Showcase: Compliance & Security Readiness Drill',
        description:
          'Quarterly governance drill validating audit trails, role assignments, incident response timings, and policy adherence across command staff.',
        activityType: ActivityType.OPERATION,
        status: ActivityStatus.RECRUITING,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.admin,
        creatorName: 'Platform Admin',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 14,
        currentParticipants: 6,
        scheduledStartDate: daysFromNow(4),
        scheduledEndDate: daysFromNow(4),
        location: 'Area18 — Secure Ops Center',
        tags: ['executive', 'compliance', 'security', 'audit', 'live-demo'],
        difficulty: DifficultyLevel.MEDIUM,
        isFeatured: true,
        participants: [USER_IDS.admin, USER_IDS.commander, USER_IDS.engineer],
      },
      {
        id: ACTIVITY_IDS.fleetKpiReview,
        title: 'Executive Showcase: Fleet Readiness KPI Review',
        description:
          'Command review focused on mission throughput, ship availability, staffing gaps, and upcoming operation risk indicators for the next 30 days.',
        activityType: ActivityType.EVENT,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.commander,
        creatorName: 'Commander Nova',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 18,
        currentParticipants: 8,
        scheduledStartDate: daysFromNow(2),
        scheduledEndDate: daysFromNow(2),
        location: 'Stanton Command Deck — Briefing Room A',
        tags: ['executive', 'kpi', 'analytics', 'readiness', 'live-demo'],
        difficulty: DifficultyLevel.EASY,
        isFeatured: true,
      },

      // ── Job Listings ──
      {
        id: ACTIVITY_IDS.hiringPilots,
        title: 'Hiring: Combat Pilots (Alpha Strike Wing)',
        description:
          'The Stardust Expeditionary Fleet is recruiting experienced combat pilots for our Alpha Strike Wing. Requirements: 100+ hours flight time, own a combat-capable ship, available for 2+ ops per week. Benefits include org-funded ship upgrades and priority loot distribution.',
        activityType: ActivityType.JOB_LISTING,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.commander,
        creatorName: 'Commander Nova',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 5,
        currentParticipants: 0,
        location: 'Remote — All Stanton systems',
        tags: ['job', 'combat', 'pilot', 'recruitment', 'experienced'],
        paymentType: PaymentType.PERCENTAGE,
        rewardCredits: 0,
      },
      {
        id: ACTIVITY_IDS.cargoHaulers,
        title: 'Cargo Haulers Wanted — Weekly Runs',
        description:
          'Quantum Trade Network is expanding routes and needs reliable cargo haulers. Must own a Freelancer MAX or larger. Weekly scheduled runs with guaranteed minimum pay + bonus for on-time delivery.',
        activityType: ActivityType.JOB_LISTING,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.trader,
        creatorName: 'Silkroad Sam',
        organizationId: ORG_IDS.trading,
        organizationName: 'Quantum Trade Network',
        maxParticipants: 8,
        currentParticipants: 2,
        location: 'Stanton system — multiple routes',
        tags: ['job', 'cargo', 'hauler', 'weekly', 'guaranteed-pay'],
        paymentType: PaymentType.FIXED,
        rewardCredits: 25000,
      },

      // ── Non-Public Activities (org/alliance-scoped) ──
      {
        id: ACTIVITY_IDS.smugglingRoute,
        title: 'Internal: Smuggling Route Review — Pyro Corridor',
        description:
          'Classified briefing on new smuggling routes through the Pyro jump point. Cargo timing, patrol gaps, and safe drop locations. Syndicate members only. Do NOT discuss outside channels.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.PLANNING,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.smuggler,
        creatorName: 'Ghost Runner',
        organizationId: ORG_IDS.syndicate,
        organizationName: 'Crimson Syndicate',
        maxParticipants: 5,
        currentParticipants: 2,
        scheduledStartDate: daysFromNow(2),
        location: 'Grim HEX — Private Hangar Bay 7',
        tags: ['covert', 'smuggling', 'route-planning', 'classified'],
        difficulty: DifficultyLevel.HARD,
        rewardCredits: 200000,
      },
      {
        id: ACTIVITY_IDS.intelDebrief,
        title: 'Ghost Division — Intel Debrief #42',
        description:
          'Monthly intelligence debrief. All field agents report findings on target organizations. Secure comms only. Cover identities must not be compromised.',
        activityType: ActivityType.EVENT,
        status: ActivityStatus.PLANNING,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.diplomat,
        creatorName: 'Ambassador Aria',
        organizationId: ORG_IDS.intel,
        organizationName: 'Ghost Division',
        maxParticipants: 5,
        currentParticipants: 3,
        scheduledStartDate: daysFromNow(4),
        location: 'Undisclosed — Encrypted Channel',
        tags: ['intel', 'debrief', 'classified', 'monthly'],
        difficulty: DifficultyLevel.MEDIUM,
      },
      {
        id: ACTIVITY_IDS.moonshinRun,
        title: 'Shadow Council — Joint Smuggling Op: Moonshine Run',
        description:
          'Alliance-coordinated smuggling run moving high-value contraband from Grim HEX to Pyro. ' +
          'Ironwolf provides muscle, Crimson Syndicate handles logistics. Alliance members only.',
        activityType: ActivityType.OPERATION,
        status: ActivityStatus.RECRUITING,
        visibility: ActivityVisibility.ALLIANCE,
        creatorId: USER_IDS.smuggler,
        creatorName: 'Ghost Runner',
        organizationId: ORG_IDS.syndicate,
        organizationName: 'Crimson Syndicate',
        participatingOrgs: [
          {
            organizationId: ORG_IDS.syndicate,
            organizationName: 'Crimson Syndicate',
            role: 'host' as const,
            memberCount: 3,
            status: 'accepted' as const,
            joinedAt: new Date(),
          },
          {
            organizationId: ORG_IDS.mercenary,
            organizationName: 'Ironwolf Mercenary Company',
            role: 'participant' as const,
            memberCount: 2,
            status: 'accepted' as const,
            joinedAt: new Date(),
          },
        ],
        maxParticipants: 8,
        currentParticipants: 4,
        scheduledStartDate: daysFromNow(6),
        location: 'Grim HEX → Pyro Jump Point',
        tags: ['alliance', 'smuggling', 'covert', 'joint-op', 'pyro'],
        difficulty: DifficultyLevel.EXPERT,
        rewardCredits: 500000,
      },
      {
        id: ACTIVITY_IDS.safetyDrill,
        title: 'Deep Core Internal: Safety Drill & Equipment Audit',
        description:
          'Mandatory quarterly safety drill for all Deep Core members. Equipment inspection, emergency procedures review, and evacuation practice. Attendance is tracked.',
        activityType: ActivityType.EVENT,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.miner,
        creatorName: 'Rockbreaker Yusuf',
        organizationId: ORG_IDS.mining,
        organizationName: 'Deep Core Mining Consortium',
        maxParticipants: 20,
        currentParticipants: 2,
        scheduledStartDate: daysFromNow(8),
        location: 'HDMS-Edmond — Training Bay',
        tags: ['internal', 'safety', 'drill', 'mandatory'],
        difficulty: DifficultyLevel.EASY,
      },

      {
        id: ACTIVITY_IDS.gameNight,
        title: 'Community Game Night — Star Marine Tournament',
        description:
          'Open community game night! Star Marine 4v4 tournament followed by free-for-all. No org membership required. Prizes for top 3. All skill levels welcome.',
        activityType: ActivityType.EVENT,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.explorer,
        creatorName: 'Stellarpath',
        organizationId: null as unknown as string,
        maxParticipants: 24,
        currentParticipants: 8,
        scheduledStartDate: daysFromNow(2),
        scheduledEndDate: daysFromNow(2),
        estimatedDuration: 180,
        location: 'Area18 — TDD Arena',
        tags: ['social', 'tournament', 'star-marine', 'community', 'open'],
        difficulty: DifficultyLevel.EASY,
        metadata: {
          recurrencePattern: 'weekly' as const,
          recurrenceEndDate: daysFromNow(60),
          eventType: 'social',
        },
      },
      {
        id: ACTIVITY_IDS.freelanceEscort,
        title: 'Freelance Escort Pilot — Available for Hire',
        description:
          'Experienced combat pilot offering escort services for cargo runs, mining ops, and exploration missions. Own a Vanguard Sentinel and Eclipse. Competitive rates. DM for booking.',
        activityType: ActivityType.JOB_LISTING,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.bountyHunter,
        creatorName: 'Shadowfang',
        organizationId: null as unknown as string,
        maxParticipants: 1,
        currentParticipants: 0,
        location: 'Stanton system — flexible',
        tags: ['freelance', 'escort', 'combat', 'for-hire', 'pilot'],
        paymentType: PaymentType.FIXED,
        rewardCredits: 15000,
      },
      {
        id: ACTIVITY_IDS.shipRepair,
        title: 'Ship Repair & Maintenance Services',
        description:
          'Offering mobile repair services across Stanton. Component swaps, hull patching, and full overhauls. Fair prices, fast turnaround. No org needed — independent operator.',
        activityType: ActivityType.JOB_LISTING,
        status: ActivityStatus.OPEN,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.engineer,
        creatorName: 'Wrench Monkey',
        organizationId: null as unknown as string,
        maxParticipants: 3,
        currentParticipants: 0,
        location: 'Stanton — mobile service',
        tags: ['service', 'repair', 'maintenance', 'freelance', 'engineering'],
        paymentType: PaymentType.FIXED,
        rewardCredits: 10000,
      },
      {
        id: ACTIVITY_IDS.explorerMeetup,
        title: 'Weekly Exploration Meetup — New Frontier Explorers',
        description:
          'Informal weekly meetup for solo explorers. Share discoveries, plan routes, team up for jump point runs. All welcome — no org membership required.',
        activityType: ActivityType.EVENT,
        status: ActivityStatus.RECRUITING,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.explorer,
        creatorName: 'Stellarpath',
        organizationId: null as unknown as string,
        maxParticipants: 12,
        currentParticipants: 4,
        scheduledStartDate: daysFromNow(5),
        estimatedDuration: 120,
        location: 'New Babbage — Commons',
        tags: ['exploration', 'meetup', 'social', 'weekly', 'open'],
        difficulty: DifficultyLevel.EASY,
        metadata: {
          recurrencePattern: 'weekly' as const,
          eventType: 'social',
        },
      },

      // ── Completed Activities (for history) ──
      {
        id: ACTIVITY_IDS.opStarfall,
        title: 'Operation Starfall — Completed',
        description:
          'Successful raid on pirate staging area near Yela. All objectives met. 0 casualties.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.PUBLIC,
        creatorId: USER_IDS.commander,
        creatorName: 'Commander Nova',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 12,
        currentParticipants: 10,
        scheduledStartDate: daysAgo(7),
        scheduledEndDate: daysAgo(7),
        location: 'Yela — OM-3 vicinity',
        tags: ['combat', 'completed', 'success'],
        difficulty: DifficultyLevel.HARD,
        rewardCredits: 180000,
      },
      {
        id: ACTIVITY_IDS.miningMarathon,
        title: 'Weekly Mining Marathon — Session #47',
        description: 'Regular weekly mining session. Total yield: 1.2M aUEC across 4 MOLE loads.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.miner,
        creatorName: 'Rockbreaker Yusuf',
        organizationId: ORG_IDS.mining,
        organizationName: 'Deep Core Mining Consortium',
        maxParticipants: 8,
        currentParticipants: 5,
        scheduledStartDate: daysAgo(3),
        scheduledEndDate: daysAgo(3),
        location: 'Aaron Halo',
        tags: ['mining', 'weekly', 'completed'],
        difficulty: DifficultyLevel.MEDIUM,
        rewardCredits: 300000,
        participants: [USER_IDS.miner, USER_IDS.rookie, USER_IDS.engineer],
      },

      // ── 30-day completed history (dashboard chart enrichment) ──
      {
        id: ACTIVITY_IDS.deepScoutSurvey,
        title: 'Deep Scout Survey — Nyx System',
        description:
          'Extended recon of Nyx system; catalogued 4 derelict stations and 2 undocumented jump corridors.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.explorer,
        creatorName: 'Stellarpath',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 4,
        currentParticipants: 3,
        scheduledStartDate: daysAgo(5),
        scheduledEndDate: daysAgo(5),
        location: 'Nyx — Deep Space',
        tags: ['exploration', 'recon', 'completed'],
        difficulty: DifficultyLevel.MEDIUM,
        rewardCredits: 80000,
        participants: [USER_IDS.explorer, USER_IDS.engineer],
      },
      {
        id: ACTIVITY_IDS.aaronHaloSession,
        title: 'Aaron Halo Mining Sprint — Quantanium Run',
        description:
          'High-risk quantanium sprint near the Aaron Halo belt. MOLE and two ROC-DS teams. Yield exceeded projections by 18%.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.miner,
        creatorName: 'Rockbreaker Yusuf',
        organizationId: ORG_IDS.mining,
        organizationName: 'Deep Core Mining Consortium',
        maxParticipants: 6,
        currentParticipants: 6,
        scheduledStartDate: daysAgo(8),
        scheduledEndDate: daysAgo(8),
        location: 'Aaron Halo',
        tags: ['mining', 'quantanium', 'completed'],
        difficulty: DifficultyLevel.HARD,
        rewardCredits: 420000,
        participants: [USER_IDS.miner, USER_IDS.engineer, USER_IDS.rookie],
      },
      {
        id: ACTIVITY_IDS.escortHurston,
        title: 'Escort Run — Hurston Cargo Convoy',
        description:
          'Escorted three C2 Herculeses from Port Tressler to Lorville with zero incidents. Trade route secured.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.trader,
        creatorName: 'Meridian Flux',
        organizationId: ORG_IDS.trading,
        organizationName: 'Interstellar Trade Syndicate',
        maxParticipants: 5,
        currentParticipants: 4,
        scheduledStartDate: daysAgo(11),
        scheduledEndDate: daysAgo(11),
        location: 'Port Tressler → Lorville',
        tags: ['escort', 'trade', 'convoy', 'completed'],
        difficulty: DifficultyLevel.MEDIUM,
        rewardCredits: 95000,
        participants: [USER_IDS.bountyHunter, USER_IDS.trader],
      },
      {
        id: ACTIVITY_IDS.convoyStrike,
        title: 'Bounty: Vanduul Convoy Interdiction',
        description:
          'Successful interdiction of a Vanduul scout convoy near Calliope. 3 kills, 1 capture. Bounty paid in full.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.bountyHunter,
        creatorName: 'Vex Rho',
        organizationId: ORG_IDS.mercenary,
        organizationName: 'Ironwolf Quantum Mercenary Corps',
        maxParticipants: 4,
        currentParticipants: 3,
        scheduledStartDate: daysAgo(14),
        scheduledEndDate: daysAgo(14),
        location: 'Calliope — Deep Space',
        tags: ['bounty', 'combat', 'vanduul', 'completed'],
        difficulty: DifficultyLevel.HARD,
        rewardCredits: 210000,
        participants: [USER_IDS.bountyHunter, USER_IDS.engineer],
      },
      {
        id: ACTIVITY_IDS.clioRecon,
        title: 'Surface Recon — Clio, Crusader',
        description:
          'Planetary recon sweep of Clio. Located two unexploited ROC sites and a previously unknown cave system.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.explorer,
        creatorName: 'Stellarpath',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 3,
        currentParticipants: 2,
        scheduledStartDate: daysAgo(17),
        scheduledEndDate: daysAgo(17),
        location: 'Clio — Surface Grid 7',
        tags: ['exploration', 'recon', 'planetary', 'completed'],
        difficulty: DifficultyLevel.EASY,
        rewardCredits: 45000,
        participants: [USER_IDS.explorer, USER_IDS.medic],
      },
      {
        id: ACTIVITY_IDS.zeroGDrill,
        title: 'Zero-G Combat Drill — Armistice Zone Training',
        description:
          'Quarterly zero-G breach-and-clear drill in a derelict station. All participants passed certification.',
        activityType: ActivityType.OPERATION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.commander,
        creatorName: 'Commander Nova',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 8,
        currentParticipants: 7,
        scheduledStartDate: daysAgo(21),
        scheduledEndDate: daysAgo(21),
        location: 'Derelict Ruin — Yela Belt',
        tags: ['training', 'zero-g', 'fps', 'drill', 'completed'],
        difficulty: DifficultyLevel.MEDIUM,
        participants: [USER_IDS.commander, USER_IDS.bountyHunter, USER_IDS.rookie, USER_IDS.medic],
      },
      {
        id: ACTIVITY_IDS.salvageYela,
        title: 'Salvage Operation — Yela Wreck Field',
        description:
          'Multi-Reclaimer salvage run through the Yela asteroid belt wreck field. Recovered 34 SCU of processed goods.',
        activityType: ActivityType.MISSION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.engineer,
        creatorName: 'Kira Volt',
        organizationId: ORG_IDS.mining,
        organizationName: 'Deep Core Mining Consortium',
        maxParticipants: 6,
        currentParticipants: 4,
        scheduledStartDate: daysAgo(25),
        scheduledEndDate: daysAgo(25),
        location: 'Yela — Wreck Field Sector 3',
        tags: ['salvage', 'yela', 'completed'],
        difficulty: DifficultyLevel.MEDIUM,
        rewardCredits: 175000,
        participants: [USER_IDS.engineer, USER_IDS.miner],
      },
      {
        id: ACTIVITY_IDS.patrolStanton,
        title: 'Joint Patrol — Stanton System Security',
        description:
          'Multi-org patrol of contested Stanton corridors. Deterred 2 pirate ambushes and assisted 1 distress beacon.',
        activityType: ActivityType.OPERATION,
        status: ActivityStatus.COMPLETED,
        visibility: ActivityVisibility.ORGANIZATION,
        creatorId: USER_IDS.admiral,
        creatorName: 'Admiral Vega',
        organizationId: ORG_IDS.fleet,
        organizationName: 'Stardust Expeditionary Fleet',
        maxParticipants: 12,
        currentParticipants: 10,
        scheduledStartDate: daysAgo(30),
        scheduledEndDate: daysAgo(30),
        location: 'Stanton — Open Space',
        tags: ['patrol', 'multi-org', 'security', 'completed'],
        difficulty: DifficultyLevel.HARD,
        rewardCredits: 260000,
        participants: [USER_IDS.admiral, USER_IDS.commander, USER_IDS.bountyHunter, USER_IDS.medic],
      },
    ];

    for (const actData of ACTIVITIES) {
      // Simple dedup by title + creator
      const exists = await activityRepo.findOne({
        where: { title: actData.title, creatorId: actData.creatorId },
      });
      if (!exists) {
        const activity = activityRepo.create({
          ...actData,
          participants: (actData as any).participants ?? [],
          applications: [],
          createdAt:
            actData.status === ActivityStatus.COMPLETED
              ? (actData.scheduledStartDate ?? daysAgo(7))
              : daysAgo(Math.floor(Math.random() * 14)),
        } as any);
        await activityRepo.save(activity);
        activitiesCreated++;
      } else {
        const merged = activityRepo.merge(exists, {
          ...actData,
          participants: exists.participants ?? [],
          applications: exists.applications ?? [],
        } as any);
        await activityRepo.save(merged);
        activitiesUpdated++;
      }
    }
    console.log(`   Created ${activitiesCreated}, updated ${activitiesUpdated} activities\n`);

    // ── 10. Public Org Profiles ───────────────────────────────────────────
    console.log('🌐 Seeding public org profiles...');
    const publicOrgProfileRepo = AppDataSource.getRepository(PublicOrgProfile);
    let profilesCreated = 0;
    let profilesUpdated = 0;

    const PUBLIC_ORG_PROFILES = [
      {
        organizationId: ORG_IDS.fleet,
        isPublic: true,
        tagline: 'Per Aspera Ad Astra — Multi-org operations, governance, and readiness at scale',
        primaryFocus: OrgPrimaryFocus.COMBAT,
        secondaryFocus: [OrgPrimaryFocus.EXPLORATION, OrgPrimaryFocus.SECURITY],
        memberCount: 6,
        activityLevel: ActivityLevel.VERY_HIGH,
        rsiUrl: 'https://robertsspaceindustries.com/orgs/STARDUST',
        discordInvite: 'https://discord.gg/stardust-example',
        twitterUrl: 'https://x.com/StardustFleet',
        youtubeUrl: 'https://www.youtube.com/@StardustFleet',
        twitchUrl: 'https://www.twitch.tv/stardustfleet',
        websiteUrl: 'https://stardust-fleet.example.com',
        bannerUrl: 'https://picsum.photos/seed/stardust/800/200',
        languages: ['English'],
        timezone: 'UTC',
        isVerified: true,
        isRecruiting: true,
      },
      {
        organizationId: ORG_IDS.mining,
        isPublic: true,
        tagline: 'Quantanium specialists — Safety first, profits second',
        primaryFocus: OrgPrimaryFocus.MINING,
        secondaryFocus: [OrgPrimaryFocus.TRADING, OrgPrimaryFocus.TRANSPORT],
        memberCount: 4,
        activityLevel: ActivityLevel.HIGH,
        rsiUrl: 'https://robertsspaceindustries.com/orgs/DEEPCORE',
        discordInvite: 'https://discord.gg/deepcore-example',
        youtubeUrl: 'https://www.youtube.com/@DeepCoreMining',
        websiteUrl: 'https://deepcore-mining.example.com',
        bannerUrl: 'https://picsum.photos/seed/deepcore/800/200',
        languages: ['English'],
        timezone: 'US/Eastern',
        isVerified: true,
        isRecruiting: true,
      },
      {
        organizationId: ORG_IDS.mercenary,
        isPublic: true,
        tagline: 'We solve problems. Permanently.',
        primaryFocus: OrgPrimaryFocus.COMBAT,
        secondaryFocus: [OrgPrimaryFocus.BOUNTY_HUNTING, OrgPrimaryFocus.SECURITY],
        memberCount: 4,
        activityLevel: ActivityLevel.HIGH,
        rsiUrl: 'https://robertsspaceindustries.com/orgs/IRONWOLF',
        twitterUrl: 'https://x.com/IronWolfPMC',
        twitchUrl: 'https://www.twitch.tv/ironwolfpmc',
        bannerUrl: 'https://picsum.photos/seed/ironwolf/800/200',
        languages: ['English', 'German'],
        timezone: 'Europe/Berlin',
        isVerified: false,
        isRecruiting: false,
      },
      {
        organizationId: ORG_IDS.trading,
        isPublic: true,
        tagline: 'Interstellar logistics network with performance-first route operations',
        primaryFocus: OrgPrimaryFocus.TRADING,
        secondaryFocus: [OrgPrimaryFocus.TRANSPORT, OrgPrimaryFocus.EXPLORATION],
        memberCount: 3,
        activityLevel: ActivityLevel.MODERATE,
        rsiUrl: 'https://robertsspaceindustries.com/orgs/QTNET',
        discordInvite: 'https://discord.gg/qtnet-example',
        websiteUrl: 'https://quantum-trade.example.com',
        languages: ['English'],
        timezone: 'US/Pacific',
        isVerified: false,
        isRecruiting: false,
      },
      // ── Private Org Profiles (isPublic: false → hidden from public directory) ──
      {
        organizationId: ORG_IDS.syndicate,
        isPublic: false,
        tagline: 'Move anything. Anywhere. No questions.',
        primaryFocus: OrgPrimaryFocus.TRADING,
        secondaryFocus: [OrgPrimaryFocus.TRANSPORT],
        memberCount: 3,
        activityLevel: ActivityLevel.HIGH,
        languages: ['English'],
        timezone: 'US/Pacific',
        isVerified: false,
        isRecruiting: false,
      },
      {
        organizationId: ORG_IDS.intel,
        isPublic: false,
        tagline: 'Eyes everywhere. Loyalty above all.',
        primaryFocus: OrgPrimaryFocus.EXPLORATION,
        secondaryFocus: [OrgPrimaryFocus.SECURITY],
        memberCount: 3,
        activityLevel: ActivityLevel.MODERATE,
        languages: ['English'],
        timezone: 'UTC',
        isVerified: false,
        isRecruiting: false,
      },
    ];

    for (const profileData of PUBLIC_ORG_PROFILES) {
      const exists = await publicOrgProfileRepo.findOne({
        where: { organizationId: profileData.organizationId },
      });
      if (!exists) {
        const profile = publicOrgProfileRepo.create(profileData);
        await publicOrgProfileRepo.save(profile);
        profilesCreated++;
      } else {
        const merged = publicOrgProfileRepo.merge(exists, profileData);
        await publicOrgProfileRepo.save(merged);
        profilesUpdated++;
      }
    }
    console.log(`   Created ${profilesCreated}, updated ${profilesUpdated} public org profiles\n`);

    // ── 11. Public Job Listings ───────────────────────────────────────────
    console.log('💼 Seeding public job listings...');
    const publicJobListingRepo = AppDataSource.getRepository(PublicJobListing);
    let jobListingsCreated = 0;
    let jobListingsUpdated = 0;

    const PUBLIC_JOB_LISTINGS = [
      {
        organizationId: ORG_IDS.fleet,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Combat Pilot — Alpha Strike Wing',
        description:
          'Recruiting experienced combat pilots for the Stardust Expeditionary Fleet. Must own a combat-capable ship and be available for 2+ operations per week. Org-funded upgrades and priority loot.',
        jobType: JobType.PILOT,
        focus: OrgPrimaryFocus.COMBAT,
        payType: PayType.PERCENTAGE,
        experienceLevel: 5,
        isActive: true,
        postedAt: daysAgo(10),
        expiresAt: daysFromNow(20),
        createdBy: USER_IDS.commander,
        contactInfo: 'Apply via Discord or in-app',
        timezone: 'UTC',
        languages: ['English'],
        tags: ['combat', 'pilot', 'experienced', 'weekly-ops'],
        crewSpotsTotal: 6,
        crewSpotsFilled: 4,
        requiredShips: ['Aegis Gladius', 'Aegis Sabre', 'Anvil Arrow', 'Origin 325a'],
        shipRequirementType: 'required',
        shipCrewBreakdown: [
          {
            shipName: 'Aegis Gladius',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Cmdr Vex' }],
          },
          {
            shipName: 'Aegis Sabre',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Ace Nova' }],
          },
          {
            shipName: 'Anvil Arrow',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Foxhound' }],
            isLoaner: true,
            contributedByUserName: 'Cmdr Vex',
          },
          {
            shipName: 'Origin 325a',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Raptor' }],
            isLoaner: true,
            contributedByUserName: 'Cmdr Vex',
          },
          {
            shipName: 'Aegis Gladius',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
          },
          {
            shipName: 'Aegis Sabre',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
            isLoaner: true,
            contributedByUserName: 'Ace Nova',
          },
        ],
      },
      {
        organizationId: ORG_IDS.fleet,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Medical Officer — Search & Rescue Division',
        description:
          'Need a Cutlass Red pilot/medic for our SAR division. Training provided for newcomers. Must have mic and be comfortable with emergency response scenarios.',
        jobType: JobType.MEDIC,
        focus: OrgPrimaryFocus.MEDICAL,
        payType: PayType.VOLUNTEER,
        experienceLevel: 2,
        isActive: true,
        postedAt: daysAgo(5),
        expiresAt: daysFromNow(25),
        createdBy: USER_IDS.medic,
        contactInfo: 'DM Doc Aurora on Discord',
        timezone: 'UTC',
        languages: ['English'],
        tags: ['medic', 'sar', 'cutlass-red', 'training'],
        crewSpotsTotal: 3,
        crewSpotsFilled: 1,
        requiredShips: ['Drake Cutlass Red'],
        shipRequirementType: 'preferred',
        shipCrewBreakdown: [
          {
            shipName: 'Drake Cutlass Red',
            crewCapacity: 2,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'Doc Aurora' },
              { role: 'medic', total: 1, filled: 0 },
            ],
          },
          {
            shipName: 'Drake Cutlass Red',
            crewCapacity: 2,
            isLoaner: true,
            contributedByUserName: 'Doc Aurora',
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
          },
        ],
      },
      {
        organizationId: ORG_IDS.fleet,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Operations Intelligence Analyst — Executive Dashboard & Readiness',
        description:
          'Stardust command is recruiting an operations analyst to translate activity, fleet, and staffing telemetry into weekly executive briefs. Familiarity with mission planning and cross-org coordination preferred.',
        jobType: JobType.SCOUT,
        focus: OrgPrimaryFocus.SECURITY,
        payType: PayType.NEGOTIABLE,
        experienceLevel: 4,
        isActive: true,
        postedAt: daysAgo(2),
        expiresAt: daysFromNow(28),
        createdBy: USER_IDS.admin,
        contactInfo: 'Apply in-app with portfolio or prior ops reports',
        timezone: 'UTC',
        languages: ['English'],
        tags: ['analytics', 'operations', 'executive', 'readiness', 'live-demo'],
        crewSpotsTotal: 2,
        crewSpotsFilled: 1,
        requiredShips: [],
        shipRequirementType: 'none',
      },
      {
        organizationId: ORG_IDS.mining,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'MOLE Turret Operator — Daily Mining Ops',
        description:
          'Deep Core Mining is looking for turret operators for daily MOLE mining sessions. No experience required — we train! Profit sharing on all yielded ore.',
        jobType: JobType.MINER,
        focus: OrgPrimaryFocus.MINING,
        payType: PayType.PERCENTAGE,
        payMin: 20,
        payMax: 33,
        experienceLevel: 0,
        isActive: true,
        postedAt: daysAgo(3),
        expiresAt: daysFromNow(30),
        createdBy: USER_IDS.miner,
        contactInfo: 'Join our Discord and ping @Rockbreaker',
        timezone: 'US/Eastern',
        languages: ['English'],
        tags: ['mining', 'mole', 'beginner-friendly', 'profit-share'],
        crewSpotsTotal: 3,
        crewSpotsFilled: 1,
        requiredShips: ['ARGO MOLE'],
        shipRequirementType: 'required',
        shipCrewBreakdown: [
          {
            shipName: 'ARGO MOLE',
            crewCapacity: 4,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'Rockbreaker' },
              { role: 'gunner', total: 2, filled: 0 },
            ],
          },
        ],
      },
      {
        organizationId: ORG_IDS.mercenary,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Security Contractor — Escort Operations',
        description:
          'Ironwolf PMC hiring combat pilots for convoy escort duties. Must have 100+ hours PvP experience and own a medium fighter or larger. Competitive fixed-rate pay per operation.',
        jobType: JobType.SECURITY,
        focus: OrgPrimaryFocus.SECURITY,
        payType: PayType.FIXED,
        payMin: 30000,
        payMax: 75000,
        experienceLevel: 7,
        isActive: true,
        postedAt: daysAgo(7),
        expiresAt: daysFromNow(14),
        createdBy: USER_IDS.bountyHunter,
        contactInfo: 'contracts@ironwolf-pmc.example.com',
        timezone: 'Europe/Berlin',
        languages: ['English', 'German'],
        tags: ['security', 'escort', 'pvp', 'fixed-pay'],
        crewSpotsTotal: 8,
        crewSpotsFilled: 5,
        requiredShips: [
          'Aegis Vanguard Sentinel',
          'RSI Constellation Andromeda',
          'Anvil F7C-M Super Hornet',
        ],
        shipRequirementType: 'required',
        shipCrewBreakdown: [
          {
            shipName: 'Aegis Vanguard Sentinel',
            crewCapacity: 2,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'Commander Wolf' },
              { role: 'gunner', total: 1, filled: 1, assignedUserName: 'Fang' },
            ],
          },
          {
            shipName: 'RSI Constellation Andromeda',
            crewCapacity: 4,
            isLoaner: true,
            contributedByUserName: 'Commander Wolf',
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'Havoc' },
              { role: 'gunner', total: 2, filled: 1, assignedUserName: 'Blitz' },
              { role: 'engineer', total: 1, filled: 1, assignedUserName: 'Wrench' },
            ],
          },
          {
            shipName: 'Anvil F7C-M Super Hornet',
            crewCapacity: 2,
            roles: [
              { role: 'pilot', total: 1, filled: 0 },
              { role: 'gunner', total: 1, filled: 0 },
            ],
          },
        ],
      },
      {
        organizationId: ORG_IDS.trading,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Cargo Hauler — Weekly Trade Routes',
        description:
          'Quantum Trade Network expanding routes! Need reliable haulers with Freelancer MAX or larger. Weekly scheduled runs with guaranteed minimum pay plus on-time delivery bonus.',
        jobType: JobType.HAULER,
        focus: OrgPrimaryFocus.TRADING,
        payType: PayType.FIXED,
        payMin: 15000,
        payMax: 25000,
        experienceLevel: 3,
        isActive: true,
        postedAt: daysAgo(2),
        expiresAt: daysFromNow(28),
        createdBy: USER_IDS.trader,
        contactInfo: 'logistics@quantum-trade.example.com',
        timezone: 'US/Pacific',
        languages: ['English'],
        tags: ['cargo', 'hauler', 'weekly', 'guaranteed-pay'],
        crewSpotsTotal: 4,
        crewSpotsFilled: 2,
        requiredShips: ['MISC Freelancer MAX', 'MISC Hull C', 'Drake Caterpillar'],
        shipRequirementType: 'preferred',
        shipCrewBreakdown: [
          {
            shipName: 'MISC Freelancer MAX',
            crewCapacity: 2,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'Silkroad Sam' },
              { role: 'engineer', total: 1, filled: 1, assignedUserName: 'Grease' },
            ],
          },
          {
            shipName: 'Drake Caterpillar',
            crewCapacity: 4,
            isLoaner: true,
            contributedByUserName: 'Silkroad Sam',
            roles: [
              { role: 'pilot', total: 1, filled: 0 },
              { role: 'engineer', total: 1, filled: 0 },
            ],
          },
        ],
      },
      {
        organizationId: ORG_IDS.trading,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Scout/Navigator — Route Planning',
        description:
          'Looking for an explorer type to scout new trade routes and identify safe quantum paths. Knowledge of Pyro Jump Point preferred. Negotiable pay.',
        jobType: JobType.SCOUT,
        focus: OrgPrimaryFocus.EXPLORATION,
        payType: PayType.NEGOTIABLE,
        experienceLevel: 4,
        isActive: true,
        postedAt: daysAgo(1),
        expiresAt: daysFromNow(21),
        createdBy: USER_IDS.trader,
        contactInfo: 'DM Silkroad Sam',
        timezone: 'US/Pacific',
        languages: ['English'],
        tags: ['scout', 'navigator', 'exploration', 'pyro'],
        crewSpotsTotal: 2,
        crewSpotsFilled: 0,
        requiredShips: ['RSI Constellation Aquila', 'Anvil Carrack'],
        shipRequirementType: 'preferred',
        shipCrewBreakdown: [
          {
            shipName: 'RSI Constellation Aquila',
            crewCapacity: 4,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
          },
          {
            shipName: 'Anvil Carrack',
            crewCapacity: 6,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
          },
        ],
      },

      // ── Alliance-Owned Listings ──
      {
        ownerType: ListingOwnerType.ALLIANCE,
        allianceId: ALLIANCE_IDS.stardustDeepcore,
        organizationId: ORG_IDS.fleet,
        title: 'Coalition Patrol Pilot — Stanton Defense Coalition',
        description:
          'The Stanton Defense Coalition is recruiting combat-ready pilots for daily patrol rotations across Stanton. Alliance-funded ammo and repairs. Must be a member of a coalition org.',
        jobType: JobType.PILOT,
        focus: OrgPrimaryFocus.SECURITY,
        payType: PayType.FIXED,
        payMin: 20000,
        payMax: 40000,
        experienceLevel: 4,
        isActive: true,
        postedAt: daysAgo(4),
        expiresAt: daysFromNow(26),
        createdBy: USER_IDS.commander,
        contactInfo: 'Apply via Coalition Discord',
        timezone: 'UTC',
        languages: ['English'],
        tags: ['alliance', 'patrol', 'security', 'coalition', 'combat'],
        crewSpotsTotal: 12,
        crewSpotsFilled: 7,
        requiredShips: ['Aegis Gladius', 'Aegis Sabre', 'Anvil Arrow', 'Anvil Hornet F7C'],
        shipRequirementType: 'required',
        shipCrewBreakdown: [
          {
            shipName: 'Aegis Gladius',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Viper-1' }],
          },
          {
            shipName: 'Aegis Gladius',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Viper-2' }],
            isLoaner: true,
            contributedByUserName: 'Viper-1',
          },
          {
            shipName: 'Aegis Sabre',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Shadow' }],
          },
          {
            shipName: 'Aegis Sabre',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Spectre' }],
          },
          {
            shipName: 'Anvil Arrow',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Flash' }],
          },
          {
            shipName: 'Anvil Arrow',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Bolt' }],
            isLoaner: true,
            contributedByUserName: 'Flash',
          },
          {
            shipName: 'Anvil Hornet F7C',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Tank' }],
          },
          {
            shipName: 'Aegis Gladius',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
            isLoaner: true,
            contributedByUserName: 'Shadow',
          },
          {
            shipName: 'Aegis Sabre',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
          },
          {
            shipName: 'Anvil Arrow',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
          },
          {
            shipName: 'Anvil Hornet F7C',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
          },
          {
            shipName: 'Aegis Gladius',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
          },
        ],
      },
      {
        ownerType: ListingOwnerType.ALLIANCE,
        allianceId: ALLIANCE_IDS.ironwolfQuantum,
        organizationId: ORG_IDS.trading,
        title: 'Route Analyst — Quantum Trade Syndicate',
        description:
          'The Quantum Trade Syndicate is hiring a data-driven route analyst to optimize cargo haul profitability across member orgs. Must understand commodity pricing and quantum travel times.',
        jobType: JobType.SCOUT,
        focus: OrgPrimaryFocus.TRADING,
        payType: PayType.FIXED,
        payMin: 30000,
        payMax: 50000,
        experienceLevel: 5,
        isActive: true,
        postedAt: daysAgo(6),
        expiresAt: daysFromNow(24),
        createdBy: USER_IDS.trader,
        contactInfo: 'logistics@quantum-syndicate.example.com',
        timezone: 'US/Pacific',
        languages: ['English'],
        tags: ['alliance', 'trade', 'analyst', 'logistics', 'data'],
        crewSpotsTotal: 2,
        crewSpotsFilled: 1,
        requiredShips: [],
        shipRequirementType: 'none',
      },

      // ── Nested Transport Listings — ships carrying vehicles/fighters ──
      {
        organizationId: ORG_IDS.mercenary,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Ground Assault — Hercules C2 Deployment',
        description:
          'Ironwolf PMC is running a ground assault operation deploying vehicles via Hercules C2. ' +
          'Need crew for the C2 and drivers/gunners for transported vehicles. ' +
          'Marines ride in the Spartan — not counted as crew. Assault starts at Yela.',
        jobType: JobType.SECURITY,
        focus: OrgPrimaryFocus.COMBAT,
        payType: PayType.FIXED,
        payMin: 40000,
        payMax: 80000,
        experienceLevel: 5,
        isActive: true,
        postedAt: daysAgo(1),
        expiresAt: daysFromNow(14),
        createdBy: USER_IDS.bountyHunter,
        contactInfo: 'Apply via Ironwolf Discord #ground-ops',
        timezone: 'Europe/Berlin',
        languages: ['English', 'German'],
        tags: ['ground-assault', 'hercules', 'vehicles', 'marines', 'nested-transport'],
        crewSpotsTotal: 8,
        crewSpotsFilled: 4,
        requiredShips: ['Crusader C2 Hercules', 'Anvil Spartan', 'Anvil Ballista'],
        shipRequirementType: 'required',
        shipCrewBreakdown: [
          {
            // Index 0 — Parent ship
            shipName: 'Crusader C2 Hercules',
            crewCapacity: 2,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'Commander Wolf' },
              { role: 'engineer', total: 1, filled: 0 },
            ],
          },
          {
            // Index 1 — Spartan APC (transported in C2 cargo)
            shipName: 'Anvil Spartan',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'GroundLead' }],
            isTransported: true,
            parentShipIndex: 0,
            transportType: 'cargo',
            passengers: [
              {
                role: 'marine',
                capacity: 8,
                filled: 6,
                assignedUserNames: [
                  'Alpha-1',
                  'Alpha-2',
                  'Alpha-3',
                  'Alpha-4',
                  'Alpha-5',
                  'Alpha-6',
                ],
              },
            ],
          },
          {
            // Index 2 — Ballista AA (transported in C2 cargo)
            shipName: 'Anvil Ballista',
            crewCapacity: 3,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'Driver-B' },
              { role: 'gunner', total: 2, filled: 1, assignedUserName: 'AA-Gunner' },
            ],
            isTransported: true,
            parentShipIndex: 0,
            transportType: 'cargo',
          },
        ],
      },
      {
        organizationId: ORG_IDS.fleet,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Carrier Strike Group — Idris Deployment',
        description:
          'Stardust Expeditionary is deploying an Idris-M frigate with embarked fighters for a multi-day patrol. ' +
          'Need capital ship crew and fighter pilots. Fighters launch from the internal hangar. ' +
          'Full org-funded loadouts. Priority to veteran pilots.',
        jobType: JobType.PILOT,
        focus: OrgPrimaryFocus.COMBAT,
        payType: PayType.PERCENTAGE,
        experienceLevel: 7,
        isActive: true,
        postedAt: daysAgo(2),
        expiresAt: daysFromNow(10),
        createdBy: USER_IDS.commander,
        contactInfo: 'Apply via Fleet Discord #carrier-ops',
        timezone: 'UTC',
        languages: ['English'],
        tags: ['carrier', 'idris', 'fighters', 'capital-ship', 'nested-transport'],
        crewSpotsTotal: 14,
        crewSpotsFilled: 8,
        requiredShips: ['Aegis Idris-M', 'Aegis Gladius', 'Anvil Arrow'],
        shipRequirementType: 'required',
        shipCrewBreakdown: [
          {
            // Index 0 — Idris-M (parent carrier)
            shipName: 'Aegis Idris-M',
            crewCapacity: 10,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'Cmdr Vex' },
              { role: 'copilot', total: 1, filled: 1, assignedUserName: 'NavOfficer' },
              { role: 'gunner', total: 4, filled: 2, assignedUserName: 'TurretAce' },
              { role: 'engineer', total: 2, filled: 1, assignedUserName: 'ChiefMech' },
              { role: 'medic', total: 1, filled: 0 },
              { role: 'crew', total: 1, filled: 1, assignedUserName: 'Deckhand' },
            ],
          },
          {
            // Index 1 — Gladius #1 (in Idris hangar)
            shipName: 'Aegis Gladius',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Viper-1' }],
            isTransported: true,
            parentShipIndex: 0,
            transportType: 'hangar',
          },
          {
            // Index 2 — Gladius #2 (in Idris hangar)
            shipName: 'Aegis Gladius',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'Viper-2' }],
            isTransported: true,
            parentShipIndex: 0,
            transportType: 'hangar',
          },
          {
            // Index 3 — Gladius #3 (in Idris hangar, open)
            shipName: 'Aegis Gladius',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
            isTransported: true,
            parentShipIndex: 0,
            transportType: 'hangar',
          },
          {
            // Index 4 — Arrow (in Idris hangar, open)
            shipName: 'Anvil Arrow',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 0 }],
            isTransported: true,
            parentShipIndex: 0,
            transportType: 'hangar',
          },
        ],
      },
      {
        organizationId: ORG_IDS.fleet,
        ownerType: ListingOwnerType.ORGANIZATION,
        title: 'Hercules M2 — Combat Drop Operation',
        description:
          'Combat vehicle drop at JumpTown. M2 Hercules delivering a Nova tank and Spartan APC loaded with marines. ' +
          'Need M2 crew, tank crew, and APC driver. Marines provided by partner org. ' +
          'High-risk op with bonus pay.',
        jobType: JobType.SECURITY,
        focus: OrgPrimaryFocus.COMBAT,
        payType: PayType.FIXED,
        payMin: 50000,
        payMax: 100000,
        experienceLevel: 6,
        isActive: true,
        postedAt: daysAgo(1),
        expiresAt: daysFromNow(7),
        createdBy: USER_IDS.commander,
        contactInfo: 'DM Cmdr Vex on Discord',
        timezone: 'UTC',
        languages: ['English'],
        tags: ['combat-drop', 'hercules', 'nova', 'spartan', 'marines', 'jumptown'],
        crewSpotsTotal: 7,
        crewSpotsFilled: 3,
        requiredShips: ['Crusader M2 Hercules', 'Tumbril Nova', 'Anvil Spartan'],
        shipRequirementType: 'required',
        shipCrewBreakdown: [
          {
            // Index 0 — M2 Hercules (parent)
            shipName: 'Crusader M2 Hercules',
            crewCapacity: 3,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'Cmdr Vex' },
              { role: 'gunner', total: 1, filled: 0 },
              { role: 'engineer', total: 1, filled: 0 },
            ],
          },
          {
            // Index 1 — Nova tank (in M2 cargo)
            shipName: 'Tumbril Nova',
            crewCapacity: 2,
            roles: [
              { role: 'pilot', total: 1, filled: 1, assignedUserName: 'TankDriver' },
              { role: 'gunner', total: 1, filled: 0 },
            ],
            isTransported: true,
            parentShipIndex: 0,
            transportType: 'cargo',
          },
          {
            // Index 2 — Spartan APC with marines (in M2 cargo)
            shipName: 'Anvil Spartan',
            crewCapacity: 1,
            roles: [{ role: 'pilot', total: 1, filled: 1, assignedUserName: 'APCDriver' }],
            isTransported: true,
            parentShipIndex: 0,
            transportType: 'cargo',
            passengers: [
              {
                role: 'marine',
                capacity: 8,
                filled: 4,
                assignedUserNames: ['Bravo-1', 'Bravo-2', 'Bravo-3', 'Bravo-4'],
              },
            ],
          },
        ],
      },

      // ── Individual (User) Listings — users not affiliated with any org ──
      {
        ownerType: ListingOwnerType.USER,
        organizationId: null,
        title: 'Freelance Combat Medic — Available for Hire',
        description:
          'Experienced SAR medic offering freelance services. Cutlass Red owner with 500+ hours of rescue ops. ' +
          'Available for org ops, fleet actions, or private contracts. Competitive hourly rate. ' +
          "No permanent org commitment — I go where I'm needed.",
        jobType: JobType.MEDIC,
        focus: OrgPrimaryFocus.MEDICAL,
        payType: PayType.HOURLY,
        payMin: 5000,
        payMax: 15000,
        experienceLevel: 6,
        isActive: true,
        postedAt: daysAgo(2),
        expiresAt: daysFromNow(30),
        createdBy: USER_IDS.medic,
        contactInfo: 'DM DocAurora in-app or Discord: DocAurora#1234',
        timezone: 'UTC',
        languages: ['English'],
        tags: ['freelance', 'medic', 'sar', 'for-hire', 'independent'],
        crewSpotsTotal: 1,
        crewSpotsFilled: 0,
        requiredShips: ['Drake Cutlass Red'],
        shipRequirementType: 'provided',
      },
      {
        ownerType: ListingOwnerType.USER,
        organizationId: null,
        title: 'Looking for Crew — New Pilot, Eager to Learn',
        description:
          'Fresh out of flight school with a Mustang Alpha. Looking for any crew that will take me on — ' +
          'mining, trading, combat, exploration, you name it. I learn fast and follow orders. ' +
          'No org yet, just want to fly with good people.',
        jobType: JobType.CREW,
        focus: OrgPrimaryFocus.SOCIAL,
        payType: PayType.VOLUNTEER,
        experienceLevel: 0,
        isActive: true,
        postedAt: daysAgo(1),
        expiresAt: daysFromNow(14),
        createdBy: USER_IDS.rookie,
        contactInfo: 'Message StarCadetLuna in-app',
        timezone: 'US/Eastern',
        languages: ['English'],
        tags: ['newbie', 'lfg', 'crew', 'any-role', 'eager'],
        crewSpotsTotal: 1,
        crewSpotsFilled: 0,
        requiredShips: [],
        shipRequirementType: 'none',
      },
      {
        ownerType: ListingOwnerType.USER,
        organizationId: null,
        title: 'Ship Engineer for Hire — Loadout & Repair Specialist',
        description:
          'Independent ship engineer offering loadout optimization, component tuning, and field repair services. ' +
          'Vulture-certified salvager. Can join your fleet temporarily for extended ops. ' +
          'Fair rates, fast turnaround. References available.',
        jobType: JobType.ENGINEER,
        focus: OrgPrimaryFocus.SALVAGE,
        payType: PayType.NEGOTIABLE,
        experienceLevel: 4,
        isActive: true,
        postedAt: daysAgo(4),
        expiresAt: daysFromNow(21),
        createdBy: USER_IDS.engineer,
        contactInfo: 'Contact WrenchMonkey via Discord',
        timezone: 'US/Central',
        languages: ['English'],
        tags: ['freelance', 'engineer', 'repair', 'loadout', 'independent'],
        crewSpotsTotal: 1,
        crewSpotsFilled: 0,
        requiredShips: [],
        shipRequirementType: 'none',
      },
    ];

    for (const jobData of PUBLIC_JOB_LISTINGS) {
      const where: Record<string, any> = { title: jobData.title };
      if (jobData.organizationId) {
        where.organizationId = jobData.organizationId;
      }
      const exists = await publicJobListingRepo.findOne({ where });
      if (!exists) {
        const listing = publicJobListingRepo.create(jobData as any);
        await publicJobListingRepo.save(listing);
        jobListingsCreated++;
      } else {
        const merged = publicJobListingRepo.merge(exists, jobData as any);
        await publicJobListingRepo.save(merged);
        jobListingsUpdated++;
      }
    }
    console.log(
      `   Created ${jobListingsCreated}, updated ${jobListingsUpdated} public job listings\n`
    );

    // ── Summary ───────────────────────────────────────────────────────────
    const publicOrgs = ORGANIZATIONS.filter(o => o.settings.isPublic).length;
    const privateOrgs = ORGANIZATIONS.filter(o => !o.settings.isPublic).length;
    const multiOrgUserCount = Object.keys(MULTI_ORG_ACTIVE_ORGS).length;
    const publicProfiles = PUBLIC_ORG_PROFILES.filter(p => p.isPublic).length;
    const privateProfiles = PUBLIC_ORG_PROFILES.filter(p => !p.isPublic).length;
    const userListings = PUBLIC_JOB_LISTINGS.filter(
      j => j.ownerType === ListingOwnerType.USER
    ).length;

    console.log('═══════════════════════════════════════════════');
    console.log('🎉 Demo data seeding complete!');
    console.log('═══════════════════════════════════════════════');
    console.log(`   👤 Users:          ${USERS.length}`);
    console.log(
      `   🏛️  Organizations:  ${ORGANIZATIONS.length} (${publicOrgs} public, ${privateOrgs} private)`
    );
    console.log(`   🤝 Memberships:    ${Object.values(MEMBERSHIPS).flat().length}`);
    console.log(`   🔄 Multi-org:      ${multiOrgUserCount} users with multiple orgs`);
    console.log(`   🚀 User Ships:     ${USER_SHIPS_DATA.length}`);
    console.log(`   ⚔️  Fleets:         ${FLEETS.length}`);
    console.log(`   👥 Fleet Members:  (embedded in Fleet.members[])`);
    console.log(`   🛸 Fleet Ships:    ${FLEET_SHIP_ASSIGNMENTS.length}`);
    console.log(`   🤝 Alliances:      2`);
    console.log(`   🔗 Org Relations:  ${ORG_RELS.length}`);
    console.log(`   📋 Activities:     ${ACTIVITIES.length}`);
    console.log(
      `   🌐 Org Profiles:   ${PUBLIC_ORG_PROFILES.length} (${publicProfiles} public, ${privateProfiles} private)`
    );
    console.log(`   💼 Job Listings:   ${PUBLIC_JOB_LISTINGS.length} (${userListings} individual)`);
    console.log('═══════════════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(0);
  }
}

void seedDemoData();
