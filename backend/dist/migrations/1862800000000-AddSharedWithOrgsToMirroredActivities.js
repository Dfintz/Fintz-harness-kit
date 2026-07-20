"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSharedWithOrgsToMirroredActivities1862800000000 = void 0;
class AddSharedWithOrgsToMirroredActivities1862800000000 {
    name = 'AddSharedWithOrgsToMirroredActivities1862800000000';
    async up(queryRunner) {
        const cols = await queryRunner.query(`SELECT column_name FROM information_schema.columns
       WHERE table_name = 'mirrored_activities' AND column_name = 'sharedWithOrgs'`);
        if (cols.length === 0) {
            await queryRunner.query(`ALTER TABLE "mirrored_activities" ADD COLUMN "sharedWithOrgs" text DEFAULT ''`);
        }
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "mirrored_activities" DROP COLUMN IF EXISTS "sharedWithOrgs"`);
    }
}
exports.AddSharedWithOrgsToMirroredActivities1862800000000 = AddSharedWithOrgsToMirroredActivities1862800000000;
//# sourceMappingURL=1862800000000-AddSharedWithOrgsToMirroredActivities.js.map