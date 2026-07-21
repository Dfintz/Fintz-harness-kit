import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'src/graphql/schema/*.graphql',
  generates: {
    // Generate TypeScript types from GraphQL schema
    'src/types/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-resolvers',
      ],
      config: {
        // Use proper TypeScript conventions
        useIndexSignature: true,
        maybeValue: 'T | null | undefined',
        inputMaybeValue: 'T | null | undefined',
        
        // Context type for resolvers
        contextType: '../graphql/context#GraphQLContext',
        
        // Map custom scalars
        scalars: {
          DateTime: 'Date',
          UUID: 'string',
        },
        
        // Avoid circular imports
        avoidOptionals: {
          field: true,
          inputValue: false,
          object: false,
          defaultValue: false,
        },
        
        // Generate strict types
        strictScalars: true,
        
        // Add __typename to all types
        addUnderscoreToArgsType: true,
        
        // Use TypeScript enums
        enumsAsTypes: false,
        
        // Make fields optional by default
        optionalResolveType: true,
        
        // Use interface instead of type
        declarationKind: 'interface',
        
        // Map resolvers to their parent types
        mapperTypeSuffix: 'Model',
        mappers: {
          User: '../models/User#User',
          Organization: '../models/Organization#Organization',
          Fleet: '../models/Fleet#Fleet',
          Ship: '../models/Ship#Ship',
          Activity: '../models/Activity#Activity',
        },
      },
    },
    
    // Generate introspection JSON for tooling
    'src/graphql/schema.json': {
      plugins: ['introspection'],
      config: {
        minify: false,
      },
    },
  },
  
  // Watch mode
  watch: process.env.NODE_ENV === 'development',
  
  // Enable debug output
  verbose: true,
  
  // Hooks
  hooks: {
    afterAllFileWrite: ['prettier --write'],
  },
};

export default config;
