# Frontend Testing Guide

## Overview

Comprehensive testing infrastructure for the Star Citizen Fleet Manager frontend, built with Jest and React Testing Library.

## Tech Stack

- **Test Runner**: Jest 30.2.0
- **React Testing**: @testing-library/react 16.3.0
- **User Interactions**: @testing-library/user-event 14.6.1
- **DOM Assertions**: @testing-library/jest-dom 6.9.1
- **TypeScript**: ts-jest 29.4.5
- **Mocking**: MSW (Mock Service Worker) 2.11.5

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run in CI mode
npm run test:ci
```

## Project Structure

```
frontend/src/
├── __tests__/           # Test files
│   ├── App.test.tsx             # App component tests
│   ├── hooks.test.tsx           # Custom hook tests
│   ├── utils.test.ts            # Utility function tests
│   ├── Trading.test.tsx         # Feature tests
│   └── apiClientCaching.test.ts # API tests
├── test-utils/          # Testing utilities
│   └── test-utils.tsx           # Custom render with providers
├── mocks/               # Mock data and handlers
│   ├── handlers.ts              # MSW request handlers
│   └── data.ts                  # Mock data
└── setupTests.ts        # Global test setup
```

## Testing Patterns

### 1. Component Testing

**Basic Component Test:**
```tsx
import { render, screen } from '../test-utils/test-utils';
import MyComponent from '../components/MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    const button = screen.getByRole('button', { name: /click me/i });
    await user.click(button);
    
    expect(screen.getByText('Clicked!')).toBeInTheDocument();
  });
});
```

**Testing with Providers:**
```tsx
import { render } from '../test-utils/test-utils';

// Custom render automatically wraps with:
// - BrowserRouter
// - SpectrumProvider (Adobe Spectrum)
// Add your providers in test-utils.tsx as needed

it('renders with all providers', () => {
  render(<MyComponent />);
  // Component has access to routing and Spectrum
});
```

### 2. Hook Testing

**Testing Custom Hooks:**
```tsx
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from '../hooks/useMyHook';

describe('useMyHook', () => {
  it('initializes correctly', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.value).toBe(0);
  });

  it('updates state', () => {
    const { result } = renderHook(() => useMyHook());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.value).toBe(1);
  });
});
```

**Testing Async Hooks:**
```tsx
it('fetches data', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: 'test' }),
  });

  const { result } = renderHook(() => useFetchData('/api/test'));

  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  expect(result.current.data).toEqual({ data: 'test' });
});
```

### 3. Utility Function Testing

**Pure Function Tests:**
```typescript
import { formatCurrency, calculatePercentage } from '../utils/helpers';

describe('Utility Functions', () => {
  describe('formatCurrency', () => {
    it('formats number correctly', () => {
      expect(formatCurrency(1000)).toBe('1,000 aUEC');
    });
  });

  describe('calculatePercentage', () => {
    it('calculates correctly', () => {
      expect(calculatePercentage(25, 100)).toBe(25);
    });
  });
});
```

### 4. API Testing with MSW

**Setup MSW Handlers:**
```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/fleets', () => {
    return HttpResponse.json([
      { id: '1', name: 'Test Fleet' }
    ]);
  }),

  http.post('/api/fleets', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: '2', ...body }, { status: 201 });
  }),

  http.get('/api/error', () => {
    return HttpResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }),
];
```

**Use in Tests:**
```typescript
import { setupServer } from 'msw/node';
import { handlers } from '../mocks/handlers';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

it('fetches fleets successfully', async () => {
  render(<FleetList />);
  
  await waitFor(() => {
    expect(screen.getByText('Test Fleet')).toBeInTheDocument();
  });
});

it('handles API error', async () => {
  server.use(
    http.get('/api/fleets', () => {
      return HttpResponse.json(
        { message: 'Error' },
        { status: 500 }
      );
    })
  );

  render(<FleetList />);
  
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

### 5. User Interaction Testing

**Simulating User Events:**
```tsx
import userEvent from '@testing-library/user-event';

it('handles form submission', async () => {
  const user = userEvent.setup();
  const handleSubmit = jest.fn();
  
  render(<LoginForm onSubmit={handleSubmit} />);
  
  // Type in inputs
  await user.type(
    screen.getByLabelText(/username/i),
    'testuser'
  );
  await user.type(
    screen.getByLabelText(/password/i),
    'password123'
  );
  
  // Click button
  await user.click(
    screen.getByRole('button', { name: /login/i })
  );
  
  expect(handleSubmit).toHaveBeenCalledWith({
    username: 'testuser',
    password: 'password123',
  });
});
```

**Keyboard Navigation:**
```tsx
it('supports keyboard navigation', async () => {
  const user = userEvent.setup();
  render(<Menu />);
  
  // Tab through items
  await user.tab();
  expect(screen.getByText('Item 1')).toHaveFocus();
  
  await user.tab();
  expect(screen.getByText('Item 2')).toHaveFocus();
  
  // Press Enter
  await user.keyboard('{Enter}');
  expect(mockHandler).toHaveBeenCalled();
});
```

### 6. Accessibility Testing

**Basic A11y Checks:**
```tsx
it('is accessible', () => {
  const { container } = render(<MyComponent />);
  
  // Check for alt text on images
  const images = container.querySelectorAll('img');
  images.forEach(img => {
    expect(img).toHaveAttribute('alt');
  });
  
  // Check buttons have accessible names
  const buttons = screen.getAllByRole('button');
  buttons.forEach(button => {
    expect(button).toHaveAccessibleName();
  });
  
  // Check form labels
  const inputs = screen.getAllByRole('textbox');
  inputs.forEach(input => {
    expect(input).toHaveAccessibleName();
  });
});
```

**ARIA Attributes:**
```tsx
it('has proper ARIA attributes', () => {
  render(<Dialog title="Test Dialog" />);
  
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-labelledby');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
});
```

### 7. Async Testing

**Waiting for Elements:**
```tsx
import { waitFor, waitForElementToBeRemoved } from '@testing-library/react';

it('loads data asynchronously', async () => {
  render(<DataComponent />);
  
  // Wait for loading to finish
  await waitForElementToBeRemoved(() => 
    screen.queryByText(/loading/i)
  );
  
  // Wait for data to appear
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
  });
});
```

**findBy Queries (Built-in Async):**
```tsx
it('finds async elements', async () => {
  render(<AsyncComponent />);
  
  // findBy automatically waits (up to 1000ms by default)
  const element = await screen.findByText('Loaded data');
  expect(element).toBeInTheDocument();
});
```

## Best Practices

### ✅ DO

1. **Use semantic queries** (getByRole, getByLabelText)
2. **Test user behavior**, not implementation
3. **Use userEvent** for interactions
4. **Wait for async operations** with waitFor/findBy
5. **Clean up after tests** (afterEach cleanup)
6. **Mock external dependencies** (APIs, timers)
7. **Test accessibility** (ARIA, keyboard navigation)
8. **Keep tests isolated** (no shared state)

### ❌ DON'T

1. **Don't use container.querySelector** (use semantic queries)
2. **Don't test implementation details** (internal state)
3. **Don't use snapshot tests** for everything
4. **Don't forget to clean up** (timers, subscriptions)
5. **Don't make tests dependent** on each other
6. **Don't mock everything** (test real behavior when possible)
7. **Don't use brittle selectors** (CSS classes, data-testid overuse)

## Common Patterns

### Testing Loading States

```tsx
it('shows loading state', () => {
  render(<AsyncComponent />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

it('shows error state', async () => {
  mockApiError();
  render(<AsyncComponent />);
  
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

### Testing Forms

```tsx
it('validates form input', async () => {
  const user = userEvent.setup();
  render(<RegistrationForm />);
  
  await user.click(screen.getByRole('button', { name: /submit/i }));
  
  expect(await screen.findByText(/email is required/i))
    .toBeInTheDocument();
});
```

### Testing Navigation

```tsx
it('navigates to detail page', async () => {
  const user = userEvent.setup();
  render(<FleetList />);
  
  await user.click(screen.getByText('Fleet 1'));
  
  expect(window.location.pathname).toBe('/fleets/1');
});
```

### Testing Conditional Rendering

```tsx
it('renders admin controls for admin users', () => {
  render(<Dashboard user={{ role: 'admin' }} />);
  expect(screen.getByText(/admin panel/i)).toBeInTheDocument();
});

it('hides admin controls for regular users', () => {
  render(<Dashboard user={{ role: 'user' }} />);
  expect(screen.queryByText(/admin panel/i)).not.toBeInTheDocument();
});
```

## Configuration

### Jest Config (`jest.config.js`)

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### Setup File (`setupTests.ts`)

```typescript
import '@testing-library/jest-dom';

// Polyfills for Node.js environment
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream, WritableStream, TransformStream } from 'stream/web';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
```

## Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Coverage files generated in:
# - coverage/lcov-report/index.html (HTML report)
# - coverage/coverage-final.json (JSON data)
```

**Coverage Thresholds:**
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Debugging Tests

### Debug Single Test

```bash
# Run specific test file
npm test -- App.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="renders correctly"

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Debug Output

```tsx
import { screen, debug } from '@testing-library/react';

it('debugs output', () => {
  render(<MyComponent />);
  
  // Print entire DOM
  screen.debug();
  
  // Print specific element
  screen.debug(screen.getByRole('button'));
});
```

### Verbose Mode

```bash
# Show all test output
npm test -- --verbose

# Show only failures
npm test -- --onlyFailures
```

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Run tests
  run: npm run test:ci
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
```

## Common Issues & Solutions

### Issue: Tests timing out

```tsx
// Increase timeout for slow tests
it('slow operation', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Issue: Act warnings

```tsx
// Wrap state updates in act()
await act(async () => {
  await myAsyncFunction();
});
```

### Issue: Module not found

```javascript
// Add to moduleNameMapper in jest.config.js
moduleNameMapper: {
  '^@components/(.*)$': '<rootDir>/src/components/$1',
}
```

## Resources

- [React Testing Library Docs](https://testing-library.com/react)
- [Jest Documentation](https://jestjs.io/)
- [Testing Library User Events](https://testing-library.com/docs/user-event/intro)
- [MSW Documentation](https://mswjs.io/)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Example Test Files

See working examples in:
- `src/__tests__/App.test.tsx` - Component testing
- `src/__tests__/hooks.test.tsx` - Hook testing
- `src/__tests__/utils.test.ts` - Utility testing
- `src/__tests__/Trading.test.tsx` - Feature testing
- `src/__tests__/apiClientCaching.test.ts` - API testing

## Next Steps

1. Add tests for existing components
2. Achieve 70%+ code coverage
3. Set up automated coverage reports
4. Add visual regression testing (optional)
5. Integrate with CI/CD pipeline
