/**
 * GraphQL Query Complexity Analysis Plugin
 *
 * Provides query complexity analysis to prevent expensive queries:
 * - Field complexity scoring
 * - Query depth limiting
 * - Configurable complexity limits
 * - Per-operation complexity tracking
 */

import {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from '@apollo/server';
import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLError,
  OperationDefinitionNode,
  SelectionNode,
} from 'graphql';

import { logger } from '../../utils/logger';

/**
 * Complexity configuration for a field
 */
export interface FieldComplexityConfig {
  /** Base complexity cost for the field */
  baseCost?: number;
  /** Multiplier applied when field returns a list */
  listMultiplier?: number;
  /** Custom complexity estimator function */
  estimator?: (args: Record<string, unknown>) => number;
}

/**
 * Query complexity result
 */
export interface ComplexityResult {
  /** Total complexity score */
  complexity: number;
  /** Maximum depth of the query */
  depth: number;
  /** Field breakdown */
  fields: Record<string, number>;
  /** Whether the query exceeds limits */
  exceeds: boolean;
  /** Error message if query exceeds limits */
  message?: string;
}

/**
 * Query complexity plugin options
 */
export interface QueryComplexityPluginOptions {
  /** Maximum allowed complexity (default: 1000) */
  maxComplexity?: number;
  /** Maximum allowed query depth (default: 10) */
  maxDepth?: number;
  /** Default complexity per field (default: 1) */
  defaultFieldCost?: number;
  /** Multiplier for list types (default: 10) */
  defaultListMultiplier?: number;
  /** Field-specific complexity configurations */
  fieldConfigs?: Record<string, FieldComplexityConfig>;
  /** Callback when complexity is calculated */
  onComplexity?: (result: ComplexityResult, context: BaseContext) => void;
  /** Whether to log complexity for each query */
  logComplexity?: boolean;
  /** Whether to skip complexity check in development */
  skipInDevelopment?: boolean;
}

/**
 * Default field complexity configurations for common expensive fields
 */
const DEFAULT_FIELD_CONFIGS: Record<string, FieldComplexityConfig> = {
  // Fleet operations
  'Query.fleets': { baseCost: 5, listMultiplier: 10 },
  'Query.fleet': { baseCost: 3 },
  'Fleet.ships': { baseCost: 2, listMultiplier: 5 },
  'Fleet.members': { baseCost: 2, listMultiplier: 5 },

  // Activity operations
  'Query.activities': { baseCost: 5, listMultiplier: 10 },
  'Query.activity': { baseCost: 3 },
  'Activity.participants': { baseCost: 2, listMultiplier: 5 },

  // Organization operations
  'Query.organizations': { baseCost: 5, listMultiplier: 10 },
  'Query.organization': { baseCost: 3 },
  'Organization.members': { baseCost: 3, listMultiplier: 10 },

  // User operations
  'Query.users': { baseCost: 5, listMultiplier: 10 },
  'Query.user': { baseCost: 2 },
  'User.ships': { baseCost: 2, listMultiplier: 5 },
  'User.activities': { baseCost: 2, listMultiplier: 5 },

  // Ship operations
  'Query.ships': { baseCost: 5, listMultiplier: 10 },
  'Query.ship': { baseCost: 2 },
  'Ship.loadouts': { baseCost: 2, listMultiplier: 5 },
};

/**
 * Query Complexity Analyzer
 *
 * Calculates the complexity of a GraphQL query based on field costs
 */
export class QueryComplexityAnalyzer {
  private readonly options: Required<QueryComplexityPluginOptions>;
  private readonly fieldConfigs: Record<string, FieldComplexityConfig>;

  constructor(options: QueryComplexityPluginOptions = {}) {
    this.options = {
      maxComplexity: options.maxComplexity ?? 1000,
      maxDepth: options.maxDepth ?? 10,
      defaultFieldCost: options.defaultFieldCost ?? 1,
      defaultListMultiplier: options.defaultListMultiplier ?? 10,
      fieldConfigs: options.fieldConfigs ?? {},
      onComplexity: options.onComplexity ?? (() => {}),
      logComplexity: options.logComplexity ?? true,
      skipInDevelopment: options.skipInDevelopment ?? false,
    };

    // Merge default configs with user configs
    this.fieldConfigs = {
      ...DEFAULT_FIELD_CONFIGS,
      ...this.options.fieldConfigs,
    };
  }

  /**
   * Analyze a GraphQL document and return complexity result
   */
  analyze(
    document: DocumentNode,
    variables: Record<string, unknown> = {},
    operationName?: string | null
  ): ComplexityResult {
    const fragments = this.extractFragments(document);
    const operation = this.findOperation(document, operationName);

    if (!operation) {
      return {
        complexity: 0,
        depth: 0,
        fields: {},
        exceeds: false,
      };
    }

    const fieldCounts: Record<string, number> = {};
    const { complexity, depth } = this.calculateComplexity(
      operation.selectionSet.selections,
      operation.operation === 'query'
        ? 'Query'
        : operation.operation === 'mutation'
          ? 'Mutation'
          : 'Subscription',
      fragments,
      variables,
      fieldCounts,
      0
    );

    const exceeds = complexity > this.options.maxComplexity || depth > this.options.maxDepth;
    let message: string | undefined;

    if (complexity > this.options.maxComplexity) {
      message = `Query complexity ${complexity} exceeds maximum allowed complexity ${this.options.maxComplexity}`;
    } else if (depth > this.options.maxDepth) {
      message = `Query depth ${depth} exceeds maximum allowed depth ${this.options.maxDepth}`;
    }

    return {
      complexity,
      depth,
      fields: fieldCounts,
      exceeds,
      message,
    };
  }

  /**
   * Extract fragments from document
   */
  private extractFragments(document: DocumentNode): Map<string, FragmentDefinitionNode> {
    const fragments = new Map<string, FragmentDefinitionNode>();

    for (const definition of document.definitions) {
      if (definition.kind === 'FragmentDefinition') {
        fragments.set(definition.name.value, definition);
      }
    }

    return fragments;
  }

  /**
   * Find the operation to analyze
   */
  private findOperation(
    document: DocumentNode,
    operationName?: string | null
  ): OperationDefinitionNode | undefined {
    for (const definition of document.definitions) {
      if (definition.kind === 'OperationDefinition') {
        if (!operationName || definition.name?.value === operationName) {
          return definition;
        }
      }
    }
    return undefined;
  }

  /**
   * Calculate complexity for a selection set
   */
  private calculateComplexity(
    selections: readonly SelectionNode[],
    parentType: string,
    fragments: Map<string, FragmentDefinitionNode>,
    variables: Record<string, unknown>,
    fieldCounts: Record<string, number>,
    currentDepth: number
  ): { complexity: number; depth: number } {
    let totalComplexity = 0;
    let maxDepth = currentDepth;

    for (const selection of selections) {
      if (selection.kind === 'Field') {
        const fieldName = selection.name.value;
        const fieldPath = `${parentType}.${fieldName}`;

        // Get field configuration
        const config = this.fieldConfigs[fieldPath] || {};
        let fieldCost = config.baseCost ?? this.options.defaultFieldCost;

        // Apply custom estimator if provided
        if (config.estimator) {
          const args = this.extractArguments(selection, variables);
          fieldCost = config.estimator(args);
        }

        // Apply list multiplier if field has nested selections (likely returns list)
        if (selection.selectionSet && config.listMultiplier) {
          const limitArg = this.findLimitArgument(selection, variables);
          const multiplier =
            limitArg ?? config.listMultiplier ?? this.options.defaultListMultiplier;
          fieldCost *= multiplier;
        }

        // Track field counts
        fieldCounts[fieldPath] = (fieldCounts[fieldPath] || 0) + fieldCost;
        totalComplexity += fieldCost;

        // Process nested selections
        if (selection.selectionSet) {
          // Determine child type (simplified - using field name as proxy)
          const childType = this.guessChildType(fieldName);
          const { complexity, depth } = this.calculateComplexity(
            selection.selectionSet.selections,
            childType,
            fragments,
            variables,
            fieldCounts,
            currentDepth + 1
          );
          totalComplexity += complexity;
          maxDepth = Math.max(maxDepth, depth);
        }
      } else if (selection.kind === 'FragmentSpread') {
        const fragment = fragments.get(selection.name.value);
        if (fragment) {
          const { complexity, depth } = this.calculateComplexity(
            fragment.selectionSet.selections,
            fragment.typeCondition.name.value,
            fragments,
            variables,
            fieldCounts,
            currentDepth
          );
          totalComplexity += complexity;
          maxDepth = Math.max(maxDepth, depth);
        }
      } else if (selection.kind === 'InlineFragment') {
        const typeName = selection.typeCondition?.name.value || parentType;
        const { complexity, depth } = this.calculateComplexity(
          selection.selectionSet.selections,
          typeName,
          fragments,
          variables,
          fieldCounts,
          currentDepth
        );
        totalComplexity += complexity;
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return { complexity: totalComplexity, depth: maxDepth };
  }

  /**
   * Extract arguments from a field selection
   */
  private extractArguments(
    field: FieldNode,
    variables: Record<string, unknown>
  ): Record<string, unknown> {
    const args: Record<string, unknown> = {};

    for (const arg of field.arguments || []) {
      const value = arg.value;
      if (value.kind === 'Variable') {
        args[arg.name.value] = variables[value.name.value];
      } else if (value.kind === 'IntValue') {
        args[arg.name.value] = Number.parseInt(value.value, 10);
      } else if (value.kind === 'FloatValue') {
        args[arg.name.value] = Number.parseFloat(value.value);
      } else if (value.kind === 'StringValue') {
        args[arg.name.value] = value.value;
      } else if (value.kind === 'BooleanValue') {
        args[arg.name.value] = value.value;
      }
    }

    return args;
  }

  /**
   * Find limit/first/last argument for pagination
   */
  private findLimitArgument(
    field: FieldNode,
    variables: Record<string, unknown>
  ): number | undefined {
    const args = this.extractArguments(field, variables);
    return (args.limit || args.first || args.last || args.perPage) as number | undefined;
  }

  /**
   * Guess child type from field name (simplified type inference)
   *
   * Maps common field names to their GraphQL types. For unknown fields,
   * falls back to a basic heuristic.
   */
  private guessChildType(fieldName: string): string {
    // Known field name to type mappings for common patterns
    const knownMappings: Record<string, string> = {
      // Collection fields
      fleets: 'Fleet',
      ships: 'Ship',
      members: 'Member',
      users: 'User',
      organizations: 'Organization',
      activities: 'Activity',
      participants: 'Participant',
      roles: 'Role',
      permissions: 'Permission',
      notifications: 'Notification',
      events: 'Event',
      loadouts: 'Loadout',
      trades: 'Trade',
      intel: 'Intel', // Irregular plural
      data: 'Data', // Uncountable
      children: 'Child', // Irregular plural
      people: 'Person', // Irregular plural
      mice: 'Mouse', // Irregular plural (rare but possible)
      criteria: 'Criterion', // Irregular plural

      // Single item fields
      fleet: 'Fleet',
      ship: 'Ship',
      user: 'User',
      member: 'Member',
      organization: 'Organization',
      activity: 'Activity',
      owner: 'User',
      creator: 'User',
      author: 'User',
    };

    // Check known mappings first
    const lowerFieldName = fieldName.toLowerCase();
    if (knownMappings[lowerFieldName]) {
      return knownMappings[lowerFieldName];
    }

    // Fallback: Convert field name to PascalCase
    const typeName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

    // Handle common plural suffixes
    if (typeName.endsWith('ies') && typeName.length > 3) {
      // 'activities' -> 'Activity'
      return `${typeName.slice(0, -3)}y`;
    } else if (typeName.endsWith('es') && typeName.length > 2) {
      // 'boxes' -> 'Box', but be careful with 'services' -> 'Service'
      const stem = typeName.slice(0, -2);
      if (stem.endsWith('x') || stem.endsWith('s') || stem.endsWith('ch') || stem.endsWith('sh')) {
        return stem;
      }
      // Otherwise try removing just 's'
      return typeName.slice(0, -1);
    } else if (typeName.endsWith('s') && typeName.length > 1) {
      // Simple plural removal
      return typeName.slice(0, -1);
    }

    return typeName;
  }
}

/**
 * Create Query Complexity Apollo Server Plugin
 */
export function createQueryComplexityPlugin(
  options: QueryComplexityPluginOptions = {}
): ApolloServerPlugin {
  const analyzer = new QueryComplexityAnalyzer(options);
  const skipInDev = options.skipInDevelopment && process.env.NODE_ENV !== 'production';

  return {
    async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
      let complexityResult: ComplexityResult | null = null;

      return {
        async didResolveOperation(
          requestContext: GraphQLRequestContext<BaseContext>
        ): Promise<void> {
          const { document, operationName, request } = requestContext;
          const variables = request.variables || {};

          if (!document) {
            return;
          }

          const result = analyzer.analyze(document, variables, operationName);
          complexityResult = result;

          // Log complexity
          if (options.logComplexity ?? true) {
            logger.debug('GraphQL query complexity', {
              operationName,
              complexity: result.complexity,
              depth: result.depth,
              exceeds: result.exceeds,
            });
          }

          // Call callback
          if (options.onComplexity) {
            options.onComplexity(result, requestContext.contextValue);
          }

          // Reject if exceeds limits (unless skipping in dev)
          if (result.exceeds && !skipInDev) {
            throw new GraphQLError(result.message || 'Query too complex', {
              extensions: {
                code: 'QUERY_TOO_COMPLEX',
                complexity: result.complexity,
                maxComplexity: options.maxComplexity ?? 1000,
                depth: result.depth,
                maxDepth: options.maxDepth ?? 10,
              },
            });
          }
        },
        async willSendResponse(requestContext: GraphQLRequestContext<BaseContext>): Promise<void> {
          // Add complexity information to response extensions
          const body = requestContext.response.body;
          if (complexityResult && body?.kind === 'single') {
            // In Apollo Server v4, single responses have a singleResult property
            // The type system doesn't narrow properly, but we know it's there when kind === 'single'
            body.singleResult.extensions ??= {};
            body.singleResult.extensions.complexity = {
              score: complexityResult.complexity,
              depth: complexityResult.depth,
              limit: options.maxComplexity ?? 1000,
              depthLimit: options.maxDepth ?? 10,
            };
          }
        },
      };
    },
  };
}

/**
 * Query complexity metrics tracking
 */
export interface ComplexityMetrics {
  totalQueries: number;
  rejectedQueries: number;
  averageComplexity: number;
  maxComplexity: number;
  averageDepth: number;
  maxDepth: number;
  complexityDistribution: {
    low: number; // 0-100
    medium: number; // 100-500
    high: number; // 500-1000
    veryHigh: number; // 1000+
  };
}

/**
 * Complexity Metrics Collector
 */
export class ComplexityMetricsCollector {
  private metrics: ComplexityMetrics = {
    totalQueries: 0,
    rejectedQueries: 0,
    averageComplexity: 0,
    maxComplexity: 0,
    averageDepth: 0,
    maxDepth: 0,
    complexityDistribution: {
      low: 0,
      medium: 0,
      high: 0,
      veryHigh: 0,
    },
  };
  private complexitySum: number = 0;
  private depthSum: number = 0;

  /**
   * Record a complexity result
   */
  record(result: ComplexityResult): void {
    this.metrics.totalQueries++;

    if (result.exceeds) {
      this.metrics.rejectedQueries++;
    }

    this.complexitySum += result.complexity;
    this.depthSum += result.depth;

    this.metrics.averageComplexity = Math.round(this.complexitySum / this.metrics.totalQueries);
    this.metrics.averageDepth = Math.round((this.depthSum / this.metrics.totalQueries) * 10) / 10;

    if (result.complexity > this.metrics.maxComplexity) {
      this.metrics.maxComplexity = result.complexity;
    }
    if (result.depth > this.metrics.maxDepth) {
      this.metrics.maxDepth = result.depth;
    }

    // Update distribution
    if (result.complexity < 100) {
      this.metrics.complexityDistribution.low++;
    } else if (result.complexity < 500) {
      this.metrics.complexityDistribution.medium++;
    } else if (result.complexity < 1000) {
      this.metrics.complexityDistribution.high++;
    } else {
      this.metrics.complexityDistribution.veryHigh++;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): ComplexityMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      totalQueries: 0,
      rejectedQueries: 0,
      averageComplexity: 0,
      maxComplexity: 0,
      averageDepth: 0,
      maxDepth: 0,
      complexityDistribution: {
        low: 0,
        medium: 0,
        high: 0,
        veryHigh: 0,
      },
    };
    this.complexitySum = 0;
    this.depthSum = 0;
  }
}

// Export singleton metrics collector
export const complexityMetrics = new ComplexityMetricsCollector();

// Export default plugin with metrics collection
export const queryComplexityPlugin = createQueryComplexityPlugin({
  maxComplexity: 1000,
  maxDepth: 10,
  logComplexity: true,
  skipInDevelopment: false, // CWE-400: Always enforce limits to prevent DoS
  onComplexity: result => complexityMetrics.record(result),
});
