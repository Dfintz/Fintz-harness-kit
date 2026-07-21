# Route Registration Automation - Migration Guide

## Overview

This document provides a guide for migrating manual route registration to the decorator-based automatic registration system.

## Current State

- ✅ Decorator system implemented in `/backend/src/routing/`
- ✅ Authentication and validation decorators available
- ✅ FleetTenantController fully migrated and tested
- ✅ All tests passing (194 suites, 4027 tests)

## Available Decorators

### Class Decorators

#### `@Controller(basePath: string)`
Marks a class as a route controller and sets the base path for all routes.

```typescript
@Controller('/fleets')
export class FleetController { }
```

#### `@UseControllerMiddleware(...middleware: Function[])`
Applies middleware to all routes in the controller.

```typescript
@UseControllerMiddleware(authenticate, tenantContextMiddleware)
export class FleetController { }
```

#### `@injectable()`
Makes the controller injectable via the DI container (optional but recommended).

```typescript
@injectable()
@Controller('/fleets')
export class FleetController { }
```

### Method Decorators

#### HTTP Method Decorators
- `@Get(path?: string)` - GET request
- `@Post(path?: string)` - POST request
- `@Put(path?: string)` - PUT request
- `@Patch(path?: string)` - PATCH request
- `@Delete(path?: string)` - DELETE request

```typescript
@Get('/')
async list(req: Request, res: Response): Promise<void> { }

@Get('/:id')
async getById(req: Request, res: Response): Promise<void> { }
```

#### `@UseMiddleware(...middleware: Function[])`
Applies middleware to a specific route.

```typescript
@Get('/')
@UseMiddleware(rateLimiter, caching)
async list(req: Request, res: Response): Promise<void> { }
```

#### `@Authenticate()`
Applies authentication middleware (authenticateToken) to the route.

```typescript
@Get('/protected')
@Authenticate()
async protectedRoute(req: Request, res: Response): Promise<void> { }
```

#### Validation Decorators
- `@ValidateBody(schema)` - Validates request body
- `@ValidateQuery(schema)` - Validates query parameters
- `@ValidateParams(schema)` - Validates route parameters

```typescript
@Post('/')
@ValidateBody(fleetSchemas.create)
async create(req: Request, res: Response): Promise<void> { }
```

## Migration Steps

### Step 1: Create Decorated Controller

Create a new controller file (or convert existing) using decorators:

```typescript
import { Request, Response } from 'express';
import { injectable } from 'tsyringe';

import { authenticate } from '../middleware/auth';
import { tenantContextMiddleware, requireTenantContext } from '../middleware/tenantContext';
import { Controller, Get, Post, Put, Delete, UseControllerMiddleware } from '../routing';
import { YourService } from '../services/your-service';
import logger from '../utils/logger';

import { BaseController } from './BaseController';

@injectable()
@Controller('/your-resource')
@UseControllerMiddleware(authenticate, tenantContextMiddleware, requireTenantContext)
export class YourResourceController extends BaseController {
    private service: YourService;

    constructor() {
        super();
        this.service = new YourService();
    }

    @Get('/')
    async list(req: Request, res: Response): Promise<void> {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new Error('Organization ID required');
            }
            
            return await this.service.getAll(organizationId);
        });
    }

    @Get('/:id')
    async getById(req: Request, res: Response): Promise<void> {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const organizationId = req.tenantContext?.organizationId;
            
            const item = await this.service.getById(organizationId, id);
            if (!item) {
                res.status(404);
                throw new Error('Resource not found');
            }
            
            return item;
        });
    }

    @Post('/')
    async create(req: Request, res: Response): Promise<void> {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            const data = req.body;
            
            return await this.service.create(organizationId, data);
        }, 201); // Status code 201 for creation
    }

    @Put('/:id')
    async update(req: Request, res: Response): Promise<void> {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const organizationId = req.tenantContext?.organizationId;
            const updates = req.body;
            
            return await this.service.update(organizationId, id, updates);
        });
    }

    @Delete('/:id')
    async delete(req: Request, res: Response): Promise<void> {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const organizationId = req.tenantContext?.organizationId;
            
            await this.service.delete(organizationId, id);
            res.status(204).send();
        });
    }
}
```

### Step 2: Register Controller in app.ts

Import the controller and add it to the `registerControllers()` call:

```typescript
import { FleetTenantController } from './controllers/FleetTenantController';
import { YourResourceController } from './controllers/YourResourceController';

// ... after middleware setup ...

// ==================== DECORATOR-BASED ROUTES ====================
registerControllers(app, [
    FleetTenantController,
    YourResourceController, // Add your new controller here
], {
    prefix: '/api',
    debug: process.env.NODE_ENV === 'development',
});
```

### Step 3: Comment Out Old Route Registration

Find and comment out the old manual route registration:

```typescript
// Old manual registration - REPLACED by YourResourceController
// setYourResourceRoutes(app);
```

### Step 4: Write Tests

Create a test file following the FleetTenantController test pattern:

```typescript
import request from 'supertest';
import express, { Express } from 'express';
import { json } from 'body-parser';

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
    AppDataSource: mockAppDataSource,
}));

import { YourResourceController } from '../../controllers/YourResourceController';
import { registerControllers } from '../../routing';
import { YourService } from '../../services/your-service';

jest.mock('../../services/your-service');
jest.mock('../../middleware/auth', () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { id: 'user-123', username: 'testuser', role: 'admin' };
        next();
    }),
}));
// ... other mocks ...

describe('YourResourceController', () => {
    let app: Express;
    let mockService: jest.Mocked<YourService>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockService = {
            getAll: jest.fn(),
            getById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        } as any;

        (YourService as any) = jest.fn(() => mockService);

        app = express();
        app.use(json());

        registerControllers(app, [YourResourceController], {
            prefix: '/api',
            debug: false,
        });
    });

    describe('GET /api/your-resource', () => {
        it('should list all resources', async () => {
            const mockData = [{ id: '1', name: 'Test' }];
            mockService.getAll.mockResolvedValue(mockData as any);

            const response = await request(app)
                .get('/api/your-resource')
                .expect(200);

            expect(response.body).toEqual(mockData);
        });
    });
    
    // ... more tests ...
});
```

### Step 5: Run Tests

```bash
cd backend
npm test -- --testPathPattern="YourResourceController"
npm test  # Run all tests to ensure nothing broke
```

## Benefits of Decorator-Based Routes

1. **Self-Documenting**: Routes are declared right next to their handlers
2. **Type-Safe**: Full TypeScript support with decorators
3. **Less Boilerplate**: No need to manually wire up routes
4. **Consistent Patterns**: BaseController provides standard error handling
5. **Middleware Composition**: Easy to apply middleware at class or method level
6. **DI Integration**: Works with tsyringe dependency injection
7. **Testable**: Easy to test with standard testing patterns

## Common Patterns

### Applying Multiple Middleware

```typescript
@Get('/protected')
@UseMiddleware(rateLimiter, caching, logging)
async protectedRoute(req: Request, res: Response): Promise<void> { }
```

### Validation with Custom Schemas

```typescript
@Post('/')
@ValidateBody(yourSchemas.create)
@ValidateQuery(yourSchemas.query)
async create(req: Request, res: Response): Promise<void> { }
```

### Admin-Only Routes

```typescript
import { requireAdmin } from '../middleware/authorization';

@Controller('/admin')
@UseControllerMiddleware(authenticate, requireAdmin)
export class AdminController extends BaseController {
    @Get('/users')
    async listUsers(req: Request, res: Response): Promise<void> { }
}
```

### Public Routes (No Auth)

```typescript
@Controller('/public')
export class PublicController extends BaseController {
    @Get('/health')
    async health(req: Request, res: Response): Promise<void> {
        await this.executeAndReturn(req, res, async () => ({
            status: 'ok',
            timestamp: new Date().toISOString(),
        }));
    }
}
```

## Migration Checklist

For each route file to migrate:

- [ ] Create new decorated controller class
- [ ] Extend BaseController for error handling
- [ ] Add @Controller decorator with base path
- [ ] Add @UseControllerMiddleware for global middleware
- [ ] Convert each route to method with HTTP decorator
- [ ] Use @Authenticate, @ValidateBody, etc. as needed
- [ ] Register controller in app.ts
- [ ] Comment out old route registration
- [ ] Write comprehensive tests
- [ ] Run tests to verify functionality
- [ ] Update any route documentation

## Route Files Remaining

After FleetTenantController migration, these route files remain:

1. ✅ **fleetRoutesTenant.ts** - MIGRATED to FleetTenantController
2. organizationRoutes.ts (614 lines)
3. userRoutes.ts (296 lines)
4. eventRoutes.ts
5. imageRoutes.ts
6. tournamentRoutes.ts
7. miningOperationRoutes.ts
8. tradingRouteRoutes.ts
9. shipMaintenanceRoutes.ts
10. crewAssignmentRoutes.ts
11. shipLoanRoutes.ts
12. reputationRoutes.ts
13. cargoManifestRoutes.ts
14. allianceDiplomacyRoutes.ts
15. fleetLogisticsRoutes.ts
16. twoFactorRoutes.ts
17. authRoutes.ts
18. activityRoutes.ts
19. recruitmentRoutes.ts
20. shipLoadoutRoutes.ts
21. shipDataRoutes.ts
22. fleetViewRoutes.ts
23. briefingRoutes.ts
24. permissionRoutes.ts
25. sharedAccountRoutes.ts
26. attendanceRoutes.ts
27. intelVaultRoutes.ts
28. rsiVerificationRoutes.ts
29. rsiRoleMappingRoutes.ts
30. webhookRoutes.ts
31. userShipRoutes.ts
32. organizationShipRoutes.ts
33. squadronRoutes.ts

## Notes

- Prioritize migrating routes that change frequently
- Larger route files provide more value when migrated
- Test each migration thoroughly before moving to the next
- The decorator system is backward compatible with manual routes
- Migration can be done incrementally without breaking existing functionality

## Future Enhancements

Potential improvements to the decorator system:

1. **@RateLimit(limiter)** decorator for easy rate limiting
2. **@RequirePermission(resource, action)** for permission checks
3. **@Cache(ttl)** decorator for response caching
4. **@ApiDoc()** decorator for automatic OpenAPI documentation
5. **@Transactional()** decorator for database transactions
