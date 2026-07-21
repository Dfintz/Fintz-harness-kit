import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Migration: Add slug column to public_org_profiles table.
 *
 * Stores a URL-friendly slug derived from the organization name.
 * Enables efficient slug-based lookups for public directory pages
 * instead of scanning all profiles to match by computed slug.
 *
 * NOTE: The backfill SQL uses REGEXP_REPLACE without NFD normalization,
 * so names with diacritical marks (e.g., "Crème Brûlée Org") may produce
 * different slugs than the runtime slugify() utility which uses NFD.
 * This is accepted — future profile saves will regenerate the slug
 * via the TypeScript slugify() function, and the DB unique index
 * prevents collisions.
 */
export class AddSlugToPublicOrgProfile1808000000000 implements MigrationInterface {
  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    desiredColumnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `,
      [tableName, desiredColumnName]
    );

    return (rows[0] as { column_name?: string } | undefined)?.column_name ?? null;
  }

  private async hasIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string
  ): Promise<boolean> {
    const table = await queryRunner.getTable(tableName);
    return table?.indices.some(index => index.name === indexName) ?? false;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    let slugColumnName = await this.resolveColumnName(queryRunner, 'public_org_profiles', 'slug');

    // Add slug column (nullable initially for backfill)
    if (!slugColumnName) {
      await queryRunner.addColumn(
        'public_org_profiles',
        new TableColumn({
          name: 'slug',
          type: 'varchar',
          length: '255',
          isNullable: true,
        })
      );
      slugColumnName = 'slug';
    }

    const profileOrganizationIdColumnName = await this.resolveColumnName(
      queryRunner,
      'public_org_profiles',
      'organizationId'
    );
    const organizationNameColumnName = await this.resolveColumnName(
      queryRunner,
      'organizations',
      'name'
    );
    const createdAtColumnName =
      (await this.resolveColumnName(queryRunner, 'public_org_profiles', 'createdAt')) ?? 'id';

    if (!profileOrganizationIdColumnName || !organizationNameColumnName) {
      return;
    }

    // Backfill slugs from organization names
    // Uses PostgreSQL string functions to approximate slugify:
    // lowercase → replace non-alnum with hyphens → collapse multiple hyphens → trim hyphens
    await queryRunner.query(`
      UPDATE public_org_profiles p
      SET ${this.quoteIdentifier(slugColumnName)} = TRIM(BOTH '-' FROM
        REGEXP_REPLACE(
          REGEXP_REPLACE(
            LOWER(o.${this.quoteIdentifier(organizationNameColumnName)}),
            '[^a-z0-9\\s-]', '', 'g'
          ),
          '[\\s-]+', '-', 'g'
        )
      )
      FROM organizations o
      WHERE p.${this.quoteIdentifier(profileOrganizationIdColumnName)} = o.id
    `);

    // Deduplicate slugs: append '-N' suffix where collisions exist
    await queryRunner.query(`
      UPDATE public_org_profiles p
      SET ${this.quoteIdentifier(slugColumnName)} = p.${this.quoteIdentifier(slugColumnName)} || '-' || sub.rn
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY ${this.quoteIdentifier(slugColumnName)} ORDER BY ${this.quoteIdentifier(createdAtColumnName)}) AS rn
        FROM public_org_profiles
        WHERE ${this.quoteIdentifier(slugColumnName)} IS NOT NULL
      ) sub
      WHERE p.id = sub.id AND sub.rn > 1
    `);

    // Add unique index on slug (allowing nulls for orgs without names)
    if (
      !(await this.hasIndex(queryRunner, 'public_org_profiles', 'IDX_public_org_profiles_slug'))
    ) {
      await queryRunner.createIndex(
        'public_org_profiles',
        new TableIndex({
          name: 'IDX_public_org_profiles_slug',
          columnNames: [slugColumnName],
          isUnique: true,
          where: `${this.quoteIdentifier(slugColumnName)} IS NOT NULL`,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.hasIndex(queryRunner, 'public_org_profiles', 'IDX_public_org_profiles_slug')) {
      await queryRunner.dropIndex('public_org_profiles', 'IDX_public_org_profiles_slug');
    }

    const slugColumnName = await this.resolveColumnName(queryRunner, 'public_org_profiles', 'slug');
    if (slugColumnName) {
      await queryRunner.dropColumn('public_org_profiles', slugColumnName);
    }
  }
}
