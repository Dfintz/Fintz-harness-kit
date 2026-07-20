"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddUpdatedAtToInvitations1862900000000 = void 0;
class AddUpdatedAtToInvitations1862900000000 {
    name = 'AddUpdatedAtToInvitations1862900000000';
    async up(queryRunner) {
        const cols = await queryRunner.query(`SELECT column_name FROM information_schema.columns
       WHERE table_name = 'invitations' AND column_name = 'updatedAt'`);
        if (cols.length === 0) {
            await queryRunner.query(`ALTER TABLE "invitations"
         ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "invitations" DROP COLUMN IF EXISTS "updatedAt"`);
    }
}
exports.AddUpdatedAtToInvitations1862900000000 = AddUpdatedAtToInvitations1862900000000;
//# sourceMappingURL=1862900000000-AddUpdatedAtToInvitations.js.map