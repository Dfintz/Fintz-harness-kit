# OpenAPI 3.1 Schema-First Development Workflow

## Overview

The Star Citizen Fleet Manager API uses OpenAPI 3.1 for API contract definition, type generation, and request/response validation. This document describes the schema-first development workflow.

## Architecture

### Directory Structure

```
backend/
├── openapi/
│   ├── api.yaml                 # Main OpenAPI spec (references other files)
│   ├── bundled.yaml            # Bundled spec for type generation
│   ├── paths/                  # API endpoint definitions
│   │   ├── auth.yaml
│   │   ├── users.yaml
│   │   ├── organizations.yaml
│   │   ├── ships.yaml
│   │   ├── fleets.yaml
│   │   ├── activities.yaml
│   │   └── intel.yaml
│   ├── schemas/                # Data model definitions
│   │   ├── _index.yaml
│   │   ├── common.yaml
│   │   ├── user.yaml
│   │   ├── organization.yaml
│   │   ├── ship.yaml
│   │   ├── fleet.yaml
│   │   ├── activity.yaml
│   │   └── intel.yaml
│   ├── parameters/             # Reusable parameter definitions
│   │   └── _index.yaml
│   └── responses/              # Reusable response definitions
│       └── _index.yaml
└── src/
    ├── middleware/
    │   └── openapiValidation.ts  # OpenAPI validation middleware
    └── types/
        └── generated/
            └── api.ts            # Auto-generated TypeScript types
```

### Key Files

- **api.yaml**: Main entry point for the OpenAPI specification. References other YAML files for modularity.
- **bundled.yaml**: Self-contained spec used for type generation. Contains all schemas inline.
- **openapiValidation.ts**: Express middleware for runtime validation against OpenAPI specs.
- **generated/api.ts**: Auto-generated TypeScript type definitions.

## Workflow

### 1. Define API Contract (Schema-First)

When adding a new endpoint, always start by defining the OpenAPI specification:

```yaml
# openapi/paths/users.yaml

myProfile:
  get:
    tags:
      - Users
    summary: Get my profile
    description: Returns the authenticated user's profile
    operationId: getMyProfile
    responses:
      '200':
        description: Profile retrieved successfully
        content:
          application/json:
            schema:
              $ref: '../schemas/user.yaml#/UserV2'
      '401':
        $ref: '../responses/_index.yaml#/Unauthorized'
```

### 2. Update Main API Spec

Add the endpoint reference to `openapi/api.yaml`:

```yaml
paths:
  /api/users/me:
    $ref: './paths/users.yaml#/myProfile'
```

### 3. Update Bundled Schema (for Type Generation)

If you added new request/response types, add them to `openapi/bundled.yaml`:

```yaml
components:
  schemas:
    UserProfile:
      type: object
      required:
        - id
        - username
      properties:
        id:
          type: string
          format: uuid
        username:
          type: string
```

### 4. Generate TypeScript Types

Run the type generation script:

```bash
npm run openapi:generate
```

This generates `src/types/generated/api.ts` with type-safe definitions:

```typescript
import type { components } from './types/generated/api';

type User = components['schemas']['UserV2'];
type LoginRequest = components['schemas']['LoginRequest'];
```

### 5. Implement Controller/Route

Use the generated types in your implementation:

```typescript
import type { components } from '../types/generated/api';

type UserProfile = components['schemas']['UserV2'];

export class UserController {
    async getMyProfile(req: Request, res: Response): Promise<void> {
        const user: UserProfile = await this.userService.getProfile(req.user.id);
        res.json(user);
    }
}
```

### 6. Add Validation Middleware (Optional)

For routes that need contract validation, add the OpenAPI validator:

```typescript
import { openapiValidatorMiddleware, openapiErrorHandler } from '../middleware/openapiValidation';

// In app.ts, before route definitions
app.use(openapiValidatorMiddleware);

// After all routes, add error handler
app.use(openapiErrorHandler);
```

This will automatically validate:
- Request parameters (path, query, header)
- Request body against schema
- Response format (when enabled)

## Best Practices

### 1. Schema Organization

- **paths/**: Group by resource (users, organizations, ships, etc.)
- **schemas/**: Define reusable data models
- **responses/**: Common error responses (400, 401, 404, etc.)
- **parameters/**: Reusable parameters (pagination, filters, etc.)

### 2. Type Safety

Always use generated types instead of `any`:

```typescript
// ✅ Good
import type { components } from '../types/generated/api';
type Fleet = components['schemas']['FleetV2'];

// ❌ Bad
const fleet: any = await getFleet();
```

### 3. Validation Layers

The API has multiple validation layers:

1. **OpenAPI Validation** (runtime): Validates against OpenAPI spec
2. **Joi Validation** (existing): Business logic validation
3. **TypeScript** (compile-time): Type checking

Use all three for comprehensive validation.

### 4. Documentation

The OpenAPI spec serves as:
- **API documentation** (via Swagger UI)
- **Contract for frontend** (type generation)
- **Contract tests** (validation)
- **Developer reference** (readable YAML)

Keep descriptions clear and examples accurate.

### 5. Versioning

- Use path versioning: `/api/v2/...`
- Keep backward compatibility when possible
- Document breaking changes in changelog

## Common Operations

### Adding a New Endpoint

1. Create/update path definition in `openapi/paths/`
2. Add schema types to `openapi/schemas/` if needed
3. Update `openapi/api.yaml` with path reference
4. Update `openapi/bundled.yaml` with new types
5. Run `npm run openapi:generate`
6. Implement controller using generated types
7. Add route with validation middleware
8. Test with curl or Postman

### Modifying an Existing Endpoint

1. Update the OpenAPI spec first
2. Regenerate types
3. Fix TypeScript errors in implementation
4. Update tests
5. Run build and tests

### Testing OpenAPI Compliance

```bash
# Validate OpenAPI spec
npx @apidevtools/swagger-cli validate openapi/api.yaml

# Test against running server
npm run test:e2e
```

## Integration with Swagger UI

The OpenAPI spec is automatically served via Swagger UI:

```
http://localhost:3000/api-docs
```

This provides:
- Interactive API documentation
- Request/response examples
- "Try it out" functionality
- Schema browsing

## Tools and Libraries

- **openapi-typescript**: Generate TypeScript types from OpenAPI specs
- **express-openapi-validator**: Runtime validation middleware
- **swagger-ui-express**: Serve interactive API documentation
- **js-yaml**: YAML parsing

## Migration Guide

For endpoints not yet in OpenAPI spec:

1. Document existing endpoint behavior
2. Create OpenAPI definition
3. Add to `api.yaml`
4. Test for regressions
5. Add validation middleware
6. Update documentation

## Resources

- [OpenAPI 3.1 Specification](https://spec.openapis.org/oas/v3.1.0)
- [express-openapi-validator](https://github.com/cdimascio/express-openapi-validator)
- [openapi-typescript](https://github.com/drwpow/openapi-typescript)

## Support

For questions or issues:
1. Check this documentation
2. Review OpenAPI spec examples in `openapi/paths/`
3. Consult OpenAPI 3.1 specification
4. Ask in team chat or create an issue
