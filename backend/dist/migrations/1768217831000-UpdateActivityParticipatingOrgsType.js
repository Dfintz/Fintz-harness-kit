"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateActivityParticipatingOrgsType1768217831000 = void 0;
const logger_1 = require("../utils/logger");
class UpdateActivityParticipatingOrgsType1768217831000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('activities');
        if (!table) {
            logger_1.logger.warn('activities table does not exist, skipping migration');
            return;
        }
        const column = table.columns.find(col => col.name === 'participatingOrgs');
        if (!column) {
            logger_1.logger.warn('participatingOrgs column does not exist, skipping migration');
            return;
        }
        const currentType = await queryRunner.query(`
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_name = 'activities' 
            AND column_name = 'participatingOrgs'
        `);
        if (currentType?.[0]?.data_type === 'jsonb') {
            logger_1.logger.warn('participatingOrgs column is already jsonb type, skipping migration');
            return;
        }
        logger_1.logger.info('Converting participatingOrgs column from text/json to jsonb...');
        await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" DROP DEFAULT
        `);
        await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" TYPE jsonb USING 
            CASE 
                WHEN "participatingOrgs" IS NULL THEN '[]'::jsonb
                WHEN "participatingOrgs" = '' THEN '[]'::jsonb
                ELSE "participatingOrgs"::jsonb
            END
        `);
        await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" SET DEFAULT '[]'::jsonb
        `);
        logger_1.logger.info('Creating GIN index for participatingOrgs column...');
        const indexExists = await queryRunner.query(`
            SELECT 1 
            FROM pg_indexes 
            WHERE indexname = 'idx_activity_participating_orgs'
        `);
        if (!indexExists || indexExists.length === 0) {
            await queryRunner.query(`
                CREATE INDEX idx_activity_participating_orgs 
                ON activities USING gin("participatingOrgs")
            `);
            logger_1.logger.info('✅ Successfully converted participatingOrgs to jsonb and added GIN index');
        }
        else {
            logger_1.logger.warn('Index idx_activity_participating_orgs already exists, skipping index creation');
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('activities');
        if (!table) {
            logger_1.logger.warn('activities table does not exist, skipping rollback');
            return;
        }
        logger_1.logger.info('Rolling back: Dropping GIN index...');
        const indexExists = await queryRunner.query(`
            SELECT 1 
            FROM pg_indexes 
            WHERE indexname = 'idx_activity_participating_orgs'
        `);
        if (indexExists && indexExists.length > 0) {
            await queryRunner.query(`
                DROP INDEX IF EXISTS idx_activity_participating_orgs
            `);
        }
        logger_1.logger.info('Rolling back: Converting participatingOrgs from jsonb to json...');
        await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" DROP DEFAULT
        `);
        await queryRunner.query(`
            ALTER TABLE activities 
            ALTER COLUMN "participatingOrgs" TYPE json USING "participatingOrgs"::json
        `);
        logger_1.logger.info('✅ Successfully rolled back participatingOrgs column type');
    }
}
exports.UpdateActivityParticipatingOrgsType1768217831000 = UpdateActivityParticipatingOrgsType1768217831000;
//# sourceMappingURL=1768217831000-UpdateActivityParticipatingOrgsType.js.map