"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateFederationAmbassadors1814000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateFederationAmbassadors1814000000000 {
    name = 'CreateFederationAmbassadors1814000000000';
    async up(queryRunner) {
        const table = await queryRunner.getTable('federation_ambassadors');
        if (!table) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'federation_ambassadors',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'federationId', type: 'uuid', isNullable: false },
                    { name: 'organizationId', type: 'varchar', isNullable: false },
                    { name: 'organizationName', type: 'varchar', length: '200', isNullable: false },
                    { name: 'userId', type: 'varchar', isNullable: false },
                    { name: 'userName', type: 'varchar', length: '200', isNullable: false },
                    {
                        name: 'role',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                        default: "'representative'",
                    },
                    {
                        name: 'permissions',
                        type: 'jsonb',
                        isNullable: false,
                        default: '\'["view"]\'',
                    },
                    {
                        name: 'isActive',
                        type: 'boolean',
                        isNullable: false,
                        default: true,
                    },
                    {
                        name: 'title',
                        type: 'varchar',
                        length: '200',
                        isNullable: true,
                    },
                    {
                        name: 'appointedAt',
                        type: 'timestamptz',
                        isNullable: false,
                        default: 'now()',
                    },
                ],
            }), true);
            await queryRunner.createForeignKey('federation_ambassadors', new typeorm_1.TableForeignKey({
                name: 'FK_fed_ambassador_federation',
                columnNames: ['federationId'],
                referencedTableName: 'federations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
            await queryRunner.createIndex('federation_ambassadors', new typeorm_1.TableIndex({
                name: 'idx_fed_amb_federation',
                columnNames: ['federationId'],
            }));
            await queryRunner.createIndex('federation_ambassadors', new typeorm_1.TableIndex({
                name: 'idx_fed_amb_org',
                columnNames: ['organizationId'],
            }));
            await queryRunner.createIndex('federation_ambassadors', new typeorm_1.TableIndex({
                name: 'idx_fed_amb_user',
                columnNames: ['userId'],
            }));
            await queryRunner.createIndex('federation_ambassadors', new typeorm_1.TableIndex({
                name: 'idx_fed_amb_unique',
                columnNames: ['federationId', 'userId'],
                isUnique: true,
            }));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('federation_ambassadors');
        if (table) {
            await queryRunner.dropTable('federation_ambassadors');
        }
    }
}
exports.CreateFederationAmbassadors1814000000000 = CreateFederationAmbassadors1814000000000;
//# sourceMappingURL=1814000000000-CreateFederationAmbassadors.js.map