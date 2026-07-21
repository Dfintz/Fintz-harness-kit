import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add pin support and read-receipt tracking to announcements.
 *
 * announcements table:
 *   - ADD pinnedAt  (timestamp, nullable)
 *   - ADD pinnedBy  (varchar, nullable)
 *
 * announcement_read_receipts table (NEW):
 *   - id              uuid  PK
 *   - announcementId  uuid  FK → announcements (CASCADE)
 *   - userId          varchar
 *   - readAt          timestamp  DEFAULT now()
 *   - UNIQUE (announcementId, userId)
 */
export class AddAnnouncementPinAndReadReceipts1803000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── announcements: pin columns ──────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "announcements"
         ADD COLUMN "pinnedAt" TIMESTAMP`
    );
    await queryRunner.query(
      `ALTER TABLE "announcements"
         ADD COLUMN "pinnedBy" varchar`
    );

    // ── announcement_read_receipts table ────────────────────────
    await queryRunner.query(
      `CREATE TABLE "announcement_read_receipts" (
         "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
         "announcementId"  uuid NOT NULL,
         "userId"          varchar NOT NULL,
         "readAt"          TIMESTAMP NOT NULL DEFAULT now(),
         CONSTRAINT "PK_announcement_read_receipts" PRIMARY KEY ("id"),
         CONSTRAINT "FK_arr_announcementId"
           FOREIGN KEY ("announcementId") REFERENCES "announcements"("id")
           ON DELETE CASCADE,
         CONSTRAINT "UQ_arr_announcement_user"
           UNIQUE ("announcementId", "userId")
       )`
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_arr_announcementId"
         ON "announcement_read_receipts" ("announcementId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_arr_userId"
         ON "announcement_read_receipts" ("userId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "announcement_read_receipts"`);
    await queryRunner.query(`ALTER TABLE "announcements" DROP COLUMN IF EXISTS "pinnedBy"`);
    await queryRunner.query(`ALTER TABLE "announcements" DROP COLUMN IF EXISTS "pinnedAt"`);
  }
}
