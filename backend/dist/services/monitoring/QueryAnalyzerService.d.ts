import { DataSource } from 'typeorm';
export interface QueryMetrics {
    query: string;
    duration: number;
    timestamp: Date;
    rowsAffected?: number;
    parameters?: unknown[];
}
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
export interface SlowQueryAnalysis {
    query: string;
    averageDuration: number;
    executionCount: number;
    suggestion: string;
}
export interface IndexRecommendation {
    table: string;
    columns: string[];
    reason: string;
    estimatedImprovement: string;
}
export declare class QueryAnalyzerService {
    private queryHistory;
    private readonly maxHistorySize;
    private readonly slowQueryThreshold;
    private dataSource;
    constructor(options?: {
        maxHistorySize?: number;
        slowQueryThreshold?: number;
        dataSource?: DataSource;
    });
    recordQuery(metrics: QueryMetrics): void;
    measureQuery<T>(queryFn: () => Promise<T>, queryDescription: string): Promise<T>;
    getQueryStats(): QueryStats;
    analyzeSlowQueries(): SlowQueryAnalysis[];
    getIndexRecommendations(): IndexRecommendation[];
    getExistingIndices(tableName?: string): Promise<Array<{
        tableName: string;
        indexName: string;
        columns: string[];
        isUnique: boolean;
    }>>;
    getTableStats(): Promise<Array<{
        tableName: string;
        rowCount: number;
        deadRows: number;
        lastVacuum: Date | null;
        lastAnalyze: Date | null;
    }>>;
    clearHistory(): void;
    getRecentQueries(limit?: number): QueryMetrics[];
    private sanitizeQuery;
    private normalizeQuery;
    private extractTableName;
    private extractWhereColumns;
    private getPercentile;
    private getSuggestion;
    private estimateImprovement;
}
export declare const queryAnalyzerService: QueryAnalyzerService;
//# sourceMappingURL=QueryAnalyzerService.d.ts.map