"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddUseDiscordForApplicationsToPublicOrgProfile1772000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddUseDiscordForApplicationsToPublicOrgProfile1772000000000 {
    name = 'AddUseDiscordForApplicationsToPublicOrgProfile1772000000000';
    async up(queryRunner) {
        await queryRunner.addColumn('public_org_profiles', new typeorm_1.TableColumn({
            name: 'useDiscordForApplications',
            type: 'boolean',
            default: false,
            isNullable: false,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('public_org_profiles', 'useDiscordForApplications');
    }
}
exports.AddUseDiscordForApplicationsToPublicOrgProfile1772000000000 = AddUseDiscordForApplicationsToPublicOrgProfile1772000000000;
//# sourceMappingURL=1772000000000-AddUseDiscordForApplicationsToPublicOrgProfile.js.map