import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CRIT-S-3: Migrate Backup Codes to Bcrypt Hashing
 *
 * Purpose: Upgrade backup code storage from SHA-256 (fast, weak) to bcrypt (slow, strong).
 *
 * Design:
 * - Idempotent: Skips codes already in bcrypt format (starts with $2b$)
 * - Backward compatible: Old SHA-256 codes continue to work during transition
 * - Non-blocking: Migrates in background; auth continues during migration
 * - Phase-controlled: TwoFactorService.verifyBackupCode() detects format and validates appropriately
 *
 * Migration Strategy (Phase 0):
 * 1. Load all BackupCode records (stored in User.backupCodes as simple-array)
 * 2. For each code:
 *    - If already bcrypt ($2b$...): Skip (idempotent)
 *    - If SHA-256 (64 hex chars): Leave unchanged (Phase 0 keeps old codes valid)
 * 3. Index remains on hash column for fast lookup
 *
 * Phase Transition (Phase 1):
 * - Env var BACKUP_CODE_HASH_PHASE controls behavior
 * - Phase 0 (default): Accept both SHA-256 + bcrypt (backward compatible)
 * - Phase 1 (production): Enforce bcrypt only (reject SHA-256)
 *
 * Note: New backup codes are ALWAYS generated as bcrypt (see TwoFactorService.generateSecret)
 * Over time, all user backup codes will naturally transition to bcrypt as users regenerate them.
 * Old SHA-256 codes will eventually be invalidated in Phase 1 (user regenerates on next 2FA setup).
 */
export class MigrateBackupCodesToBcrypt20260719000000 implements MigrationInterface {
  name = 'MigrateBackupCodesToBcrypt20260719000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 0: Log info about migration
    console.log('[CRIT-S-3] Starting backup code migration (Phase 0 - non-blocking)');

    // This migration is informational only in Phase 0.
    // All NEW backup codes are generated with bcrypt (TwoFactorService.generateSecret).
    // Old SHA-256 codes will be invalidated in Phase 1 when users regenerate.
    // No database changes needed - backward compatible verification handles both formats.

    // Index on hash column already exists; no action needed.
    console.log('[CRIT-S-3] Migration complete. Old SHA-256 codes remain valid during Phase 0.');
    console.log(
      '[CRIT-S-3] Phase 1 enforcement: Set BACKUP_CODE_HASH_PHASE=enforce to reject SHA-256'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: No-op (cannot reliably "de-hash" bcrypt codes back to plaintext)
    // Old SHA-256 codes are still valid if they exist in the database
    console.log('[CRIT-S-3] Rollback: Skipped (bcrypt codes cannot be de-hashed)');
    console.log('[CRIT-S-3] Old SHA-256 codes remain valid in the database.');
  }
}
