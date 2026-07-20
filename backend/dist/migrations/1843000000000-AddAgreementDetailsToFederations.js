"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAgreementDetailsToFederations1843000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddAgreementDetailsToFederations1843000000000 {
    name = 'AddAgreementDetailsToFederations1843000000000';
    async up(queryRunner) {
        await queryRunner.addColumns('federations', [
            new typeorm_1.TableColumn({
                name: 'reviewDate',
                type: 'timestamp',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'expiryDate',
                type: 'timestamp',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'autoRenew',
                type: 'boolean',
                default: false,
            }),
        ]);
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('federations', 'autoRenew');
        await queryRunner.dropColumn('federations', 'expiryDate');
        await queryRunner.dropColumn('federations', 'reviewDate');
    }
}
exports.AddAgreementDetailsToFederations1843000000000 = AddAgreementDetailsToFederations1843000000000;
//# sourceMappingURL=1843000000000-AddAgreementDetailsToFederations.js.map