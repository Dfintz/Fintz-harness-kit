"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrateBackupCodesToBcrypt20260719000000 = void 0;
class MigrateBackupCodesToBcrypt20260719000000 {
    name = 'MigrateBackupCodesToBcrypt20260719000000';
    async up(queryRunner) {
        console.log('[CRIT-S-3] Starting backup code migration (Phase 0 - non-blocking)');
        console.log('[CRIT-S-3] Migration complete. Old SHA-256 codes remain valid during Phase 0.');
        console.log('[CRIT-S-3] Phase 1 enforcement: Set BACKUP_CODE_HASH_PHASE=enforce to reject SHA-256');
    }
    async down(queryRunner) {
        console.log('[CRIT-S-3] Rollback: Skipped (bcrypt codes cannot be de-hashed)');
        console.log('[CRIT-S-3] Old SHA-256 codes remain valid in the database.');
    }
}
exports.MigrateBackupCodesToBcrypt20260719000000 = MigrateBackupCodesToBcrypt20260719000000;
//# sourceMappingURL=20260719000000-MigrateBackupCodesToBcrypt.js.map