"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryAnalyzerService = exports.QueryAnalyzerService = void 0;
const data_source_1 = require("../../data-source");
const logger_1 = require("../../utils/logger");
class QueryAnalyzerService {
    queryHistory = [];
    maxHistorySize;
    slowQueryThreshold;
    dataSource;
    constructor(options) {
        this.maxHistorySize = options?.maxHistorySize ?? 1000;
        this.slowQueryThreshold = options?.slowQueryThreshold ?? 100;
        this.dataSource = options?.dataSource ?? data_source_1.AppDataSource;
        logger_1.logger.info('QueryAnalyzerService initialized', {
            maxHistorySize: this.maxHistorySize,
            slowQueryThreshold: this.slowQueryThreshold
        });
    }
    recordQuery(metrics) {
        if (this.queryHistory.length >= this.maxHistorySize) {
            this.queryHistory.shift();
        }
        this.queryHistory.push(metrics);
        if (metrics.duration >= this.slowQueryThreshold) {
            logger_1.logger.warn('Slow query detected', {
                query: this.sanitizeQuery(metrics.query),
                duration: `${metrics.duration}ms`,
                threshold: `${this.slowQueryThreshold}ms`
            });
        }
    }
    async measureQuery(queryFn, queryDescription) {
        const startTime = Date.now();
        try {
            const result = await queryFn();
            const duration = Date.now() - startTime;
            this.recordQuery({
                query: queryDescription,
                duration,
                timestamp: new Date()
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.recordQuery({
                query: queryDescription,
                duration,
                timestamp: new Date()
            });
            throw error;
        }
    }
    getQueryStats() {
        if (this.queryHistory.length === 0) {
            return {
                totalQueries: 0,
                averageDuration: 0,
                maxDuration: 0,
                minDuration: 0,
                p50Duration: 0,
                p95Duration: 0,
                p99Duration: 0,
                slowQueryCount: 0,
                queriesByTable: {}
            };
        }
        const durations = this.queryHistory.map(q => q.duration).sort((a, b) => a - b);
        const totalDuration = durations.reduce((sum, d) => sum + d, 0);
        const queriesByTable = {};
        this.queryHistory.forEach(q => {
            const tableName = this.extractTableName(q.query);
            if (tableName) {
                queriesByTable[tableName] = (queriesByTable[tableName] || 0) + 1;
            }
        });
        return {
            totalQueries: this.queryHistory.length,
            averageDuration: Math.round(totalDuration / this.queryHistory.length * 100) / 100,
            maxDuration: durations[durations.length - 1],
            minDuration: durations[0],
            p50Duration: this.getPercentile(durations, 50),
            p95Duration: this.getPercentile(durations, 95),
            p99Duration: this.getPercentile(durations, 99),
            slowQueryCount: this.queryHistory.filter(q => q.duration >= this.slowQueryThreshold).length,
            queriesByTable
        };
    }
    analyzeSlowQueries() {
        const slowQueries = this.queryHistory.filter(q => q.duration >= this.slowQueryThreshold);
        const queryPatterns = new Map();
        slowQueries.forEach(q => {
            const pattern = this.normalizeQuery(q.query);
            const existing = queryPatterns.get(pattern) || [];
            existing.push(q);
            queryPatterns.set(pattern, existing);
        });
        const analyses = [];
        queryPatterns.forEach((queries, pattern) => {
            const avgDuration = queries.reduce((sum, q) => sum + q.duration, 0) / queries.length;
            analyses.push({
                query: pattern,
                averageDuration: Math.round(avgDuration * 100) / 100,
                executionCount: queries.length,
                suggestion: this.getSuggestion(pattern, avgDuration)
            });
        });
        return analyses.sort((a, b) => b.averageDuration - a.averageDuration);
    }
    getIndexRecommendations() {
        const recommendations = [];
        const tableQueries = new Map();
        this.queryHistory.forEach(q => {
            const tableName = this.extractTableName(q.query);
            const whereColumns = this.extractWhereColumns(q.query);
            if (tableName && whereColumns.length > 0) {
                const existing = tableQueries.get(tableName) || [];
                existing.push(...whereColumns);
                tableQueries.set(tableName, existing);
            }
        });
        tableQueries.forEach((columns, table) => {
            const columnCounts = new Map();
            columns.forEach(col => {
                const count = columnCounts.get(col) || 0;
                columnCounts.set(col, count + 1);
            });
            columnCounts.forEach((count, column) => {
                if (count > this.queryHistory.length * 0.1) {
                    recommendations.push({
                        table,
                        columns: [column],
                        reason: `Column "${column}" appears in ${count} WHERE clauses`,
                        estimatedImprovement: this.estimateImprovement(count)
                    });
                }
            });
        });
        return recommendations;
    }
    async getExistingIndices(tableName) {
        if (!this.dataSource.isInitialized) {
            return [];
        }
        try {
            const query = tableName
                ? `
                    SELECT 
                        t.relname as table_name,
                        i.relname as index_name,
                        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
                        ix.indisunique as is_unique
                    FROM pg_class t
                    JOIN pg_index ix ON t.oid = ix.indrelid
                    JOIN pg_class i ON i.oid = ix.indexrelid
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                    WHERE t.relname = $1
                    GROUP BY t.relname, i.relname, ix.indisunique
                    ORDER BY t.relname, i.relname
                `
                : `
                    SELECT 
                        t.relname as table_name,
                        i.relname as index_name,
                        array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
                        ix.indisunique as is_unique
                    FROM pg_class t
                    JOIN pg_index ix ON t.oid = ix.indrelid
                    JOIN pg_class i ON i.oid = ix.indexrelid
                    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
                    WHERE t.relkind = 'r' 
                    AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                    GROUP BY t.relname, i.relname, ix.indisunique
                    ORDER BY t.relname, i.relname
                `;
            const results = tableName
                ? await this.dataSource.query(query, [tableName])
                : await this.dataSource.query(query);
            return results.map((row) => ({
                tableName: row.table_name,
                indexName: row.index_name,
                columns: row.columns,
                isUnique: row.is_unique
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get existing indices', { error });
            return [];
        }
    }
    async getTableStats() {
        if (!this.dataSource.isInitialized) {
            return [];
        }
        try {
            const query = `
                SELECT 
                    relname as table_name,
                    n_live_tup as row_count,
                    n_dead_tup as dead_rows,
                    last_vacuum,
                    last_analyze
                FROM pg_stat_user_tables
                ORDER BY n_live_tup DESC
            `;
            const results = await this.dataSource.query(query);
            return results.map((row) => ({
                tableName: row.table_name,
                rowCount: parseInt(row.row_count, 10),
                deadRows: parseInt(row.dead_rows, 10),
                lastVacuum: row.last_vacuum,
                lastAnalyze: row.last_analyze
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get table stats', { error });
            return [];
        }
    }
    clearHistory() {
        this.queryHistory = [];
        logger_1.logger.info('Query history cleared');
    }
    getRecentQueries(limit = 100) {
        return this.queryHistory.slice(-limit);
    }
    sanitizeQuery(query) {
        return query
            .replace(/'\d{4}-\d{2}-\d{2}[^']*'/g, "'<date>'")
            .replace(/'[^']{32,}'/g, "'<token>'")
            .replace(/'[a-f0-9-]{36}'/gi, "'<uuid>'")
            .substring(0, 500);
    }
    normalizeQuery(query) {
        return query
            .replace(/\s+/g, ' ')
            .replace(/'[^']*'/g, '?')
            .replace(/\d+/g, '?')
            .trim()
            .substring(0, 200);
    }
    extractTableName(query) {
        const normalizedQuery = query.toUpperCase();
        const patterns = [
            /FROM\s+(\w+)/i,
            /INTO\s+(\w+)/i,
            /UPDATE\s+(\w+)/i,
            /DELETE\s+FROM\s+(\w+)/i
        ];
        for (const pattern of patterns) {
            const match = normalizedQuery.match(pattern);
            if (match) {
                return match[1].toLowerCase();
            }
        }
        return null;
    }
    extractWhereColumns(query) {
        const columns = [];
        const whereMatch = query.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i);
        if (whereMatch) {
            const whereClause = whereMatch[1];
            const columnMatches = whereClause.match(/(\w+)\s*(?:=|>|<|LIKE|IN|IS)/gi);
            if (columnMatches) {
                columnMatches.forEach(match => {
                    const col = match.replace(/\s*(=|>|<|LIKE|IN|IS).*/i, '').trim();
                    if (col && !columns.includes(col)) {
                        columns.push(col.toLowerCase());
                    }
                });
            }
        }
        return columns;
    }
    getPercentile(sortedArray, percentile) {
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
    }
    getSuggestion(queryPattern, avgDuration) {
        const suggestions = [];
        if (queryPattern.includes('LIKE')) {
            suggestions.push('Consider using full-text search instead of LIKE with wildcards');
        }
        if (!queryPattern.includes('LIMIT')) {
            suggestions.push('Add LIMIT clause to prevent large result sets');
        }
        if (queryPattern.includes('SELECT *')) {
            suggestions.push('Select only needed columns instead of SELECT *');
        }
        if (avgDuration > 500) {
            suggestions.push('Consider adding appropriate indices');
        }
        if (avgDuration > 1000) {
            suggestions.push('Consider caching this query result');
        }
        return suggestions.length > 0
            ? suggestions.join('; ')
            : 'Review query execution plan with EXPLAIN ANALYZE';
    }
    estimateImprovement(queryCount) {
        if (queryCount > 100) {
            return 'High - significant performance improvement expected';
        }
        else if (queryCount > 50) {
            return 'Medium - noticeable performance improvement expected';
        }
        else {
            return 'Low - minor performance improvement expected';
        }
    }
}
exports.QueryAnalyzerService = QueryAnalyzerService;
exports.queryAnalyzerService = new QueryAnalyzerService();
//# sourceMappingURL=QueryAnalyzerService.js.map