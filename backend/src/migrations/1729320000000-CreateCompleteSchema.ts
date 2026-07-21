import * as fs from 'node:fs';
import * as path from 'node:path';

import { MigrationInterface, QueryRunner } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Comprehensive Base Migration - Creates All 87 Tables
 *
 * This migration creates the complete database schema including all 87 entity tables.
 * It's designed for fresh production databases that don't use TypeORM synchronize.
 *
 * Tables created (87 total):
 * - Core: users, organizations, permissions, security_levels
 * - Activities: activities, operations, mining_operations, tournaments
 * - Fleets: fleets, fleet_members, fleet_inventory, fleet_logistics
 * - Ships: ships, ship_loadouts, ship_loans, ship_maintenance, user_ships, organization_ships
 * - Authentication: user_sessions, refresh_tokens, password_reset_tokens, passwordless_tokens, recovery_tokens, token_blacklist, webauthn_credentials, trusted_devices
 * - Organizations: organization_memberships, organization_permissions, organization_activities, organization_analytics, organization_inventory, organization_templates, organization_relationships, organization_deletion_requests
 * - Intel: intel_entries, intel_officers, intel_approvals, intel_audit_logs, intel_shares
 * - Bounties: bounties, bounty_claims, bounty_evidence, hunter_profiles
 * - Announcements: announcements, announcement_deliveries, announcement_templates
 * - RSI: rsi_member_cache, rsi_role_mappings, rsi_user_links, rsi_sync_audit_log, rsi_sync_schedules
 * - LFG: lfg_group_history, lfg_reputation_ratings, lfg_user_reputation
 * - Moderation: moderation_incidents, blacklist_sharing_config, mirror_actions
 * - GDPR: deletion_requests, export_requests, legal_holds, user_consents
 * - Misc: account_access_logs, account_permissions, alliance_diplomacy, briefings, cargo_manifests, contact_requests, crew_assignments, event_attendance_confirmations, event_reminders, external_integrations, guild_organizations, logistics_alerts, password_history, public_job_listings, public_org_profiles, relationship_history, reputation, shared_accounts, tickets, trading_routes, tunnels, user_activities, user_gameplay_preferences, webhook_retry_queue, webhooks
 *
 * This migration replaces the previous CreateBaseTables migration to provide a complete schema.
 */
export class CreateCompleteSchema1729320000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    logger.info('Creating complete database schema (87 tables)...');
    logger.info('This may take a few minutes...');

    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '..', '..', 'schema', 'complete-schema.sql');

    // Check if schema file exists
    if (!fs.existsSync(schemaPath)) {
      logger.error('Schema file not found at:', { path: schemaPath });
      logger.info('\n⚠️  IMPORTANT: Complete schema SQL file not found!');
      logger.info('To create the complete schema, you have two options:');
      logger.info('\n1. Use TypeORM synchronize for initial setup:');
      logger.info('   - Set DB_SYNCHRONIZE=true temporarily');
      logger.info('   - Start the application once to create all tables');
      logger.info('   - Set DB_SYNCHRONIZE=false for production');
      logger.info('\n2. Run the schema SQL manually:');
      logger.info('   - Get the complete-schema.sql file from the repository');
      logger.info(
        '   - Execute: psql -U <user> -d <database> -f backend/schema/complete-schema.sql'
      );
      throw new Error(
        'Schema file not found. Please use one of the methods above to initialize the database.'
      );
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Split into individual statements properly
    // Remove SET commands and comments, keep only CREATE statements
    const lines = schemaSql.split('\n');
    let currentStatement = '';
    const statements: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip SET, SELECT, and COMMENT commands
      if (
        trimmed.startsWith('SET ') ||
        trimmed.startsWith('SELECT pg_catalog') ||
        trimmed.startsWith('COMMENT ON') ||
        trimmed.startsWith('GRANT ') ||
        trimmed.startsWith('--') ||
        trimmed.length === 0
      ) {
        continue;
      }

      currentStatement += `${line}\n`;

      // Check if statement is complete (ends with semicolon)
      if (trimmed.endsWith(';')) {
        if (currentStatement.trim().length > 0) {
          statements.push(currentStatement.trim());
        }
        currentStatement = '';
      }
    }

    logger.info(`Executing ${statements.length} SQL statements...`);

    type PgLikeError = {
      code?: string;
      driverError?: {
        code?: string;
      };
    };

    // The generated schema SQL mixes quoted camelCase references and unquoted camelCase
    // column definitions. We only dequote camelCase identifiers so PostgreSQL folds
    // them consistently, while preserving required quotes (for example "uuid-ossp").
    const normalizeIdentifierQuotes = (sql: string): string => {
      let normalized = '';
      let inSingleQuotedString = false;

      for (let index = 0; index < sql.length; index++) {
        const char = sql[index];
        const nextChar = sql[index + 1];

        if (char === "'") {
          // Preserve escaped single quotes inside string literals.
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
      logger.info(`Pass ${pass}: processing ${pendingStatements.length} pending SQL statements...`);

      const deferredStatements: string[] = [];
      let passProgress = 0;
      let statementIndex = 0;

      for (const statement of pendingStatements) {
        // Use a savepoint to allow rolling back just this statement on error
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
            logger.info(`  Progress: ${executedCount}/${totalStatements} statements executed`);
          }
        } catch (error: unknown) {
          // Check if error is due to duplicate objects/constraints - these are safe to ignore
          // PostgreSQL error codes:
          // - 42710: duplicate_object (type/enum already exists)
          // - 42P07: duplicate_table (table already exists)
          // - 42P16: invalid_table_definition (multiple primary keys)
          // - 23505: unique_violation (constraint/index already exists)
          // - 42P01: undefined_table (can happen when FK references a table created later in file)
          const errorObj = error as PgLikeError;
          const errorCode = errorObj?.code || errorObj?.driverError?.code;
          const errorMessage = error instanceof Error ? error.message : String(error);

          const isDuplicateError =
            errorCode === '42710' || // duplicate object
            errorCode === '42P07' || // duplicate table
            errorCode === '42P16' || // multiple primary keys
            errorCode === '23505' || // unique violation (constraint exists)
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
            } catch (rollbackError: unknown) {
              logger.debug('Rollback after duplicate statement failed (safe to continue)', {
                error: rollbackError,
              });
            }

            logger.warn(
              `⚠️  Skipping duplicate object (${executedCount + 1}/${totalStatements}): ${errorMessage.substring(0, 100)}`
            );
            executedCount++;
            passProgress++;
            continue;
          }

          const normalizedStatementForChecks = statement.trimStart();
          const isMissingRelationDependency =
            (errorCode === '42P01' || errorMessage.includes('relation')) &&
            errorMessage.includes('does not exist') &&
            (statement.includes('FOREIGN KEY') ||
              statement.includes('nextval(') ||
              normalizedStatementForChecks.startsWith('CREATE INDEX') ||
              normalizedStatementForChecks.startsWith('CREATE UNIQUE INDEX'));

          if (isMissingRelationDependency && pass < maxPasses) {
            try {
              await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
              await queryRunner.query(`RELEASE SAVEPOINT ${savepointName}`);
            } catch (rollbackError: unknown) {
              logger.debug(
                'Rollback after deferred dependency statement failed (safe to continue)',
                {
                  error: rollbackError,
                }
              );
            }

            deferredStatements.push(statement);
            logger.warn(
              `↺ Deferring relation-dependent statement to pass ${pass + 1}: ${errorMessage.substring(0, 120)}`
            );
            continue;
          }

          // For other errors, rollback the savepoint and throw
          try {
            await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          } catch (rollbackError: unknown) {
            logger.debug('Rollback before rethrow failed (continuing with original error)', {
              error: rollbackError,
            });
          }

          logger.error(`Failed to execute statement (${executedCount + 1}/${totalStatements}):`);
          logger.error(`${normalizedStatement.substring(0, 200)}...`);
          logger.error('Error:', error);
          throw error;
        }
      }

      if (deferredStatements.length === 0) {
        break;
      }

      if (passProgress === 0 || deferredStatements.length === pendingStatements.length) {
        throw new Error(
          `Unable to resolve SQL dependency ordering after pass ${pass}; ${deferredStatements.length} statements remain deferred.`
        );
      }

      pendingStatements = deferredStatements;
      pass++;

      if (pass > maxPasses) {
        throw new Error(
          `Exceeded maximum dependency-resolution passes (${maxPasses}) while applying complete schema migration.`
        );
      }
    }

    logger.info(`✅ Complete schema created successfully (${executedCount} statements)`);
    logger.info('✅ All 87 tables are now available');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    logger.info('Dropping all tables (complete schema rollback)...');

    // Drop all tables in reverse dependency order
    const tables = [
      // Drop tables with foreign keys first
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
      // Then independent tables
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
      // Finally base tables
      'organizations',
      'users',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }

    // Drop all custom types
    await queryRunner.query(`
            DO $$ DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT typname FROM pg_type WHERE typtype = 'e' AND typname LIKE '%_enum') LOOP
                    EXECUTE 'DROP TYPE IF EXISTS ' || quote_ident(r.typname) || ' CASCADE';
                END LOOP;
            END $$;
        `);

    logger.info('✅ Complete schema dropped');
  }
}
