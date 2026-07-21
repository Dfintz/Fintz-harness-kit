import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

export class CreateOrganizationRelationshipsTable1733275200000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if organization_relationships table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('organization_relationships');
        if (existingTable) {
            logger.warn('organization_relationships table already exists, skipping creation');
            return;
        }

        // Check if table already exists
        const tableExists = await queryRunner.hasTable('organization_relationships');
        if (tableExists) {
            logger.info('Table organization_relationships already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'organization_relationships',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'uuid'
                    },
                    {
                        name: 'organizationId',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'targetOrganizationId',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'type',
                        type: 'varchar',
                        default: "'neutral'"
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        default: "'active'"
                    },
                    {
                        name: 'trustScore',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        default: 50.00
                    },
                    {
                        name: 'relationshipStrength',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        default: 50.00
                    },
                    {
                        name: 'interactionCount',
                        type: 'int',
                        default: 0
                    },
                    {
                        name: 'positiveInteractions',
                        type: 'int',
                        default: 0
                    },
                    {
                        name: 'negativeInteractions',
                        type: 'int',
                        default: 0
                    },
                    {
                        name: 'description',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'notes',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'tags',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'metadata',
                        type: 'json',
                        isNullable: true
                    },
                    {
                        name: 'primaryContact',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'contactName',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'contactRole',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'contactEmail',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'communicationChannels',
                        type: 'text',
                        isNullable: true
                    },
                    {
                        name: 'establishedBy',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'lastModifiedBy',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'establishedDate',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'lastInteractionDate',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'reviewDate',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'expiryDate',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'isMutual',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'isMutuallyRecognized',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'reciprocalRelationshipId',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'isPublic',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'requiresApproval',
                        type: 'boolean',
                        default: false
                    },
                    {
                        name: 'autoRenew',
                        type: 'boolean',
                        default: false
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
            'organization_relationships',
            new TableIndex({
                name: 'IDX_org_target_unique',
                columnNames: ['organizationId', 'targetOrganizationId'],
                isUnique: true
            })
        );

        await queryRunner.createIndex(
            'organization_relationships',
            new TableIndex({
                name: 'IDX_relationship_type',
                columnNames: ['type']
            })
        );

        await queryRunner.createIndex(
            'organization_relationships',
            new TableIndex({
                name: 'IDX_relationship_status',
                columnNames: ['status']
            })
        );

        await queryRunner.createIndex(
            'organization_relationships',
            new TableIndex({
                name: 'IDX_relationship_trust_score',
                columnNames: ['trustScore']
            })
        );

        await queryRunner.createIndex(
            'organization_relationships',
            new TableIndex({
                name: 'IDX_relationship_org_id',
                columnNames: ['organizationId']
            })
        );

        await queryRunner.createIndex(
            'organization_relationships',
            new TableIndex({
                name: 'IDX_relationship_target_org_id',
                columnNames: ['targetOrganizationId']
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('organization_relationships', true);
    }
}
