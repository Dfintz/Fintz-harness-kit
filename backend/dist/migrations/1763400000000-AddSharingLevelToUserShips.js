"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSharingLevelToUserShips1763400000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddSharingLevelToUserShips1763400000000 {
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
        const table = await queryRunner.getTable('user_ships');
        if (!table) {
            logger_1.logger.warn('user_ships table does not exist, skipping migration');
            return;
        }
        const sharingLevelColumn = await this.resolveColumnName(queryRunner, 'user_ships', 'sharingLevel');
        if (sharingLevelColumn) {
            logger_1.logger.warn('sharingLevel column already exists, skipping migration');
            return;
        }
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE ship_sharing_level AS ENUM ('personal', 'shared_users', 'organization', 'alliance');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.addColumn('user_ships', new typeorm_1.TableColumn({
            name: 'sharingLevel',
            type: 'ship_sharing_level',
            default: "'personal'",
            isNullable: false,
        }));
        await queryRunner.addColumn('user_ships', new typeorm_1.TableColumn({
            name: 'sharedWithUsers',
            type: 'text',
            isNullable: true,
        }));
        const availableForOrgColumn = await this.resolveColumnName(queryRunner, 'user_ships', 'availableForOrg');
        if (availableForOrgColumn) {
            await queryRunner.query(`
                UPDATE user_ships 
                SET "sharingLevel" = 'organization' 
                WHERE "${availableForOrgColumn}" = true
            `);
        }
        await queryRunner.createIndex('user_ships', new typeorm_1.TableIndex({
            name: 'IDX_USER_SHIPS_SHARING_LEVEL',
            columnNames: ['sharingLevel'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('user_ships', 'IDX_USER_SHIPS_SHARING_LEVEL');
        await queryRunner.dropColumn('user_ships', 'sharedWithUsers');
        await queryRunner.dropColumn('user_ships', 'sharingLevel');
        await queryRunner.query(`DROP TYPE IF EXISTS ship_sharing_level`);
    }
}
exports.AddSharingLevelToUserShips1763400000000 = AddSharingLevelToUserShips1763400000000;
//# sourceMappingURL=1763400000000-AddSharingLevelToUserShips.js.map