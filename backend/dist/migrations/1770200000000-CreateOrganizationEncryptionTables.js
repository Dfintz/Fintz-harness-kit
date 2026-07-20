"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrganizationEncryptionTables1770200000000 = void 0;
class CreateOrganizationEncryptionTables1770200000000 {
    async up(queryRunner) {
        const keysTableExists = await queryRunner.hasTable('organization_encryption_keys');
        if (keysTableExists) {
            return;
        }
        await queryRunner.query(`
      CREATE TABLE organization_encryption_keys (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

        -- Organization reference
        "organizationId" varchar(255) NOT NULL,

        -- Key metadata (NOT the actual key!)
        "keyId" varchar(64) NOT NULL UNIQUE,
        algorithm varchar(32) NOT NULL DEFAULT 'AES-256-GCM',
        version integer NOT NULL DEFAULT 1,

        -- Encrypted key wrappers (encrypted with user passwords)
        -- JSON format: { "userId1": "encrypted_key_base64", "userId2": "encrypted_key_base64" }
        "keyWrappers" jsonb NOT NULL,

        -- Key recovery
        "recoveryHint" text,
        "requiresRecoveryPhrase" boolean NOT NULL DEFAULT true,

        -- Metadata
        "createdBy" varchar(255) NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "rotatedAt" timestamp,
        "isActive" boolean NOT NULL DEFAULT true,

        -- Usage tracking
        "lastUsedAt" timestamp,
        "usageCount" integer NOT NULL DEFAULT 0,

        -- Foreign keys
        CONSTRAINT fk_org_encryption_key_org
          FOREIGN KEY ("organizationId")
          REFERENCES organizations(id)
          ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`
      CREATE UNIQUE INDEX idx_org_encryption_keys_active_unique
        ON organization_encryption_keys ("organizationId")
        WHERE "isActive" = true
    `);
        await queryRunner.query(`
      CREATE INDEX idx_org_encryption_keys_org
        ON organization_encryption_keys ("organizationId")
    `);
        await queryRunner.query(`
      CREATE INDEX idx_org_encryption_keys_key_id
        ON organization_encryption_keys ("keyId")
    `);
        await queryRunner.query(`
      CREATE TABLE encrypted_data (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

        -- Organization and key reference
        "organizationId" varchar(255) NOT NULL,
        "keyId" varchar(64) NOT NULL,

        -- Data classification
        "dataType" varchar(50) NOT NULL,
        "resourceId" uuid,

        -- Encrypted content (stored as base64 text for easier handling)
        "encryptedData" text NOT NULL,
        "encryptionMetadata" jsonb NOT NULL,

        -- Access control
        "createdBy" varchar(255) NOT NULL,
        "minSecurityLevel" integer NOT NULL DEFAULT 1,
        "allowedRoles" text[],

        -- Metadata
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),
        "accessedCount" integer NOT NULL DEFAULT 0,
        "lastAccessedAt" timestamp,

        -- Soft delete
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" timestamp,
        "deletedBy" varchar(255),

        -- Foreign keys
        CONSTRAINT fk_encrypted_data_org
          FOREIGN KEY ("organizationId")
          REFERENCES organizations(id)
          ON DELETE CASCADE,

        CONSTRAINT fk_encrypted_data_key
          FOREIGN KEY ("keyId")
          REFERENCES organization_encryption_keys("keyId")
          ON DELETE RESTRICT
      )
    `);
        await queryRunner.query(`
      CREATE INDEX idx_encrypted_data_org
        ON encrypted_data ("organizationId")
    `);
        await queryRunner.query(`
      CREATE INDEX idx_encrypted_data_type
        ON encrypted_data ("organizationId", "dataType")
    `);
        await queryRunner.query(`
      CREATE INDEX idx_encrypted_data_resource
        ON encrypted_data ("resourceId")
        WHERE "resourceId" IS NOT NULL
    `);
        await queryRunner.query(`
      CREATE INDEX idx_encrypted_data_key
        ON encrypted_data ("keyId")
    `);
        await queryRunner.query(`
      CREATE INDEX idx_encrypted_data_not_deleted
        ON encrypted_data ("organizationId", "isDeleted")
        WHERE "isDeleted" = false
    `);
        await queryRunner.query(`
      CREATE TABLE encryption_audit_log (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

        -- Organization reference
        "organizationId" varchar(255) NOT NULL,

        -- Event details
        "eventType" varchar(50) NOT NULL,
        "userId" varchar(255) NOT NULL,
        message text NOT NULL,
        details jsonb,

        -- Metadata
        "ipAddress" varchar(45),
        "userAgent" text,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),

        -- Foreign keys
        CONSTRAINT fk_encryption_audit_org
          FOREIGN KEY ("organizationId")
          REFERENCES organizations(id)
          ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`
      CREATE INDEX idx_encryption_audit_org
        ON encryption_audit_log ("organizationId")
    `);
        await queryRunner.query(`
      CREATE INDEX idx_encryption_audit_type
        ON encryption_audit_log ("eventType")
    `);
        await queryRunner.query(`
      CREATE INDEX idx_encryption_audit_user
        ON encryption_audit_log ("userId")
    `);
        await queryRunner.query(`
      CREATE INDEX idx_encryption_audit_created
        ON encryption_audit_log ("createdAt" DESC)
    `);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS encryption_audit_log CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS encrypted_data CASCADE`);
        await queryRunner.query(`DROP TABLE IF EXISTS organization_encryption_keys CASCADE`);
    }
}
exports.CreateOrganizationEncryptionTables1770200000000 = CreateOrganizationEncryptionTables1770200000000;
//# sourceMappingURL=1770200000000-CreateOrganizationEncryptionTables.js.map