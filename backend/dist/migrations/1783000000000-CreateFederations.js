"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFederations1783000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateFederations1783000000000 {
    name = 'CreateFederations1783000000000';
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
        const federationsExists = await queryRunner.hasTable('federations');
        const membersExists = await queryRunner.hasTable('federation_members');
        const proposalsExists = await queryRunner.hasTable('federation_proposals');
        if (federationsExists && membersExists && proposalsExists) {
            const memberFederationId = await this.resolveColumnName(queryRunner, 'federation_members', 'federationId');
            const memberOrganizationId = await this.resolveColumnName(queryRunner, 'federation_members', 'organizationId');
            const proposalFederationId = await this.resolveColumnName(queryRunner, 'federation_proposals', 'federationId');
            if (memberFederationId && memberOrganizationId && proposalFederationId) {
                return;
            }
        }
        const federationsTable = await queryRunner.getTable('federations');
        if (!federationsTable) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'federations',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'name', type: 'varchar', length: '200', isNullable: false },
                    { name: 'description', type: 'text', isNullable: false },
                    { name: 'founderId', type: 'uuid', isNullable: false },
                    { name: 'founderOrgId', type: 'uuid', isNullable: false },
                    {
                        name: 'governance',
                        type: 'jsonb',
                        isNullable: false,
                        default: "'{}'",
                    },
                    {
                        name: 'sharedResources',
                        type: 'jsonb',
                        isNullable: false,
                        default: "'[]'",
                    },
                    {
                        name: 'treaties',
                        type: 'jsonb',
                        isNullable: false,
                        default: "'[]'",
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                        default: "'forming'",
                    },
                    { name: 'isPublic', type: 'boolean', isNullable: false, default: false },
                    {
                        name: 'tags',
                        type: 'jsonb',
                        isNullable: false,
                        default: "'[]'",
                    },
                    { name: 'logoUrl', type: 'varchar', length: '500', isNullable: true },
                    { name: 'bannerUrl', type: 'varchar', length: '500', isNullable: true },
                    { name: 'discordUrl', type: 'varchar', length: '500', isNullable: true },
                    { name: 'websiteUrl', type: 'varchar', length: '500', isNullable: true },
                    { name: 'createdAt', type: 'timestamptz', default: 'now()', isNullable: false },
                    { name: 'updatedAt', type: 'timestamptz', default: 'now()', isNullable: false },
                ],
            }), true);
        }
        const membersTable = await queryRunner.getTable('federation_members');
        if (!membersTable) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'federation_members',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'federationId', type: 'uuid', isNullable: false },
                    { name: 'organizationId', type: 'varchar', isNullable: false },
                    { name: 'organizationName', type: 'varchar', length: '200', isNullable: false },
                    {
                        name: 'role',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                        default: "'member'",
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                        default: "'pending'",
                    },
                    { name: 'votingPower', type: 'int', isNullable: false, default: 1 },
                    { name: 'contributions', type: 'int', isNullable: false, default: 0 },
                    { name: 'joinedAt', type: 'timestamptz', default: 'now()', isNullable: false },
                ],
            }), true);
        }
        const proposalsTable = await queryRunner.getTable('federation_proposals');
        if (!proposalsTable) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'federation_proposals',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'federationId', type: 'uuid', isNullable: false },
                    { name: 'type', type: 'varchar', length: '30', isNullable: false },
                    { name: 'title', type: 'varchar', length: '200', isNullable: false },
                    { name: 'description', type: 'text', isNullable: false },
                    { name: 'proposedBy', type: 'varchar', length: '200', isNullable: false },
                    { name: 'proposedByOrg', type: 'uuid', isNullable: false },
                    {
                        name: 'votes',
                        type: 'jsonb',
                        isNullable: false,
                        default: "'[]'",
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                        default: "'open'",
                    },
                    { name: 'requiredApproval', type: 'int', isNullable: false },
                    { name: 'metadata', type: 'jsonb', isNullable: true },
                    { name: 'votingEndsAt', type: 'timestamptz', isNullable: false },
                    { name: 'createdAt', type: 'timestamptz', default: 'now()', isNullable: false },
                ],
            }), true);
        }
        const members = await queryRunner.getTable('federation_members');
        if (members && !members.foreignKeys.find(fk => fk.name === 'FK_fed_member_federation')) {
            await queryRunner.createForeignKey('federation_members', new typeorm_1.TableForeignKey({
                name: 'FK_fed_member_federation',
                columnNames: ['federationId'],
                referencedTableName: 'federations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
        }
        const proposals = await queryRunner.getTable('federation_proposals');
        if (proposals && !proposals.foreignKeys.find(fk => fk.name === 'FK_fed_proposal_federation')) {
            await queryRunner.createForeignKey('federation_proposals', new typeorm_1.TableForeignKey({
                name: 'FK_fed_proposal_federation',
                columnNames: ['federationId'],
                referencedTableName: 'federations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
        }
        const fedTable = await queryRunner.getTable('federations');
        if (fedTable) {
            if (!fedTable.indices.find(i => i.name === 'idx_federation_founder_org')) {
                await queryRunner.createIndex('federations', new typeorm_1.TableIndex({ name: 'idx_federation_founder_org', columnNames: ['founderOrgId'] }));
            }
            if (!fedTable.indices.find(i => i.name === 'idx_federation_status')) {
                await queryRunner.createIndex('federations', new typeorm_1.TableIndex({ name: 'idx_federation_status', columnNames: ['status'] }));
            }
            if (!fedTable.indices.find(i => i.name === 'idx_federation_public_active')) {
                await queryRunner.createIndex('federations', new typeorm_1.TableIndex({
                    name: 'idx_federation_public_active',
                    columnNames: ['isPublic', 'status'],
                }));
            }
        }
        const memTable = await queryRunner.getTable('federation_members');
        if (memTable) {
            if (!memTable.indices.find(i => i.name === 'idx_fed_member_federation')) {
                await queryRunner.createIndex('federation_members', new typeorm_1.TableIndex({ name: 'idx_fed_member_federation', columnNames: ['federationId'] }));
            }
            if (!memTable.indices.find(i => i.name === 'idx_fed_member_org')) {
                await queryRunner.createIndex('federation_members', new typeorm_1.TableIndex({ name: 'idx_fed_member_org', columnNames: ['organizationId'] }));
            }
            if (!memTable.indices.find(i => i.name === 'idx_fed_member_unique')) {
                await queryRunner.createIndex('federation_members', new typeorm_1.TableIndex({
                    name: 'idx_fed_member_unique',
                    columnNames: ['federationId', 'organizationId'],
                    isUnique: true,
                }));
            }
        }
        const propTable = await queryRunner.getTable('federation_proposals');
        if (propTable) {
            if (!propTable.indices.find(i => i.name === 'idx_fed_proposal_federation')) {
                await queryRunner.createIndex('federation_proposals', new typeorm_1.TableIndex({ name: 'idx_fed_proposal_federation', columnNames: ['federationId'] }));
            }
            if (!propTable.indices.find(i => i.name === 'idx_fed_proposal_status')) {
                await queryRunner.createIndex('federation_proposals', new typeorm_1.TableIndex({ name: 'idx_fed_proposal_status', columnNames: ['status'] }));
            }
            if (!propTable.indices.find(i => i.name === 'idx_fed_proposal_federation_status')) {
                await queryRunner.createIndex('federation_proposals', new typeorm_1.TableIndex({
                    name: 'idx_fed_proposal_federation_status',
                    columnNames: ['federationId', 'status'],
                }));
            }
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('federation_proposals', true, true, true);
        await queryRunner.dropTable('federation_members', true, true, true);
        await queryRunner.dropTable('federations', true, true, true);
    }
}
exports.CreateFederations1783000000000 = CreateFederations1783000000000;
//# sourceMappingURL=1783000000000-CreateFederations.js.map