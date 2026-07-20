"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCompleteSchema1729320000000 = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const logger_1 = require("../utils/logger");
class CreateCompleteSchema1729320000000 {
    async up(queryRunner) {
        logger_1.logger.info('Creating complete database schema (87 tables)...');
        logger_1.logger.info('This may take a few minutes...');
        const schemaPath = path.join(__dirname, '..', '..', 'schema', 'complete-schema.sql');
        if (!fs.existsSync(schemaPath)) {
            logger_1.logger.error('Schema file not found at:', { path: schemaPath });
            logger_1.logger.info('\n⚠️  IMPORTANT: Complete schema SQL file not found!');
            logger_1.logger.info('To create the complete schema, you have two options:');
            logger_1.logger.info('\n1. Use TypeORM synchronize for initial setup:');
            logger_1.logger.info('   - Set DB_SYNCHRONIZE=true temporarily');
            logger_1.logger.info('   - Start the application once to create all tables');
            logger_1.logger.info('   - Set DB_SYNCHRONIZE=false for production');
            logger_1.logger.info('\n2. Run the schema SQL manually:');
            logger_1.logger.info('   - Get the complete-schema.sql file from the repository');
            logger_1.logger.info('   - Execute: psql -U <user> -d <database> -f backend/schema/complete-schema.sql');
            throw new Error('Schema file not found. Please use one of the methods above to initialize the database.');
        }
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        const lines = schemaSql.split('\n');
        let currentStatement = '';
        const statements = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('SET ') ||
                trimmed.startsWith('SELECT pg_catalog') ||
                trimmed.startsWith('COMMENT ON') ||
                trimmed.startsWith('GRANT ') ||
                trimmed.startsWith('--') ||
                trimmed.length === 0) {
                continue;
            }
            currentStatement += `${line}\n`;
            if (trimmed.endsWith(';')) {
                if (currentStatement.trim().length > 0) {
                    statements.push(currentStatement.trim());
                }
                currentStatement = '';
            }
        }
        logger_1.logger.info(`Executing ${statements.length} SQL statements...`);
        const normalizeIdentifierQuotes = (sql) => {
            let normalized = '';
            let inSingleQuotedString = false;
            for (let index = 0; index < sql.length; index++) {
                const char = sql[index];
                const nextChar = sql[index + 1];
                if (char === "'") {
                    if (inSingleQuotedString && nextChar === "'") {
                        normalized += "''";
                        index++;
                        continue;
                    }
                    inSingleQuotedString = !inSingleQuotedString;
                    normalized += char;
                    continue;
                }
                if (!inSingleQuotedString && char === '"') {
                    const endQuoteIndex = sql.indexOf('"', index + 1);
                    if (endQuoteIndex === -1) {
                        normalized += char;
                        continue;
                    }
                    const identifier = sql.slice(index + 1, endQuoteIndex);
                    const canFoldToLowercase = /^[A-Za-z_]\w*$/.test(identifier) && /[A-Z]/.test(identifier);
                    normalized += canFoldToLowercase ? identifier : `"${identifier}"`;
                    index = endQuoteIndex;
                    continue;
                }
                normalized += char;
            }
            return normalized;
        };
        const totalStatements = statements.length;
        const maxPasses = 10;
        let executedCount = 0;
        let pass = 1;
        let pendingStatements = [...statements];
        while (pendingStatements.length > 0) {
            logger_1.logger.info(`Pass ${pass}: processing ${pendingStatements.length} pending SQL statements...`);
            const deferredStatements = [];
            let passProgress = 0;
            let statementIndex = 0;
            for (const statement of pendingStatements) {
                const savepointName = `sp_${pass}_${statementIndex}`;
                statementIndex++;
                const normalizedStatement = normalizeIdentifierQuotes(statement);
                try {
                    await queryRunner.query(`SAVEPOINT ${savepointName}`);
                    await queryRunner.query(normalizedStatement);
                    await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
                    executedCount++;
                    passProgress++;
                    if (executedCount % 20 === 0) {
                        logger_1.logger.info(`  Progress: ${executedCount}/${totalStatements} statements executed`);
                    }
                }
                catch (error) {
                    const errorObj = error;
                    const errorCode = errorObj?.code || errorObj?.driverError?.code;
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const isDuplicateError = errorCode === '42710' ||
                        errorCode === '42P07' ||
                        errorCode === '42P16' ||
                        errorCode === '23505' ||
                        (errorMessage.includes('already exists') &&
                            (errorMessage.includes('type') ||
                                errorMessage.includes('enum') ||
                                errorMessage.includes('table') ||
                                errorMessage.includes('constraint') ||
                                errorMessage.includes('index'))) ||
                        errorMessage.includes('multiple primary keys');
                    if (isDuplicateError) {
                        try {
                            await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                            await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
                        }
                        catch (rollbackError) {
                            logger_1.logger.debug('Rollback after duplicate statement failed (safe to continue)', {
                                error: rollbackError,
                            });
                        }
                        logger_1.logger.warn(`⚠️  Skipping duplicate object (${executedCount + 1}/${totalStatements}): ${errorMessage.substring(0, 100)}`);
                        executedCount++;
                        passProgress++;
                        continue;
                    }
                    const normalizedStatementForChecks = statement.trimStart();
                    const isMissingRelationDependency = (errorCode === '42P01' || errorMessage.includes('relation')) &&
                        errorMessage.includes('does not exist') &&
                        (statement.includes('FOREIGN KEY') ||
                            statement.includes('nextval(') ||
                            normalizedStatementForChecks.startsWith('CREATE INDEX') ||
                            normalizedStatementForChecks.startsWith('CREATE UNIQUE INDEX'));
                    if (isMissingRelationDependency && pass < maxPasses) {
                        try {
                            await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                            await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
                        }
                        catch (rollbackError) {
                            logger_1.logger.debug('Rollback after deferred dependency statement failed (safe to continue)', {
                                error: rollbackError,
                            });
                        }
                        deferredStatements.push(statement);
                        logger_1.logger.warn(`↺ Deferring relation-dependent statement to pass ${pass + 1}: ${errorMessage.substring(0, 120)}`);
                        continue;
                    }
                    try {
                        await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                    }
                    catch (rollbackError) {
                        logger_1.logger.debug('Rollback before rethrow failed (continuing with original error)', {
                            error: rollbackError,
                        });
                    }
                    logger_1.logger.error(`Failed to execute statement (${executedCount + 1}/${totalStatements}):`);
                    logger_1.logger.error(`${normalizedStatement.substring(0, 200)}...`);
                    logger_1.logger.error('Error:', error);
                    throw error;
                }
            }
            if (deferredStatements.length === 0) {
                break;
            }
            if (passProgress === 0 || deferredStatements.length === pendingStatements.length) {
                throw new Error(`Unable to resolve SQL dependency ordering after pass ${pass}; ${deferredStatements.length} statements remain deferred.`);
            }
            pendingStatements = deferredStatements;
            pass++;
            if (pass > maxPasses) {
                throw new Error(`Exceeded maximum dependency-resolution passes (${maxPasses}) while applying complete schema migration.`);
            }
        }
        logger_1.logger.info(`✅ Complete schema created successfully (${executedCount} statements)`);
        logger_1.logger.info('✅ All 87 tables are now available');
    }
    async down(queryRunner) {
        logger_1.logger.info('Dropping all tables (complete schema rollback)...');
        const tables = [
            'announcement_deliveries',
            'intel_shares',
            'intel_approvals',
            'intel_audit_logs',
            'bounty_evidence',
            'bounty_claims',
            'organization_deletion_requests',
            'organization_ships',
            'organization_inventory',
            'organization_activities',
            'organization_analytics',
            'organization_permissions',
            'organization_memberships',
            'organization_relationships',
            'relationship_history',
            'guild_organizations',
            'alliance_diplomacy',
            'organization_templates',
            'user_ships',
            'ship_loans',
            'ship_maintenance',
            'ship_loadouts',
            'fleet_members',
            'fleet_inventory',
            'fleet_logistics',
            'crew_assignments',
            'event_attendance_confirmations',
            'event_reminders',
            'lfg_reputation_ratings',
            'lfg_group_history',
            'user_activities',
            'user_gameplay_preferences',
            'user_consents',
            'user_sessions',
            'account_access_logs',
            'account_permissions',
            'rsi_user_links',
            'rsi_role_mappings',
            'rsi_sync_audit_log',
            'password_history',
            'password_reset_tokens',
            'passwordless_tokens',
            'recovery_tokens',
            'refresh_tokens',
            'token_blacklist',
            'webauthn_credentials',
            'trusted_devices',
            'deletion_requests',
            'export_requests',
            'legal_holds',
            'webhook_retry_queue',
            'blacklist_sharing_config',
            'mirror_actions',
            'cargo_manifests',
            'contact_requests',
            'public_job_listings',
            'announcements',
            'announcement_templates',
            'intel_entries',
            'intel_officers',
            'bounties',
            'hunter_profiles',
            'activities',
            'operations',
            'mining_operations',
            'tournaments',
            'briefings',
            'ships',
            'fleets',
            'tickets',
            'moderation_incidents',
            'lfg_user_reputation',
            'reputation',
            'logistics_alerts',
            'rsi_member_cache',
            'rsi_sync_schedules',
            'external_integrations',
            'webhooks',
            'tunnels',
            'trading_routes',
            'public_org_profiles',
            'shared_accounts',
            'security_levels',
            'permissions',
            'organizations',
            'users',
        ];
        for (const table of tables) {
            await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        }
        await queryRunner.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typname LIKE '%_enum') LOOP
                    EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
                END LOOP;
            END $$;
        `);
        logger_1.logger.info('✅ Complete schema dropped');
    }
}
exports.CreateCompleteSchema1729320000000 = CreateCompleteSchema1729320000000;
//# sourceMappingURL=1729320000000-CreateCompleteSchema.js.map