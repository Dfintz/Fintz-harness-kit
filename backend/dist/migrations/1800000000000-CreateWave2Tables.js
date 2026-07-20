"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateWave2Tables1800000000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateWave2Tables1800000000000 {
    name = 'CreateWave2Tables1800000000000';
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'dashboards',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'organizationId', type: 'uuid', isNullable: false },
                { name: 'name', type: 'varchar', length: '200', isNullable: false },
                { name: 'description', type: 'text', isNullable: true },
                { name: 'type', type: 'varchar', length: '64', isNullable: false, default: "'custom'" },
                { name: 'layout', type: 'varchar', length: '64', isNullable: false, default: "'grid'" },
                { name: 'createdBy', type: 'uuid', isNullable: false },
                { name: 'isDefault', type: 'boolean', isNullable: false, default: false },
                { name: 'sharedWithUsers', type: 'text', isNullable: true },
                { name: 'createdAt', type: 'timestamp', default: 'now()' },
                { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            ],
            foreignKeys: [
                {
                    columnNames: ['organizationId'],
                    referencedTableName: 'organizations',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
                {
                    columnNames: ['createdBy'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);
        await queryRunner.createIndex('dashboards', new typeorm_1.TableIndex({ columnNames: ['organizationId'] }));
        await queryRunner.createIndex('dashboards', new typeorm_1.TableIndex({ columnNames: ['createdBy'] }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'dashboard_widgets',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'dashboardId', type: 'uuid', isNullable: false },
                { name: 'type', type: 'varchar', length: '64', isNullable: false },
                { name: 'title', type: 'varchar', length: '200', isNullable: false },
                { name: 'config', type: 'text', isNullable: true },
                { name: 'position', type: 'text', isNullable: true },
                { name: 'sortOrder', type: 'integer', isNullable: false, default: 0 },
                { name: 'createdAt', type: 'timestamp', default: 'now()' },
                { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            ],
            foreignKeys: [
                {
                    columnNames: ['dashboardId'],
                    referencedTableName: 'dashboards',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);
        await queryRunner.createIndex('dashboard_widgets', new typeorm_1.TableIndex({ columnNames: ['dashboardId'] }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'approval_requests',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'organizationId', type: 'uuid', isNullable: false },
                { name: 'type', type: 'varchar', length: '64', isNullable: false },
                { name: 'title', type: 'varchar', length: '200', isNullable: true },
                { name: 'description', type: 'text', isNullable: true },
                { name: 'resourceId', type: 'varchar', length: '255', isNullable: true },
                { name: 'resourceType', type: 'varchar', length: '64', isNullable: true },
                { name: 'requestedBy', type: 'uuid', isNullable: false },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '32',
                    isNullable: false,
                    default: "'pending'",
                },
                { name: 'reason', type: 'text', isNullable: true },
                { name: 'assignedTo', type: 'uuid', isNullable: true },
                { name: 'delegatedTo', type: 'uuid', isNullable: true },
                { name: 'delegatedBy', type: 'uuid', isNullable: true },
                { name: 'history', type: 'jsonb', isNullable: true },
                { name: 'metadata', type: 'jsonb', isNullable: true },
                { name: 'expiresAt', type: 'timestamp', isNullable: true },
                { name: 'completedAt', type: 'timestamp', isNullable: true },
                { name: 'completedBy', type: 'uuid', isNullable: true },
                { name: 'createdAt', type: 'timestamp', default: 'now()' },
                { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            ],
            foreignKeys: [
                {
                    columnNames: ['organizationId'],
                    referencedTableName: 'organizations',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
                {
                    columnNames: ['requestedBy'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
                {
                    columnNames: ['assignedTo'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'SET NULL',
                },
            ],
        }), true);
        await queryRunner.createIndex('approval_requests', new typeorm_1.TableIndex({ columnNames: ['organizationId'] }));
        await queryRunner.createIndex('approval_requests', new typeorm_1.TableIndex({ columnNames: ['status'] }));
        await queryRunner.createIndex('approval_requests', new typeorm_1.TableIndex({ columnNames: ['assignedTo'] }));
        await queryRunner.createIndex('approval_requests', new typeorm_1.TableIndex({ columnNames: ['createdAt'] }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'equipment',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'organizationId', type: 'uuid', isNullable: false },
                { name: 'name', type: 'varchar', length: '200', isNullable: false },
                { name: 'type', type: 'varchar', length: '64', isNullable: false },
                {
                    name: 'rarity',
                    type: 'varchar',
                    length: '32',
                    isNullable: false,
                    default: "'common'",
                },
                { name: 'description', type: 'text', isNullable: true },
                { name: 'ownerId', type: 'uuid', isNullable: false },
                { name: 'shipId', type: 'uuid', isNullable: true },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '32',
                    isNullable: false,
                    default: "'available'",
                },
                { name: 'quantity', type: 'integer', isNullable: false, default: 1 },
                { name: 'metadata', type: 'text', isNullable: true },
                { name: 'createdAt', type: 'timestamp', default: 'now()' },
                { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            ],
            foreignKeys: [
                {
                    columnNames: ['organizationId'],
                    referencedTableName: 'organizations',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
                {
                    columnNames: ['ownerId'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);
        await queryRunner.createIndex('equipment', new typeorm_1.TableIndex({ columnNames: ['organizationId'] }));
        await queryRunner.createIndex('equipment', new typeorm_1.TableIndex({ columnNames: ['ownerId'] }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'achievements',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'organizationId', type: 'uuid', isNullable: false },
                { name: 'name', type: 'varchar', length: '200', isNullable: false },
                { name: 'description', type: 'text', isNullable: true },
                { name: 'category', type: 'varchar', length: '64', isNullable: true },
                {
                    name: 'rarity',
                    type: 'varchar',
                    length: '32',
                    isNullable: false,
                    default: "'common'",
                },
                { name: 'icon', type: 'varchar', length: '255', isNullable: true },
                { name: 'points', type: 'integer', isNullable: false, default: 10 },
                { name: 'criteria', type: 'text', isNullable: true },
                { name: 'createdBy', type: 'uuid', isNullable: false },
                { name: 'isActive', type: 'boolean', isNullable: false, default: true },
                { name: 'createdAt', type: 'timestamp', default: 'now()' },
                { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            ],
            foreignKeys: [
                {
                    columnNames: ['organizationId'],
                    referencedTableName: 'organizations',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);
        await queryRunner.createIndex('achievements', new typeorm_1.TableIndex({ columnNames: ['organizationId'] }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'user_achievements',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'achievementId', type: 'uuid', isNullable: false },
                { name: 'userId', type: 'uuid', isNullable: false },
                { name: 'organizationId', type: 'uuid', isNullable: false },
                { name: 'awardedBy', type: 'uuid', isNullable: false },
                { name: 'awardedAt', type: 'timestamp', default: 'now()' },
            ],
            foreignKeys: [
                {
                    columnNames: ['achievementId'],
                    referencedTableName: 'achievements',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
                {
                    columnNames: ['userId'],
                    referencedTableName: 'users',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);
        await queryRunner.createIndex('user_achievements', new typeorm_1.TableIndex({ columnNames: ['achievementId'] }));
        await queryRunner.createIndex('user_achievements', new typeorm_1.TableIndex({ columnNames: ['userId'] }));
        await queryRunner.createIndex('user_achievements', new typeorm_1.TableIndex({ columnNames: ['organizationId'] }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'workflow_definitions',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'organizationId', type: 'uuid', isNullable: false },
                { name: 'name', type: 'varchar', length: '200', isNullable: false },
                { name: 'type', type: 'varchar', length: '64', isNullable: false },
                { name: 'description', type: 'text', isNullable: true },
                { name: 'trigger', type: 'text', isNullable: true },
                { name: 'actions', type: 'text', isNullable: false },
                { name: 'enabled', type: 'boolean', isNullable: false, default: true },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '32',
                    isNullable: false,
                    default: "'active'",
                },
                { name: 'createdBy', type: 'uuid', isNullable: false },
                { name: 'createdAt', type: 'timestamp', default: 'now()' },
                { name: 'updatedAt', type: 'timestamp', default: 'now()' },
            ],
            foreignKeys: [
                {
                    columnNames: ['organizationId'],
                    referencedTableName: 'organizations',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);
        await queryRunner.createIndex('workflow_definitions', new typeorm_1.TableIndex({ columnNames: ['organizationId'] }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'workflow_executions',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                { name: 'workflowId', type: 'uuid', isNullable: false },
                { name: 'organizationId', type: 'uuid', isNullable: false },
                { name: 'executedBy', type: 'uuid', isNullable: false },
                {
                    name: 'status',
                    type: 'varchar',
                    length: '32',
                    isNullable: false,
                    default: "'pending'",
                },
                { name: 'dryRun', type: 'boolean', isNullable: false, default: false },
                { name: 'parameters', type: 'text', isNullable: true },
                { name: 'result', type: 'text', isNullable: true },
                { name: 'error', type: 'text', isNullable: true },
                { name: 'startedAt', type: 'timestamp', default: 'now()' },
                { name: 'completedAt', type: 'timestamp', isNullable: true },
            ],
            foreignKeys: [
                {
                    columnNames: ['workflowId'],
                    referencedTableName: 'workflow_definitions',
                    referencedColumnNames: ['id'],
                    onDelete: 'CASCADE',
                },
            ],
        }), true);
        await queryRunner.createIndex('workflow_executions', new typeorm_1.TableIndex({ columnNames: ['workflowId'] }));
        await queryRunner.createIndex('workflow_executions', new typeorm_1.TableIndex({ columnNames: ['organizationId'] }));
        await queryRunner.createIndex('workflow_executions', new typeorm_1.TableIndex({ columnNames: ['status'] }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('workflow_executions', true);
        await queryRunner.dropTable('workflow_definitions', true);
        await queryRunner.dropTable('user_achievements', true);
        await queryRunner.dropTable('achievements', true);
        await queryRunner.dropTable('equipment', true);
        await queryRunner.dropTable('approval_requests', true);
        await queryRunner.dropTable('dashboard_widgets', true);
        await queryRunner.dropTable('dashboards', true);
    }
}
exports.CreateWave2Tables1800000000000 = CreateWave2Tables1800000000000;
//# sourceMappingURL=1800000000000-CreateWave2Tables.js.map