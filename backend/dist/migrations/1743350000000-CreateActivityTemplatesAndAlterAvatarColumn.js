"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateActivityTemplatesAndAlterAvatarColumn1743350000000 = void 0;
const typeorm_1 = require("typeorm");
class CreateActivityTemplatesAndAlterAvatarColumn1743350000000 {
    async up(queryRunner) {
        const usersTable = await queryRunner.getTable('users');
        if (usersTable) {
            const avatarColumn = usersTable.findColumnByName('avatar');
            if (avatarColumn && avatarColumn.type !== 'text') {
                await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "avatar" TYPE text`);
            }
        }
        const templateTable = await queryRunner.getTable('activity_templates');
        if (!templateTable) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'activity_templates',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'organizationId', type: 'uuid', isNullable: false },
                    { name: 'name', type: 'varchar', length: '150', isNullable: false },
                    { name: 'description', type: 'text', isNullable: true },
                    {
                        name: 'activityType',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                    },
                    {
                        name: 'category',
                        type: 'varchar',
                        length: '50',
                        default: "'custom'",
                        isNullable: false,
                    },
                    { name: 'templateData', type: 'jsonb', default: "'{}'" },
                    { name: 'isPublic', type: 'boolean', default: false },
                    { name: 'isActive', type: 'boolean', default: true },
                    { name: 'usageCount', type: 'integer', default: 0 },
                    { name: 'tags', type: 'text', isNullable: true },
                    { name: 'createdBy', type: 'uuid', isNullable: false },
                    { name: 'createdByName', type: 'varchar', length: '255', isNullable: true },
                    { name: 'sharedWithOrgs', type: 'text', isNullable: true, default: "''" },
                    { name: 'deletedAt', type: 'timestamp', isNullable: true },
                    { name: 'deletedBy', type: 'varchar', length: '255', isNullable: true },
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
            await queryRunner.createIndices('activity_templates', [
                new typeorm_1.TableIndex({
                    name: 'IDX_activity_templates_org_category',
                    columnNames: ['organizationId', 'category'],
                }),
                new typeorm_1.TableIndex({
                    name: 'IDX_activity_templates_org_createdBy',
                    columnNames: ['organizationId', 'createdBy'],
                }),
                new typeorm_1.TableIndex({
                    name: 'IDX_activity_templates_public_active',
                    columnNames: ['isPublic', 'isActive'],
                }),
            ]);
        }
        const existingTable = await queryRunner.getTable('activity_templates');
        if (existingTable && !existingTable.findColumnByName('sharedWithOrgs')) {
            await queryRunner.query(`ALTER TABLE "activity_templates" ADD COLUMN "sharedWithOrgs" text DEFAULT ''`);
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('activity_templates', true);
        const usersTable = await queryRunner.getTable('users');
        if (usersTable) {
            await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "avatar" TYPE varchar(255)`);
        }
    }
}
exports.CreateActivityTemplatesAndAlterAvatarColumn1743350000000 = CreateActivityTemplatesAndAlterAvatarColumn1743350000000;
//# sourceMappingURL=1743350000000-CreateActivityTemplatesAndAlterAvatarColumn.js.map