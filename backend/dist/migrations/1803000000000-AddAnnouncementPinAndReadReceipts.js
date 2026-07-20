"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAnnouncementPinAndReadReceipts1803000000000 = void 0;
class AddAnnouncementPinAndReadReceipts1803000000000 {
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "announcements"
         ADD COLUMN "pinnedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "announcements"
         ADD COLUMN "pinnedBy" varchar`);
        await queryRunner.query(`CREATE TABLE "announcement_read_receipts" (
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
       )`);
        await queryRunner.query(`CREATE INDEX "IDX_arr_announcementId"
         ON "announcement_read_receipts" ("announcementId")`);
        await queryRunner.query(`CREATE INDEX "IDX_arr_userId"
         ON "announcement_read_receipts" ("userId")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "announcement_read_receipts"`);
        await queryRunner.query(`ALTER TABLE "announcements" DROP COLUMN IF EXISTS "pinnedBy"`);
        await queryRunner.query(`ALTER TABLE "announcements" DROP COLUMN IF EXISTS "pinnedAt"`);
    }
}
exports.AddAnnouncementPinAndReadReceipts1803000000000 = AddAnnouncementPinAndReadReceipts1803000000000;
//# sourceMappingURL=1803000000000-AddAnnouncementPinAndReadReceipts.js.map