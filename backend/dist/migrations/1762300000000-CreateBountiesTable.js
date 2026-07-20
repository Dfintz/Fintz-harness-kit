"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBountiesTable1762300000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateBountiesTable1762300000000 {
    name = 'CreateBountiesTable1762300000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('bounties');
        if (existingTable) {
            logger_1.logger.warn('bounties table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'bounties',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'organizationId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'createdBy',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'createdByName',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'title',
                    type: 'varchar',
                    length: '200',
                    isNullable: false,
                },
                {
                    name: 'description',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'bountyType',
                    type: 'varchar',
                    length: '20',
                    isNullable: false,
                    comment: 'kill, capture, intel, transport, rescue, custom',
                },
                {
                    name: 'targetType',
                    type: 'varchar',
                    length: '20',
                    isNullable: false,
                    comment: 'player, npc, ship, location, item, other',
                },
                {
                    name: 'targetIdentifier',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'targetName',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'targetDetails',
                    type: 'jsonb',
                    isNullable: true,
                    comment: 'Additional target information',
                },
                {
                    name: 'rewardType',
                    type: 'varchar',
                    length: '20',
                    isNullable: false,
                    comment: 'credits, item, reputation, mixed, other',
                },
                {
                    name: 'rewardAmount',
                    type: 'integer',
                    isNullable: true,
                },
                {
                    name: 'rewardDescription',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '20',
                    default: "'active'",
                    comment: 'active, claimed, in_progress, completed, verified, paid, cancelled, expired',
                },
                {
                    name: 'difficulty',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                    comment: 'easy, medium, hard, expert',
                },
                {
                    name: 'location',
                    type: 'varchar',
                    length: '200',
                    isNullable: true,
                },
                {
                    name: 'systemLocation',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'claimedBy',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'claimedByName',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'claimedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'completedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'verifiedBy',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'verifiedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'paidAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'expiresAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'visibility',
                    type: 'varchar',
                    length: '20',
                    default: "'organization'",
                    comment: 'public, organization, alliance, private',
                },
                {
                    name: 'tags',
                    type: 'text[]',
                    isNullable: true,
                    default: "'{}'",
                },
                {
                    name: 'metadata',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'linkedActivityId',
                    type: 'uuid',
                    isNullable: true,
                    comment: 'Links to unified Activity model for cross-system integration',
                },
                {
                    name: 'sharedWithOrgs',
                    type: 'text[]',
                    isNullable: true,
                    default: "'{}'",
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'updatedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'deletedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'deletedBy',
                    type: 'varchar',
                    isNullable: true,
                },
            ],
        }), true);
        await queryRunner.createIndex('bounties', new typeorm_1.TableIndex({
            name: 'IDX_bounties_organizationId',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createIndex('bounties', new typeorm_1.TableIndex({
            name: 'IDX_bounties_createdBy',
            columnNames: ['createdBy'],
        }));
        await queryRunner.createIndex('bounties', new typeorm_1.TableIndex({
            name: 'IDX_bounties_status',
            columnNames: ['status'],
        }));
        await queryRunner.createIndex('bounties', new typeorm_1.TableIndex({
            name: 'IDX_bounties_bountyType',
            columnNames: ['bountyType'],
        }));
        await queryRunner.createIndex('bounties', new typeorm_1.TableIndex({
            name: 'IDX_bounties_status_bountyType',
            columnNames: ['status', 'bountyType'],
        }));
        await queryRunner.createIndex('bounties', new typeorm_1.TableIndex({
            name: 'IDX_bounties_organizationId_status',
            columnNames: ['organizationId', 'status'],
        }));
        await queryRunner.createIndex('bounties', new typeorm_1.TableIndex({
            name: 'IDX_bounties_claimedBy',
            columnNames: ['claimedBy'],
        }));
        await queryRunner.createIndex('bounties', new typeorm_1.TableIndex({
            name: 'IDX_bounties_expiresAt',
            columnNames: ['expiresAt'],
        }));
        await queryRunner.createIndex('bounties', new typeorm_1.TableIndex({
            name: 'IDX_bounties_createdAt',
            columnNames: ['createdAt'],
        }));
        await queryRunner.createForeignKey('bounties', new typeorm_1.TableForeignKey({
            columnNames: ['organizationId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organizations',
            onDelete: 'CASCADE',
            name: 'FK_bounties_organizationId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('bounties', 'FK_bounties_organizationId');
        await queryRunner.dropIndex('bounties', 'IDX_bounties_createdAt');
        await queryRunner.dropIndex('bounties', 'IDX_bounties_expiresAt');
        await queryRunner.dropIndex('bounties', 'IDX_bounties_claimedBy');
        await queryRunner.dropIndex('bounties', 'IDX_bounties_organizationId_status');
        await queryRunner.dropIndex('bounties', 'IDX_bounties_status_bountyType');
        await queryRunner.dropIndex('bounties', 'IDX_bounties_bountyType');
        await queryRunner.dropIndex('bounties', 'IDX_bounties_status');
        await queryRunner.dropIndex('bounties', 'IDX_bounties_createdBy');
        await queryRunner.dropIndex('bounties', 'IDX_bounties_organizationId');
        await queryRunner.dropTable('bounties');
    }
}
exports.CreateBountiesTable1762300000000 = CreateBountiesTable1762300000000;
//# sourceMappingURL=1762300000000-CreateBountiesTable.js.map