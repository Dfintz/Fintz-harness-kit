"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddExternalCatalogIndexOnCategory1721100600000 = void 0;
class AddExternalCatalogIndexOnCategory1721100600000 {
    async up(queryRunner) {
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_external_catalog_source_type_active_category 
       ON external_catalog_records(source, "recordType", "isActive", category)`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_external_catalog_source_type_active_category`);
    }
}
exports.AddExternalCatalogIndexOnCategory1721100600000 = AddExternalCatalogIndexOnCategory1721100600000;
//# sourceMappingURL=1721100600000-AddExternalCatalogIndexOnCategory.js.map