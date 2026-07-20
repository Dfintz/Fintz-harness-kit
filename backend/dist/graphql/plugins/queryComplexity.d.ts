import { ApolloServerPlugin, BaseContext } from '@apollo/server';
import { DocumentNode } from 'graphql';
export interface FieldComplexityConfig {
    baseCost?: number;
    listMultiplier?: number;
    estimator?: (args: Record<string, unknown>) => number;
}
export interface ComplexityResult {
    complexity: number;
    depth: number;
    fields: Record<string, number>;
    exceeds: boolean;
    message?: string;
}
export interface QueryComplexityPluginOptions {
    maxComplexity?: number;
    maxDepth?: number;
    defaultFieldCost?: number;
    defaultListMultiplier?: number;
    fieldConfigs?: Record<string, FieldComplexityConfig>;
    onComplexity?: (result: ComplexityResult, context: BaseContext) => void;
    logComplexity?: boolean;
    skipInDevelopment?: boolean;
}
export declare class QueryComplexityAnalyzer {
    private readonly options;
    private readonly fieldConfigs;
    constructor(options?: QueryComplexityPluginOptions);
    analyze(document: DocumentNode, variables?: Record<string, unknown>, operationName?: string | null): ComplexityResult;
    private extractFragments;
    private findOperation;
    private calculateComplexity;
    private extractArguments;
    private findLimitArgument;
    private guessChildType;
}
export declare function createQueryComplexityPlugin(options?: QueryComplexityPluginOptions): ApolloServerPlugin;
export interface ComplexityMetrics {
    totalQueries: number;
    rejectedQueries: number;
    averageComplexity: number;
    maxComplexity: number;
    averageDepth: number;
    maxDepth: number;
    complexityDistribution: {
        low: number;
        medium: number;
        high: number;
        veryHigh: number;
    };
}
export declare class ComplexityMetricsCollector {
    private metrics;
    private complexitySum;
    private depthSum;
    record(result: ComplexityResult): void;
    getMetrics(): ComplexityMetrics;
    reset(): void;
}
export declare const complexityMetrics: ComplexityMetricsCollector;
export declare const queryComplexityPlugin: ApolloServerPlugin<BaseContext>;
//# sourceMappingURL=queryComplexity.d.ts.map