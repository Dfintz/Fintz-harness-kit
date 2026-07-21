import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Bounty Claims and Evidence Tables
 *
 * Phase 2: Claiming & Submission Workflow
 * Creates tables to track bounty claims and evidence submissions.
 */
export class CreateBountyClaimsTable1762400000000 implements MigrationInterface {
  name = 'CreateBountyClaimsTable1762400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if bounty_claims table already exists (may be in complete schema)
    const existingTable = await queryRunner.getTable('bounty_claims');
    if (existingTable) {
      logger.warn('bounty_claims table already exists, skipping creation');
      return;
    }

    // Create bounty_claims table
    await queryRunner.createTable(
      new Table({
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
      }),
      true
    );

    // Create bounty_evidence table
    await queryRunner.createTable(
      new Table({
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
      }),
      true
    );

    // Create indexes for bounty_claims
    await queryRunner.createIndex(
      'bounty_claims',
      new TableIndex({
        name: 'IDX_bounty_claims_bountyId',
        columnNames: ['bountyId'],
      })
    );

    await queryRunner.createIndex(
      'bounty_claims',
      new TableIndex({
        name: 'IDX_bounty_claims_hunterId',
        columnNames: ['hunterId'],
      })
    );

    await queryRunner.createIndex(
      'bounty_claims',
      new TableIndex({
        name: 'IDX_bounty_claims_organizationId',
        columnNames: ['organizationId'],
      })
    );

    await queryRunner.createIndex(
      'bounty_claims',
      new TableIndex({
        name: 'IDX_bounty_claims_status',
        columnNames: ['status'],
      })
    );

    await queryRunner.createIndex(
      'bounty_claims',
      new TableIndex({
        name: 'IDX_bounty_claims_hunterId_status',
        columnNames: ['hunterId', 'status'],
      })
    );

    // Create indexes for bounty_evidence
    await queryRunner.createIndex(
      'bounty_evidence',
      new TableIndex({
        name: 'IDX_bounty_evidence_claimId',
        columnNames: ['claimId'],
      })
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'bounty_claims',
      new TableForeignKey({
        columnNames: ['bountyId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'bounties',
        onDelete: 'CASCADE',
        name: 'FK_bounty_claims_bountyId',
      })
    );

    await queryRunner.createForeignKey(
      'bounty_claims',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'organizations',
        onDelete: 'CASCADE',
        name: 'FK_bounty_claims_organizationId',
      })
    );

    await queryRunner.createForeignKey(
      'bounty_evidence',
      new TableForeignKey({
        columnNames: ['claimId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'bounty_claims',
        onDelete: 'CASCADE',
        name: 'FK_bounty_evidence_claimId',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('bounty_evidence', 'FK_bounty_evidence_claimId');
    await queryRunner.dropForeignKey('bounty_claims', 'FK_bounty_claims_organizationId');
    await queryRunner.dropForeignKey('bounty_claims', 'FK_bounty_claims_bountyId');

    // Drop indexes for bounty_evidence
    await queryRunner.dropIndex('bounty_evidence', 'IDX_bounty_evidence_claimId');

    // Drop indexes for bounty_claims
    await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_hunterId_status');
    await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_status');
    await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_organizationId');
    await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_hunterId');
    await queryRunner.dropIndex('bounty_claims', 'IDX_bounty_claims_bountyId');

    // Drop tables
    await queryRunner.dropTable('bounty_evidence');
    await queryRunner.dropTable('bounty_claims');
  }
}
