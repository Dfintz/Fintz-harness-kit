import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Moderation Incidents Table
 *
 * Creates the moderation_incidents table for tracking moderation actions
 * across Discord servers. Supports 5 severity levels and cross-organization sharing.
 *
 * Phase 1: Cross-Discord Blacklist System - Incident Tracking
 */
export class CreateModerationIncidentsTable1762500000000 implements MigrationInterface {
  name = 'CreateModerationIncidentsTable1762500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if moderation_incidents table already exists (may be in complete schema)
    const existingTable = await queryRunner.getTable('moderation_incidents');
    if (existingTable) {
      logger.warn('moderation_incidents table already exists, skipping creation');
      return;
    }

    // Create enum types first
    await queryRunner.query(`
            CREATE TYPE "incident_type_enum" AS ENUM ('warning', 'timeout', 'long_timeout', 'kick', 'ban')
        `);

    await queryRunner.query(`
            CREATE TYPE "incident_status_enum" AS ENUM ('active', 'expired', 'revoked')
        `);

    await queryRunner.createTable(
      new Table({
        name: 'moderation_incidents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organizationId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'guildId',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'guildName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'targetDiscordId',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'targetUsername',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'moderatorId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'moderatorDiscordId',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'moderatorUsername',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'incidentType',
            type: 'incident_type_enum',
            default: "'warning'",
          },
          {
            name: 'severity',
            type: 'integer',
            default: 1,
            comment: '1=Warning, 2=Timeout, 3=LongTimeout, 4=Kick, 5=Ban',
          },
          {
            name: 'status',
            type: 'incident_status_enum',
            default: "'active'",
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'durationMinutes',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'isShared',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isAutoDetected',
            type: 'boolean',
            default: false,
          },
          {
            name: 'discordAuditLogId',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'revokedBy',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'revokedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'revokeReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sharedWithOrgs',
            type: 'text[]',
            isNullable: true,
            default: "'{}'",
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'deletedBy',
            type: 'varchar',
            isNullable: true,
          },
        ],
      }),
      true
    );

    // Create indexes for efficient queries
    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_organizationId',
        columnNames: ['organizationId'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_guildId',
        columnNames: ['guildId'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_targetDiscordId',
        columnNames: ['targetDiscordId'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_incidentType',
        columnNames: ['incidentType'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_severity',
        columnNames: ['severity'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_status',
        columnNames: ['status'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_isShared',
        columnNames: ['isShared'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_createdAt',
        columnNames: ['createdAt'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_org_target',
        columnNames: ['organizationId', 'targetDiscordId'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_guild_target',
        columnNames: ['guildId', 'targetDiscordId'],
      })
    );

    await queryRunner.createIndex(
      'moderation_incidents',
      new TableIndex({
        name: 'IDX_moderation_incidents_shared_lookup',
        columnNames: ['isShared', 'status', 'severity'],
      })
    );

    // Add foreign key to organizations table
    await queryRunner.createForeignKey(
      'moderation_incidents',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
        name: 'FK_moderation_incidents_organizationId',
      })
    );

    // Add check constraint for severity range
    await queryRunner.query(`
            ALTER TABLE moderation_incidents 
            ADD CONSTRAINT CHK_moderation_incidents_severity 
            CHECK (severity >= 1 AND severity <= 5)
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraint
    await queryRunner.query(`
            ALTER TABLE moderation_incidents DROP CONSTRAINT CHK_moderation_incidents_severity
        `);

    // Drop foreign key
    await queryRunner.dropForeignKey(
      'moderation_incidents',
      'FK_moderation_incidents_organizationId'
    );

    // Drop indexes
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_shared_lookup');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_guild_target');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_org_target');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_createdAt');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_isShared');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_status');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_severity');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_incidentType');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_targetDiscordId');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_guildId');
    await queryRunner.dropIndex('moderation_incidents', 'IDX_moderation_incidents_organizationId');

    // Drop table
    await queryRunner.dropTable('moderation_incidents');

    // Drop enum types
    await queryRunner.query(`DROP TYPE "incident_status_enum"`);
    await queryRunner.query(`DROP TYPE "incident_type_enum"`);
  }
}
