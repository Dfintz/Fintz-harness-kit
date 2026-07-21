import { MigrationInterface, QueryRunner, Table } from 'typeorm';

import { logger } from '../utils/logger';

export class CreateAllianceDiplomacyTable1733275300000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if alliance_diplomacy table already exists (may be in complete schema)
        const existingTable = await queryRunner.getTable('alliance_diplomacy');
        if (existingTable) {
            logger.warn('alliance_diplomacy table already exists, skipping creation');
            return;
        }

        // Check if table already exists
        const tableExists = await queryRunner.hasTable('alliance_diplomacy');
        if (tableExists) {
            logger.info('Table alliance_diplomacy already exists, skipping creation');
            return;
        }

        await queryRunner.createTable(
            new Table({
                name: 'alliance_diplomacy',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        isPrimary: true
                    },
                    {
                        name: 'orgId1',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'orgId2',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'allianceType',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        default: "'proposed'"
                    },
                    {
                        name: 'proposedBy',
                        type: 'varchar',
                        isNullable: false
                    },
                    {
                        name: 'approvedBy',
                        type: 'varchar',
                        isNullable: true
                    },
                    {
                        name: 'terms',
                        type: 'json',
                        default: "'[]'"
                    },
                    {
                        name: 'incidents',
                        type: 'json',
                        default: "'[]'"
                    },
                    {
                        name: 'startDate',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'endDate',
                        type: 'timestamp',
                        isNullable: true
                    },
                    {
                        name: 'notes',
                        type: 'text',
                        isNullable: true
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('alliance_diplomacy', true);
    }
}
