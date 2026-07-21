import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Create Trusted Devices Table
 * 
 * Creates the trusted_devices table for persisting device fingerprints
 * and trust levels for Zero Trust security implementation.
 * 
 * This migration moves trusted device storage from in-memory Map
 * to database for persistence across server restarts.
 */
export class CreateTrustedDevicesTable1761500000000 implements MigrationInterface {
    name = 'CreateTrustedDevicesTable1761500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if trusted_devices table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('trusted_devices');
        if (existingTable) {
            logger.warn('trusted_devices table already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'trusted_devices',
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
                        name: 'deviceFingerprint',
                        type: 'varchar',
                        length: '64',
                        isNullable: false,
                    },
                    {
                        name: 'deviceName',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'userAgent',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'ipAddress',
                        type: 'varchar',
                        length: '45',
                        isNullable: true,
                    },
                    {
                        name: 'location',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                    },
                    {
                        name: 'lastUsed',
                        type: 'timestamp',
                        isNullable: false,
                        default: 'CURRENT_TIMESTAMP',
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true,
                    },
                    {
                        name: 'trustLevel',
                        type: 'varchar',
                        length: '20',
                        default: "'medium'",
                    },
                    {
                        name: 'verificationMethod',
                        type: 'varchar',
                        length: '20',
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
                        onUpdate: 'CURRENT_TIMESTAMP',
                    },
                ],
            }),
            true,
        );

        // Create indexes for efficient lookups
        await queryRunner.createIndex(
            'trusted_devices',
            new TableIndex({
                name: 'IDX_trusted_devices_userId',
                columnNames: ['userId'],
            }),
        );

        await queryRunner.createIndex(
            'trusted_devices',
            new TableIndex({
                name: 'IDX_trusted_devices_fingerprint',
                columnNames: ['deviceFingerprint'],
            }),
        );

        await queryRunner.createIndex(
            'trusted_devices',
            new TableIndex({
                name: 'IDX_trusted_devices_userId_fingerprint',
                columnNames: ['userId', 'deviceFingerprint'],
            }),
        );

        // Add foreign key to users table
        await queryRunner.createForeignKey(
            'trusted_devices',
            new TableForeignKey({
                columnNames: ['userId'],
                referencedColumnNames: ['id'],
                referencedTableName: 'users',
                onDelete: 'CASCADE',
                name: 'FK_trusted_devices_userId',
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key first
        await queryRunner.dropForeignKey('trusted_devices', 'FK_trusted_devices_userId');

        // Drop indexes
        await queryRunner.dropIndex('trusted_devices', 'IDX_trusted_devices_userId_fingerprint');
        await queryRunner.dropIndex('trusted_devices', 'IDX_trusted_devices_fingerprint');
        await queryRunner.dropIndex('trusted_devices', 'IDX_trusted_devices_userId');

        // Drop table
        await queryRunner.dropTable('trusted_devices');
    }
}
