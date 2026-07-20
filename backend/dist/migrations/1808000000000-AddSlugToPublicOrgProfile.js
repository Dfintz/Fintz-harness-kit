"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSlugToPublicOrgProfile1808000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddSlugToPublicOrgProfile1808000000000 {
    quoteIdentifier(identifier) {
        return `"${identifier.replace(/"/g, '""')}"`;
    }
    async resolveColumnName(queryRunner, tableName, desiredColumnName) {
        const rows = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND lower(column_name) = lower($2)
      ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END, column_name
      LIMIT 1
      `, [tableName, desiredColumnName]);
        return rows[0]?.column_name ?? null;
    }
    async hasIndex(queryRunner, tableName, indexName) {
        const table = await queryRunner.getTable(tableName);
        return table?.indices.some(index => index.name === indexName) ?? false;
    }
    async up(queryRunner) {
        let slugColumnName = await this.resolveColumnName(queryRunner, 'public_org_profiles', 'slug');
        if (!slugColumnName) {
            await queryRunner.addColumn('public_org_profiles', new typeorm_1.TableColumn({
                name: 'slug',
                type: 'varchar',
                length: '255',
                isNullable: true,
            }));
            slugColumnName = 'slug';
        }
        const profileOrganizationIdColumnName = await this.resolveColumnName(queryRunner, 'public_org_profiles', 'organizationId');
        const organizationNameColumnName = await this.resolveColumnName(queryRunner, 'organizations', 'name');
        const createdAtColumnName = (await this.resolveColumnName(queryRunner, 'public_org_profiles', 'createdAt')) ?? 'id';
        if (!profileOrganizationIdColumnName || !organizationNameColumnName) {
            return;
        }
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
        if (!(await this.hasIndex(queryRunner, 'public_org_profiles', 'IDX_public_org_profiles_slug'))) {
            await queryRunner.createIndex('public_org_profiles', new typeorm_1.TableIndex({
                name: 'IDX_public_org_profiles_slug',
                columnNames: [slugColumnName],
                isUnique: true,
                where: `${this.quoteIdentifier(slugColumnName)} IS NOT NULL`,
            }));
        }
    }
    async down(queryRunner) {
        if (await this.hasIndex(queryRunner, 'public_org_profiles', 'IDX_public_org_profiles_slug')) {
            await queryRunner.dropIndex('public_org_profiles', 'IDX_public_org_profiles_slug');
        }
        const slugColumnName = await this.resolveColumnName(queryRunner, 'public_org_profiles', 'slug');
        if (slugColumnName) {
            await queryRunner.dropColumn('public_org_profiles', slugColumnName);
        }
    }
}
exports.AddSlugToPublicOrgProfile1808000000000 = AddSlugToPublicOrgProfile1808000000000;
//# sourceMappingURL=1808000000000-AddSlugToPublicOrgProfile.js.map