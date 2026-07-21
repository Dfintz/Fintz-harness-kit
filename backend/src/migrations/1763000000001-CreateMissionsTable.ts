import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Missions Table
 *
 * Creates the missions table for the AI Mission Briefings feature (Wave 3.1).
 * Supports multi-tenancy, status tracking, objectives, participants, and fleet linking.
 */
export class CreateMissionsTable1763000000001 implements MigrationInterface {
  name = 'CreateMissionsTable1763000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if missions table already exists (may be in complete schema)
    const existingTable = await queryRunner.getTable('missions');
    if (existingTable) {
      logger.warn('missions table already exists, skipping creation');
      return;
    }

    // Create the mission_type enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mission_type_enum" AS ENUM (
          'combat', 'mining', 'trading', 'exploration', 'logistics',
          'rescue', 'reconnaissance', 'escort', 'salvage', 'custom'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create the mission_status enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mission_status_enum" AS ENUM (
          'draft', 'planned', 'briefed', 'in_progress',
          'completed', 'failed', 'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create the mission_difficulty enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mission_difficulty_enum" AS ENUM (
          'trivial', 'easy', 'medium', 'hard', 'extreme'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // Create the mission_priority enum
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mission_priority_enum" AS ENUM (
          'low', 'normal', 'high', 'critical'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.createTable(
      new Table({
        name: 'missions',
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
            name: 'title',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'missionType',
            type: 'mission_type_enum',
            default: "'custom'",
          },
          {
            name: 'status',
            type: 'mission_status_enum',
            default: "'draft'",
          },
          {
            name: 'difficulty',
            type: 'mission_difficulty_enum',
            default: "'medium'",
          },
          {
            name: 'priority',
            type: 'mission_priority_enum',
            default: "'normal'",
          },
          {
            name: 'createdBy',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'assignedTo',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'fleetId',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'linkedActivityId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'location',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'objectives',
            type: 'text',
            isNullable: true,
            default: "'[]'",
            comment: 'JSON array of MissionObjectiveData',
          },
          {
            name: 'participants',
            type: 'text',
            isNullable: true,
            default: "'[]'",
            comment: 'JSON array of MissionParticipantData',
          },
          {
            name: 'tags',
            type: 'text',
            isNullable: true,
            default: "''",
            comment: 'Comma-separated tags (simple-array)',
          },
          {
            name: 'reward',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'startDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'endDate',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'sharedWithOrgs',
            type: 'text',
            isNullable: true,
            default: "''",
            comment: 'TenantEntity: comma-separated org IDs',
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
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Create indexes for common query patterns
    await queryRunner.createIndex(
      'missions',
      new TableIndex({
        name: 'IDX_missions_org_status',
        columnNames: ['organizationId', 'status'],
      })
    );

    await queryRunner.createIndex(
      'missions',
      new TableIndex({
        name: 'IDX_missions_org_type',
        columnNames: ['organizationId', 'missionType'],
      })
    );

    await queryRunner.createIndex(
      'missions',
      new TableIndex({
        name: 'IDX_missions_org_createdBy',
        columnNames: ['organizationId', 'createdBy'],
      })
    );

    await queryRunner.createIndex(
      'missions',
      new TableIndex({
        name: 'IDX_missions_org_createdAt',
        columnNames: ['organizationId', 'createdAt'],
      })
    );

    await queryRunner.createIndex(
      'missions',
      new TableIndex({
        name: 'IDX_missions_organizationId',
        columnNames: ['organizationId'],
      })
    );

    // Foreign key to fleets table
    const fleetsTableExists = await queryRunner.getTable('fleets');
    if (fleetsTableExists) {
      await queryRunner.createForeignKey(
        'missions',
        new TableForeignKey({
          name: 'FK_missions_fleetId',
          columnNames: ['fleetId'],
          referencedTableName: 'fleets',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        })
      );
    }

    // Foreign key to organizations table
    const orgsTableExists = await queryRunner.getTable('organizations');
    if (orgsTableExists) {
      await queryRunner.createForeignKey(
        'missions',
        new TableForeignKey({
          name: 'FK_missions_organizationId',
          columnNames: ['organizationId'],
          referencedTableName: 'organizations',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );
    }

    logger.info('Created missions table with indexes and foreign keys');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const table = await queryRunner.getTable('missions');
    if (table) {
      const fkFleet = table.foreignKeys.find(fk => fk.name === 'FK_missions_fleetId');
      if (fkFleet) {
        await queryRunner.dropForeignKey('missions', fkFleet);
      }

      const fkOrg = table.foreignKeys.find(fk => fk.name === 'FK_missions_organizationId');
      if (fkOrg) {
        await queryRunner.dropForeignKey('missions', fkOrg);
      }
    }

    await queryRunner.dropTable('missions', true);

    // Drop enums
    await queryRunner.query('DROP TYPE IF EXISTS "mission_priority_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "mission_difficulty_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "mission_status_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "mission_type_enum"');

    logger.info('Dropped missions table and related enums');
  }
}
