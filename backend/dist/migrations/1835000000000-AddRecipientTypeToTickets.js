"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRecipientTypeToTickets1835000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddRecipientTypeToTickets1835000000000 {
    name = 'AddRecipientTypeToTickets1835000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tickets_recipienttype_enum" AS ENUM (
          'org_leadership',
          'org_officers',
          'team_leader',
          'alliance_council',
          'hr_department',
          'recruitment',
          'diplomacy',
          'specific_user',
          'platform_admin'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
        const hasColumn = await queryRunner.hasColumn('tickets', 'recipientType');
        if (!hasColumn) {
            await queryRunner.addColumn('tickets', new typeorm_1.TableColumn({
                name: 'recipientType',
                type: 'tickets_recipienttype_enum',
                isNullable: true,
            }));
        }
    }
    async down(queryRunner) {
        const hasColumn = await queryRunner.hasColumn('tickets', 'recipientType');
        if (hasColumn) {
            await queryRunner.dropColumn('tickets', 'recipientType');
        }
        await queryRunner.query(`DROP TYPE IF EXISTS "tickets_recipienttype_enum"`);
    }
}
exports.AddRecipientTypeToTickets1835000000000 = AddRecipientTypeToTickets1835000000000;
//# sourceMappingURL=1835000000000-AddRecipientTypeToTickets.js.map