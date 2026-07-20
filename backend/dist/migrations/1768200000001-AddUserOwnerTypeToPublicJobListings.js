"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddUserOwnerTypeToPublicJobListings1768200000001 = void 0;
class AddUserOwnerTypeToPublicJobListings1768200000001 {
    name = 'AddUserOwnerTypeToPublicJobListings1768200000000';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TYPE "public_job_listings_ownertype_enum" ADD VALUE IF NOT EXISTS 'user'`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DELETE FROM "public_job_listings" WHERE "ownerType" = 'user'`);
    }
}
exports.AddUserOwnerTypeToPublicJobListings1768200000001 = AddUserOwnerTypeToPublicJobListings1768200000001;
//# sourceMappingURL=1768200000001-AddUserOwnerTypeToPublicJobListings.js.map