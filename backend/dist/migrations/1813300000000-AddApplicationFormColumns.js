"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddApplicationFormColumns1813300000000 = void 0;
const typeorm_1 = require("typeorm");
class AddApplicationFormColumns1813300000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('org_applications', new typeorm_1.TableColumn({
            name: 'formResponses',
            type: 'jsonb',
            isNullable: true,
        }));
        await queryRunner.addColumn('org_applications', new typeorm_1.TableColumn({
            name: 'source',
            type: 'varchar',
            length: '10',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('org_applications', 'source');
        await queryRunner.dropColumn('org_applications', 'formResponses');
    }
}
exports.AddApplicationFormColumns1813300000000 = AddApplicationFormColumns1813300000000;
//# sourceMappingURL=1813300000000-AddApplicationFormColumns.js.map