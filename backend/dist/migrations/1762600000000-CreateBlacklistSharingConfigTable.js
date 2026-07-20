"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBlacklistSharingConfigTable1762600000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateBlacklistSharingConfigTable1762600000000 {
    name = 'CreateBlacklistSharingConfigTable1762600000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('blacklist_sharing_config');
        if (existingTable) {
            logger_1.logger.warn('blacklist_sharing_config table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'blacklist_sharing_config',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'organizationId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'shareWarnings',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'shareTimeouts',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'shareKicks',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'shareBans',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'receiveAlerts',
                    type: 'boolean',
                    default: true,
                },
                {
                    name: 'minAlertSeverity',
                    type: 'integer',
                    default: 2,
                    comment: '1=Warning, 2=Timeout, 3=LongTimeout, 4=Kick, 5=Ban',
                },
                {
                    name: 'alertChannelId',
                    type: 'varchar',
                    length: '20',
                    isNullable: true,
                },
                {
                    name: 'autoShareWithAllies',
                    type: 'boolean',
                    default: false,
                },
                {
                    name: 'autoShareMinSeverity',
                    type: 'integer',
                    default: 3,
                },
                {
                    name: 'sharedWithOrgs',
                    type: 'text[]',
                    isNullable: true,
                    default: "'{}'",
                },
                {
                    name: 'deletedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'deletedBy',
                    type: 'varchar',
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
                },
            ],
        }), true);
        await queryRunner.createIndex('blacklist_sharing_config', new typeorm_1.TableIndex({
            name: 'IDX_blacklist_sharing_config_organizationId',
            columnNames: ['organizationId'],
            isUnique: true,
        }));
        await queryRunner.createForeignKey('blacklist_sharing_config', new typeorm_1.TableForeignKey({
            columnNames: ['organizationId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organizations',
            onDelete: 'CASCADE',
            name: 'FK_blacklist_sharing_config_organizationId',
        }));
        await queryRunner.query(`
            ALTER TABLE blacklist_sharing_config 
            ADD CONSTRAINT CHK_blacklist_sharing_config_minAlertSeverity 
            CHECK ("minAlertSeverity" >= 1 AND "minAlertSeverity" <= 5)
        `);
        await queryRunner.query(`
            ALTER TABLE blacklist_sharing_config 
            ADD CONSTRAINT CHK_blacklist_sharing_config_autoShareMinSeverity 
            CHECK ("autoShareMinSeverity" >= 1 AND "autoShareMinSeverity" <= 5)
        `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE blacklist_sharing_config DROP CONSTRAINT IF EXISTS CHK_blacklist_sharing_config_autoShareMinSeverity
        `);
        await queryRunner.query(`
            ALTER TABLE blacklist_sharing_config DROP CONSTRAINT IF EXISTS CHK_blacklist_sharing_config_minAlertSeverity
        `);
        await queryRunner.dropForeignKey('blacklist_sharing_config', 'FK_blacklist_sharing_config_organizationId');
        await queryRunner.dropIndex('blacklist_sharing_config', 'IDX_blacklist_sharing_config_organizationId');
        await queryRunner.dropTable('blacklist_sharing_config');
    }
}
exports.CreateBlacklistSharingConfigTable1762600000000 = CreateBlacklistSharingConfigTable1762600000000;
//# sourceMappingURL=1762600000000-CreateBlacklistSharingConfigTable.js.map