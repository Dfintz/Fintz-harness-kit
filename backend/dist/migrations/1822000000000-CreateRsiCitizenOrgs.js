"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRsiCitizenOrgs1822000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateRsiCitizenOrgs1822000000000 {
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'rsi_citizen_orgs',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'citizenHandle',
                    type: 'varchar',
                    length: '100',
                    isNullable: false,
                },
                {
                    name: 'organizationSid',
                    type: 'varchar',
                    length: '50',
                    isNullable: false,
                },
                {
                    name: 'organizationName',
                    type: 'varchar',
                    length: '200',
                    isNullable: false,
                },
                {
                    name: 'rank',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                },
                {
                    name: 'stars',
                    type: 'int',
                    isNullable: true,
                },
                {
                    name: 'isMain',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'isAffiliate',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'lastFetchedAt',
                    type: 'timestamp',
                    isNullable: false,
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
                },
            ],
        }), true);
        await queryRunner.createUniqueConstraint('rsi_citizen_orgs', new typeorm_1.TableUnique({
            name: 'UQ_rsi_citizen_orgs_handle_sid',
            columnNames: ['citizenHandle', 'organizationSid'],
        }));
        await queryRunner.createIndices('rsi_citizen_orgs', [
            new typeorm_1.TableIndex({
                name: 'IDX_rsi_citizen_orgs_handle',
                columnNames: ['citizenHandle'],
            }),
            new typeorm_1.TableIndex({
                name: 'IDX_rsi_citizen_orgs_org_sid',
                columnNames: ['organizationSid'],
            }),
            new typeorm_1.TableIndex({
                name: 'IDX_rsi_citizen_orgs_fetched_at',
                columnNames: ['lastFetchedAt'],
            }),
        ]);
    }
    async down(queryRunner) {
        await queryRunner.dropTable('rsi_citizen_orgs', true);
    }
}
exports.CreateRsiCitizenOrgs1822000000000 = CreateRsiCitizenOrgs1822000000000;
//# sourceMappingURL=1822000000000-CreateRsiCitizenOrgs.js.map