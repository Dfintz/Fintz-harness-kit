"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTrustedDevicesTable1761500000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateTrustedDevicesTable1761500000000 {
    name = 'CreateTrustedDevicesTable1761500000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('trusted_devices');
        if (existingTable) {
            logger_1.logger.warn('trusted_devices table already exists, skipping creation');
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
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
        }), true);
        await queryRunner.createIndex('trusted_devices', new typeorm_1.TableIndex({
            name: 'IDX_trusted_devices_userId',
            columnNames: ['userId'],
        }));
        await queryRunner.createIndex('trusted_devices', new typeorm_1.TableIndex({
            name: 'IDX_trusted_devices_fingerprint',
            columnNames: ['deviceFingerprint'],
        }));
        await queryRunner.createIndex('trusted_devices', new typeorm_1.TableIndex({
            name: 'IDX_trusted_devices_userId_fingerprint',
            columnNames: ['userId', 'deviceFingerprint'],
        }));
        await queryRunner.createForeignKey('trusted_devices', new typeorm_1.TableForeignKey({
            columnNames: ['userId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'CASCADE',
            name: 'FK_trusted_devices_userId',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropForeignKey('trusted_devices', 'FK_trusted_devices_userId');
        await queryRunner.dropIndex('trusted_devices', 'IDX_trusted_devices_userId_fingerprint');
        await queryRunner.dropIndex('trusted_devices', 'IDX_trusted_devices_fingerprint');
        await queryRunner.dropIndex('trusted_devices', 'IDX_trusted_devices_userId');
        await queryRunner.dropTable('trusted_devices');
    }
}
exports.CreateTrustedDevicesTable1761500000000 = CreateTrustedDevicesTable1761500000000;
//# sourceMappingURL=1761500000000-CreateTrustedDevicesTable.js.map