import { GraphQLSchema } from 'graphql';
export declare function rateLimitDirective(directiveName: string): {
    rateLimitDirectiveTypeDefs: string;
    rateLimitDirectiveTransformer: (schema: GraphQLSchema) => GraphQLSchema;
};
//# sourceMappingURL=rateLimit.d.ts.map