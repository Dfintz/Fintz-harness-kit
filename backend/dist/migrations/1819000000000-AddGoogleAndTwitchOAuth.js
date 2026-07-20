"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddGoogleAndTwitchOAuth1819000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddGoogleAndTwitchOAuth1819000000000 {
    name = 'AddGoogleAndTwitchOAuth1819000000000';
    async up(queryRunner) {
        const table = await queryRunner.getTable('users');
        if (!table) {
            return;
        }
        const hasGoogleId = table.columns.some(c => c.name === 'googleId');
        if (!hasGoogleId) {
            await queryRunner.addColumn('users', new typeorm_1.TableColumn({
                name: 'googleId',
                type: 'varchar',
                isNullable: true,
            }));
        }
        const hasTwitchId = table.columns.some(c => c.name === 'twitchId');
        if (!hasTwitchId) {
            await queryRunner.addColumn('users', new typeorm_1.TableColumn({
                name: 'twitchId',
                type: 'varchar',
                isNullable: true,
            }));
        }
        const hasGoogleIdx = table.indices.some(i => i.name === 'IDX_users_googleId');
        if (!hasGoogleIdx) {
            await queryRunner.createIndex('users', new typeorm_1.TableIndex({
                name: 'IDX_users_googleId',
                columnNames: ['googleId'],
                isUnique: true,
                where: '"googleId" IS NOT NULL',
            }));
        }
        const hasTwitchIdx = table.indices.some(i => i.name === 'IDX_users_twitchId');
        if (!hasTwitchIdx) {
            await queryRunner.createIndex('users', new typeorm_1.TableIndex({
                name: 'IDX_users_twitchId',
                columnNames: ['twitchId'],
                isUnique: true,
                where: '"twitchId" IS NOT NULL',
            }));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('users');
        if (!table) {
            return;
        }
        if (table.indices.some(i => i.name === 'IDX_users_twitchId')) {
            await queryRunner.dropIndex('users', 'IDX_users_twitchId');
        }
        if (table.indices.some(i => i.name === 'IDX_users_googleId')) {
            await queryRunner.dropIndex('users', 'IDX_users_googleId');
        }
        if (table.columns.some(c => c.name === 'twitchId')) {
            await queryRunner.dropColumn('users', 'twitchId');
        }
        if (table.columns.some(c => c.name === 'googleId')) {
            await queryRunner.dropColumn('users', 'googleId');
        }
    }
}
exports.AddGoogleAndTwitchOAuth1819000000000 = AddGoogleAndTwitchOAuth1819000000000;
//# sourceMappingURL=1819000000000-AddGoogleAndTwitchOAuth.js.map