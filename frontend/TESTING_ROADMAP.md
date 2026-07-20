# Frontend Testing Roadmap

## Current State (December 2025)

### Coverage Metrics
- **Statements**: 29.11% (Target: 80%+)
- **Branches**: 34.7% (Target: 80%+)
- **Functions**: 24.63% (Target: 80%+)
- **Lines**: 29.39% (Target: 80%+)

### Test Statistics
- **Total Test Suites**: 95
- **Total Tests**: 1,464 (1,462 passing, 2 skipped)
- **Execution Time**: ~99 seconds

### Recent Progress
Starting point: 28.33% statement coverage
Current: 29.11% statement coverage
Improvement: +0.78% (+96 tests)

## Completed Test Files

### Hooks (3 files, 21 tests)
- ✅ `src/hooks/__tests__/useLoading.test.ts` (10 tests)
- ✅ `src/hooks/__tests__/useErrorHandler.test.ts` (11 tests)
- ✅ `src/hooks/__tests__/useDebounce.test.ts` (existing)
- ✅ `src/hooks/__tests__/useIdleTimeout.test.ts` (existing)

### Utils (2 files, 12 tests)
- ✅ `src/utils/__tests__/errorHandling.test.ts` (12 tests)
- ✅ `src/utils/__tests__/csvParser.test.ts` (existing, 100% coverage)
- ✅ `src/utils/__tests__/sanitize.test.ts` (existing, 100% coverage)

### Store (1 file, 37 tests)
- ✅ `src/store/__tests__/uiStore.test.ts` (37 tests, 2 skipped)
  - Coverage improved to 57.24% for store directory

### Services (1 file, 36 tests)
- ✅ `src/services/__tests__/baseService.test.ts` (36 tests, 100% coverage)

## Priority 1: High-Impact Store Tests (Est: 8-10 hours)

### authStore.ts (Current: 44% → Target: 80%+)
**Estimated effort**: 4-5 hours

Test coverage needed:
- User authentication flow
- Login/logout actions
- Token management
- Session persistence
- User profile updates
- Permission checks
- Error handling

Example test structure:
```typescript
describe('authStore', () => {
  describe('login', () => {
    it('should set user and token on successful login');
    it('should handle login errors');
    it('should persist auth state to localStorage');
  });
  
  describe('logout', () => {
    it('should clear user and token');
    it('should clear localStorage');
    it('should reset auth state');
  });
  
  describe('token management', () => {
    it('should refresh token when expired');
    it('should handle refresh token failures');
  });
});
```

### fleetStore.ts (Current: 29% → Target: 80%+)
**Estimated effort**: 4-5 hours

Test coverage needed:
- Fleet CRUD operations
- Fleet member management
- Fleet filters and sorting
- Loading states
- Error handling
- Optimistic updates

## Priority 2: Service Layer Tests (Est: 15-20 hours)

### High-Value Services to Test First

#### apiClient.ts (Current: 23% → Target: 70%+)
**Estimated effort**: 4-5 hours
- Request/response interceptors
- Error handling
- Retry logic
- Caching mechanism
- Request deduplication

#### dashboardService.ts (Current: 0% → Target: 70%+)
**Estimated effort**: 3-4 hours
- Dashboard data fetching
- Statistics aggregation
- Error handling

#### organizationService.ts (Current: 0% → Target: 70%+)
**Estimated effort**: 3-4 hours
- Organization CRUD
- Member management
- Settings updates

#### fleetService.ts (Current: 5% → Target: 70%+)
**Estimated effort**: 3-4 hours
- Fleet operations
- Member assignments
- Fleet status updates

## Priority 3: Remaining Hooks (Est: 10-12 hours)

### Complex Hooks Requiring Tests

#### useWebSocket.ts (Current: 0%)
**Estimated effort**: 3-4 hours
- Connection management
- Message handling
- Reconnection logic
- Error handling

#### useRealtime.ts (Current: 0%)
**Estimated effort**: 3-4 hours
- Real-time data synchronization
- Event handling
- Subscription management

#### useKeyboardShortcuts.ts (Current: 0%)
**Estimated effort**: 2-3 hours
- Keyboard event handling
- Shortcut registration
- Conflict resolution

#### useGlobalSearch.ts (Current: 0%)
**Estimated effort**: 2-3 hours
- Search functionality
- Debouncing
- Result filtering

## Priority 4: Remaining Utils (Est: 6-8 hours)

### Utility Functions Needing Tests

#### deviceFingerprint.ts (Current: 0%)
**Estimated effort**: 2-3 hours
- Browser fingerprinting
- Device detection
- Privacy considerations

#### secureStorage.ts (Current: 0%)
**Estimated effort**: 2-3 hours
- Encryption/decryption
- Storage operations
- Error handling

#### graphql.ts (Current: 16% → Target: 70%+)
**Estimated effort**: 2-3 hours
- Query building
- Response parsing
- Error handling

## Priority 5: Component Tests (Est: 20-30 hours)

### Strategy
Focus on high-value, complex components with business logic:
- Form components with validation
- Data display components with transformations
- Interactive components with state management
- Components with API integrations

### Skip
- Pure presentational components
- Simple UI wrappers
- Components that are already well-tested indirectly

## Configuration & CI Updates

### Jest Configuration ✅ COMPLETED
- [x] Updated coverage thresholds from 5-10% to 20-25%
- [ ] Plan to incrementally increase to 80% as tests are added
- [ ] Configure coverage reports to fail CI on drops

### CI/CD Integration ✅ ALREADY CONFIGURED
- [x] Frontend tests run on PR and push
- [x] Coverage uploaded to Codecov
- [x] Tests run with `--coverage` flag
- [ ] Add PR comments with coverage diff
- [ ] Configure coverage gate on PRs

## Testing Best Practices

### 1. Test Structure
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  describe('feature or method', () => {
    it('should handle specific case', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### 2. Mock Strategy
- Mock external dependencies (axios, API calls)
- Mock complex hooks and stores
- Use `jest.mock()` at module level
- Reset mocks between tests

### 3. Coverage Goals
- Focus on meaningful tests, not coverage numbers
- Test behavior, not implementation
- Cover edge cases and error paths
- Test user interactions and workflows

### 4. Testing Tools
- **@testing-library/react**: Component testing
- **@testing-library/react-hooks**: Hook testing
- **jest**: Test runner and assertions
- **msw**: API mocking (if needed)

## Estimated Timeline to 80% Coverage

### Phase 1: Foundation (Completed) ✅
- Duration: 1 week
- Result: 29% coverage
- Tests added: 96

### Phase 2: Store & Services (8-10 weeks)
- Duration: 8-10 weeks
- Target: 50-60% coverage
- Focus: authStore, fleetStore, critical services

### Phase 3: Hooks & Utils (4-6 weeks)
- Duration: 4-6 weeks
- Target: 65-70% coverage
- Focus: Remaining hooks and utilities

### Phase 4: Components (6-8 weeks)
- Duration: 6-8 weeks
- Target: 75-80% coverage
- Focus: High-value components

### Phase 5: Polish & Edge Cases (2-3 weeks)
- Duration: 2-3 weeks
- Target: 80%+ coverage
- Focus: Edge cases, integration tests

**Total estimated effort**: 40-60 hours (as specified in original issue)

## Known Issues & Limitations

### Skipped Tests
1. `uiStore.test.ts` - 2 tests skipped due to timer/persistence interaction
   - Issue: Zustand persist middleware interferes with fake timers
   - Solution: Need to mock localStorage or use different testing approach

### Missing Dependencies
- ✅ `zod` - Added to dependencies (required by useFormValidation)

### Problematic Files
- `useFormValidation.ts` - Has implementation bugs, tests not created
  - Issue: Error handling in validation doesn't work correctly
  - Recommendation: Fix implementation before testing

## Next Steps for Contributors

1. **Start with Priority 1** - Store tests have high impact on coverage
2. **Follow existing patterns** - Review completed test files for consistency
3. **Update this roadmap** - Mark items as complete and adjust estimates
4. **Run tests frequently** - Ensure new tests don't break existing ones
5. **Focus on quality** - Better to have fewer high-quality tests

## Resources

- [Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Hooks Testing](https://react-hooks-testing-library.com/)
- [Zustand Testing Guide](https://docs.pmnd.rs/zustand/guides/testing)

## Questions or Issues?

- Review existing test files for patterns
- Check `src/test-utils/test-utils.tsx` for custom render functions
- Consult `src/setupTests.ts` for global test configuration
- Refer to repository's `TESTING.md` for additional guidance
