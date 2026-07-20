"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFederationMemberAssociationType1825000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddFederationMemberAssociationType1825000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('federation_members', new typeorm_1.TableColumn({
            name: 'associationType',
            type: 'varchar',
            length: '20',
            default: "'full_member'",
            isNullable: false,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('federation_members', 'associationType');
    }
}
exports.AddFederationMemberAssociationType1825000000000 = AddFederationMemberAssociationType1825000000000;
//# sourceMappingURL=1825000000000-AddFederationMemberAssociationType.js.map