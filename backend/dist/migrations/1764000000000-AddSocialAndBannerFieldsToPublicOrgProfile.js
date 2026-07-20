"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSocialAndBannerFieldsToPublicOrgProfile1764000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddSocialAndBannerFieldsToPublicOrgProfile1764000000000 {
    name = 'AddSocialAndBannerFieldsToPublicOrgProfile1764000000000';
    async up(queryRunner) {
        await queryRunner.addColumns('public_org_profiles', [
            new typeorm_1.TableColumn({
                name: 'twitterUrl',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'youtubeUrl',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'twitchUrl',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'websiteUrl',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }),
            new typeorm_1.TableColumn({
                name: 'bannerUrl',
                type: 'varchar',
                length: '500',
                isNullable: true,
            }),
        ]);
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('public_org_profiles', 'bannerUrl');
        await queryRunner.dropColumn('public_org_profiles', 'websiteUrl');
        await queryRunner.dropColumn('public_org_profiles', 'twitchUrl');
        await queryRunner.dropColumn('public_org_profiles', 'youtubeUrl');
        await queryRunner.dropColumn('public_org_profiles', 'twitterUrl');
    }
}
exports.AddSocialAndBannerFieldsToPublicOrgProfile1764000000000 = AddSocialAndBannerFieldsToPublicOrgProfile1764000000000;
//# sourceMappingURL=1764000000000-AddSocialAndBannerFieldsToPublicOrgProfile.js.map