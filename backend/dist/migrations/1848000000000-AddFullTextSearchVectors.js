"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFullTextSearchVectors1848000000000 = void 0;
class AddFullTextSearchVectors1848000000000 {
    name = 'AddFullTextSearchVectors1848000000000';
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
    async up(queryRunner) {
        const dbType = queryRunner.connection.options.type;
        if (dbType !== 'postgres') {
            return;
        }
        await this.addSearchVector(queryRunner, 'users', 'search_vector', [
            { column: 'username', weight: 'A' },
            { column: 'displayName', weight: 'A' },
        ], 'idx_users_search');
        await this.addSearchVector(queryRunner, 'activities', 'search_vector', [
            { column: 'title', weight: 'A' },
            { column: 'description', weight: 'B' },
        ], 'idx_activities_search');
        await this.addSearchVector(queryRunner, 'organizations', 'search_vector', [
            { column: 'name', weight: 'A' },
            { column: 'description', weight: 'B' },
        ], 'idx_organizations_search');
        await this.addSearchVector(queryRunner, 'user_ships', 'search_vector', [
            { column: 'shipName', weight: 'A' },
            { column: 'customName', weight: 'A' },
            { column: 'notes', weight: 'B' },
        ], 'idx_user_ships_search');
        await this.addSearchVector(queryRunner, 'ships', 'search_vector', [
            { column: 'name', weight: 'A' },
            { column: 'manufacturer', weight: 'B' },
        ], 'idx_ships_search');
        await this.addSearchVector(queryRunner, 'bounties', 'search_vector', [
            { column: 'title', weight: 'A' },
            { column: 'description', weight: 'B' },
            { column: 'targetName', weight: 'A' },
        ], 'idx_bounties_search');
        await this.addSearchVector(queryRunner, 'public_job_listings', 'search_vector', [
            { column: 'title', weight: 'A' },
            { column: 'description', weight: 'B' },
        ], 'idx_public_job_listings_search');
        await this.addSearchVector(queryRunner, 'missions', 'search_vector', [
            { column: 'title', weight: 'A' },
            { column: 'description', weight: 'B' },
            { column: 'location', weight: 'A' },
        ], 'idx_missions_search');
        await this.addSearchVector(queryRunner, 'fleets', 'search_vector', [{ column: 'name', weight: 'A' }], 'idx_fleets_search');
    }
    async down(queryRunner) {
        const dbType = queryRunner.connection.options.type;
        if (dbType !== 'postgres') {
            return;
        }
        const tables = [
            { table: 'users', index: 'idx_users_search' },
            { table: 'activities', index: 'idx_activities_search' },
            { table: 'organizations', index: 'idx_organizations_search' },
            { table: 'user_ships', index: 'idx_user_ships_search' },
            { table: 'ships', index: 'idx_ships_search' },
            { table: 'bounties', index: 'idx_bounties_search' },
            { table: 'public_job_listings', index: 'idx_public_job_listings_search' },
            { table: 'missions', index: 'idx_missions_search' },
            { table: 'fleets', index: 'idx_fleets_search' },
        ];
        for (const { table, index } of tables) {
            await queryRunner.query(`DROP INDEX IF EXISTS ${index};`);
            await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS search_vector;`);
        }
    }
    async addSearchVector(queryRunner, table, column, fields, indexName) {
        const weightedExpressions = [];
        for (const field of fields) {
            const resolvedColumn = await this.resolveColumnName(queryRunner, table, field.column);
            if (!resolvedColumn) {
                continue;
            }
            weightedExpressions.push(`setweight(to_tsvector('english', coalesce(${this.quoteIdentifier(resolvedColumn)}, '')), '${field.weight}')`);
        }
        if (weightedExpressions.length === 0) {
            return;
        }
        const expression = weightedExpressions.join(' || ');
        const quotedTable = this.quoteIdentifier(table);
        const quotedColumn = this.quoteIdentifier(column);
        await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'
        ) THEN
          ALTER TABLE ${quotedTable} ADD COLUMN ${quotedColumn} tsvector
            GENERATED ALWAYS AS (${expression}) STORED;
        END IF;
      END $$;
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier(indexName)}
        ON ${quotedTable} USING GIN (${quotedColumn});
    `);
    }
}
exports.AddFullTextSearchVectors1848000000000 = AddFullTextSearchVectors1848000000000;
//# sourceMappingURL=1848000000000-AddFullTextSearchVectors.js.map