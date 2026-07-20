"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddScaleOptimizationIndexes1844000000000 = void 0;
class AddScaleOptimizationIndexes1844000000000 {
    name = 'AddScaleOptimizationIndexes1844000000000';
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
    async resolveRequiredColumns(queryRunner, tableName, desiredColumnNames) {
        const resolved = [];
        for (const desiredColumnName of desiredColumnNames) {
            const columnName = await this.resolveColumnName(queryRunner, tableName, desiredColumnName);
            if (!columnName) {
                return null;
            }
            resolved.push(columnName);
        }
        return resolved;
    }
    async createIndexIfColumnsExist(queryRunner, options) {
        const keyColumnNames = await this.resolveRequiredColumns(queryRunner, options.tableName, options.keyColumns.map(column => column.name));
        if (!keyColumnNames) {
            return;
        }
        const keyClauses = keyColumnNames.map((columnName, index) => {
            const direction = options.keyColumns[index]?.direction;
            return `${this.quoteIdentifier(columnName)}${direction ? ` ${direction}` : ''}`;
        });
        let includeClause = '';
        if (options.includeColumns && options.includeColumns.length > 0) {
            const includeColumnNames = await this.resolveRequiredColumns(queryRunner, options.tableName, options.includeColumns);
            if (!includeColumnNames) {
                return;
            }
            includeClause = ` INCLUDE (${includeColumnNames.map(column => this.quoteIdentifier(column)).join(', ')})`;
        }
        const whereClause = options.where ? ` WHERE ${options.where}` : '';
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS ${this.quoteIdentifier(options.indexName)} ON ${this.quoteIdentifier(options.tableName)} (${keyClauses.join(', ')})${includeClause}${whereClause}`);
    }
    async up(queryRunner) {
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_membership_org_active',
            tableName: 'organization_memberships',
            keyColumns: [{ name: 'organizationId' }, { name: 'isActive' }],
            includeColumns: ['userId', 'roleId', 'joinedAt'],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_org_ships_org_active',
            tableName: 'organization_ships',
            keyColumns: [{ name: 'organizationId' }, { name: 'isActive' }],
        });
        const sharingLevelColumn = await this.resolveColumnName(queryRunner, 'user_ships', 'sharingLevel');
        const statusColumn = await this.resolveColumnName(queryRunner, 'user_ships', 'status');
        if (sharingLevelColumn && statusColumn) {
            await this.createIndexIfColumnsExist(queryRunner, {
                indexName: 'idx_user_ships_sharing',
                tableName: 'user_ships',
                keyColumns: [{ name: sharingLevelColumn }, { name: statusColumn }],
                where: `${this.quoteIdentifier(sharingLevelColumn)} IN ('organization', 'alliance')`,
            });
        }
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_activity_org_date',
            tableName: 'activities',
            keyColumns: [{ name: 'organizationId' }, { name: 'scheduledStartDate', direction: 'DESC' }],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_trade_txn_org_date',
            tableName: 'trade_transactions',
            keyColumns: [{ name: 'organizationId' }, { name: 'executedAt', direction: 'DESC' }],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_trade_routes_org',
            tableName: 'trading_routes',
            keyColumns: [{ name: 'organizationId' }],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_credit_txn_org',
            tableName: 'credit_transactions',
            keyColumns: [
                { name: 'organizationId' },
                { name: 'createdBy' },
                { name: 'createdAt', direction: 'DESC' },
            ],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_credit_txn_category',
            tableName: 'credit_transactions',
            keyColumns: [
                { name: 'organizationId' },
                { name: 'category' },
                { name: 'createdAt', direction: 'DESC' },
            ],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_bounties_org',
            tableName: 'bounties',
            keyColumns: [
                { name: 'organizationId' },
                { name: 'status' },
                { name: 'createdAt', direction: 'DESC' },
            ],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_hunter_profiles_org',
            tableName: 'hunter_profiles',
            keyColumns: [
                { name: 'organizationId' },
                { name: 'totalBountiesCompleted', direction: 'DESC' },
            ],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_bounty_claims_hunter',
            tableName: 'bounty_claims',
            keyColumns: [{ name: 'hunterId' }, { name: 'organizationId' }, { name: 'status' }],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_intel_org_expiry',
            tableName: 'intel_entries',
            keyColumns: [{ name: 'organizationId' }, { name: 'expirationDate' }],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_poll_votes',
            tableName: 'poll_votes',
            keyColumns: [{ name: 'pollId' }],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_rsi_crawled_org',
            tableName: 'rsi_crawled_members',
            keyColumns: [{ name: 'organizationSid' }],
        });
        await this.createIndexIfColumnsExist(queryRunner, {
            indexName: 'idx_reputation_score',
            tableName: 'lfg_user_reputation',
            keyColumns: [{ name: 'overallScore', direction: 'DESC' }],
        });
    }
    async down(queryRunner) {
        await queryRunner.query('DROP INDEX IF EXISTS idx_reputation_score');
        await queryRunner.query('DROP INDEX IF EXISTS idx_rsi_crawled_org');
        await queryRunner.query('DROP INDEX IF EXISTS idx_poll_votes');
        await queryRunner.query('DROP INDEX IF EXISTS idx_intel_org_expiry');
        await queryRunner.query('DROP INDEX IF EXISTS idx_bounty_claims_hunter');
        await queryRunner.query('DROP INDEX IF EXISTS idx_hunter_profiles_org');
        await queryRunner.query('DROP INDEX IF EXISTS idx_bounties_org');
        await queryRunner.query('DROP INDEX IF EXISTS idx_credit_txn_category');
        await queryRunner.query('DROP INDEX IF EXISTS idx_credit_txn_org');
        await queryRunner.query('DROP INDEX IF EXISTS idx_trade_routes_org');
        await queryRunner.query('DROP INDEX IF EXISTS idx_trade_txn_org_date');
        await queryRunner.query('DROP INDEX IF EXISTS idx_activity_org_date');
        await queryRunner.query('DROP INDEX IF EXISTS idx_user_ships_sharing');
        await queryRunner.query('DROP INDEX IF EXISTS idx_org_ships_org_active');
        await queryRunner.query('DROP INDEX IF EXISTS idx_membership_org_active');
    }
}
exports.AddScaleOptimizationIndexes1844000000000 = AddScaleOptimizationIndexes1844000000000;
//# sourceMappingURL=1844000000000-AddScaleOptimizationIndexes.js.map