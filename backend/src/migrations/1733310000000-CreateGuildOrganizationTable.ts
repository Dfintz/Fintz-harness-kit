import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

export class CreateGuildOrganizationTable1733310000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if guild_organizations table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('guild_organizations');
        if (existingTable) {
            logger.warn('guild_organizations table already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'guild_organizations',
                columns: [
                    {
                        name: 'guildId',
                        type: 'varchar',
                        length: '20',
                        isPrimary: true,
                        comment: 'Discord Guild (server) ID'
                    },
                    {
                        name: 'organizationId',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                        comment: 'Organization ID that owns/manages this guild'
                    },
                    {
                        name: 'guildName',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                        comment: 'Guild name (cached for display)'
                    },
                    {
                        name: 'isPrimary',
                        type: 'boolean',
                        default: true,
                        comment: 'Whether this is the primary/main guild for the organization'
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        default: true,
                        comment: 'Whether this mapping is currently active'
                    },
                    {
                        name: 'createdBy',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                        comment: 'User ID who created this mapping'
                    },
                    {
                        name: 'metadata',
                        type: 'jsonb',
                        isNullable: true,
                        comment: 'Additional metadata (integration settings, sync config, etc.)'
                    },
                    {
                        name: 'deactivatedAt',
                        type: 'timestamp',
                        isNullable: true,
                        comment: 'When this mapping was deactivated'
                    },
                    {
                        name: 'deactivatedBy',
                        type: 'varchar',
                        length: '255',
                        isNullable: true,
                        comment: 'User ID who deactivated this mapping'
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP'
                    }
                ]
            }),
            true
        );

        // Create indexes
        await queryRunner.createIndex(
            'guild_organizations',
            new TableIndex({
                name: 'IDX_GUILD_ORG_ORGANIZATION_ID',
                columnNames: ['organizationId']
            })
        );

        await queryRunner.createIndex(
            'guild_organizations',
            new TableIndex({
                name: 'IDX_GUILD_ORG_IS_PRIMARY',
                columnNames: ['isPrimary']
            })
        );

        await queryRunner.createIndex(
            'guild_organizations',
            new TableIndex({
                name: 'IDX_GUILD_ORG_IS_ACTIVE',
                columnNames: ['isActive']
            })
        );

        // Composite index for common query pattern
        await queryRunner.createIndex(
            'guild_organizations',
            new TableIndex({
                name: 'IDX_GUILD_ORG_ORG_ACTIVE',
                columnNames: ['organizationId', 'isActive']
            })
        );

        logger.info('Created guild_organizations table with indexes');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.dropIndex('guild_organizations', 'IDX_GUILD_ORG_ORG_ACTIVE');
        await queryRunner.dropIndex('guild_organizations', 'IDX_GUILD_ORG_IS_ACTIVE');
        await queryRunner.dropIndex('guild_organizations', 'IDX_GUILD_ORG_IS_PRIMARY');
        await queryRunner.dropIndex('guild_organizations', 'IDX_GUILD_ORG_ORGANIZATION_ID');
        
        // Drop table
        await queryRunner.dropTable('guild_organizations', true);
        
        logger.info('Dropped guild_organizations table');
    }
}
