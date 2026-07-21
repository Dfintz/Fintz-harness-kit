import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create AI Usage Tracking table
 *
 * Tracks AI generation usage per organization per day for rate limiting
 * and analytics. Supports the AIBriefingGenerationService daily quota
 * enforcement (default: 50 generations/org/day).
 */
export class CreateAIUsageTrackingTable1763100000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    logger.info('Running migration: CreateAIUsageTrackingTable1763100000000 (UP)');

    // Create the enum type
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE ai_feature_type_enum AS ENUM ('briefing_generation', 'mission_summary');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Check if table already exists
    const tableExists = await queryRunner.hasTable('ai_usage_tracking');
    if (tableExists) {
      logger.info('Table ai_usage_tracking already exists, skipping creation');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'ai_usage_tracking',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organizationId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'featureType',
            type: 'ai_feature_type_enum',
            default: "'briefing_generation'",
          },
          {
            name: 'usageDate',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'requestCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'promptTokens',
            type: 'int',
            default: 0,
          },
          {
            name: 'completionTokens',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalTokens',
            type: 'int',
            default: 0,
          },
          {
            name: 'lastModelUsed',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'lastRequestByUserId',
            type: 'varchar',
            isNullable: true,
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
        ],
      }),
      true
    );

    // Unique composite index: one row per org+feature+day
    await queryRunner.createIndex(
      'ai_usage_tracking',
      new TableIndex({
        name: 'IDX_ai_usage_org_feature_date',
        columnNames: ['organizationId', 'featureType', 'usageDate'],
        isUnique: true,
      })
    );

    // Lookup index for org + date queries
    await queryRunner.createIndex(
      'ai_usage_tracking',
      new TableIndex({
        name: 'IDX_ai_usage_org_date',
        columnNames: ['organizationId', 'usageDate'],
      })
    );

    logger.info('Migration CreateAIUsageTrackingTable1763100000000 (UP) completed successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    logger.info('Running migration: CreateAIUsageTrackingTable1763100000000 (DOWN)');

    await queryRunner.dropTable('ai_usage_tracking', true);
    await queryRunner.query('DROP TYPE IF EXISTS ai_feature_type_enum');

    logger.info('Migration CreateAIUsageTrackingTable1763100000000 (DOWN) completed successfully');
  }
}
