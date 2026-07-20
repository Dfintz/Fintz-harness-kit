"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MakeUserShipsUserOwned1734042000000 = void 0;
const logger_1 = require("../utils/logger");
class MakeUserShipsUserOwned1734042000000 {
    name = 'MakeUserShipsUserOwned1734042000000';
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveColumnName(queryRunner, tableName, preferredName) {
        const rows = await queryRunner.query(`SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`, [tableName, preferredName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        const tableName = 'user_ships';
        const resolveOrDefault = async (preferredName) => (await this.resolveColumnName(queryRunner, tableName, preferredName)) ?? preferredName;
        const organizationIdColumn = await this.resolveColumnName(queryRunner, tableName, 'organizationId');
        const hasOrganizationId = organizationIdColumn !== null;
        const deletedAtColumn = await resolveOrDefault('deletedAt');
        const visibleToOrganizationColumn = await resolveOrDefault('visibleToOrganization');
        const classificationChangedByColumn = await resolveOrDefault('classificationChangedBy');
        const classificationChangedAtColumn = await resolveOrDefault('classificationChangedAt');
        const classificationReasonColumn = await resolveOrDefault('classificationReason');
        await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(deletedAtColumn)} TIMESTAMP DEFAULT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(visibleToOrganizationColumn)} BOOLEAN DEFAULT true
        `);
        await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(classificationChangedByColumn)} VARCHAR(255) DEFAULT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(classificationChangedAtColumn)} TIMESTAMP DEFAULT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(classificationReasonColumn)} TEXT DEFAULT NULL
        `);
        if (hasOrganizationId) {
            const indexQueries = [
                'DROP INDEX IF EXISTS "IDX_user_ships_organizationId_userId"',
                'DROP INDEX IF EXISTS "IDX_user_ships_organizationId_shipId"',
                'DROP INDEX IF EXISTS "IDX_user_ships_organizationId_status"',
            ];
            for (const query of indexQueries) {
                try {
                    await queryRunner.query(query);
                }
                catch (_error) {
                    logger_1.logger.info(`Index drop skipped (might not exist): ${query}`);
                }
            }
            try {
                await queryRunner.query(`
                ALTER TABLE "user_ships" 
                DROP CONSTRAINT IF EXISTS "FK_user_ships_organizationId"
            `);
            }
            catch (_error) {
                logger_1.logger.info('Foreign key constraint drop skipped (might not exist)');
            }
            try {
                await queryRunner.query(`
                ALTER TABLE "user_ships" 
                ALTER COLUMN ${this.quoteIdentifier(organizationIdColumn)} DROP NOT NULL
            `);
            }
            catch (_error) {
                logger_1.logger.info('organizationId is already nullable');
            }
        }
        else {
            logger_1.logger.info('organizationId column not present on user_ships; skipping org-specific mutations');
        }
        const userIdColumn = await resolveOrDefault('userId');
        const shipIdColumn = await resolveOrDefault('shipId');
        const statusColumn = await resolveOrDefault('status');
        const sharingLevelColumn = await resolveOrDefault('sharingLevel');
        const deletedAtColumnForIndex = await resolveOrDefault('deletedAt');
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_userId_status" 
        ON "user_ships" (${this.quoteIdentifier(userIdColumn)}, ${this.quoteIdentifier(statusColumn)}) 
        WHERE ${this.quoteIdentifier(deletedAtColumnForIndex)} IS NULL
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_userId_shipId" 
        ON "user_ships" (${this.quoteIdentifier(userIdColumn)}, ${this.quoteIdentifier(shipIdColumn)}) 
        WHERE ${this.quoteIdentifier(deletedAtColumnForIndex)} IS NULL
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_userId_sharingLevel" 
        ON "user_ships" (${this.quoteIdentifier(userIdColumn)}, ${this.quoteIdentifier(sharingLevelColumn)}) 
        WHERE ${this.quoteIdentifier(deletedAtColumnForIndex)} IS NULL
        `);
    }
    async down(queryRunner) {
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_userId_status"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_userId_shipId"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_userId_sharingLevel"');
        await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ALTER COLUMN "organizationId" SET NOT NULL
        `);
        await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD CONSTRAINT "FK_user_ships_organizationId" 
            FOREIGN KEY ("organizationId") 
            REFERENCES "organizations"("id") 
            ON DELETE CASCADE
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_user_ships_organizationId_userId" 
            ON "user_ships" ("organizationId", "userId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_user_ships_organizationId_shipId" 
            ON "user_ships" ("organizationId", "shipId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_user_ships_organizationId_status" 
            ON "user_ships" ("organizationId", "status")
        `);
        await queryRunner.query(`
            ALTER TABLE "user_ships" 
            DROP COLUMN "classificationReason",
            DROP COLUMN "classificationChangedAt",
            DROP COLUMN "classificationChangedBy",
            DROP COLUMN "visibleToOrganization"
        `);
        await queryRunner.query(`
            ALTER TABLE "user_ships" 
            DROP COLUMN "deletedAt"
        `);
    }
}
exports.MakeUserShipsUserOwned1734042000000 = MakeUserShipsUserOwned1734042000000;
//# sourceMappingURL=1734042000000-MakeUserShipsUserOwned.js.map