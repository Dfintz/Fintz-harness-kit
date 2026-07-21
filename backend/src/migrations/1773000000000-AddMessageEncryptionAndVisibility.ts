import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * AddMessageEncryptionAndVisibility
 *
 * 1. Changes subject column on contact_requests from varchar(255) to text
 *    to accommodate AES-256-GCM encrypted payloads (base64-encoded).
 * 2. Adds visibility enum + visibleToRoles JSONB column for role-based
 *    message access control (n:1 / n:m).
 *
 * The actual encryption/decryption is handled transparently by TypeORM's
 * encryptionTransformer on the entity columns. This migration does not
 * backfill existing plaintext rows; they will remain stored as plaintext
 * at rest until they are re-saved or processed by a dedicated backfill job.
 * Only new or updated rows are encrypted as part of this gradual rollout.
 */
export class AddMessageEncryptionAndVisibility1773000000000 implements MigrationInterface {
  name = 'AddMessageEncryptionAndVisibility1773000000000';

  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    preferredName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [tableName, preferredName]
    );

    return rows[0]?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const visibilityColumn = await this.resolveColumnName(
      queryRunner,
      'contact_requests',
      'visibility'
    );
    const visibleToRolesColumn = await this.resolveColumnName(
      queryRunner,
      'contact_requests',
      'visibleToRoles'
    );

    // Complete schema already includes visibility controls.
    if (visibilityColumn && visibleToRolesColumn) {
      return;
    }

    // 1. Widen subject from varchar(255) → text so encrypted payloads fit
    await queryRunner.changeColumn(
      'contact_requests',
      'subject',
      new TableColumn({
        name: 'subject',
        type: 'text',
        isNullable: false,
      })
    );

    // 2. Create visibility enum type
    // M-08: Idempotent enum creation — safe for migration reruns
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "contact_request_visibility_enum" AS ENUM ('all', 'leadership', 'hr', 'diplomacy', 'recruitment', 'custom');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    // 3. Add visibility column
    await queryRunner.addColumn(
      'contact_requests',
      new TableColumn({
        name: 'visibility',
        type: 'enum',
        enum: ['all', 'leadership', 'hr', 'diplomacy', 'recruitment', 'custom'],
        enumName: 'contact_request_visibility_enum',
        default: `'all'`,
        isNullable: false,
      })
    );

    // 4. Add visibleToRoles JSONB column (for custom visibility)
    await queryRunner.addColumn(
      'contact_requests',
      new TableColumn({
        name: 'visibleToRoles',
        type: 'jsonb',
        isNullable: true,
      })
    );

    // 5. Index on visibility for efficient filtering
    await queryRunner.createIndex(
      'contact_requests',
      new TableIndex({
        name: 'IDX_contact_requests_visibility',
        columnNames: ['visibility'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('contact_requests', 'IDX_contact_requests_visibility');
    await queryRunner.dropColumn('contact_requests', 'visibleToRoles');
    await queryRunner.dropColumn('contact_requests', 'visibility');
    await queryRunner.query(`DROP TYPE IF EXISTS "contact_request_visibility_enum"`);

    // Revert subject back to varchar(255)
    await queryRunner.changeColumn(
      'contact_requests',
      'subject',
      new TableColumn({
        name: 'subject',
        type: 'varchar',
        length: '255',
        isNullable: false,
      })
    );
  }
}
