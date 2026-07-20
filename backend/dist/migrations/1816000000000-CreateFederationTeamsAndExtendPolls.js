"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFederationTeamsAndExtendPolls1816000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateFederationTeamsAndExtendPolls1816000000000 {
    name = 'CreateFederationTeamsAndExtendPolls1816000000000';
    async up(queryRunner) {
        const pollsTable = await queryRunner.getTable('polls');
        if (pollsTable) {
            const hasFedCol = pollsTable.columns.some(c => c.name === 'federationId');
            if (!hasFedCol) {
                await queryRunner.addColumn('polls', new typeorm_1.TableColumn({
                    name: 'federationId',
                    type: 'uuid',
                    isNullable: true,
                }));
                await queryRunner.createIndex('polls', new typeorm_1.TableIndex({
                    name: 'idx_poll_federation',
                    columnNames: ['federationId'],
                }));
                await queryRunner.createIndex('polls', new typeorm_1.TableIndex({
                    name: 'idx_poll_federation_status',
                    columnNames: ['federationId', 'status'],
                }));
            }
            const hasVotingMode = pollsTable.columns.some(c => c.name === 'votingMode');
            if (!hasVotingMode) {
                await queryRunner.addColumn('polls', new typeorm_1.TableColumn({
                    name: 'votingMode',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                    default: "'equal'",
                }));
            }
        }
        const teamsTable = await queryRunner.getTable('federation_teams');
        if (!teamsTable) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'federation_teams',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'federationId', type: 'uuid', isNullable: false },
                    { name: 'name', type: 'varchar', length: '100', isNullable: false },
                    { name: 'description', type: 'text', isNullable: true },
                    {
                        name: 'type',
                        type: 'varchar',
                        length: '30',
                        isNullable: false,
                        default: "'task_force'",
                    },
                    { name: 'leaderId', type: 'varchar', isNullable: true },
                    { name: 'leaderName', type: 'varchar', length: '200', isNullable: true },
                    { name: 'leaderOrgId', type: 'varchar', isNullable: true },
                    {
                        name: 'members',
                        type: 'jsonb',
                        isNullable: false,
                        default: "'[]'",
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                        default: "'active'",
                    },
                    {
                        name: 'maxMembers',
                        type: 'int',
                        isNullable: false,
                        default: 20,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamptz',
                        isNullable: false,
                        default: 'now()',
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamptz',
                        isNullable: false,
                        default: 'now()',
                    },
                ],
            }), true);
            await queryRunner.createForeignKey('federation_teams', new typeorm_1.TableForeignKey({
                name: 'FK_fed_team_federation',
                columnNames: ['federationId'],
                referencedTableName: 'federations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
            await queryRunner.createIndex('federation_teams', new typeorm_1.TableIndex({
                name: 'idx_fed_team_federation',
                columnNames: ['federationId'],
            }));
            await queryRunner.createIndex('federation_teams', new typeorm_1.TableIndex({
                name: 'idx_fed_team_status',
                columnNames: ['federationId', 'status'],
            }));
        }
    }
    async down(queryRunner) {
        const teamsTable = await queryRunner.getTable('federation_teams');
        if (teamsTable) {
            await queryRunner.dropTable('federation_teams');
        }
        const pollsTable = await queryRunner.getTable('polls');
        if (pollsTable) {
            if (pollsTable.columns.some(c => c.name === 'votingMode')) {
                await queryRunner.dropColumn('polls', 'votingMode');
            }
            const fedStatusIdx = pollsTable.indices.find(i => i.name === 'idx_poll_federation_status');
            if (fedStatusIdx) {
                await queryRunner.dropIndex('polls', 'idx_poll_federation_status');
            }
            const fedIdx = pollsTable.indices.find(i => i.name === 'idx_poll_federation');
            if (fedIdx) {
                await queryRunner.dropIndex('polls', 'idx_poll_federation');
            }
            if (pollsTable.columns.some(c => c.name === 'federationId')) {
                await queryRunner.dropColumn('polls', 'federationId');
            }
        }
    }
}
exports.CreateFederationTeamsAndExtendPolls1816000000000 = CreateFederationTeamsAndExtendPolls1816000000000;
//# sourceMappingURL=1816000000000-CreateFederationTeamsAndExtendPolls.js.map