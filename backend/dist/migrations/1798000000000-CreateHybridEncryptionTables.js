"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateHybridEncryptionTables1798000000000 = void 0;
class CreateHybridEncryptionTables1798000000000 {
    name = 'CreateHybridEncryptionTables1798000000000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE TABLE "member_public_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "userId" varchar NOT NULL,
        "publicKey" text NOT NULL,
        "keyFingerprint" varchar(64) NOT NULL,
        "keySize" integer NOT NULL DEFAULT 4096,
        "algorithm" varchar(32) NOT NULL DEFAULT 'RSA-OAEP-SHA256',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "lastUsedAt" timestamp,
        CONSTRAINT "PK_member_public_keys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_member_public_keys_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_member_public_keys_org_user" ON "member_public_keys" ("organizationId", "userId")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_member_public_keys_fingerprint" ON "member_public_keys" ("keyFingerprint")`);
        await queryRunner.query(`
      CREATE TABLE "data_encryption_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid NOT NULL,
        "dekId" varchar(64) NOT NULL,
        "dataType" varchar(64) NOT NULL,
        "resourceId" varchar(255),
        "algorithm" varchar(32) NOT NULL DEFAULT 'AES-GCM-256',
        "wrappedKeys" jsonb NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdBy" varchar NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        "deletedAt" timestamp,
        CONSTRAINT "PK_data_encryption_keys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_data_encryption_keys_org" FOREIGN KEY ("organizationId")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_data_encryption_keys_dekid" ON "data_encryption_keys" ("dekId")`);
        await queryRunner.query(`CREATE INDEX "IDX_data_encryption_keys_org" ON "data_encryption_keys" ("organizationId")`);
        await queryRunner.query(`CREATE INDEX "IDX_data_encryption_keys_type_resource" ON "data_encryption_keys" ("dataType", "resourceId")`);
    }
    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE IF EXISTS "data_encryption_keys"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "member_public_keys"`);
    }
}
exports.CreateHybridEncryptionTables1798000000000 = CreateHybridEncryptionTables1798000000000;
//# sourceMappingURL=1798000000000-CreateHybridEncryptionTables.js.map