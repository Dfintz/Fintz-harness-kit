"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFederationNotificationTypes1846000000000 = void 0;
class AddFederationNotificationTypes1846000000000 {
    async up(queryRunner) {
        const enumExists = await queryRunner.query(`SELECT 1 FROM pg_type WHERE typname = 'notifications_type_enum' LIMIT 1`);
        if (enumExists.length > 0) {
            await queryRunner.query(`ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'federation_invitation'`);
            await queryRunner.query(`ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'federation_accepted'`);
        }
    }
    async down(_queryRunner) {
    }
}
exports.AddFederationNotificationTypes1846000000000 = AddFederationNotificationTypes1846000000000;
//# sourceMappingURL=1846000000000-AddFederationNotificationTypes.js.map