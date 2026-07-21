import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Create Encryption Key Claims Table
 *
 * Supports the Key Claim Token flow for secure E2E key distribution.
 * Admins create claims (org key encrypted with one-time passphrase),
 * members claim them by entering the passphrase out-of-band.
 */
export class CreateEncryptionKeyClaimsTable1770300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('encryption_key_claims');
    if (tableExists) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS encryption_key_claims (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

        -- Organization and key reference
        "organizationId" varchar(255) NOT NULL,
        "keyId" varchar(64) NOT NULL,

        -- Encrypted claim blob (org key encrypted with one-time passphrase)
        "encryptedClaim" text NOT NULL,
        "claimMetadata" jsonb NOT NULL DEFAULT '{}',

        -- Creator
        "createdBy" varchar(255) NOT NULL,

        -- Claimant (null until claimed)
        "claimedBy" varchar(255),

        -- Admin label for tracking
        label varchar(100),

        -- Status: pending | claimed | expired | revoked
        status varchar(20) NOT NULL DEFAULT 'pending',

        -- Timestamps
        "expiresAt" timestamp NOT NULL,
        "claimedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT NOW(),
        "updatedAt" timestamp NOT NULL DEFAULT NOW(),

        -- Foreign keys
        CONSTRAINT fk_key_claims_org
          FOREIGN KEY ("organizationId")
          REFERENCES organizations(id)
          ON DELETE CASCADE,

        CONSTRAINT fk_key_claims_creator
          FOREIGN KEY ("createdBy")
          REFERENCES users(id)
          ON DELETE SET NULL,

        CONSTRAINT fk_key_claims_claimant
          FOREIGN KEY ("claimedBy")
          REFERENCES users(id)
          ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_key_claims_org
        ON encryption_key_claims ("organizationId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_key_claims_status
        ON encryption_key_claims (status, "expiresAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_key_claims_creator
        ON encryption_key_claims ("createdBy")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS encryption_key_claims CASCADE`);
  }
}
