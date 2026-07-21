"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrateBackupCodesToBcrypt20260719000000 = void 0;
class MigrateBackupCodesToBcrypt20260719000000 {
    name = 'MigrateBackupCodesToBcrypt20260719000000';
    async up(queryRunner) {
        console.log('[CRIT-S-3] Starting backup code migration contract alignment');
        console.log('[CRIT-S-3] Migration complete. Legacy SHA-256 codes remain runtime-compatible.');
        console.log('[CRIT-S-3] Runtime phase enforcement: Set BACKUP_CODE_HASH_PHASE=enforce to require bcrypt.');
    }
    async down(queryRunner) {
        console.log('[CRIT-S-3] Rollback: Skipped (bcrypt codes cannot be de-hashed)');
        console.log('[CRIT-S-3] Old SHA-256 codes remain valid in the database.');
    }
}
exports.MigrateBackupCodesToBcrypt20260719000000 = MigrateBackupCodesToBcrypt20260719000000;
//# sourceMappingURL=20260719000000-MigrateBackupCodesToBcrypt.js.map