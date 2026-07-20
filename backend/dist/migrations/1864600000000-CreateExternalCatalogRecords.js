"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateExternalCatalogRecords1864600000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateExternalCatalogRecords1864600000000 {
    name = 'CreateExternalCatalogRecords1864600000000';
    async up(queryRunner) {
        const existing = await queryRunner.getTable('external_catalog_records');
        if (existing) {
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'external_catalog_records',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'source',
                    type: 'varchar',
                    length: '32',
                    isNullable: false,
                },
                {
                    name: 'recordType',
                    type: 'varchar',
                    length: '32',
                    isNullable: false,
                },
                {
                    name: 'externalId',
                    type: 'varchar',
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'displayName',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'category',
                    type: 'varchar',
                    length: '255',
                    isNullable: true,
                },
                {
                    name: 'sourceVersion',
                    type: 'varchar',
                    length: '128',
                    isNullable: true,
                },
                {
                    name: 'payloadHash',
                    type: 'varchar',
                    length: '64',
                    isNullable: false,
                },
                {
                    name: 'payload',
                    type: 'jsonb',
                    isNullable: false,
                },
                {
                    name: 'isActive',
                    type: 'boolean',
                    isNullable: false,
                    default: true,
                },
                {
                    name: 'firstSeenAt',
                    type: 'timestamptz',
                    isNullable: false,
                    default: 'now()',
                },
                {
                    name: 'lastSeenAt',
                    type: 'timestamptz',
                    isNullable: false,
                    default: 'now()',
                },
                {
                    name: 'lastSyncedAt',
                    type: 'timestamptz',
                    isNullable: false,
                    default: 'now()',
                },
                {
                    name: 'createdAt',
                    type: 'timestamptz',
                    isNullable: false,
                    default: 'now()',
                },
                {
                    name: 'updatedAt',
                    type: 'timestamptz',
                    isNullable: false,
                    default: 'now()',
                },
            ],
        }), true);
        await queryRunner.createIndex('external_catalog_records', new typeorm_1.TableIndex({
            name: 'IDX_external_catalog_records_source_record_type_external_id',
            columnNames: ['source', 'recordType', 'externalId'],
            isUnique: true,
        }));
        await queryRunner.createIndex('external_catalog_records', new typeorm_1.TableIndex({
            name: 'IDX_external_catalog_records_source_record_type_active',
            columnNames: ['source', 'recordType', 'isActive'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('external_catalog_records', true);
    }
}
exports.CreateExternalCatalogRecords1864600000000 = CreateExternalCatalogRecords1864600000000;
//# sourceMappingURL=1864600000000-CreateExternalCatalogRecords.js.map