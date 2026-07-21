import { DataSource } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { logger } from '../../utils/logger';

/**
 * Query metrics interface for tracking query performance
 */
export interface QueryMetrics {
    query: string;
    duration: number;
    timestamp: Date;
    rowsAffected?: number;
    parameters?: unknown[];
}

/**
 * Query statistics aggregation
 */
export interface QueryStats {
    totalQueries: number;
    averageDuration: number;
    maxDuration: number;
    minDuration: number;
    p50Duration: number;
    p95Duration: number;
    p99Duration: number;
    slowQueryCount: number;
    queriesByTable: Record<string, number>;
}

/**
 * Slow query analysis result
 */
export interface SlowQueryAnalysis {
    query: string;
    averageDuration: number;
    executionCount: number;
    suggestion: string;
}

/**
 * Index recommendation result
 */
export interface IndexRecommendation {
    table: string;
    columns: string[];
    reason: string;
    estimatedImprovement: string;
}

/**
 * Query Analyzer Service
 * 
 * Provides database query performance analysis, slow query detection,
 * and index recommendations for optimization.
 * 
 * Features:
 * - Query execution time tracking
 * - Slow query detection and logging
 * - Query pattern analysis
 * - Index recommendations
 * - Query statistics aggregation
 */
export class QueryAnalyzerService {
    private queryHistory: QueryMetrics[] = [];
    private readonly maxHistorySize: number;
    private readonly slowQueryThreshold: number;
    private dataSource: DataSource;

    constructor(options?: {
        maxHistorySize?: number;
        slowQueryThreshold?: number;
        dataSource?: DataSource;
    }) {
        this.maxHistorySize = options?.maxHistorySize ?? 1000;
        this.slowQueryThreshold = options?.slowQueryThreshold ?? 100; // ms
        this.dataSource = options?.dataSource ?? AppDataSource;

        logger.info('QueryAnalyzerService initialized', {
            maxHistorySize: this.maxHistorySize,
            slowQueryThreshold: this.slowQueryThreshold
        });
    }

    /**
     * Record a query execution with timing
     */
    public recordQuery(metrics: QueryMetrics): void {
        // Maintain max history size
        if (this.queryHistory.length >= this.maxHistorySize) {
            this.queryHistory.shift();
        }

        this.queryHistory.push(metrics);

        // Log slow queries
        if (metrics.duration >= this.slowQueryThreshold) {
            logger.warn('Slow query detected', {
                query: this.sanitizeQuery(metrics.query),
                duration: `${metrics.duration}ms`,
                threshold: `${this.slowQueryThreshold}ms`
            });
        }
    }

    /**
     * Wrap a query execution with timing
     */
    public async measureQuery<T>(
        queryFn: () => Promise<T>,
        queryDescription: string
    ): Promise<T> {
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
        } catch (error: unknown) {
            const duration = Date.now() - startTime;
            this.recordQuery({
                query: queryDescription,
                duration,
                timestamp: new Date()
            });
            throw error;
        }
    }

    /**
     * Get query statistics
     */
    public getQueryStats(): QueryStats {
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

        // Extract table names from queries
        const queriesByTable: Record<string, number> = {};
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

    /**
     * Analyze slow queries and provide recommendations
     */
    public analyzeSlowQueries(): SlowQueryAnalysis[] {
        const slowQueries = this.queryHistory.filter(q => q.duration >= this.slowQueryThreshold);
        
        // Group by query pattern
        const queryPatterns: Map<string, QueryMetrics[]> = new Map();
        
        slowQueries.forEach(q => {
            const pattern = this.normalizeQuery(q.query);
            const existing = queryPatterns.get(pattern) || [];
            existing.push(q);
            queryPatterns.set(pattern, existing);
        });

        const analyses: SlowQueryAnalysis[] = [];
        
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

    /**
     * Get index recommendations based on query patterns
     */
    public getIndexRecommendations(): IndexRecommendation[] {
        const recommendations: IndexRecommendation[] = [];
        const tableQueries: Map<string, string[]> = new Map();

        // Analyze queries for common patterns
        this.queryHistory.forEach(q => {
            const tableName = this.extractTableName(q.query);
            const whereColumns = this.extractWhereColumns(q.query);
            
            if (tableName && whereColumns.length > 0) {
                const existing = tableQueries.get(tableName) || [];
                existing.push(...whereColumns);
                tableQueries.set(tableName, existing);
            }
        });

        // Find frequently queried column combinations
        tableQueries.forEach((columns, table) => {
            const columnCounts: Map<string, number> = new Map();
            
            columns.forEach(col => {
                const count = columnCounts.get(col) || 0;
                columnCounts.set(col, count + 1);
            });

            // Recommend indices for frequently queried columns
            columnCounts.forEach((count, column) => {
                if (count > this.queryHistory.length * 0.1) { // More than 10% of queries
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

    /**
     * Check existing database indices
     */
    public async getExistingIndices(tableName?: string): Promise<Array<{
        tableName: string;
        indexName: string;
        columns: string[];
        isUnique: boolean;
    }>> {
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

            return results.map((row: {
                table_name: string;
                index_name: string;
                columns: string[];
                is_unique: boolean;
            }) => ({
                tableName: row.table_name,
                indexName: row.index_name,
                columns: row.columns,
                isUnique: row.is_unique
            }));
        } catch (error: unknown) {
            logger.error('Failed to get existing indices', { error });
            return [];
        }
    }

    /**
     * Analyze table statistics for optimization opportunities
     */
    public async getTableStats(): Promise<Array<{
        tableName: string;
        rowCount: number;
        deadRows: number;
        lastVacuum: Date | null;
        lastAnalyze: Date | null;
    }>> {
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
            return results.map((row: {
                table_name: string;
                row_count: string;
                dead_rows: string;
                last_vacuum: Date | null;
                last_analyze: Date | null;
            }) => ({
                tableName: row.table_name,
                rowCount: parseInt(row.row_count, 10),
                deadRows: parseInt(row.dead_rows, 10),
                lastVacuum: row.last_vacuum,
                lastAnalyze: row.last_analyze
            }));
        } catch (error: unknown) {
            logger.error('Failed to get table stats', { error });
            return [];
        }
    }

    /**
     * Clear query history
     */
    public clearHistory(): void {
        this.queryHistory = [];
        logger.info('Query history cleared');
    }

    /**
     * Get recent queries
     */
    public getRecentQueries(limit: number = 100): QueryMetrics[] {
        return this.queryHistory.slice(-limit);
    }

    // Private helper methods

    private sanitizeQuery(query: string): string {
        // Remove sensitive values from query for logging
        return query
            .replace(/'\d{4}-\d{2}-\d{2}[^']*'/g, "'<date>'")
            .replace(/'[^']{32,}'/g, "'<token>'")
            .replace(/'[a-f0-9-]{36}'/gi, "'<uuid>'")
            .substring(0, 500);
    }

    private normalizeQuery(query: string): string {
        // Normalize query for pattern matching
        return query
            .replace(/\s+/g, ' ')
            .replace(/'[^']*'/g, '?')
            .replace(/\d+/g, '?')
            .trim()
            .substring(0, 200);
    }

    private extractTableName(query: string): string | null {
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

    private extractWhereColumns(query: string): string[] {
        const columns: string[] = [];
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

    private getPercentile(sortedArray: number[], percentile: number): number {
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, index)];
    }

    private getSuggestion(queryPattern: string, avgDuration: number): string {
        const suggestions: string[] = [];
        
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

    private estimateImprovement(queryCount: number): string {
        if (queryCount > 100) {
            return 'High - significant performance improvement expected';
        } else if (queryCount > 50) {
            return 'Medium - noticeable performance improvement expected';
        } else {
            return 'Low - minor performance improvement expected';
        }
    }
}

// Export singleton instance
export const queryAnalyzerService = new QueryAnalyzerService();

