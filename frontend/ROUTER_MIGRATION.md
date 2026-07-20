# React Router Data Loaders Migration

## Overview

This document describes the migration from React Router's `<Routes>` and `<Route>` components to the new `createBrowserRouter` API with data loaders.

## Changes Made

### 1. Router Configuration

**Before:**
```tsx
// App.tsx
<BrowserRouter>
  <Layout>
    <Routes>
      <Route path="/" element={<Dashboard />} />
      {/* ... more routes */}
    </Routes>
  </Layout>
</BrowserRouter>
```

**After:**
```tsx
// App.tsx
const router = createAppRouter(queryClient);
<RouterProvider router={router} />

// router/routes.tsx
export function createAppRouter(queryClient: QueryClient) {
  return createBrowserRouter(createRoutes(queryClient));
}
```

### 2. Root Layout

Created a `RootLayout` component that wraps all routes with the main `Layout` component and provides:
- Suspense boundary for lazy-loaded routes
- Navigation progress indicator
- Error boundary integration

### 3. Data Loaders

Added route loaders that prefetch data before navigation:

- `createFleetListLoader` - Prefetches fleet list for `/fleet`
- `createFleetDetailLoader` - Prefetches single fleet for `/fleet/:id`
- `createOrganizationsListLoader` - Prefetches organizations for `/organizations`
- `createOrganizationShipsLoader` - Prefetches org ships for `/organizations/:orgId/ships`
- `createUsersListLoader` - Prefetches users for `/users`
- `createUserShipsLoader` - Prefetches user ships for `/users/:userId/ships`
- `createActivitiesListLoader` - Prefetches activities for `/activities`
- `createActivityDetailLoader` - Prefetches activity for `/activities/:id`

### 4. Error Boundaries

Created `RouteErrorBoundary` component that:
- Catches errors from loaders and components
- Displays user-friendly error messages
- Provides navigation back/home buttons
- Shows detailed error stack in development mode

### 5. Navigation Progress

Added `NavigationProgress` component that:
- Shows a progress bar at the top during route transitions
- Uses React Router's `useNavigation` hook
- Provides visual feedback for loading states

### 6. Component Updates

Updated components to use `useLoaderData`:

- `ActivityDetail` - Now uses loader data with TanStack Query hooks
- `OrganizationShips` - Uses loader validation
- `UserShips` - Uses loader validation

## Benefits

### 1. Better Loading States
- Data loads **before** navigation completes
- Users see new page only when data is ready
- No more flash of loading spinner after navigation

### 2. Improved Performance
- Loaders integrate with TanStack Query cache
- Data is prefetched in parallel with code splitting
- Reduced time to interactive

### 3. Better Error Handling
- Route-level error boundaries catch loader errors
- Consistent error UI across the application
- Better error recovery options

### 4. Type Safety
- Loader data is typed
- `useLoaderData` provides proper TypeScript types
- Compile-time safety for route parameters

## Migration Guide

### For New Routes

1. Add a loader function in `router/loaders.ts`:
```tsx
export function createMyRouteLoader(queryClient: QueryClient) {
  return async ({ params }: LoaderFunctionArgs) => {
    const data = await queryClient.fetchQuery({
      queryKey: ['myData', params.id],
      queryFn: () => myService.getData(params.id),
      staleTime: 5 * 60 * 1000,
    });
    return data;
  };
}
```

2. Add the loader to your route in `router/routes.tsx`:
```tsx
{
  path: '/my-route/:id',
  element: <MyComponent />,
  loader: createMyRouteLoader(queryClient),
}
```

3. Use the loader data in your component:
```tsx
import { useLoaderData } from 'react-router-dom';

const MyComponent = () => {
  const loaderData = useLoaderData() as MyDataType;
  
  // Use TanStack Query with initial data from loader
  const { data } = useMyData(id, {
    initialData: loaderData,
  });
  
  // ...
};
```

### For Existing Routes

1. Remove `useEffect` data fetching
2. Add a loader to the route
3. Use `useLoaderData` with TanStack Query hooks
4. Keep mutation logic unchanged

## Testing

The router changes maintain backward compatibility with existing tests. Routes work the same way from a user perspective, just with better loading states.

## Future Improvements

1. Add more loaders for remaining routes
2. Implement optimistic UI updates with loaders
3. Add loader timeout handling
4. Implement background data refresh
5. Add loader data streaming for large datasets

## References

- [React Router Data Loading](https://reactrouter.com/en/main/guides/data-libs)
- [TanStack Query Integration](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
