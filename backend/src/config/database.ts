import { DataSource, DataSourceOptions } from 'typeorm';

import { AccountAccessLog } from '../models/AccountAccessLog';
import { AccountPermission } from '../models/AccountPermission';
import { Achievement } from '../models/Achievement';
import { Activity } from '../models/Activity';
import { ActivityParticipantEntity } from '../models/ActivityParticipant';
import { ActivityReminder } from '../models/ActivityReminder';
import { ActivityTemplate } from '../models/ActivityTemplate';
import { AIUsageTracking } from '../models/AIUsageTracking';
import { AllianceDiplomacy } from '../models/AllianceDiplomacy';
import { Announcement } from '../models/Announcement';
import { AnnouncementDelivery } from '../models/AnnouncementDelivery';
import { AnnouncementTemplate } from '../models/AnnouncementTemplate';
import { ApprovalRequest } from '../models/ApprovalRequest';
import { Backup } from '../models/Backup';
import { BackupSchedule } from '../models/BackupSchedule';
import { BlacklistSharingConfig } from '../models/BlacklistSharingConfig';
import { Bounty } from '../models/Bounty';
import { BountyClaim } from '../models/BountyClaim';
import { BountyEvidence } from '../models/BountyEvidence';
import { Briefing } from '../models/Briefing';
import { CargoManifest } from '../models/CargoManifest';
import { Certification } from '../models/Certification';
import { Comment } from '../models/Comment';
import { CommentLike } from '../models/CommentLike';
import { CommissaryItem } from '../models/CommissaryItem';
import { CommissaryPurchase } from '../models/CommissaryPurchase';
import { ContactRequest } from '../models/ContactRequest';
import { ContactRequestReply } from '../models/ContactRequestReply';
import { CreditPool } from '../models/CreditPool';
import { CreditTransaction } from '../models/CreditTransaction';
import { CrewAssignment } from '../models/CrewAssignment';
import { Dashboard } from '../models/Dashboard';
import { DashboardWidget } from '../models/DashboardWidget';
import { DataBreachNotification } from '../models/DataBreachNotification';
import { DataEncryptionKey } from '../models/DataEncryptionKey';
import { DeletionRequest } from '../models/DeletionRequest';
import { DiscordGuildSettings } from '../models/DiscordGuildSettings';
import { DiscordUserPreference } from '../models/DiscordUserPreference';
import { EncryptedData } from '../models/EncryptedData';
import { EncryptionAuditLog } from '../models/EncryptionAuditLog';
import { EncryptionKeyClaim } from '../models/EncryptionKeyClaim';
import { Equipment } from '../models/Equipment';
import { EventAttendanceConfirmation } from '../models/EventAttendanceConfirmation';
import { ExportRequest } from '../models/ExportRequest';
import { ExternalCatalogRecord } from '../models/ExternalCatalogRecord';
import { ExternalIntegration } from '../models/ExternalIntegration';
import { FailedDmDelivery } from '../models/FailedDmDelivery';
import { FeatureFlag } from '../models/FeatureFlag';
import { FeatureFlagAuditLog } from '../models/FeatureFlagAuditLog';
import { Federation } from '../models/Federation';
import { FederationAmbassador } from '../models/FederationAmbassador';
import { FederationDiscordGuildSettings } from '../models/FederationDiscordGuildSettings';
import { FederationIntelEntry } from '../models/FederationIntelEntry';
import { FederationMember } from '../models/FederationMember';
import { FederationProposal } from '../models/FederationProposal';
import { FederationTeam } from '../models/FederationTeam';
import { Fleet } from '../models/Fleet';
import { FleetAuditLog } from '../models/FleetAuditLog';
import { FleetInventory } from '../models/FleetInventory';
import { FleetLogistics } from '../models/FleetLogistics';
import { FleetShip } from '../models/FleetShip';
import { GuildOrganization } from '../models/GuildOrganization';
import { HunterProfile } from '../models/HunterProfile';
import { IntelApproval } from '../models/IntelApproval';
import { IntelAuditLog } from '../models/IntelAuditLog';
import { IntelEntry } from '../models/IntelEntry';
import { IntelOfficer } from '../models/IntelOfficer';
import { IntelShare } from '../models/IntelShare';
import { Invitation } from '../models/Invitation';
import { JobApplication } from '../models/JobApplication';
import { LegalHold } from '../models/LegalHold';
import { LFGGroupHistory } from '../models/LFGGroupHistory';
import { LFGReputationRating } from '../models/LFGReputationRating';
import { LFGUserReputation } from '../models/LFGUserReputation';
import { LogisticsAlert } from '../models/LogisticsAlert';
import { LootClaim } from '../models/LootClaim';
import { LootItem } from '../models/LootItem';
import { LootPool } from '../models/LootPool';
import { LootPoolAssistant } from '../models/LootPoolAssistant';
import { MemberAuditEvent } from '../models/MemberAuditEvent';
import {
  ChannelCounter,
  InviteTracking,
  MemberEngagement,
  StatRole,
} from '../models/MemberEngagement';
import { MemberPublicKey } from '../models/MemberPublicKey';
import { MiningOperation } from '../models/MiningOperation';
import { MirrorAction } from '../models/MirrorAction';
import { MirroredActivity } from '../models/MirroredActivity';
import { Mission } from '../models/Mission';
import { ModerationIncident } from '../models/ModerationIncident';
import { Notification } from '../models/Notification';
import { NotificationPreferences } from '../models/NotificationPreferences';
import { Operation } from '../models/Operation';
import { OrgActivityHeatmap } from '../models/OrgActivityHeatmap';
import { OrgActivityScore } from '../models/OrgActivityScore';
import { Organization } from '../models/Organization';
import { OrganizationActivity } from '../models/OrganizationActivity';
import { OrganizationAnalytics } from '../models/OrganizationAnalytics';
import { OrganizationDeletionRequest } from '../models/OrganizationDeletionRequest';
import { OrganizationEncryptionKey } from '../models/OrganizationEncryptionKey';
import { OrganizationInventory } from '../models/OrganizationInventory';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { OrganizationPermission } from '../models/OrganizationPermission';
import { OrganizationRelationship } from '../models/OrganizationRelationship';
import { OrganizationShip } from '../models/OrganizationShip';
import { OrganizationTemplate } from '../models/OrganizationTemplate';
import { OrgApplication } from '../models/OrgApplication';
import { OrgDues } from '../models/OrgDues';
import { OrgFocusPreference } from '../models/OrgFocusPreference';
import { OrgWatchlistEntry } from '../models/OrgWatchlistEntry';
import { PasswordHistory } from '../models/PasswordHistory';
import { PasswordlessToken } from '../models/PasswordlessToken';
import { PasswordResetToken } from '../models/PasswordResetToken';
import { Permission } from '../models/Permission';
import { Poll } from '../models/Poll';
import { PollDiscordMirror } from '../models/PollDiscordMirror';
import { PollVote } from '../models/PollVote';
import { PriceAlert } from '../models/PriceAlert';
import { PublicJobListing } from '../models/PublicJobListing';
import { PublicOrgProfile } from '../models/PublicOrgProfile';
import { RecoveryToken } from '../models/RecoveryToken';
import { RefreshToken } from '../models/RefreshToken';
import { RelationshipHistory } from '../models/RelationshipHistory';
import { Reputation } from '../models/Reputation';
import { Role } from '../models/Role';
import { RoleSyncRetryQueue } from '../models/RoleSyncRetryQueue';
import { RsiChangeHistory } from '../models/RsiChangeHistory';
import { RsiCitizenOrg } from '../models/RsiCitizenOrg';
import { RsiCrawledMember } from '../models/RsiCrawledMember';
import { RsiCrawledOrganization } from '../models/RsiCrawledOrganization';
import { RsiMemberCache } from '../models/RsiMemberCache';
import { RsiRoleMapping } from '../models/RsiRoleMapping';
import { RsiSyncAuditLog } from '../models/RsiSyncAuditLog';
import { RsiSyncMemberSnapshot } from '../models/RsiSyncMemberSnapshot';
import { RsiSyncSchedule } from '../models/RsiSyncSchedule';
import { RsiUserLink } from '../models/RsiUserLink';
import { SCStatsCsvImport } from '../models/SCStatsCsvImport';
import { SecurityLevel } from '../models/SecurityLevel';
import { SharedAccount } from '../models/SharedAccount';
import { Ship } from '../models/Ship';
import { ShipLoadout } from '../models/ShipLoadout';
import { ShipLoan } from '../models/ShipLoan';
import { ShipMaintenance } from '../models/ShipMaintenance';
import { Skill } from '../models/Skill';
import { SkillEndorsement } from '../models/SkillEndorsement';
import { Tag } from '../models/Tag';
import { TagAssignment } from '../models/TagAssignment';
import { Team } from '../models/Team';
import { TeamDiscordChannel } from '../models/TeamDiscordChannel';
import { TeamMember } from '../models/TeamMember';
import { Ticket } from '../models/Ticket';
import { TokenBlacklist } from '../models/TokenBlacklist';
import { Tournament } from '../models/Tournament';
import { TradeTransaction } from '../models/TradeTransaction';
import { TradeUserReputation } from '../models/TradeUserReputation';
import { TradingRoute } from '../models/TradingRoute';
import { TrustedDevice } from '../models/TrustedDevice';
import { Tunnel } from '../models/Tunnel';
import { TunnelAnalyticsEntry } from '../models/TunnelAnalyticsEntry';
import { TunnelBan } from '../models/TunnelBan';
import { TunnelMessage } from '../models/TunnelMessage';
import { User } from '../models/User';
import { UserAchievement } from '../models/UserAchievement';
import { UserActivity } from '../models/UserActivity';
import { UserAvailability } from '../models/UserAvailability';
import { UserCertification } from '../models/UserCertification';
import { UserConsent } from '../models/UserConsent';
import { UserFocusPreference } from '../models/UserFocusPreference';
import { UserGameplayPreferences } from '../models/UserGameplayPreferences';
import { UserSession } from '../models/UserSession';
import { UserShip } from '../models/UserShip';
import { UserSkill } from '../models/UserSkill';
import { UserSocialConnection } from '../models/UserSocialConnection';
import { WebAuthnCredential } from '../models/WebAuthnCredential';
import { Webhook } from '../models/Webhook';
import { WebhookRetryQueue } from '../models/WebhookRetryQueue';
import { WikiPage } from '../models/WikiPage';
import { WikiPageRevision } from '../models/WikiPageRevision';
import { WorkflowDefinition } from '../models/WorkflowDefinition';
import { WorkflowExecution } from '../models/WorkflowExecution';
import { JsonbDirtySubscriber } from '../services/shared/JsonbDirtySubscriber';

/**
 * Safely parse integer with fallback to default value.
 *
 * - Prevents NaN/invalid env vars from causing connection failures.
 * - Applies reasonable bounds for database-related settings based on explicit mode.
 * - Mode 'count': For pool sizes, connection counts (max 10,000)
 * - Mode 'duration': For timeouts, durations in milliseconds (max 24 hours)
 */
function parseIntSafe(
  value: string | undefined,
  defaultValue: number,
  mode: 'count' | 'duration' = 'count',
  maxOverride?: number
): number {
  if (!value) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  // Reject invalid or non-positive values up front
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  // Apply appropriate bounds based on mode (or use explicit override)
  const maxAllowed = maxOverride ?? (mode === 'duration' ? 24 * 60 * 60 * 1000 : 10000);

  if (parsed > maxAllowed) {
    return defaultValue;
  }

  return parsed;
}

/**
 * Get database configuration for PostgreSQL
 */
const getDatabaseConfig = (): DataSourceOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Enable query logging based on environment
  // In development: log all queries
  // In production: only log slow queries (if DB_LOG_QUERIES is set)
  const enableQueryLogging = isDevelopment || process.env.DB_LOG_QUERIES === 'true';
  const logSlowQueries = process.env.DB_LOG_SLOW_QUERIES === 'true';

  // Database synchronize configuration
  // - Allow explicit override via DB_SYNCHRONIZE environment variable
  // - Default: DISABLED in all environments to prevent migration conflicts
  // - WARNING: synchronize can cause data loss in production if schema changes
  // - IMPORTANT: Use migrations for schema changes, not synchronize
  let shouldSynchronize: boolean;
  if (process.env.DB_SYNCHRONIZE === 'true') {
    shouldSynchronize = true;
  } else if (process.env.DB_SYNCHRONIZE === 'false') {
    shouldSynchronize = false;
  } else {
    // Default behavior: DISABLED to avoid enum conflicts with migrations
    shouldSynchronize = false;
  }

  // SSL/TLS configuration for database connection
  // - In production: SSL is enabled by default (can be disabled with DB_SSL=false)
  // - In other environments: SSL is disabled by default (can be enabled with DB_SSL=true)
  // This allows SSL to be enabled in staging or other non-production environments
  const enableSSL =
    process.env.DB_SSL === 'true' || (isProduction && process.env.DB_SSL !== 'false');
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

  // Build SSL configuration if enabled
  // Azure PostgreSQL requires SSL connections by default
  const sslConfig = enableSSL
    ? {
        rejectUnauthorized,
      }
    : false;

  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'sc_fleet_manager',
    synchronize: shouldSynchronize, // Auto-sync schema (configurable via DB_SYNCHRONIZE)
    migrationsRun: false,
    migrations: ['dist/migrations/*.js'],
    logging: enableQueryLogging ? ['query', 'error', 'warn'] : ['error'],
    maxQueryExecutionTime: logSlowQueries ? 1000 : undefined, // Log queries taking longer than 1s
    // SSL/TLS configuration for secure database connections
    ssl: sslConfig,
    // Connection pool configuration (pg driver options)
    // parseInt with validation to prevent NaN values from invalid env vars
    extra: {
      max: parseIntSafe(process.env.DB_POOL_MAX, 25, 'count'), // Maximum connections in pool
      min: parseIntSafe(process.env.DB_POOL_MIN, 5, 'count'), // Minimum connections kept alive
      idleTimeoutMillis: parseIntSafe(process.env.DB_IDLE_TIMEOUT, 30000, 'duration'), // Close idle connections after 30s
      connectionTimeoutMillis: parseIntSafe(process.env.DB_CONNECT_TIMEOUT, 5000, 'duration'), // Connection timeout
      // Prevent runaway queries from holding connections indefinitely (default 30s)
      // Cap at 5 minutes to prevent misconfiguration (not 24h like other durations)
      statement_timeout: parseIntSafe(process.env.DB_STATEMENT_TIMEOUT, 30000, 'duration', 300000),
    },
    entities: [
      // User and Authentication
      User,
      UserShip,
      UserActivity,
      UserConsent,
      UserGameplayPreferences,
      UserSession,
      UserSocialConnection,
      RefreshToken,
      PasswordHistory,
      PasswordResetToken,
      PasswordlessToken,
      RecoveryToken,
      TokenBlacklist,
      TrustedDevice,
      WebAuthnCredential,

      // Organization
      Organization,
      OrganizationInventory,
      OrganizationMembership,
      OrganizationShip,
      OrganizationActivity,
      OrganizationAnalytics,
      OrgActivityScore,
      OrgActivityHeatmap,
      OrganizationPermission,
      OrganizationRelationship,
      OrganizationTemplate,
      PublicOrgProfile,
      GuildOrganization,
      OrgApplication,
      Invitation,
      RelationshipHistory,

      // Fleet
      Fleet,
      FleetAuditLog,
      FleetShip,
      FleetLogistics,
      FleetInventory,

      // Ships
      Ship,
      ShipLoadout,
      ShipLoan,
      ShipMaintenance,

      // Activities
      Activity,
      ActivityParticipantEntity,
      ActivityTemplate,
      Tournament,
      MiningOperation,
      Operation,
      EventAttendanceConfirmation,
      ActivityReminder,

      // Trading and Cargo
      TradingRoute,
      TradeTransaction,
      TradeUserReputation,
      CargoManifest,
      PriceAlert,

      // Crew
      CrewAssignment,

      // Alliance and Diplomacy
      AllianceDiplomacy,

      // Reputation and Bounties
      Reputation,
      HunterProfile,
      Bounty,
      BountyClaim,
      BountyEvidence,

      // Roles
      Role,

      // Security and Permissions
      Permission,
      SecurityLevel,
      SharedAccount,
      AccountAccessLog,
      AccountPermission,

      // Moderation
      ModerationIncident,
      BlacklistSharingConfig,
      MirrorAction,
      MirroredActivity,

      // Member Audit & Watchlist (Wave 2.1)
      MemberAuditEvent,
      OrgWatchlistEntry,

      // LFG (Looking for Group)
      LFGGroupHistory,
      LFGReputationRating,
      LFGUserReputation,

      // Intel
      IntelEntry,
      IntelOfficer,
      IntelApproval,
      IntelAuditLog,
      IntelShare,

      // Notifications & Announcements
      Notification,
      NotificationPreferences,
      Announcement,
      AnnouncementDelivery,
      AnnouncementTemplate,

      // Polls / Voting
      Poll,
      PollVote,
      PollDiscordMirror,

      // Discord Integration
      DiscordGuildSettings,
      FailedDmDelivery,

      // Discord Engagement & Stats (Phase 3)
      MemberEngagement,
      StatRole,
      ChannelCounter,
      InviteTracking,

      // RSI Integration
      RsiCrawledOrganization,
      RsiCrawledMember,
      RsiCitizenOrg,
      RsiChangeHistory,
      RsiMemberCache,
      RsiRoleMapping,
      RsiSyncAuditLog,
      RsiSyncMemberSnapshot,
      RsiSyncSchedule,
      RsiUserLink,
      RoleSyncRetryQueue,

      // External Systems
      ExternalCatalogRecord,
      ExternalIntegration,
      Webhook,
      WebhookRetryQueue,
      Tunnel,
      TunnelAnalyticsEntry,
      TunnelBan,
      TunnelMessage,

      // Logistics
      LogisticsAlert,

      // Job Listings
      PublicJobListing,
      JobApplication,

      // Support
      Ticket,
      ContactRequest,
      ContactRequestReply,

      // Data Management
      DeletionRequest,
      OrganizationDeletionRequest,
      DataBreachNotification,
      ExportRequest,
      LegalHold,

      // Backup & Restore
      Backup,
      BackupSchedule,

      // Content & AI
      Briefing,
      Mission,
      AIUsageTracking,

      // Feature Flags
      FeatureFlag,
      FeatureFlagAuditLog,

      // Wiki / Knowledge Base
      WikiPage,
      WikiPageRevision,

      // Federation (Alliance Enhancement)
      Federation,
      FederationAmbassador,
      FederationDiscordGuildSettings,
      FederationIntelEntry,
      FederationMember,
      FederationProposal,
      FederationTeam,

      // Teams/Squads (Wave 2.6)
      Team,
      TeamDiscordChannel,
      TeamMember,

      // Calendar / Availability (Wave 2.4)
      UserAvailability,

      // SCStats CSV Imports
      SCStatsCsvImport,

      // Focus Preferences
      UserFocusPreference,
      OrgFocusPreference,

      // Encryption (E2E + Hybrid)
      OrganizationEncryptionKey,
      EncryptedData,
      EncryptionAuditLog,
      EncryptionKeyClaim,
      MemberPublicKey,
      DataEncryptionKey,

      // Tags, Comments, Skills, Certifications (Sprint 26)
      Tag,
      TagAssignment,
      Comment,
      CommentLike,
      Skill,
      UserSkill,
      SkillEndorsement,
      Certification,
      UserCertification,

      // Wave 2 Backing Entities (Sprint 26 Tier 2)
      Dashboard,
      DashboardWidget,
      ApprovalRequest,
      Equipment,
      Achievement,
      UserAchievement,
      WorkflowDefinition,
      WorkflowExecution,

      // Treasury (Sprint 25)
      CreditPool,
      CreditTransaction,
      OrgDues,
      CommissaryItem,
      CommissaryPurchase,

      // Commissary loot distribution
      LootPool,
      LootPoolAssistant,
      LootItem,
      LootClaim,

      // Discord user preferences (Sprint 27)
      DiscordUserPreference,
    ],
    subscribers: [JsonbDirtySubscriber],
  };
};

export const AppDataSource = new DataSource(getDatabaseConfig());

import { logger } from '../utils/logger';

export const initializeDatabase = async (): Promise<void> => {
  try {
    // Warn if synchronize is enabled in production
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && AppDataSource.options.synchronize) {
      logger.warn('⚠️  WARNING: TypeORM synchronize is enabled in production!');
      logger.warn('⚠️  This can cause data loss. Use migrations instead.');
      logger.warn('⚠️  Set DB_SYNCHRONIZE=false for production deployments.');
    }

    // Debug: Log synchronize status before initialization
    logger.info(
      `TypeORM synchronize: ${AppDataSource.options.synchronize}, NODE_ENV: ${process.env.NODE_ENV}, DB_SYNCHRONIZE: ${process.env.DB_SYNCHRONIZE || 'not set'}`
    );
    logger.info(
      `Database: ${AppDataSource.options.database}, Entities count: ${(AppDataSource.options.entities as unknown[])?.length ?? 0}`
    );

    await AppDataSource.initialize();
    logger.info(`Database connection established successfully (${AppDataSource.options.type})`);

    // Run migrations automatically in production or when explicitly requested
    if (isProduction || process.env.RUN_MIGRATIONS === 'true') {
      logger.info('🔄 Running database migrations...');
      try {
        const migrations = await AppDataSource.runMigrations({
          transaction: 'all',
        });

        if (migrations.length > 0) {
          logger.info(`✅ Successfully ran ${migrations.length} migration(s)`);
          migrations.forEach(migration => {
            logger.info(`   - ${migration.name}`);
          });
        } else {
          logger.info('✅ Database is up to date (no pending migrations)');
        }
      } catch (migrationError) {
        logger.error('❌ Migration failed:', migrationError);
        throw migrationError;
      }
    }

    if (isProduction && !AppDataSource.options.synchronize) {
      logger.info('✓ Database synchronize is correctly disabled in production');
    }

    // Start connection health monitoring with auto-reconnect
    startConnectionMonitor();
  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production';
    logger.error('Error during database initialization:', error);

    if (isProduction) {
      // In production, fail fast if database initialization fails
      logger.error('Database initialization failed in production. Application cannot start.');
      throw error;
    } else {
      // In development, allow app to run without database for testing
      logger.warn('Application will continue without database connection');
    }
  }
};

/**
 * PostgreSQL auto-reconnect with exponential backoff.
 * Monitors the connection by issuing a lightweight query periodically.
 * If the connection is lost, it will attempt to re-initialize with backoff.
 */
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 1_000; // 1 second
const MAX_RECONNECT_DELAY_MS = 60_000; // 60 seconds
const HEALTH_CHECK_INTERVAL_MS = 30_000; // 30 seconds

let reconnectAttempts = 0;
let healthCheckTimer: NodeJS.Timeout | null = null;
let reconnectInProgress = false;
let isShuttingDown = false;

/**
 * Stop the connection monitor (call before shutdown).
 * Prevents race condition where monitor tries to reconnect during graceful shutdown.
 */
export function stopConnectionMonitor(): void {
  isShuttingDown = true;
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  logger.debug('Database connection monitor stopped');
}

function startConnectionMonitor(): void {
  isShuttingDown = false;

  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
  }

  healthCheckTimer = setInterval(async () => {
    // Skip if reconnect is already in progress
    if (reconnectInProgress) {
      return;
    }

    if (!AppDataSource.isInitialized) {
      await attemptReconnect();
      return;
    }

    try {
      // Lightweight query to verify connection is alive
      await AppDataSource.query('SELECT 1');
      // Reset reconnect counter on success
      if (reconnectAttempts > 0) {
        logger.info('Database connection restored after reconnect');
        reconnectAttempts = 0;
      }
    } catch {
      logger.warn('Database health check failed — attempting reconnect...');
      await attemptReconnect();
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  // Allow process to exit even if timer is running
  healthCheckTimer.unref();
}

async function attemptReconnect(): Promise<void> {
  // Skip if shutting down
  if (isShuttingDown) {
    logger.debug('Skipping reconnect attempt during shutdown');
    return;
  }

  // Guard against concurrent reconnect attempts
  if (reconnectInProgress) {
    return;
  }

  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error(
      `Database reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts — giving up. ` +
        'Manual intervention required.'
    );
    return;
  }

  reconnectInProgress = true;

  try {
    reconnectAttempts++;
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS
    );

    logger.info(
      `Database reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`
    );
    await new Promise(resolve => setTimeout(resolve, delay));

    if (isShuttingDown) {
      logger.debug('Skipping reconnect completion during shutdown');
      return;
    }

    // Destroy existing (broken) connection first
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy().catch(() => {
        /* ignore destroy errors */
      });
    }
    await AppDataSource.initialize();
    logger.info('Database reconnected successfully');
    reconnectAttempts = 0;
  } catch (error) {
    logger.error(`Database reconnect attempt ${reconnectAttempts} failed:`, error);
  } finally {
    reconnectInProgress = false;
  }
}
