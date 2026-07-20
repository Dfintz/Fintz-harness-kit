"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTeamsAndTeamMembers1779000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateTeamsAndTeamMembers1779000000000 {
    async up(queryRunner) {
        const teamsTable = await queryRunner.getTable('teams');
        if (!teamsTable) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'teams',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'organizationId', type: 'varchar', isNullable: false },
                    { name: 'name', type: 'varchar', length: '100', isNullable: false },
                    { name: 'description', type: 'text', isNullable: true },
                    { name: 'type', type: 'varchar', length: '20', default: "'squad'" },
                    { name: 'parentTeamId', type: 'uuid', isNullable: true },
                    { name: 'level', type: 'int', default: 0 },
                    { name: 'sortOrder', type: 'int', default: 0 },
                    { name: 'maxMembers', type: 'int', default: 20 },
                    { name: 'isActive', type: 'boolean', default: true },
                    { name: 'sharedWithOrgs', type: 'text', isNullable: true, default: "''" },
                    { name: 'deletedAt', type: 'timestamptz', isNullable: true },
                    { name: 'deletedBy', type: 'varchar', isNullable: true },
                    { name: 'createdAt', type: 'timestamptz', default: 'now()' },
                    { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
                ],
            }), true);
            await queryRunner.createForeignKey('teams', new typeorm_1.TableForeignKey({
                name: 'FK_team_parent',
                columnNames: ['parentTeamId'],
                referencedTableName: 'teams',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }));
            await queryRunner.createIndex('teams', new typeorm_1.TableIndex({
                name: 'idx_team_org_parent',
                columnNames: ['organizationId', 'parentTeamId'],
            }));
            await queryRunner.createIndex('teams', new typeorm_1.TableIndex({
                name: 'idx_team_org_name',
                columnNames: ['organizationId', 'name'],
                isUnique: true,
            }));
            await queryRunner.createIndex('teams', new typeorm_1.TableIndex({
                name: 'idx_team_org_id',
                columnNames: ['organizationId'],
            }));
        }
        const membersTable = await queryRunner.getTable('team_members');
        if (!membersTable) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'team_members',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'organizationId', type: 'varchar', isNullable: false },
                    { name: 'teamId', type: 'uuid', isNullable: false },
                    { name: 'userId', type: 'varchar', isNullable: false },
                    { name: 'role', type: 'varchar', length: '20', default: "'member'" },
                    { name: 'status', type: 'varchar', length: '20', default: "'active'" },
                    { name: 'joinedAt', type: 'timestamptz', isNullable: true },
                    { name: 'leftAt', type: 'timestamptz', isNullable: true },
                    { name: 'sharedWithOrgs', type: 'text', isNullable: true, default: "''" },
                    { name: 'deletedAt', type: 'timestamptz', isNullable: true },
                    { name: 'deletedBy', type: 'varchar', isNullable: true },
                    { name: 'createdAt', type: 'timestamptz', default: 'now()' },
                    { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
                ],
            }), true);
            await queryRunner.createForeignKey('team_members', new typeorm_1.TableForeignKey({
                name: 'FK_tm_team',
                columnNames: ['teamId'],
                referencedTableName: 'teams',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
            await queryRunner.createIndex('team_members', new typeorm_1.TableIndex({
                name: 'idx_tm_org_team',
                columnNames: ['organizationId', 'teamId'],
            }));
            await queryRunner.createIndex('team_members', new typeorm_1.TableIndex({
                name: 'idx_tm_org_user',
                columnNames: ['organizationId', 'userId'],
            }));
            await queryRunner.createIndex('team_members', new typeorm_1.TableIndex({
                name: 'idx_tm_user_team',
                columnNames: ['userId', 'teamId'],
                isUnique: true,
            }));
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('team_members', true);
        await queryRunner.dropTable('teams', true);
    }
}
exports.CreateTeamsAndTeamMembers1779000000000 = CreateTeamsAndTeamMembers1779000000000;
//# sourceMappingURL=1779000000000-CreateTeamsAndTeamMembers.js.map