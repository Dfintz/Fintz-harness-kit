"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddShipHangarVisibilityControls1776392400000 = void 0;
const typeorm_1 = require("typeorm");
class AddShipHangarVisibilityControls1776392400000 {
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
        const userUseCustomColumn = await this.resolveColumnName(queryRunner, 'user_ships', 'useCustomVisibility');
        const orgSharingLevelColumn = await this.resolveColumnName(queryRunner, 'organization_ships', 'sharingLevel');
        const orgMinRequiredRankColumn = await this.resolveColumnName(queryRunner, 'organization_ships', 'minRequiredRank');
        const orgUseCustomColumn = await this.resolveColumnName(queryRunner, 'organization_ships', 'useCustomVisibility');
        if (userUseCustomColumn &&
            orgSharingLevelColumn &&
            orgMinRequiredRankColumn &&
            orgUseCustomColumn) {
            return;
        }
        await queryRunner.query(`
      ALTER TYPE "ship_sharing_level" ADD VALUE IF NOT EXISTS 'public';
    `);
        await queryRunner.query(`
      ALTER TYPE "ship_sharing_level" ADD VALUE IF NOT EXISTS 'private';
    `);
        await queryRunner.addColumn('user_ships', new typeorm_1.TableColumn({
            name: 'useCustomVisibility',
            type: 'boolean',
            default: false,
            isNullable: false,
            comment: 'Use custom per-ship visibility instead of global sharingLevel default',
        }));
        await queryRunner.query(`
      ALTER TABLE user_ships 
      ALTER COLUMN "sharingLevel" SET DEFAULT 'organization';
    `);
        await queryRunner.addColumn('organization_ships', new typeorm_1.TableColumn({
            name: 'sharingLevel',
            type: 'enum',
            enum: ['private', 'personal', 'shared_users', 'organization', 'alliance', 'public'],
            default: "'organization'",
            isNullable: false,
            comment: 'Visibility level for this organization ship',
        }));
        await queryRunner.query(`
      CREATE INDEX "IDX_organization_ships_sharingLevel" 
      ON organization_ships ("sharingLevel");
    `);
        await queryRunner.addColumn('organization_ships', new typeorm_1.TableColumn({
            name: 'minRequiredRank',
            type: 'int',
            isNullable: true,
            comment: 'Minimum member rank required to view/use this ship (null = no restriction)',
        }));
        await queryRunner.addColumn('organization_ships', new typeorm_1.TableColumn({
            name: 'useCustomVisibility',
            type: 'boolean',
            default: false,
            isNullable: false,
            comment: 'Use custom per-ship visibility instead of organization default policy',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('organization_ships', 'useCustomVisibility');
        await queryRunner.dropColumn('organization_ships', 'minRequiredRank');
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organization_ships_sharingLevel";`);
        await queryRunner.dropColumn('organization_ships', 'sharingLevel');
        await queryRunner.query(`
      ALTER TABLE user_ships 
      ALTER COLUMN "sharingLevel" SET DEFAULT 'personal';
    `);
        await queryRunner.dropColumn('user_ships', 'useCustomVisibility');
    }
}
exports.AddShipHangarVisibilityControls1776392400000 = AddShipHangarVisibilityControls1776392400000;
//# sourceMappingURL=1776392400000-AddShipHangarVisibilityControls.js.map