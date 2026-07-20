"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFederationIntelEntries1817000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateFederationIntelEntries1817000000000 {
    name = 'CreateFederationIntelEntries1817000000000';
    async up(queryRunner) {
        const table = await queryRunner.getTable('federation_intel_entries');
        if (!table) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'federation_intel_entries',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'federationId', type: 'uuid', isNullable: false },
                    { name: 'title', type: 'varchar', length: '200', isNullable: false },
                    { name: 'content', type: 'text', isNullable: false },
                    {
                        name: 'classification',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                        default: "'open'",
                    },
                    {
                        name: 'status',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                        default: "'draft'",
                    },
                    { name: 'submittedBy', type: 'varchar', isNullable: false },
                    { name: 'submittedByName', type: 'varchar', length: '200', isNullable: true },
                    { name: 'submittedByOrgId', type: 'varchar', isNullable: true },
                    { name: 'approvedBy', type: 'varchar', isNullable: true },
                    { name: 'tags', type: 'jsonb', isNullable: false, default: "'[]'" },
                    { name: 'visibleToTreaties', type: 'jsonb', isNullable: false, default: "'[]'" },
                    { name: 'createdAt', type: 'timestamptz', isNullable: false, default: 'now()' },
                    { name: 'updatedAt', type: 'timestamptz', isNullable: false, default: 'now()' },
                ],
            }), true);
            await queryRunner.createForeignKey('federation_intel_entries', new typeorm_1.TableForeignKey({
                name: 'FK_fed_intel_federation',
                columnNames: ['federationId'],
                referencedTableName: 'federations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
            await queryRunner.createIndex('federation_intel_entries', new typeorm_1.TableIndex({ name: 'idx_fed_intel_federation', columnNames: ['federationId'] }));
            await queryRunner.createIndex('federation_intel_entries', new typeorm_1.TableIndex({ name: 'idx_fed_intel_status', columnNames: ['federationId', 'status'] }));
            await queryRunner.createIndex('federation_intel_entries', new typeorm_1.TableIndex({
                name: 'idx_fed_intel_classification',
                columnNames: ['federationId', 'classification'],
            }));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('federation_intel_entries');
        if (table) {
            await queryRunner.dropTable('federation_intel_entries');
        }
    }
}
exports.CreateFederationIntelEntries1817000000000 = CreateFederationIntelEntries1817000000000;
//# sourceMappingURL=1817000000000-CreateFederationIntelEntries.js.map