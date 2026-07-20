"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateHunterProfilesTable1853000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateHunterProfilesTable1853000000000 {
    async up(queryRunner) {
        const tableExists = await queryRunner.hasTable('hunter_profiles');
        if (tableExists) {
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'hunter_profiles',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'userId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'userName',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'organizationId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'totalBountiesCompleted',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'totalBountiesClaimed',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'totalBountiesAbandoned',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'totalBountiesRejected',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'totalRewardsEarned',
                    type: 'bigint',
                    default: 0,
                },
                {
                    name: 'successRate',
                    type: 'decimal',
                    precision: 5,
                    scale: 2,
                    default: 0,
                },
                {
                    name: 'averageCompletionTimeMinutes',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'rank',
                    type: 'varchar',
                    length: '50',
                    default: "'rookie'",
                },
                {
                    name: 'reputationScore',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'killBountiesCompleted',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'captureBountiesCompleted',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'intelBountiesCompleted',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'transportBountiesCompleted',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'rescueBountiesCompleted',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'customBountiesCompleted',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'lastBountyCompletedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'currentStreak',
                    type: 'integer',
                    default: 0,
                },
                {
                    name: 'longestStreak',
                    type: 'integer',
                    default: 0,
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
        }), true);
        await queryRunner.createIndex('hunter_profiles', new typeorm_1.TableIndex({
            name: 'IDX_hunter_profiles_userId_organizationId',
            columnNames: ['userId', 'organizationId'],
            isUnique: true,
        }));
        await queryRunner.createIndex('hunter_profiles', new typeorm_1.TableIndex({
            name: 'IDX_hunter_profiles_org_completed',
            columnNames: ['organizationId', 'totalBountiesCompleted'],
        }));
        await queryRunner.createIndex('hunter_profiles', new typeorm_1.TableIndex({
            name: 'IDX_hunter_profiles_org_rewards',
            columnNames: ['organizationId', 'totalRewardsEarned'],
        }));
        await queryRunner.createIndex('hunter_profiles', new typeorm_1.TableIndex({
            name: 'IDX_hunter_profiles_org_reputation',
            columnNames: ['organizationId', 'reputationScore'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('hunter_profiles', true);
    }
}
exports.CreateHunterProfilesTable1853000000000 = CreateHunterProfilesTable1853000000000;
//# sourceMappingURL=1853000000000-CreateHunterProfilesTable.js.map