import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add `updatedAt` column to the `invitations` table.
 *
 * The Invitation entity now defines `@UpdateDateColumn()` so the invitation
 * spam guard (InvitationService.invite) can enforce a re-invite cooldown
 * after an invitee declines (or an admin rejects) an invitation. Without
 * this column TypeORM SELECTs would fail with "column updatedAt does not exist".
 */
export class AddUpdatedAtToInvitations1862900000000 implements MigrationInterface {
  name = 'AddUpdatedAtToInvitations1862900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'invitations' AND column_name = 'updatedAt'`
    );
    if (cols.length === 0) {
      await queryRunner.query(
        `ALTER TABLE "invitations"
         ADD COLUMN "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invitations" DROP COLUMN IF EXISTS "updatedAt"`);
  }
}
