import { GraphQLSchema } from 'graphql';
export declare function authDirective(directiveName: string): {
    authDirectiveTypeDefs: string;
    authDirectiveTransformer: (schema: GraphQLSchema) => GraphQLSchema;
};
//# sourceMappingURL=auth.d.ts.map