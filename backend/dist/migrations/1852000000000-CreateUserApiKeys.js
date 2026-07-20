"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUserApiKeys1852000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateUserApiKeys1852000000000 {
    name = 'CreateUserApiKeys1852000000000';
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'user_api_keys',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'userId', type: 'varchar', isNullable: false },
                { name: 'name', type: 'varchar', length: '100', isNullable: false },
                { name: 'prefix', type: 'varchar', length: '16', isNullable: false },
                { name: 'tokenHash', type: 'varchar', length: '64', isNullable: false },
                { name: 'scopes', type: 'text', isNullable: false },
                { name: 'expiresAt', type: 'timestamp', isNullable: true },
                { name: 'revoked', type: 'boolean', default: false },
                { name: 'revokedAt', type: 'timestamp', isNullable: true },
                { name: 'lastUsedAt', type: 'timestamp', isNullable: true },
                { name: 'lastUsedIp', type: 'text', isNullable: true },
                { name: 'createdByIp', type: 'text', isNullable: true },
                { name: 'createdAt', type: 'timestamp', default: 'now()' },
                { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            ],
        }), true);
        await queryRunner.createIndex('user_api_keys', new typeorm_1.TableIndex({ name: 'IDX_user_api_keys_user', columnNames: ['userId'] }));
        await queryRunner.createIndex('user_api_keys', new typeorm_1.TableIndex({
            name: 'IDX_user_api_keys_hash',
            columnNames: ['tokenHash'],
            isUnique: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('user_api_keys', true);
    }
}
exports.CreateUserApiKeys1852000000000 = CreateUserApiKeys1852000000000;
//# sourceMappingURL=1852000000000-CreateUserApiKeys.js.map