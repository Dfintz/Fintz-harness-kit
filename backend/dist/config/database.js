"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = exports.AppDataSource = void 0;
exports.stopConnectionMonitor = stopConnectionMonitor;
const typeorm_1 = require("typeorm");
const AccountAccessLog_1 = require("../models/AccountAccessLog");
const AccountPermission_1 = require("../models/AccountPermission");
const Achievement_1 = require("../models/Achievement");
const Activity_1 = require("../models/Activity");
const ActivityParticipant_1 = require("../models/ActivityParticipant");
const ActivityReminder_1 = require("../models/ActivityReminder");
const ActivityTemplate_1 = require("../models/ActivityTemplate");
const AIUsageTracking_1 = require("../models/AIUsageTracking");
const AllianceDiplomacy_1 = require("../models/AllianceDiplomacy");
const Announcement_1 = require("../models/Announcement");
const AnnouncementDelivery_1 = require("../models/AnnouncementDelivery");
const AnnouncementTemplate_1 = require("../models/AnnouncementTemplate");
const ApprovalRequest_1 = require("../models/ApprovalRequest");
const Backup_1 = require("../models/Backup");
const BackupSchedule_1 = require("../models/BackupSchedule");
const BlacklistSharingConfig_1 = require("../models/BlacklistSharingConfig");
const Bounty_1 = require("../models/Bounty");
const BountyClaim_1 = require("../models/BountyClaim");
const BountyEvidence_1 = require("../models/BountyEvidence");
const Briefing_1 = require("../models/Briefing");
const CargoManifest_1 = require("../models/CargoManifest");
const Certification_1 = require("../models/Certification");
const Comment_1 = require("../models/Comment");
const CommentLike_1 = require("../models/CommentLike");
const CommissaryItem_1 = require("../models/CommissaryItem");
const CommissaryPurchase_1 = require("../models/CommissaryPurchase");
const ContactRequest_1 = require("../models/ContactRequest");
const ContactRequestReply_1 = require("../models/ContactRequestReply");
const CreditPool_1 = require("../models/CreditPool");
const CreditTransaction_1 = require("../models/CreditTransaction");
const CrewAssignment_1 = require("../models/CrewAssignment");
const Dashboard_1 = require("../models/Dashboard");
const DashboardWidget_1 = require("../models/DashboardWidget");
const DataBreachNotification_1 = require("../models/DataBreachNotification");
const DataEncryptionKey_1 = require("../models/DataEncryptionKey");
const DeletionRequest_1 = require("../models/DeletionRequest");
const DiscordGuildSettings_1 = require("../models/DiscordGuildSettings");
const DiscordUserPreference_1 = require("../models/DiscordUserPreference");
const EncryptedData_1 = require("../models/EncryptedData");
const EncryptionAuditLog_1 = require("../models/EncryptionAuditLog");
const EncryptionKeyClaim_1 = require("../models/EncryptionKeyClaim");
const Equipment_1 = require("../models/Equipment");
const EventAttendanceConfirmation_1 = require("../models/EventAttendanceConfirmation");
const ExportRequest_1 = require("../models/ExportRequest");
const ExternalCatalogRecord_1 = require("../models/ExternalCatalogRecord");
const ExternalIntegration_1 = require("../models/ExternalIntegration");
const FailedDmDelivery_1 = require("../models/FailedDmDelivery");
const FeatureFlag_1 = require("../models/FeatureFlag");
const FeatureFlagAuditLog_1 = require("../models/FeatureFlagAuditLog");
const Federation_1 = require("../models/Federation");
const FederationAmbassador_1 = require("../models/FederationAmbassador");
const FederationDiscordGuildSettings_1 = require("../models/FederationDiscordGuildSettings");
const FederationIntelEntry_1 = require("../models/FederationIntelEntry");
const FederationMember_1 = require("../models/FederationMember");
const FederationProposal_1 = require("../models/FederationProposal");
const FederationTeam_1 = require("../models/FederationTeam");
const Fleet_1 = require("../models/Fleet");
const FleetAuditLog_1 = require("../models/FleetAuditLog");
const FleetInventory_1 = require("../models/FleetInventory");
const FleetLogistics_1 = require("../models/FleetLogistics");
const FleetShip_1 = require("../models/FleetShip");
const GuildOrganization_1 = require("../models/GuildOrganization");
const HunterProfile_1 = require("../models/HunterProfile");
const IntelApproval_1 = require("../models/IntelApproval");
const IntelAuditLog_1 = require("../models/IntelAuditLog");
const IntelEntry_1 = require("../models/IntelEntry");
const IntelOfficer_1 = require("../models/IntelOfficer");
const IntelShare_1 = require("../models/IntelShare");
const Invitation_1 = require("../models/Invitation");
const JobApplication_1 = require("../models/JobApplication");
const LegalHold_1 = require("../models/LegalHold");
const LFGGroupHistory_1 = require("../models/LFGGroupHistory");
const LFGReputationRating_1 = require("../models/LFGReputationRating");
const LFGUserReputation_1 = require("../models/LFGUserReputation");
const LogisticsAlert_1 = require("../models/LogisticsAlert");
const LootClaim_1 = require("../models/LootClaim");
const LootItem_1 = require("../models/LootItem");
const LootPool_1 = require("../models/LootPool");
const LootPoolAssistant_1 = require("../models/LootPoolAssistant");
const MemberAuditEvent_1 = require("../models/MemberAuditEvent");
const MemberEngagement_1 = require("../models/MemberEngagement");
const MemberPublicKey_1 = require("../models/MemberPublicKey");
const MiningOperation_1 = require("../models/MiningOperation");
const MirrorAction_1 = require("../models/MirrorAction");
const MirroredActivity_1 = require("../models/MirroredActivity");
const Mission_1 = require("../models/Mission");
const ModerationIncident_1 = require("../models/ModerationIncident");
const Notification_1 = require("../models/Notification");
const NotificationPreferences_1 = require("../models/NotificationPreferences");
const Operation_1 = require("../models/Operation");
const OrgActivityHeatmap_1 = require("../models/OrgActivityHeatmap");
const OrgActivityScore_1 = require("../models/OrgActivityScore");
const Organization_1 = require("../models/Organization");
const OrganizationActivity_1 = require("../models/OrganizationActivity");
const OrganizationAnalytics_1 = require("../models/OrganizationAnalytics");
const OrganizationDeletionRequest_1 = require("../models/OrganizationDeletionRequest");
const OrganizationEncryptionKey_1 = require("../models/OrganizationEncryptionKey");
const OrganizationInventory_1 = require("../models/OrganizationInventory");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const OrganizationRelationship_1 = require("../models/OrganizationRelationship");
const OrganizationShip_1 = require("../models/OrganizationShip");
const OrganizationTemplate_1 = require("../models/OrganizationTemplate");
const OrgApplication_1 = require("../models/OrgApplication");
const OrgDues_1 = require("../models/OrgDues");
const OrgFocusPreference_1 = require("../models/OrgFocusPreference");
const OrgWatchlistEntry_1 = require("../models/OrgWatchlistEntry");
const PasswordHistory_1 = require("../models/PasswordHistory");
const PasswordlessToken_1 = require("../models/PasswordlessToken");
const PasswordResetToken_1 = require("../models/PasswordResetToken");
const Permission_1 = require("../models/Permission");
const Poll_1 = require("../models/Poll");
const PollDiscordMirror_1 = require("../models/PollDiscordMirror");
const PollVote_1 = require("../models/PollVote");
const PriceAlert_1 = require("../models/PriceAlert");
const PublicJobListing_1 = require("../models/PublicJobListing");
const PublicOrgProfile_1 = require("../models/PublicOrgProfile");
const RecoveryToken_1 = require("../models/RecoveryToken");
const RefreshToken_1 = require("../models/RefreshToken");
const RelationshipHistory_1 = require("../models/RelationshipHistory");
const Reputation_1 = require("../models/Reputation");
const Role_1 = require("../models/Role");
const RoleSyncRetryQueue_1 = require("../models/RoleSyncRetryQueue");
const RsiChangeHistory_1 = require("../models/RsiChangeHistory");
const RsiCitizenOrg_1 = require("../models/RsiCitizenOrg");
const RsiCrawledMember_1 = require("../models/RsiCrawledMember");
const RsiCrawledOrganization_1 = require("../models/RsiCrawledOrganization");
const RsiMemberCache_1 = require("../models/RsiMemberCache");
const RsiRoleMapping_1 = require("../models/RsiRoleMapping");
const RsiSyncAuditLog_1 = require("../models/RsiSyncAuditLog");
const RsiSyncMemberSnapshot_1 = require("../models/RsiSyncMemberSnapshot");
const RsiSyncSchedule_1 = require("../models/RsiSyncSchedule");
const RsiUserLink_1 = require("../models/RsiUserLink");
const SCStatsCsvImport_1 = require("../models/SCStatsCsvImport");
const SecurityLevel_1 = require("../models/SecurityLevel");
const SharedAccount_1 = require("../models/SharedAccount");
const Ship_1 = require("../models/Ship");
const ShipLoadout_1 = require("../models/ShipLoadout");
const ShipLoan_1 = require("../models/ShipLoan");
const ShipMaintenance_1 = require("../models/ShipMaintenance");
const Skill_1 = require("../models/Skill");
const SkillEndorsement_1 = require("../models/SkillEndorsement");
const Tag_1 = require("../models/Tag");
const TagAssignment_1 = require("../models/TagAssignment");
const Team_1 = require("../models/Team");
const TeamDiscordChannel_1 = require("../models/TeamDiscordChannel");
const TeamMember_1 = require("../models/TeamMember");
const Ticket_1 = require("../models/Ticket");
const TokenBlacklist_1 = require("../models/TokenBlacklist");
const Tournament_1 = require("../models/Tournament");
const TradeTransaction_1 = require("../models/TradeTransaction");
const TradeUserReputation_1 = require("../models/TradeUserReputation");
const TradingRoute_1 = require("../models/TradingRoute");
const TrustedDevice_1 = require("../models/TrustedDevice");
const Tunnel_1 = require("../models/Tunnel");
const TunnelAnalyticsEntry_1 = require("../models/TunnelAnalyticsEntry");
const TunnelBan_1 = require("../models/TunnelBan");
const TunnelMessage_1 = require("../models/TunnelMessage");
const User_1 = require("../models/User");
const UserAchievement_1 = require("../models/UserAchievement");
const UserActivity_1 = require("../models/UserActivity");
const UserAvailability_1 = require("../models/UserAvailability");
const UserCertification_1 = require("../models/UserCertification");
const UserConsent_1 = require("../models/UserConsent");
const UserFocusPreference_1 = require("../models/UserFocusPreference");
const UserGameplayPreferences_1 = require("../models/UserGameplayPreferences");
const UserSession_1 = require("../models/UserSession");
const UserShip_1 = require("../models/UserShip");
const UserSkill_1 = require("../models/UserSkill");
const UserSocialConnection_1 = require("../models/UserSocialConnection");
const WebAuthnCredential_1 = require("../models/WebAuthnCredential");
const Webhook_1 = require("../models/Webhook");
const WebhookRetryQueue_1 = require("../models/WebhookRetryQueue");
const WikiPage_1 = require("../models/WikiPage");
const WikiPageRevision_1 = require("../models/WikiPageRevision");
const WorkflowDefinition_1 = require("../models/WorkflowDefinition");
const WorkflowExecution_1 = require("../models/WorkflowExecution");
const JsonbDirtySubscriber_1 = require("../services/shared/JsonbDirtySubscriber");
function parseIntSafe(value, defaultValue, mode = 'count', maxOverride) {
    if (!value) {
        return defaultValue;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return defaultValue;
    }
    const maxAllowed = maxOverride ?? (mode === 'duration' ? 24 * 60 * 60 * 1000 : 10000);
    if (parsed > maxAllowed) {
        return defaultValue;
    }
    return parsed;
}
const getDatabaseConfig = () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    const enableQueryLogging = isDevelopment || process.env.DB_LOG_QUERIES === 'true';
    const logSlowQueries = process.env.DB_LOG_SLOW_QUERIES === 'true';
    let shouldSynchronize;
    if (process.env.DB_SYNCHRONIZE === 'true') {
        shouldSynchronize = true;
    }
    else if (process.env.DB_SYNCHRONIZE === 'false') {
        shouldSynchronize = false;
    }
    else {
        shouldSynchronize = false;
    }
    const enableSSL = process.env.DB_SSL === 'true' || (isProduction && process.env.DB_SSL !== 'false');
    const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
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
        synchronize: shouldSynchronize,
        migrationsRun: false,
        migrations: ['dist/migrations/*.js'],
        logging: enableQueryLogging ? ['query', 'error', 'warn'] : ['error'],
        maxQueryExecutionTime: logSlowQueries ? 1000 : undefined,
        ssl: sslConfig,
        extra: {
            max: parseIntSafe(process.env.DB_POOL_MAX, 25, 'count'),
            min: parseIntSafe(process.env.DB_POOL_MIN, 5, 'count'),
            idleTimeoutMillis: parseIntSafe(process.env.DB_IDLE_TIMEOUT, 30000, 'duration'),
            connectionTimeoutMillis: parseIntSafe(process.env.DB_CONNECT_TIMEOUT, 5000, 'duration'),
            statement_timeout: parseIntSafe(process.env.DB_STATEMENT_TIMEOUT, 30000, 'duration', 300000),
        },
        entities: [
            User_1.User,
            UserShip_1.UserShip,
            UserActivity_1.UserActivity,
            UserConsent_1.UserConsent,
            UserGameplayPreferences_1.UserGameplayPreferences,
            UserSession_1.UserSession,
            UserSocialConnection_1.UserSocialConnection,
            RefreshToken_1.RefreshToken,
            PasswordHistory_1.PasswordHistory,
            PasswordResetToken_1.PasswordResetToken,
            PasswordlessToken_1.PasswordlessToken,
            RecoveryToken_1.RecoveryToken,
            TokenBlacklist_1.TokenBlacklist,
            TrustedDevice_1.TrustedDevice,
            WebAuthnCredential_1.WebAuthnCredential,
            Organization_1.Organization,
            OrganizationInventory_1.OrganizationInventory,
            OrganizationMembership_1.OrganizationMembership,
            OrganizationShip_1.OrganizationShip,
            OrganizationActivity_1.OrganizationActivity,
            OrganizationAnalytics_1.OrganizationAnalytics,
            OrgActivityScore_1.OrgActivityScore,
            OrgActivityHeatmap_1.OrgActivityHeatmap,
            OrganizationPermission_1.OrganizationPermission,
            OrganizationRelationship_1.OrganizationRelationship,
            OrganizationTemplate_1.OrganizationTemplate,
            PublicOrgProfile_1.PublicOrgProfile,
            GuildOrganization_1.GuildOrganization,
            OrgApplication_1.OrgApplication,
            Invitation_1.Invitation,
            RelationshipHistory_1.RelationshipHistory,
            Fleet_1.Fleet,
            FleetAuditLog_1.FleetAuditLog,
            FleetShip_1.FleetShip,
            FleetLogistics_1.FleetLogistics,
            FleetInventory_1.FleetInventory,
            Ship_1.Ship,
            ShipLoadout_1.ShipLoadout,
            ShipLoan_1.ShipLoan,
            ShipMaintenance_1.ShipMaintenance,
            Activity_1.Activity,
            ActivityParticipant_1.ActivityParticipantEntity,
            ActivityTemplate_1.ActivityTemplate,
            Tournament_1.Tournament,
            MiningOperation_1.MiningOperation,
            Operation_1.Operation,
            EventAttendanceConfirmation_1.EventAttendanceConfirmation,
            ActivityReminder_1.ActivityReminder,
            TradingRoute_1.TradingRoute,
            TradeTransaction_1.TradeTransaction,
            TradeUserReputation_1.TradeUserReputation,
            CargoManifest_1.CargoManifest,
            PriceAlert_1.PriceAlert,
            CrewAssignment_1.CrewAssignment,
            AllianceDiplomacy_1.AllianceDiplomacy,
            Reputation_1.Reputation,
            HunterProfile_1.HunterProfile,
            Bounty_1.Bounty,
            BountyClaim_1.BountyClaim,
            BountyEvidence_1.BountyEvidence,
            Role_1.Role,
            Permission_1.Permission,
            SecurityLevel_1.SecurityLevel,
            SharedAccount_1.SharedAccount,
            AccountAccessLog_1.AccountAccessLog,
            AccountPermission_1.AccountPermission,
            ModerationIncident_1.ModerationIncident,
            BlacklistSharingConfig_1.BlacklistSharingConfig,
            MirrorAction_1.MirrorAction,
            MirroredActivity_1.MirroredActivity,
            MemberAuditEvent_1.MemberAuditEvent,
            OrgWatchlistEntry_1.OrgWatchlistEntry,
            LFGGroupHistory_1.LFGGroupHistory,
            LFGReputationRating_1.LFGReputationRating,
            LFGUserReputation_1.LFGUserReputation,
            IntelEntry_1.IntelEntry,
            IntelOfficer_1.IntelOfficer,
            IntelApproval_1.IntelApproval,
            IntelAuditLog_1.IntelAuditLog,
            IntelShare_1.IntelShare,
            Notification_1.Notification,
            NotificationPreferences_1.NotificationPreferences,
            Announcement_1.Announcement,
            AnnouncementDelivery_1.AnnouncementDelivery,
            AnnouncementTemplate_1.AnnouncementTemplate,
            Poll_1.Poll,
            PollVote_1.PollVote,
            PollDiscordMirror_1.PollDiscordMirror,
            DiscordGuildSettings_1.DiscordGuildSettings,
            FailedDmDelivery_1.FailedDmDelivery,
            MemberEngagement_1.MemberEngagement,
            MemberEngagement_1.StatRole,
            MemberEngagement_1.ChannelCounter,
            MemberEngagement_1.InviteTracking,
            RsiCrawledOrganization_1.RsiCrawledOrganization,
            RsiCrawledMember_1.RsiCrawledMember,
            RsiCitizenOrg_1.RsiCitizenOrg,
            RsiChangeHistory_1.RsiChangeHistory,
            RsiMemberCache_1.RsiMemberCache,
            RsiRoleMapping_1.RsiRoleMapping,
            RsiSyncAuditLog_1.RsiSyncAuditLog,
            RsiSyncMemberSnapshot_1.RsiSyncMemberSnapshot,
            RsiSyncSchedule_1.RsiSyncSchedule,
            RsiUserLink_1.RsiUserLink,
            RoleSyncRetryQueue_1.RoleSyncRetryQueue,
            ExternalCatalogRecord_1.ExternalCatalogRecord,
            ExternalIntegration_1.ExternalIntegration,
            Webhook_1.Webhook,
            WebhookRetryQueue_1.WebhookRetryQueue,
            Tunnel_1.Tunnel,
            TunnelAnalyticsEntry_1.TunnelAnalyticsEntry,
            TunnelBan_1.TunnelBan,
            TunnelMessage_1.TunnelMessage,
            LogisticsAlert_1.LogisticsAlert,
            PublicJobListing_1.PublicJobListing,
            JobApplication_1.JobApplication,
            Ticket_1.Ticket,
            ContactRequest_1.ContactRequest,
            ContactRequestReply_1.ContactRequestReply,
            DeletionRequest_1.DeletionRequest,
            OrganizationDeletionRequest_1.OrganizationDeletionRequest,
            DataBreachNotification_1.DataBreachNotification,
            ExportRequest_1.ExportRequest,
            LegalHold_1.LegalHold,
            Backup_1.Backup,
            BackupSchedule_1.BackupSchedule,
            Briefing_1.Briefing,
            Mission_1.Mission,
            AIUsageTracking_1.AIUsageTracking,
            FeatureFlag_1.FeatureFlag,
            FeatureFlagAuditLog_1.FeatureFlagAuditLog,
            WikiPage_1.WikiPage,
            WikiPageRevision_1.WikiPageRevision,
            Federation_1.Federation,
            FederationAmbassador_1.FederationAmbassador,
            FederationDiscordGuildSettings_1.FederationDiscordGuildSettings,
            FederationIntelEntry_1.FederationIntelEntry,
            FederationMember_1.FederationMember,
            FederationProposal_1.FederationProposal,
            FederationTeam_1.FederationTeam,
            Team_1.Team,
            TeamDiscordChannel_1.TeamDiscordChannel,
            TeamMember_1.TeamMember,
            UserAvailability_1.UserAvailability,
            SCStatsCsvImport_1.SCStatsCsvImport,
            UserFocusPreference_1.UserFocusPreference,
            OrgFocusPreference_1.OrgFocusPreference,
            OrganizationEncryptionKey_1.OrganizationEncryptionKey,
            EncryptedData_1.EncryptedData,
            EncryptionAuditLog_1.EncryptionAuditLog,
            EncryptionKeyClaim_1.EncryptionKeyClaim,
            MemberPublicKey_1.MemberPublicKey,
            DataEncryptionKey_1.DataEncryptionKey,
            Tag_1.Tag,
            TagAssignment_1.TagAssignment,
            Comment_1.Comment,
            CommentLike_1.CommentLike,
            Skill_1.Skill,
            UserSkill_1.UserSkill,
            SkillEndorsement_1.SkillEndorsement,
            Certification_1.Certification,
            UserCertification_1.UserCertification,
            Dashboard_1.Dashboard,
            DashboardWidget_1.DashboardWidget,
            ApprovalRequest_1.ApprovalRequest,
            Equipment_1.Equipment,
            Achievement_1.Achievement,
            UserAchievement_1.UserAchievement,
            WorkflowDefinition_1.WorkflowDefinition,
            WorkflowExecution_1.WorkflowExecution,
            CreditPool_1.CreditPool,
            CreditTransaction_1.CreditTransaction,
            OrgDues_1.OrgDues,
            CommissaryItem_1.CommissaryItem,
            CommissaryPurchase_1.CommissaryPurchase,
            LootPool_1.LootPool,
            LootPoolAssistant_1.LootPoolAssistant,
            LootItem_1.LootItem,
            LootClaim_1.LootClaim,
            DiscordUserPreference_1.DiscordUserPreference,
        ],
        subscribers: [JsonbDirtySubscriber_1.JsonbDirtySubscriber],
    };
};
exports.AppDataSource = new typeorm_1.DataSource(getDatabaseConfig());
const logger_1 = require("../utils/logger");
const initializeDatabase = async () => {
    try {
        const isProduction = process.env.NODE_ENV === 'production';
        if (isProduction && exports.AppDataSource.options.synchronize) {
            logger_1.logger.warn('⚠️  WARNING: TypeORM synchronize is enabled in production!');
            logger_1.logger.warn('⚠️  This can cause data loss. Use migrations instead.');
            logger_1.logger.warn('⚠️  Set DB_SYNCHRONIZE=false for production deployments.');
        }
        logger_1.logger.info(`TypeORM synchronize: ${exports.AppDataSource.options.synchronize}, NODE_ENV: ${process.env.NODE_ENV}, DB_SYNCHRONIZE: ${process.env.DB_SYNCHRONIZE || 'not set'}`);
        logger_1.logger.info(`Database: ${exports.AppDataSource.options.database}, Entities count: ${exports.AppDataSource.options.entities?.length ?? 0}`);
        await exports.AppDataSource.initialize();
        logger_1.logger.info(`Database connection established successfully (${exports.AppDataSource.options.type})`);
        if (isProduction || process.env.RUN_MIGRATIONS === 'true') {
            logger_1.logger.info('🔄 Running database migrations...');
            try {
                const migrations = await exports.AppDataSource.runMigrations({
                    transaction: 'all',
                });
                if (migrations.length > 0) {
                    logger_1.logger.info(`✅ Successfully ran ${migrations.length} migration(s)`);
                    migrations.forEach(migration => {
                        logger_1.logger.info(`   - ${migration.name}`);
                    });
                }
                else {
                    logger_1.logger.info('✅ Database is up to date (no pending migrations)');
                }
            }
            catch (migrationError) {
                logger_1.logger.error('❌ Migration failed:', migrationError);
                throw migrationError;
            }
        }
        if (isProduction && !exports.AppDataSource.options.synchronize) {
            logger_1.logger.info('✓ Database synchronize is correctly disabled in production');
        }
        startConnectionMonitor();
    }
    catch (error) {
        const isProduction = process.env.NODE_ENV === 'production';
        logger_1.logger.error('Error during database initialization:', error);
        if (isProduction) {
            logger_1.logger.error('Database initialization failed in production. Application cannot start.');
            throw error;
        }
        else {
            logger_1.logger.warn('Application will continue without database connection');
        }
    }
};
exports.initializeDatabase = initializeDatabase;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 60_000;
const HEALTH_CHECK_INTERVAL_MS = 30_000;
let reconnectAttempts = 0;
let healthCheckTimer = null;
let reconnectInProgress = false;
let isShuttingDown = false;
function stopConnectionMonitor() {
    isShuttingDown = true;
    if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        healthCheckTimer = null;
    }
    logger_1.logger.debug('Database connection monitor stopped');
}
function startConnectionMonitor() {
    isShuttingDown = false;
    if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
    }
    healthCheckTimer = setInterval(async () => {
        if (reconnectInProgress) {
            return;
        }
        if (!exports.AppDataSource.isInitialized) {
            await attemptReconnect();
            return;
        }
        try {
            await exports.AppDataSource.query('SELECT 1');
            if (reconnectAttempts > 0) {
                logger_1.logger.info('Database connection restored after reconnect');
                reconnectAttempts = 0;
            }
        }
        catch {
            logger_1.logger.warn('Database health check failed — attempting reconnect...');
            await attemptReconnect();
        }
    }, HEALTH_CHECK_INTERVAL_MS);
    healthCheckTimer.unref();
}
async function attemptReconnect() {
    if (isShuttingDown) {
        logger_1.logger.debug('Skipping reconnect attempt during shutdown');
        return;
    }
    if (reconnectInProgress) {
        return;
    }
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logger_1.logger.error(`Database reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts — giving up. ` +
            'Manual intervention required.');
        return;
    }
    reconnectInProgress = true;
    try {
        reconnectAttempts++;
        const delay = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS);
        logger_1.logger.info(`Database reconnect attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        if (isShuttingDown) {
            logger_1.logger.debug('Skipping reconnect completion during shutdown');
            return;
        }
        if (exports.AppDataSource.isInitialized) {
            await exports.AppDataSource.destroy().catch(() => {
            });
        }
        await exports.AppDataSource.initialize();
        logger_1.logger.info('Database reconnected successfully');
        reconnectAttempts = 0;
    }
    catch (error) {
        logger_1.logger.error(`Database reconnect attempt ${reconnectAttempts} failed:`, error);
    }
    finally {
        reconnectInProgress = false;
    }
}
//# sourceMappingURL=database.js.map