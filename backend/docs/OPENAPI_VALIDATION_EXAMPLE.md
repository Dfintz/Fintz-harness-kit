# OpenAPI Validation Middleware Example

## Basic Usage

The OpenAPI validation middleware can be applied to the entire Express app or specific routes. It validates incoming requests against the OpenAPI 3.1 specification.

### App-Wide Validation

To enable validation for all API routes, add the middleware in `app.ts`:

```typescript
import { 
    openapiValidatorMiddleware, 
    openapiErrorHandler 
} from './middleware/openapiValidation';

// Apply OpenAPI validation middleware BEFORE route definitions
// This validates all /api/* routes against openapi/api.yaml
app.use(openapiValidatorMiddleware);

// ... define your routes here ...

// Apply OpenAPI error handler AFTER all routes
app.use(openapiErrorHandler);
```

### Route-Specific Validation

For more granular control, apply to specific routers:

```typescript
import express from 'express';
import { openapiValidatorMiddleware } from '../middleware/openapiValidation';

const router = express.Router();

// Apply validation to this router only
router.use(openapiValidatorMiddleware);

router.post('/users', (req, res) => {
    // Request body is already validated against OpenAPI spec
    // TypeScript types from generated/api.ts ensure compile-time safety
    const userData = req.body;
    // ... handle request
});

export default router;
```

## Validation Behavior

The middleware validates:

1. **Request Parameters**
   - Path parameters (e.g., `/users/:userId`)
   - Query parameters (e.g., `?page=1&limit=20`)
   - Header parameters

2. **Request Body**
   - Validates JSON schema
   - Enforces required fields
   - Validates data types and formats (email, uuid, date-time, etc.)
   - Enforces min/max constraints

3. **Response Format** (optional, disabled by default)
   - Can be enabled in development for stricter validation

## Error Responses

When validation fails, the middleware returns a standard error response:

```json
{
  "status": "error",
  "code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "field": "body.email",
      "message": "must be a valid email address",
      "code": "format.openapi.validation"
    }
  ],
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Configuration

The validation middleware is configured in `src/middleware/openapiValidation.ts`:

```typescript
export const openapiValidatorMiddleware = OpenApiValidator.middleware({
    apiSpec: path.join(__dirname, '../../openapi/api.yaml'),
    validateRequests: true,        // Enable request validation
    validateResponses: false,      // Disable response validation (enable in dev)
    validateSecurity: {
        handlers: {
            bearerAuth: async (req, scopes) => true // Handled by auth middleware
        }
    },
    ignorePaths: /^\/(?!api).*/,  // Only validate /api/* routes
    validateFormats: 'fast',       // Validate string formats (email, uri, uuid)
});
```

## Example Validated Route

```typescript
// openapi/paths/users.yaml
createUser:
  post:
    tags:
      - Users
    operationId: createUser
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - username
              - email
            properties:
              username:
                type: string
                minLength: 3
                maxLength: 50
              email:
                type: string
                format: email
    responses:
      '201':
        description: User created
```

```typescript
// src/routes/userRoutes.ts
import { Router } from 'express';

const router = Router();

// Request is automatically validated against OpenAPI spec
router.post('/api/users', async (req, res) => {
    // req.body is guaranteed to have:
    // - username: string (3-50 chars)
    // - email: valid email format
    const { username, email } = req.body;
    
    // ... create user
    
    res.status(201).json({ id: '...', username, email });
});

export default router;
```

## Disabling Validation for Specific Routes

If needed, you can exclude specific routes:

```typescript
// Configure in openapiValidation.ts
ignorePaths: /^\/(health|metrics|api-docs)/
```

Or conditionally apply:

```typescript
if (process.env.ENABLE_OPENAPI_VALIDATION === 'true') {
    app.use(openapiValidatorMiddleware);
}
```

## Testing with Validation

When writing tests, you can either:

1. **Mock the validation** - Skip OpenAPI validation in tests
2. **Use real validation** - Ensure tests provide valid request bodies

```typescript
describe('POST /api/users', () => {
    it('should reject invalid email', async () => {
        const response = await request(app)
            .post('/api/users')
            .send({ username: 'test', email: 'invalid' });
        
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
    });
});
```

## Best Practices

1. **Always update OpenAPI spec first** before implementing the route
2. **Regenerate types** after updating specs: `npm run openapi:generate`
3. **Use generated types** in your controller implementations
4. **Test validation** - Add tests for both valid and invalid requests
5. **Keep specs in sync** - Review OpenAPI specs during code review

## Troubleshooting

### "No spec found for operation"
- The route path doesn't match any path in `openapi/api.yaml`
- Check that the path is correctly defined and referenced

### "Schema validation failed"
- The request doesn't match the schema definition
- Check the error details for specific field issues
- Verify the schema in the OpenAPI spec

### "Cannot read property 'schema' of undefined"
- The OpenAPI spec failed to load
- Check for YAML syntax errors: `npx js-yaml openapi/api.yaml`

### Build errors after adding validation
- Run `npm run openapi:generate` to update types
- Ensure TypeScript compilation succeeds: `npm run build`
