import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 25 — B-3 Document Tables
 *
 * Creates: documents, document_versions, document_folders, document_shares
 * Convention: Raw SQL, gen_random_uuid() PKs, explicit indexes, TenantEntity columns.
 */
export class CreateDocumentTables1795000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ==================== DOCUMENT FOLDERS ====================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_folders" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId"   varchar NOT NULL,
        "parentId"         uuid,
        "name"             varchar(255) NOT NULL,
        "sortOrder"        integer NOT NULL DEFAULT 0,
        "createdBy"        varchar NOT NULL,
        "createdAt"        timestamp NOT NULL DEFAULT now(),
        "sharedWithOrgs"   text,
        "deletedAt"        timestamp,
        "deletedBy"        varchar,
        CONSTRAINT "fk_document_folders_parent"
          FOREIGN KEY ("parentId") REFERENCES "document_folders"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_document_folders_org_parent" ON "document_folders" ("organizationId", "parentId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_document_folders_org_name" ON "document_folders" ("organizationId", "name")
    `);

    // ==================== DOCUMENTS ====================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "organizationId"    varchar NOT NULL,
        "folderId"          uuid,
        "name"              varchar(255) NOT NULL,
        "description"       text,
        "mimeType"          varchar(255) NOT NULL,
        "fileSize"          bigint NOT NULL,
        "blobPath"          varchar(1000) NOT NULL,
        "currentVersionId"  uuid,
        "downloadCount"     integer NOT NULL DEFAULT 0,
        "isPublic"          boolean NOT NULL DEFAULT false,
        "tags"              text,
        "createdBy"         varchar NOT NULL,
        "updatedBy"         varchar,
        "createdAt"         timestamp NOT NULL DEFAULT now(),
        "updatedAt"         timestamp NOT NULL DEFAULT now(),
        "version"           integer NOT NULL DEFAULT 1,
        "sharedWithOrgs"    text,
        "deletedAt"         timestamp,
        "deletedBy"         varchar,
        CONSTRAINT "fk_documents_folder"
          FOREIGN KEY ("folderId") REFERENCES "document_folders"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_documents_org_folder" ON "documents" ("organizationId", "folderId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_org_name" ON "documents" ("organizationId", "name")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_org_mimetype" ON "documents" ("organizationId", "mimeType")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_createdby" ON "documents" ("createdBy")
    `);

    // ==================== DOCUMENT VERSIONS ====================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_versions" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "documentId"   uuid NOT NULL,
        "version"      integer NOT NULL,
        "blobPath"     varchar(1000) NOT NULL,
        "fileSize"     bigint NOT NULL,
        "changeNote"   varchar(500),
        "uploadedBy"   varchar NOT NULL,
        "createdAt"    timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "fk_document_versions_document"
          FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_document_versions_doc_version" ON "document_versions" ("documentId", "version")
    `);

    // ==================== DOCUMENT SHARES ====================
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_shares" (
        "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "documentId"        uuid NOT NULL,
        "sharedWithUserId"  varchar,
        "sharedWithRole"    varchar(100),
        "permission"        varchar(20) NOT NULL DEFAULT 'view',
        "sharedBy"          varchar NOT NULL,
        "expiresAt"         timestamp,
        "createdAt"         timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "fk_document_shares_document"
          FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_document_shares_doc_user" ON "document_shares" ("documentId", "sharedWithUserId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_document_shares_user" ON "document_shares" ("sharedWithUserId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "document_shares" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "document_versions" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "documents" CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS "document_folders" CASCADE');
  }
}
