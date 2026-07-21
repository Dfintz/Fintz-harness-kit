# @sc-fleet-manager/shared-types

Shared TypeScript types for Star Citizen Fleet Manager. This package provides type definitions that
are used across both frontend and backend applications to ensure type consistency and reduce
duplication.

## Features

- **Model Types**: Core domain entities (Fleet, Ship, User, Organization, Activity)
- **API Types**: Request/response types, pagination, error handling
- **WebSocket Types**: Real-time event types for live updates
- **Type Safety**: Strict TypeScript with comprehensive type coverage
- **Single Source of Truth**: Eliminates type drift between frontend and backend

## Installation

This package is part of the monorepo workspace and is installed automatically when you run
`npm install` from the root directory.

```bash
# From the root directory
npm install
```

## Usage

### In Backend (Express.js)

```typescript
import {
  Fleet,
  FleetV2,
  CreateFleetRequest,
  ApiResponse,
  PaginatedResponse,
  ErrorCodes,
  FleetEvent,
} from '@sc-fleet-manager/shared-types';

// Using in a controller
export async function createFleet(req: Request, res: Response) {
  const createData: CreateFleetRequest = req.body;
  const fleet: Fleet = await fleetService.create(createData);

  const response: ApiResponse<Fleet> = {
    success: true,
    data: fleet,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.id,
    },
  };

  res.json(response);
}

// WebSocket events
socket.emit('fleet:created', {
  type: 'fleet:created',
  fleetId: fleet.id,
  organizationId: fleet.organizationId,
  data: fleet,
  timestamp: Date.now(),
} as FleetEvent);
```

### In Frontend (React)

```typescript
import {
  Fleet,
  FleetV2,
  ApiResponse,
  PaginatedResponse,
  ApiError,
  FleetEvent,
} from '@sc-fleet-manager/shared-types';
import axios from 'axios';

// API call with typed response
async function fetchFleets(orgId: string): Promise<FleetV2[]> {
  const response = await axios.get<PaginatedResponse<FleetV2>>(
    `/api/v2/organizations/${orgId}/fleets`
  );
  return response.data.data;
}

// WebSocket event handling
socket.on('fleet:created', (event: FleetEvent) => {
  console.log('New fleet created:', event.data);
});

// Error handling
try {
  await createFleet(data);
} catch (err) {
  const error = err.response?.data as ApiError;
  if (error.error.code === 'FLEET_CAPACITY_EXCEEDED') {
    showError('Fleet is at maximum capacity');
  }
}
```

## Package Structure

```
src/
├── index.ts              # Main export file
├── models/               # Domain model types
│   ├── fleet.ts          # Fleet-related types
│   ├── ship.ts           # Ship-related types
│   ├── user.ts           # User-related types
│   ├── organization.ts   # Organization-related types
│   ├── activity.ts       # Activity-related types
│   └── index.ts          # Model exports
└── api/                  # API-related types
    ├── responses.ts      # API response types, error codes
    ├── params.ts         # Query parameter types
    ├── websocket.ts      # WebSocket event types
    └── index.ts          # API exports
```

## Type Categories

### Model Types

Core domain entities that represent the application's data model:

- `Fleet`, `FleetV2` - Fleet entities with composition data
- `Ship`, `ShipV2` - Ship entities with loadout and insurance info
- `User`, `UserV2`, `UserProfile` - User entities and profiles
- `Organization`, `OrganizationV2` - Organization entities with stats
- `Activity`, `ActivityV2` - Activity/event entities

### API Response Types

Standard response wrappers for API endpoints:

- `ApiResponse<T>` - Standard success response
- `PaginatedResponse<T>` - Paginated list response
- `ApiError` - Error response structure
- `Pagination` - Pagination metadata
- `ErrorCodes` - Standard error code constants

### API Request Types

Request payload types for creating and updating entities:

- `CreateFleetRequest`, `UpdateFleetRequest`
- `CreateShipRequest`, `UpdateShipRequest`
- `CreateActivityRequest`, `UpdateActivityRequest`
- `CreateOrganizationRequest`, `UpdateOrganizationRequest`
- `UpdateUserRequest`

### Query Parameter Types

Types for filtering and pagination:

- `PaginationParams` - page, limit
- `SortParams` - sortBy, sortOrder
- `SearchParams` - search, searchFields
- `ListQueryParams` - Combined pagination, sorting, search
- `FleetListParams`, `ActivityListParams`, `ShipListParams`, etc.

### WebSocket Event Types

Real-time event types for WebSocket communication:

- `FleetEvent` - Fleet creation, updates, ship assignments
- `ActivityEvent` - Activity creation, updates, participant changes
- `OrganizationEvent` - Organization and membership changes
- `PresenceEvent` - User online/offline status
- `NotificationEvent` - System notifications
- `TradingEvent` - Trading route and market updates

## OpenAPI Integration

The backend uses OpenAPI for API documentation and validation. Types can be generated from the
OpenAPI specification:

```bash
# In the backend directory
cd backend
npm run openapi:generate
```

This generates TypeScript types from `backend/openapi/bundled.yaml` to
`backend/src/types/generated/api.ts`.

## Development

### Building

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist` directory.

### Type Checking

```bash
npm run type-check
```

### Cleaning

```bash
npm run clean
```

## Best Practices

1. **Keep Types Minimal**: Only include fields that are shared between frontend and backend
2. **Use Exact Types**: Avoid `any` or overly broad types
3. **Version Compatibility**: When adding breaking changes, consider adding v2 types
4. **Document Complex Types**: Add JSDoc comments for non-obvious types
5. **Reuse Common Patterns**: Use composition and utility types to avoid duplication

## Enum vs. Union Boundary (ADR-004)

Backend domain vocabularies are declared as TypeScript `enum`s (the persistence source of truth);
this package exposes the **client-facing** vocabulary as a runtime-introspectable `as const` array
plus a derived union type, so the values can be enumerated at runtime (validation, iteration, tests)
without shipping enum runtime to the browser:

```typescript
export const ACTIVITY_TYPE_VALUES = ['mission', 'contract' /* ... */] as const;
export type ActivityType = (typeof ACTIVITY_TYPE_VALUES)[number];
```

Rules (see `docs/adr/004-shared-types-enum-union-boundary.md`):

- The client value set MAY be a **subset** of the backend enum, never a superset (a client value the
  backend does not understand is a contract break).
- Backend-only values (e.g. `recruitment` in `ActivityType`) are intentional exclusions documented
  in the parity test.
- A backend contract test (`backend/src/__tests__/contracts/sharedTypesActivityParity.test.ts`)
  enforces the boundary one-way (backend → shared-types). This package and the frontend never import
  backend enums.

Use the `…_VALUES` suffix for the canonical raw-value array to distinguish it from UI helper arrays
such as a `{ value, label }[]` selector list.

## Adding New Types

When adding new types to this package:

1. Determine the category (model vs API)
2. Create or update the appropriate file in `src/models/` or `src/api/`
3. Export from the category index file
4. Build and test the package
5. Update imports in backend and frontend applications

Example:

```typescript
// src/models/mission.ts
export interface Mission {
  id: string;
  title: string;
  description: string;
  // ... more fields
}

export interface CreateMissionRequest {
  title: string;
  description: string;
}

// src/models/index.ts
export * from './mission';
```

## Type Versioning

For API evolution, we use versioned types:

- `Fleet` - Base/v1 type
- `FleetV2` - Enhanced type with additional computed fields
- Both can coexist for backward compatibility

## Contributing

When contributing new types:

1. Follow existing naming conventions
2. Use strict TypeScript (no `any`, explicit types)
3. Add JSDoc comments for complex types
4. Keep types focused and single-purpose
5. Test with both backend and frontend

## License

MIT
