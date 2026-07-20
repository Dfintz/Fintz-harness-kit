"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddMessageEncryptionAndVisibility1773000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddMessageEncryptionAndVisibility1773000000000 {
    name = 'AddMessageEncryptionAndVisibility1773000000000';
    async resolveColumnName(queryRunner, tableName, preferredName) {
        const rows = await queryRunner.query(`SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`, [tableName, preferredName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        const visibilityColumn = await this.resolveColumnName(queryRunner, 'contact_requests', 'visibility');
        const visibleToRolesColumn = await this.resolveColumnName(queryRunner, 'contact_requests', 'visibleToRoles');
        if (visibilityColumn && visibleToRolesColumn) {
            return;
        }
        await queryRunner.changeColumn('contact_requests', 'subject', new typeorm_1.TableColumn({
            name: 'subject',
            type: 'text',
            isNullable: false,
        }));
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "contact_request_visibility_enum" AS ENUM ('all', 'leadership', 'hr', 'diplomacy', 'recruitment', 'custom');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
        await queryRunner.addColumn('contact_requests', new typeorm_1.TableColumn({
            name: 'visibility',
            type: 'enum',
            enum: ['all', 'leadership', 'hr', 'diplomacy', 'recruitment', 'custom'],
            enumName: 'contact_request_visibility_enum',
            default: `'all'`,
            isNullable: false,
        }));
        await queryRunner.addColumn('contact_requests', new typeorm_1.TableColumn({
            name: 'visibleToRoles',
            type: 'jsonb',
            isNullable: true,
        }));
        await queryRunner.createIndex('contact_requests', new typeorm_1.TableIndex({
            name: 'IDX_contact_requests_visibility',
            columnNames: ['visibility'],
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropIndex('contact_requests', 'IDX_contact_requests_visibility');
        await queryRunner.dropColumn('contact_requests', 'visibleToRoles');
        await queryRunner.dropColumn('contact_requests', 'visibility');
        await queryRunner.query(`DROP TYPE IF EXISTS "contact_request_visibility_enum"`);
        await queryRunner.changeColumn('contact_requests', 'subject', new typeorm_1.TableColumn({
            name: 'subject',
            type: 'varchar',
            length: '255',
            isNullable: false,
        }));
    }
}
exports.AddMessageEncryptionAndVisibility1773000000000 = AddMessageEncryptionAndVisibility1773000000000;
//# sourceMappingURL=1773000000000-AddMessageEncryptionAndVisibility.js.map