import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * CreateWikiPages
 *
 * Phase 3.2.1 — Org Wiki: Entity & Service
 *
 * Creates:
 *   - `wiki_pages` table (Markdown content, tree structure, version tracking)
 *   - `wiki_page_revisions` table (full edit history)
 *   - tsvector GENERATED column + GIN index for full-text search
 *   - All required foreign keys and indexes
 *
 * Idempotent: guards every DDL statement to allow safe re-runs.
 */
export class CreateWikiPages1782000000000 implements MigrationInterface {
  name = 'CreateWikiPages1782000000000';

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
    const pagesTableExists = await queryRunner.hasTable('wiki_pages');
    const revisionsTableExists = await queryRunner.hasTable('wiki_page_revisions');

    if (pagesTableExists && revisionsTableExists) {
      const parentPageColumn = await this.resolveColumnName(
        queryRunner,
        'wiki_pages',
        'parentPageId'
      );
      const organizationColumn = await this.resolveColumnName(
        queryRunner,
        'wiki_pages',
        'organizationId'
      );
      const revisionPageColumn = await this.resolveColumnName(
        queryRunner,
        'wiki_page_revisions',
        'pageId'
      );

      if (parentPageColumn && organizationColumn && revisionPageColumn) {
        return;
      }
    }

    // ────── 1. wiki_pages table ──────────────────────────────────────

    const pagesTable = await queryRunner.getTable('wiki_pages');
    if (!pagesTable) {
      await queryRunner.createTable(
        new Table({
          name: 'wiki_pages',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'organizationId', type: 'varchar', isNullable: false },
            { name: 'title', type: 'varchar', length: '200', isNullable: false },
            { name: 'slug', type: 'varchar', length: '200', isNullable: false },
            { name: 'content', type: 'text', default: "''", isNullable: false },
            { name: 'parentPageId', type: 'uuid', isNullable: true },
            { name: 'sortOrder', type: 'int', default: 0, isNullable: false },
            { name: 'tags', type: 'text', default: "''", isNullable: false },
            { name: 'version', type: 'int', default: 1, isNullable: false },
            { name: 'isLocked', type: 'boolean', default: false, isNullable: false },
            { name: 'createdBy', type: 'varchar', isNullable: false },
            { name: 'lastEditedBy', type: 'uuid', isNullable: true },
            // TenantEntity columns
            { name: 'sharedWithOrgs', type: 'text', default: "''", isNullable: true },
            { name: 'deletedAt', type: 'timestamptz', isNullable: true },
            { name: 'deletedBy', type: 'varchar', isNullable: true },
            // Timestamps
            { name: 'createdAt', type: 'timestamptz', default: 'now()', isNullable: false },
            { name: 'updatedAt', type: 'timestamptz', default: 'now()', isNullable: false },
          ],
        }),
        true
      );
    }

    // ────── 2. wiki_page_revisions table ────────────────────────────

    const revisionsTable = await queryRunner.getTable('wiki_page_revisions');
    if (!revisionsTable) {
      await queryRunner.createTable(
        new Table({
          name: 'wiki_page_revisions',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'pageId', type: 'uuid', isNullable: false },
            { name: 'content', type: 'text', isNullable: false },
            { name: 'editedBy', type: 'uuid', isNullable: false },
            { name: 'changeDescription', type: 'varchar', length: '500', isNullable: true },
            { name: 'version', type: 'int', isNullable: false },
            { name: 'editedAt', type: 'timestamptz', default: 'now()', isNullable: false },
          ],
        }),
        true
      );
    }

    // ────── 3. Foreign keys ────────────────────────────────────────

    const pages = await queryRunner.getTable('wiki_pages');
    if (pages) {
      // parentPageId → wiki_pages(id) self-reference
      if (!pages.foreignKeys.find(fk => fk.name === 'FK_wiki_page_parent')) {
        await queryRunner.createForeignKey(
          'wiki_pages',
          new TableForeignKey({
            name: 'FK_wiki_page_parent',
            columnNames: ['parentPageId'],
            referencedTableName: 'wiki_pages',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          })
        );
      }

      // organizationId → organizations(id)
      if (!pages.foreignKeys.find(fk => fk.name === 'FK_wiki_page_org')) {
        await queryRunner.createForeignKey(
          'wiki_pages',
          new TableForeignKey({
            name: 'FK_wiki_page_org',
            columnNames: ['organizationId'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          })
        );
      }
    }

    const revisions = await queryRunner.getTable('wiki_page_revisions');
    if (revisions) {
      if (!revisions.foreignKeys.find(fk => fk.name === 'FK_wiki_revision_page')) {
        await queryRunner.createForeignKey(
          'wiki_page_revisions',
          new TableForeignKey({
            name: 'FK_wiki_revision_page',
            columnNames: ['pageId'],
            referencedTableName: 'wiki_pages',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          })
        );
      }
    }

    // ────── 4. Indexes ─────────────────────────────────────────────

    const indexDefs: {
      table: string;
      name: string;
      columns: string[];
      isUnique?: boolean;
    }[] = [
      {
        table: 'wiki_pages',
        name: 'idx_wiki_org_slug',
        columns: ['organizationId', 'slug'],
        isUnique: true,
      },
      { table: 'wiki_pages', name: 'idx_wiki_parent', columns: ['parentPageId'] },
      {
        table: 'wiki_pages',
        name: 'idx_wiki_org_created',
        columns: ['organizationId', 'createdAt'],
      },
      { table: 'wiki_page_revisions', name: 'idx_revision_page', columns: ['pageId'] },
      {
        table: 'wiki_page_revisions',
        name: 'idx_revision_page_version',
        columns: ['pageId', 'version'],
      },
    ];

    for (const idx of indexDefs) {
      const tbl = await queryRunner.getTable(idx.table);
      if (tbl && !tbl.indices.find(i => i.name === idx.name)) {
        await queryRunner.createIndex(
          idx.table,
          new TableIndex({
            name: idx.name,
            columnNames: idx.columns,
            isUnique: idx.isUnique ?? false,
          })
        );
      }
    }

    // ────── 5. Full-text search (tsvector + GIN) ───────────────────

    // Add GENERATED ALWAYS tsvector column for title + content search
    // Raw SQL required — TypeORM has no native GENERATED column support
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'wiki_pages' AND column_name = 'search_vector'
        ) THEN
          ALTER TABLE wiki_pages ADD COLUMN search_vector tsvector
            GENERATED ALWAYS AS (
              to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
            ) STORED;
        END IF;
      END $$;
    `);

    // GIN index on tsvector column
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_wiki_search
        ON wiki_pages USING GIN (search_vector);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop GIN index
    await queryRunner.query(`DROP INDEX IF EXISTS idx_wiki_search;`);

    // Drop tsvector column
    await queryRunner.query(`
      ALTER TABLE wiki_pages DROP COLUMN IF EXISTS search_vector;
    `);

    // Drop indexes
    const indexNames = [
      { table: 'wiki_page_revisions', name: 'idx_revision_page_version' },
      { table: 'wiki_page_revisions', name: 'idx_revision_page' },
      { table: 'wiki_pages', name: 'idx_wiki_org_created' },
      { table: 'wiki_pages', name: 'idx_wiki_parent' },
      { table: 'wiki_pages', name: 'idx_wiki_org_slug' },
    ];
    for (const { table, name } of indexNames) {
      const tbl = await queryRunner.getTable(table);
      if (tbl) {
        const idx = tbl.indices.find(i => i.name === name);
        if (idx) {
          await queryRunner.dropIndex(table, idx);
        }
      }
    }

    // Drop foreign keys
    const revisions = await queryRunner.getTable('wiki_page_revisions');
    if (revisions) {
      const fk = revisions.foreignKeys.find(f => f.name === 'FK_wiki_revision_page');
      if (fk) {
        await queryRunner.dropForeignKey('wiki_page_revisions', fk);
      }
    }

    const pages = await queryRunner.getTable('wiki_pages');
    if (pages) {
      const fkOrg = pages.foreignKeys.find(f => f.name === 'FK_wiki_page_org');
      if (fkOrg) {
        await queryRunner.dropForeignKey('wiki_pages', fkOrg);
      }

      const fkParent = pages.foreignKeys.find(f => f.name === 'FK_wiki_page_parent');
      if (fkParent) {
        await queryRunner.dropForeignKey('wiki_pages', fkParent);
      }
    }

    // Drop tables
    await queryRunner.dropTable('wiki_page_revisions', true);
    await queryRunner.dropTable('wiki_pages', true);
  }
}
