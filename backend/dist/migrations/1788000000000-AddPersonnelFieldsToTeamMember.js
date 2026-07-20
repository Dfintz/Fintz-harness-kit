"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPersonnelFieldsToTeamMember1788000000000 = void 0;
class AddPersonnelFieldsToTeamMember1788000000000 {
    name = 'AddPersonnelFieldsToTeamMember1788000000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "rank" varchar(50)`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "ship_type" varchar(100)`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "specialization" text`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "stats" jsonb`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "certifications" text`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "additional_roles" text`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "departure_reason" text`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "departure_reason"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "last_active_at"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "additional_roles"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "certifications"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "stats"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "specialization"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "ship_type"`);
        await queryRunner.query(`ALTER TABLE "team_members" DROP COLUMN IF EXISTS "rank"`);
    }
}
exports.AddPersonnelFieldsToTeamMember1788000000000 = AddPersonnelFieldsToTeamMember1788000000000;
//# sourceMappingURL=1788000000000-AddPersonnelFieldsToTeamMember.js.map