"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddApprovedVehiclesToJobListing1824000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddApprovedVehiclesToJobListing1824000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('public_job_listings', new typeorm_1.TableColumn({
            name: 'approvedVehicles',
            type: 'jsonb',
            isNullable: true,
            default: "'[]'",
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('public_job_listings', 'approvedVehicles');
    }
}
exports.AddApprovedVehiclesToJobListing1824000000000 = AddApprovedVehiclesToJobListing1824000000000;
//# sourceMappingURL=1824000000000-AddApprovedVehiclesToJobListing.js.map