"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSpViewerUrlToShipLoadout1809000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddSpViewerUrlToShipLoadout1809000000000 {
    async up(queryRunner) {
        await queryRunner.addColumn('ship_loadouts', new typeorm_1.TableColumn({
            name: 'spViewerUrl',
            type: 'varchar',
            length: '500',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('ship_loadouts', 'spViewerUrl');
    }
}
exports.AddSpViewerUrlToShipLoadout1809000000000 = AddSpViewerUrlToShipLoadout1809000000000;
//# sourceMappingURL=1809000000000-AddSpViewerUrlToShipLoadout.js.map