"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFormResponsesToJobApplications1839000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddFormResponsesToJobApplications1839000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('job_applications', new typeorm_1.TableColumn({
            name: 'formResponses',
            type: 'jsonb',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('job_applications', 'formResponses');
    }
}
exports.AddFormResponsesToJobApplications1839000000000 = AddFormResponsesToJobApplications1839000000000;
//# sourceMappingURL=1839000000000-AddFormResponsesToJobApplications.js.map