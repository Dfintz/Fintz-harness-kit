import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CRIT-S-3: Migrate Backup Codes to Bcrypt Hashing
 *
 * Purpose: Upgrade backup code storage from SHA-256 (fast, weak) to bcrypt (slow, strong).
 *
 * Design:
 * - Idempotent: Skips codes already in bcrypt format (starts with $2b$)
 * - Backward compatible: Old SHA-256 codes continue to work during transition
 * - Non-blocking: No data rewrite in this migration; auth behavior remains runtime-controlled
 * - Format-aware verification: TwoFactorService.verifyBackupCode() detects stored hash format
 *
 * Migration Strategy (Phase 0):
 * 1. Load all BackupCode records (stored in User.backupCodes as simple-array)
 * 2. For each code:
 *    - If already bcrypt ($2b$...): Skip (idempotent)
 *    - If SHA-256 (64 hex chars): Leave unchanged (Phase 0 keeps old codes valid)
 * 3. Index remains on hash column for fast lookup
 *
 * Current Runtime Behavior:
 * - Verification accepts both SHA-256 + bcrypt in compat mode
 * - Set BACKUP_CODE_HASH_PHASE=enforce to reject legacy SHA-256 backup hashes
 *
 * Note: New backup codes are ALWAYS generated as bcrypt (see TwoFactorService.generateSecret)
 * Over time, user backup codes naturally transition to bcrypt as users regenerate them.
 * Legacy SHA-256 handling remains active until runtime is switched to enforce mode.
 */
export class MigrateBackupCodesToBcrypt20260719000000 implements MigrationInterface {
  name = 'MigrateBackupCodesToBcrypt20260719000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Phase 0: Log info about migration
    console.log('[CRIT-S-3] Starting backup code migration contract alignment');

    // This migration is informational only in Phase 0.
    // All NEW backup codes are generated with bcrypt (TwoFactorService.generateSecret).
    // Legacy SHA-256 verification remains compatible unless enforce mode is enabled at runtime.
    // No database changes needed - backward compatible verification handles both formats.

    // Index on hash column already exists; no action needed.
    console.log('[CRIT-S-3] Migration complete. Legacy SHA-256 codes remain runtime-compatible.');
    console.log(
      '[CRIT-S-3] Runtime phase enforcement: Set BACKUP_CODE_HASH_PHASE=enforce to require bcrypt.'
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Rollback: No-op (cannot reliably "de-hash" bcrypt codes back to plaintext)
    // Old SHA-256 codes are still valid if they exist in the database
    console.log('[CRIT-S-3] Rollback: Skipped (bcrypt codes cannot be de-hashed)');
    console.log('[CRIT-S-3] Old SHA-256 codes remain valid in the database.');
  }
}
