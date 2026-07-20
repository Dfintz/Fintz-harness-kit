"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAIUsageTrackingTable1763100000001 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateAIUsageTrackingTable1763100000001 {
    async up(queryRunner) {
        logger_1.logger.info('Running migration: CreateAIUsageTrackingTable1763100000000 (UP)');
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE ai_feature_type_enum AS ENUM ('briefing_generation', 'mission_summary');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
        const tableExists = await queryRunner.hasTable('ai_usage_tracking');
        if (tableExists) {
            logger_1.logger.info('Table ai_usage_tracking already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
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
        }), true);
        await queryRunner.createIndex('ai_usage_tracking', new typeorm_1.TableIndex({
            name: 'IDX_ai_usage_org_feature_date',
            columnNames: ['organizationId', 'featureType', 'usageDate'],
            isUnique: true,
        }));
        await queryRunner.createIndex('ai_usage_tracking', new typeorm_1.TableIndex({
            name: 'IDX_ai_usage_org_date',
            columnNames: ['organizationId', 'usageDate'],
        }));
        logger_1.logger.info('Migration CreateAIUsageTrackingTable1763100000000 (UP) completed successfully');
    }
    async down(queryRunner) {
        logger_1.logger.info('Running migration: CreateAIUsageTrackingTable1763100000000 (DOWN)');
        await queryRunner.dropTable('ai_usage_tracking', true);
        await queryRunner.query('DROP TYPE IF EXISTS ai_feature_type_enum');
        logger_1.logger.info('Migration CreateAIUsageTrackingTable1763100000000 (DOWN) completed successfully');
    }
}
exports.CreateAIUsageTrackingTable1763100000001 = CreateAIUsageTrackingTable1763100000001;
//# sourceMappingURL=1763100000001-CreateAIUsageTrackingTable.js.map