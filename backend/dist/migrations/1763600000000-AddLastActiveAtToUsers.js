"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddLastActiveAtToUsers1763600000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddLastActiveAtToUsers1763600000000 {
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
        const table = await queryRunner.getTable('users');
        if (!table) {
            logger_1.logger.warn('users table does not exist, skipping migration');
            return;
        }
        const lastActiveAtColumn = await this.resolveColumnName(queryRunner, 'users', 'lastActiveAt');
        if (lastActiveAtColumn) {
            logger_1.logger.info('  lastActiveAt column already exists, skipping');
            return;
        }
        await queryRunner.addColumn('users', new typeorm_1.TableColumn({
            name: 'lastActiveAt',
            type: 'timestamp',
            isNullable: true,
            comment: 'Timestamp of last user activity for active member tracking',
        }));
        const lastLoginAtColumn = await this.resolveColumnName(queryRunner, 'users', 'lastLoginAt');
        if (lastLoginAtColumn) {
            await queryRunner.query(`
                UPDATE users 
                SET "lastActiveAt" = "${lastLoginAtColumn}" 
                WHERE "${lastLoginAtColumn}" IS NOT NULL
            `);
        }
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('users', 'lastActiveAt');
    }
}
exports.AddLastActiveAtToUsers1763600000000 = AddLastActiveAtToUsers1763600000000;
//# sourceMappingURL=1763600000000-AddLastActiveAtToUsers.js.map