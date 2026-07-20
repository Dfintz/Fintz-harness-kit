"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddCrewAndShipFieldsToPublicJobListing1764100000000 = void 0;
const typeorm_1 = require("typeorm");
class AddCrewAndShipFieldsToPublicJobListing1764100000000 {
    async up(queryRunner) {
        await queryRunner.addColumns('public_job_listings', [
            new typeorm_1.TableColumn({
                name: 'crewSpotsTotal',
                type: 'integer',
                isNullable: true,
                comment: 'Total crew positions available for this listing',
            }),
            new typeorm_1.TableColumn({
                name: 'crewSpotsFilled',
                type: 'integer',
                default: 0,
                comment: 'Number of crew positions already filled',
            }),
            new typeorm_1.TableColumn({
                name: 'requiredShips',
                type: 'jsonb',
                isNullable: true,
                comment: 'JSON array of required/preferred ship models',
            }),
            new typeorm_1.TableColumn({
                name: 'shipRequirementType',
                type: 'varchar',
                length: '20',
                isNullable: true,
                default: "'none'",
                comment: "Ship requirement: 'none', 'required', 'preferred'",
            }),
        ]);
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('public_job_listings', 'shipRequirementType');
        await queryRunner.dropColumn('public_job_listings', 'requiredShips');
        await queryRunner.dropColumn('public_job_listings', 'crewSpotsFilled');
        await queryRunner.dropColumn('public_job_listings', 'crewSpotsTotal');
    }
}
exports.AddCrewAndShipFieldsToPublicJobListing1764100000000 = AddCrewAndShipFieldsToPublicJobListing1764100000000;
//# sourceMappingURL=1764100000000-AddCrewAndShipFieldsToPublicJobListing.js.map