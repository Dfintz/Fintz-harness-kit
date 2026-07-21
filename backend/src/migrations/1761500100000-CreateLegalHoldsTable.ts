import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Legal Holds Table
 * 
 * Creates the legal_holds table for tracking legal holds on user accounts
 * that prevent GDPR deletion.
 */
export class CreateLegalHoldsTable1761500100000 implements MigrationInterface {
    name = 'CreateLegalHoldsTable1761500100000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if legal_holds table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('legal_holds');
        if (existingTable) {
            logger.warn('legal_holds table already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'legal_holds',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                    },
                    {
                        name: 'userId',
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'reason',
                        type: 'text',
                        isNullable: false,
                    },
                    {
                        name: 'holdUntil',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'createdBy',
                        type: 'varchar',
                        isNullable: true,
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true,
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
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Create index on userId for efficient lookups
        await queryRunner.createIndex(
            'legal_holds',
            new TableIndex({
                name: 'IDX_legal_holds_userId',
                columnNames: ['userId'],
            }),
        );

        // Add foreign key to users table
        await queryRunner.createForeignKey(
            'legal_holds',
            new TableForeignKey({
                columnNames: ['userId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'CASCADE',
                name: 'FK_legal_holds_userId',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropForeignKey('legal_holds', 'FK_legal_holds_userId');
        await queryRunner.dropIndex('legal_holds', 'IDX_legal_holds_userId');
        await queryRunner.dropTable('legal_holds');
    }
}
