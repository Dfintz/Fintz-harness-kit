"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnableUuidExtension1729340000000 = void 0;
class EnableUuidExtension1729340000000 {
    async up(queryRunner) {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    }
    async down(_queryRunner) {
    }
}
exports.EnableUuidExtension1729340000000 = EnableUuidExtension1729340000000;
//# sourceMappingURL=1729340000000-EnableUuidExtension.js.map