"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSCStatsCsvImports1785000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateSCStatsCsvImports1785000000000 {
    name = 'CreateSCStatsCsvImports1785000000000';
    async up(queryRunner) {
        const existing = await queryRunner.getTable('scstats_csv_imports');
        if (existing) {
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'scstats_csv_imports',
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
                    length: '255',
                    isNullable: false,
                },
                {
                    name: 'playtimeData',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'loadoutTopData',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'loadoutDetailData',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'purchasesData',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'shipsData',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'playtimeImportedAt',
                    type: 'timestamptz',
                    isNullable: true,
                },
                {
                    name: 'loadoutImportedAt',
                    type: 'timestamptz',
                    isNullable: true,
                },
                {
                    name: 'purchasesImportedAt',
                    type: 'timestamptz',
                    isNullable: true,
                },
                {
                    name: 'shipsImportedAt',
                    type: 'timestamptz',
                    isNullable: true,
                },
                {
                    name: 'summary',
                    type: 'jsonb',
                    isNullable: true,
                },
                {
                    name: 'consentGranted',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'consentDate',
                    type: 'timestamptz',
                    isNullable: true,
                },
                {
                    name: 'createdAt',
                    type: 'timestamptz',
                    default: 'now()',
                },
                {
                    name: 'updatedAt',
                    type: 'timestamptz',
                    default: 'now()',
                },
            ],
        }), true);
        await queryRunner.createIndex('scstats_csv_imports', new typeorm_1.TableIndex({
            name: 'IDX_scstats_csv_imports_userId',
            columnNames: ['userId'],
            isUnique: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('scstats_csv_imports', true);
    }
}
exports.CreateSCStatsCsvImports1785000000000 = CreateSCStatsCsvImports1785000000000;
//# sourceMappingURL=1785000000000-CreateSCStatsCsvImports.js.map