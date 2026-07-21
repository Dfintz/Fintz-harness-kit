import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Password History Table
 * 
 * Creates the password_history table for storing hashed previous passwords
 * to prevent password reuse.
 * 
 * Security Features:
 * - Stores only bcrypt hashed passwords (never plaintext)
 * - Indexed by userId and createdAt for efficient lookups
 * - Cascade delete when user is removed
 * - Supports configurable history depth (recommend 12 passwords)
 * 
 * Related Issue: [Security] Implement password history check in AccountSecurityService
 */
export class CreatePasswordHistoryTable1733247000000 implements MigrationInterface {
    name = 'CreatePasswordHistoryTable1733247000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if password_history table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('password_history');
        if (existingTable) {
            logger.warn('password_history table already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'password_history',
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
                        type: 'varchar',
                        isNullable: false,
                    },
                    {
                        name: 'passwordHash',
                        type: 'text',
                        isNullable: false,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Create indexes for efficient lookups
        await queryRunner.createIndex(
            'password_history',
            new TableIndex({
                name: 'IDX_password_history_userId',
                columnNames: ['userId'],
            }),
        );

        await queryRunner.createIndex(
            'password_history',
            new TableIndex({
                name: 'IDX_password_history_userId_createdAt',
                columnNames: ['userId', 'createdAt'],
            }),
        );

        // Add foreign key to users table
        await queryRunner.createForeignKey(
            'password_history',
            new TableForeignKey({
                columnNames: ['userId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'CASCADE',
                name: 'FK_password_history_userId',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key first
        await queryRunner.dropForeignKey('password_history', 'FK_password_history_userId');

        // Drop indexes
        await queryRunner.dropIndex('password_history', 'IDX_password_history_userId_createdAt');
        await queryRunner.dropIndex('password_history', 'IDX_password_history_userId');

        // Drop table
        await queryRunner.dropTable('password_history');
    }
}
