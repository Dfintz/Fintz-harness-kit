"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSharedWithOrgsToActivityTemplates1743370000000 = void 0;
class AddSharedWithOrgsToActivityTemplates1743370000000 {
    async up(queryRunner) {
        const table = await queryRunner.getTable('activity_templates');
        if (table && !table.findColumnByName('sharedWithOrgs')) {
            await queryRunner.query(`ALTER TABLE "activity_templates" ADD COLUMN "sharedWithOrgs" text DEFAULT ''`);
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('activity_templates');
        if (table?.findColumnByName('sharedWithOrgs')) {
            await queryRunner.query(`ALTER TABLE "activity_templates" DROP COLUMN "sharedWithOrgs"`);
        }
    }
}
exports.AddSharedWithOrgsToActivityTemplates1743370000000 = AddSharedWithOrgsToActivityTemplates1743370000000;
//# sourceMappingURL=1743370000000-AddSharedWithOrgsToActivityTemplates.js.map