"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUserAvailability1778000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateUserAvailability1778000000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('user_availability');
        if (table) {
            return;
        }
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'user_availability',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'userId', type: 'varchar', isNullable: false },
                { name: 'organizationId', type: 'varchar', isNullable: false },
                { name: 'dayOfWeek', type: 'int', isNullable: false },
                { name: 'startMinute', type: 'int', isNullable: false },
                { name: 'endMinute', type: 'int', isNullable: false },
                { name: 'isRecurring', type: 'boolean', default: true },
                { name: 'effectiveDate', type: 'date', isNullable: true },
                { name: 'expiresAt', type: 'date', isNullable: true },
                { name: 'createdAt', type: 'timestamptz', default: 'now()' },
                { name: 'updatedAt', type: 'timestamptz', default: 'now()' },
            ],
        }), true);
        await queryRunner.createIndex('user_availability', new typeorm_1.TableIndex({
            name: 'idx_avail_user_org',
            columnNames: ['userId', 'organizationId'],
        }));
        await queryRunner.createIndex('user_availability', new typeorm_1.TableIndex({
            name: 'idx_avail_org_day',
            columnNames: ['organizationId', 'dayOfWeek'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('user_availability', true);
    }
}
exports.CreateUserAvailability1778000000000 = CreateUserAvailability1778000000000;
//# sourceMappingURL=1778000000000-CreateUserAvailability.js.map