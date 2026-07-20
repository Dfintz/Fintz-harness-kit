"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddBannerImageUrlToActivities1838000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddBannerImageUrlToActivities1838000000000 {
    name = 'AddBannerImageUrlToActivities1838000000000';
    async up(queryRunner) {
        await queryRunner.addColumn('activities', new typeorm_1.TableColumn({
            name: 'bannerImageUrl',
            type: 'varchar',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('activities', 'bannerImageUrl');
    }
}
exports.AddBannerImageUrlToActivities1838000000000 = AddBannerImageUrlToActivities1838000000000;
//# sourceMappingURL=1838000000000-AddBannerImageUrlToActivities.js.map