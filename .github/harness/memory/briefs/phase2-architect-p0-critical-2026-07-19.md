# Phase 2 P0 Security Hardening — Architecture Brief

resource: `backend/src/services/authentication/TwoFactorService.ts`,
`backend/src/models/BackupCode.ts`, `backend/src/migrations/`, `azure/modules/security.bicep`,
`azure/modules/compute.bicep`, `azure/main-multi-rg.bicep`

**Date**: 2026-07-19  
**Architect**: Claude Opus 4.8  
**Status**: ✅ 5/5 Gates PASS, ready for challenge

---

## Executive Summary

Phase 2 addresses 3 P0 critical security items:

1. **CRIT-S-3**: Upgrade backup code hashing from SHA-256 (weak) to bcrypt (strong)
2. **C-1**: Move Container App inline secrets to Key Vault references (Zero Trust)
3. **C-2**: Break JWT secret aliasing into 5 independent secrets (rotation granularity)

**Effort**: ~20 hours total, no critical blockers

**Sequencing**: CRIT-S-3 parallel with C-1; C-2 after C-1 foundation

---

## Architecture Decisions

### CRIT-S-3: Backup Code Hashing (Two-Phase Migration)

**Decision**: Implement phased migration (Phase 0: warn, Phase 1: enforce)

**Phase 0 (Backward Compatible)**:

- All NEW backup codes use bcrypt(10)
- Verification tries bcrypt first, falls back to SHA-256
- Operator can monitor adoption without blocking auth

**Phase 1 (Enforce)**:

- All backup codes must be bcrypt
- SHA-256 fallback removed
- Controlled via `BACKUP_CODE_HASH_PHASE` env var

**Implementation**:

```typescript
// TwoFactorService.ts
export const generateBackupCodes = async (): Promise<string[]> => {
  const codes = Array.from({ length: 10 }, () => generateRandomCode());
  const hashedCodes = await Promise.all(codes.map(code => bcrypt.hash(code, 10)));
  return hashedCodes;
};

export const verifyBackupCode = async (
  plaintext: string,
  hash: string,
  phaseMode: 'warn' | 'enforce' = 'enforce'
): Promise<boolean> => {
  // Try bcrypt (Phase 0 + 1)
  const bcryptMatch = await bcrypt.compare(plaintext, hash);
  if (bcryptMatch) return true;

  // Fallback to SHA-256 (Phase 0 only)
  if (phaseMode === 'warn') {
    const sha256Hash = crypto.createHash('sha256').update(plaintext).digest('hex');
    if (sha256Hash === hash) {
      logger.warn(`[DEPRECATED] User verified with SHA-256 backup code (migrate to bcrypt)`);
      return true;
    }
  }

  return false;
};
```

**Migration** (TypeORM 1763600000000-MigrateBackupCodesToBcrypt.ts):

- Load all BackupCode records
- For each SHA-256 hash: rehash with bcrypt(10)
- Create index on hash column for fast lookup
- Idempotent (safe to re-run)

---

### C-1: Container Secrets → Key Vault (Phased Adoption)

**Decision**: Parameter-driven migration (old params still supported)

**Pattern** (extends Discord secret approach):

```bicep
// compute.bicep
env: [
  {
    name: 'JWT_SECRET'
    value: isEmpty(parameters.jwtSecretKeyVaultUri)
      ? parameters.jwtSecret  // Fallback: inline
      : '@Microsoft.KeyVault(${parameters.jwtSecretKeyVaultUri})'  // Ref
  }
  // ... repeat for all 7 secrets
]
```

**Managed Identity**: Reuse existing (already working for Discord)

**Secrets to Migrate**:

- jwt-secret
- db-password
- bot-internal-secret
- token-encryption-key
- token-encryption-salt
- cookie-secret
- role-ipc-signing-secret

---

### C-2: Break JWT Secret Aliasing (Independent Secrets)

**Decision**: 5 new @secure() parameters in security.bicep

**Before**:

```bicep
param jwtSecret string = ''
// Other secrets derived or aliased from jwtSecret
```

**After**:

```bicep
@secure() param tokenEncryptionKey string = ''
@secure() param tokenEncryptionSalt string = ''
@secure() param cookieSecret string = ''
@secure() param botInternalSecret string = ''
@secure() param roleIpcSigningSecret string = ''

// Each gets independent Key Vault secret
resource tokenEncryptionKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!isEmpty(tokenEncryptionKey)) {
  name: '${keyVault.name}/token-encryption-key'
  properties: { value: tokenEncryptionKey }
}
// ... repeat for each
```

**Benefits**:

- Independent rotation per secret
- Clear separation of concerns
- Parameter-driven (supports partial updates)

---

## 5-Gate Summary

| Gate                           | Result  | Notes                                                                      |
| ------------------------------ | ------- | -------------------------------------------------------------------------- |
| **1. Domain/Module Alignment** | ✅ PASS | CRIT-S-3 in TwoFactorService (auth domain), C-1/C-2 in Bicep (infra layer) |
| **2. Generality Test**         | ✅ PASS | No over-generalization; patterns stay domain-specific                      |
| **3. Data Ownership**          | ✅ PASS | TwoFactorService owns codes, modules own their configs                     |
| **4. Layer Boundaries**        | ✅ PASS | No code in infra, no infra concerns in code                                |
| **5. Reuse Potential**         | ✅ PASS | Extending proven patterns (Discord secrets, TypeORM migrations)            |

---

## Constraints

- ✅ CRIT-S-3 must be backward compatible (old codes work during Phase 0)
- ✅ C-1/C-2 must be parameter-driven (old params still work)
- ✅ Managed Identity reused (no new auth setup)
- ✅ No breaking changes to APIs or deployments

---

## Do-NOTs

- ❌ Do NOT require bcrypt immediately for old backup codes
- ❌ Do NOT hardcode Key Vault URIs in Bicep
- ❌ Do NOT make all new parameters required
- ❌ Do NOT remove SHA-256 verification in Phase 0

---

## Assumptions

1. ✅ bcrypt package available
2. ✅ Managed Identity configured with Key Vault access
3. ✅ Database downtime acceptable for migration
4. ✅ Discord secret pattern proven
5. ✅ TypeORM migration system operational

---

## Risk Assessment

| Risk                    | Severity | Mitigation                                 |
| ----------------------- | -------- | ------------------------------------------ |
| Bcrypt performance      | Medium   | Phase 0 allows testing before enforcement  |
| Migration downtime      | Low      | Background migration, no API downtime      |
| Parameter management    | Low      | Parameter-driven, supports partial updates |
| Managed Identity access | Low      | Already working (Discord proves)           |

**Overall Risk**: **MEDIUM** (bcrypt performance + migration planning)

---

## Files to Modify

### CRIT-S-3 (4 files + migration)

- `backend/src/services/authentication/TwoFactorService.ts` (hash generation & verification)
- `backend/src/models/BackupCode.ts` (entity: hash column indexing)
- `backend/src/__tests__/services/TwoFactorService.bcrypt.test.ts` (test updates)
- `backend/src/migrations/1763600000000-MigrateBackupCodesToBcrypt.ts` (NEW migration)

### C-1 & C-2 (Bicep only)

- `azure/modules/security.bicep` (5 new @secure() params, Key Vault secrets)
- `azure/modules/compute.bicep` (env var refs with Key Vault URIs)
- `azure/main-multi-rg.bicep` (param passing to security module)

---

## Sequencing

1. **Parallel Start**: CRIT-S-3 + C-1 can start simultaneously
   - CRIT-S-3: No infra changes, no blocking deps
   - C-1: Extends Discord pattern, low risk

2. **After C-1**: Proceed with C-2
   - C-2 builds on C-1 (adds new secrets to security.bicep)
   - Both phased adoptions

3. **Deployment Order**:
   - Backend: Update TwoFactorService (Phase 0)
   - Database: Run migration
   - Infrastructure: Deploy C-1 + C-2 (Key Vault refs)
   - Verification: Run tests + smoke tests

---

## Architect-Challenge Review (GPT-5.3 Codex)

**Status**: ✅ **APPROVED WITH 3 AMENDMENTS**

**Blocking Issues Resolved**:

1. ✅ Backup code plaintext storage clarified: Invalidate old codes on Phase 1, force regeneration
2. ✅ C-2 backward compatibility fixed: New params fall back to jwtSecret if empty

**Clarifications Applied**: 3. ✅ Migration race condition: Added bcrypt check to skip
already-hashed codes 4. ✅ Parameter naming consistency: Will use standardized pattern in
IMPLEMENT 5. ✅ Test coverage: Testable phaseMode parameter on verifyBackupCode()

**Amendment 1: Backup Code Migration Path**

Plaintext is NOT persistently stored (security by design). Solution:

- Phase 0: Accept both SHA-256 + bcrypt for backward compat
- Phase 1: Invalidate remaining SHA-256 codes
- User regenerates codes on next 2FA setup (low friction)

**Amendment 2: C-2 Backward Compatibility**

New secrets fall back gracefully:

```bicep
resource tokenEncryptionKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  name: '${keyVault.name}/token-encryption-key'
  properties: {
    value: isEmpty(tokenEncryptionKey) ? jwtSecret : tokenEncryptionKey
  }
}
```

**Amendment 3: CRIT-S-3 Test Architecture**

Phasemode passed as parameter (testable without env vars):

```typescript
const result = await verifyBackupCode(plaintext, hash, 'phase0'); // phase0 or phase1
```

---

**Verdict**: ✅ **READY FOR STAGE 4: IMPLEMENT**
