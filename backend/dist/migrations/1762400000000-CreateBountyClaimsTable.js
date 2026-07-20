"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBountyClaimsTable1762400000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateBountyClaimsTable1762400000000 {
    name = 'CreateBountyClaimsTable1762400000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('bounty_claims');
        if (existingTable) {
            logger_1.logger.warn('bounty_claims table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'bounty_claims',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'bountyId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'hunterId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'hunterName',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'organizationId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '20',
                    default: "'active'",
                    comment: 'active, submitted, completed, abandoned, rejected',
                },
                {
                    name: 'notes',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'claimedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'submittedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'completedAt',
                    type: 'timestamp',
                    isNullable: true,
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
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'bounty_evidence',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'claimId',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'evidenceType',
                    type: 'varchar',
                    length: '20',
                    isNullable: false,
                    comment: 'screenshot, video, text, link, file',
                },
                {
                    name: 'content',
                    type: 'text',
                    isNullable: true,
                    comment: 'Text content or description',
                },
                {
                    name: 'fileUrl',
                    type: 'varchar',
                    length: '500',
                    isNullable: true,
                },
                {
                    name: 'fileName',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'fileSize',
                    type: 'integer',
                    isNullable: true,
                },
                {
                    name: 'mimeType',
                    type: 'varchar',
                    length: '100',
                    isNullable: true,
                },
                {
                    name: 'submittedBy',
                    type: 'uuid',
                    isNullable: false,
                },
                {
                    name: 'submittedAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'createdAt',
                    type: 'timestamp',
                    default: 'CURRENT_TIMESTAMP',
                },
            ],
        }), true);
        await queryRunner.createIndex('bounty_claims', new typeorm_1.TableIndex({
            name: 'IDX_bounty_claims_bountyId',
            columnNames: ['bountyId'],
        }));
        await queryRunner.createIndex('bounty_claims', new typeorm_1.TableIndex({
            name: 'IDX_bounty_claims_hunterId',
            columnNames: ['hunterId'],
        }));
        await queryRunner.createIndex('bounty_claims', new typeorm_1.TableIndex({
            name: 'IDX_bounty_claims_organizationId',
            columnNames: ['organizationId'],
        }));
        await queryRunner.createIndex('bounty_claims', new typeorm_1.TableIndex({
            name: 'IDX_bounty_claims_status',
            columnNames: ['status'],
        }));
        await queryRunner.createIndex('bounty_claims', new typeorm_1.TableIndex({
            name: 'IDX_bounty_claims_hunterId_status',
            columnNames: ['hunterId', 'status'],
        }));
        await queryRunner.createIndex('bounty_evidence', new typeorm_1.TableIndex({
            name: 'IDX_bounty_evidence_claimId',
            columnNames: ['claimId'],
        }));
        await queryRunner.createForeignKey('bounty_claims', new typeorm_1.TableForeignKey({
            columnNames: ['bountyId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'bounties',
            onDelete: 'CASCADE',
            name: 'FK_bounty_claims_bountyId',
        }));
        await queryRunner.createForeignKey('bounty_claims', new typeorm_1.TableForeignKey({
            columnNames: ['organizationId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organizations',
            onDelete: 'CASCADE',
            name: 'FK_bounty_claims_organizationId',
        }));
        await queryRunner.createForeignKey('bounty_evidence', new typeorm_1.TableForeignKey({
            columnNames: ['claimId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'bounty_claims',
            onDelete: 'CASCADE',
            name: 'FK_bounty_evidence_claimId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('bounty_evidence', 'FK_bounty_evidence_claimId');
        await queryRunner.dropForeignKey('bounty_claims', 'FK_bounty_claims_organizationId');
        await queryRunner.dropForeignKey('bounty_claims', 'FK_bounty_claims_bountyId');
        await queryRunner.dropIndex('bounty_evidence', 'IDX_bounty_evidence_claimId');
        await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_hunterId_status');
        await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_status');
        await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_organizationId');
        await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_hunterId');
        await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_bountyId');
        await queryRunner.dropTable('bounty_evidence');
        await queryRunner.dropTable('bounty_claims');
    }
}
exports.CreateBountyClaimsTable1762400000000 = CreateBountyClaimsTable1762400000000;
//# sourceMappingURL=1762400000000-CreateBountyClaimsTable.js.map