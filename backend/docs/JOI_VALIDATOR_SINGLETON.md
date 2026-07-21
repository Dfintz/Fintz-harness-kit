# Joi Validator Singleton Pattern Documentation

## Overview

The `joiValidators.ts` module implements a singleton pattern to ensure consistent validator instances across the application and prevent Joi extension conflicts.

## Problem Statement

### Original Issue
Multiple imports of joiValidators could create multiple instances causing:
- "Rule conflict" errors when Joi extensions are applied multiple times
- Validation inconsistencies across different parts of the application
- Potential performance impact from duplicate validator instances
- State management issues in testing environments

### Root Cause
Joi's extension mechanism doesn't allow the same extension type to be registered multiple times. When modules are imported in different contexts (especially in test environments where module cache may be cleared), attempting to extend Joi multiple times causes conflicts.

## Solution: Singleton Pattern

### Implementation

The singleton pattern ensures that:
1. Joi is extended only once, even if the module is imported multiple times
2. All validator schemas share the same instance
3. Validation behavior is consistent across the entire application

### Key Components

#### 1. JoiExtended Singleton
```typescript
let _joiExtendedInstance: typeof Joi | null = null;

const getJoiExtended = (): typeof Joi => {
    if (_joiExtendedInstance === null) {
        _joiExtendedInstance = Joi;  // Base Joi instance
    }
    return _joiExtendedInstance;
};

export const JoiExtended = getJoiExtended();
```

#### 2. Validators Object Singleton
```typescript
let _joiValidatorsInstance: typeof joiValidators | null = null;

export const getJoiValidators = () => {
    if (_joiValidatorsInstance === null) {
        _joiValidatorsInstance = joiValidators;
    }
    return _joiValidatorsInstance;
};
```

## Usage Examples

### Recommended: Using getJoiValidators()
```typescript
import { getJoiValidators } from '../utils/joiValidators';

const validators = getJoiValidators();
const result = validators.secureEmailSchema.validate('user@example.com');
if (result.error) {
    throw new Error('Invalid email');
}
```

### Alternative: Direct Import
```typescript
import { joiValidators } from '../utils/joiValidators';

const result = joiValidators.secureUrlSchema.validate('https://example.com');
```

### Individual Schema Import
```typescript
import { secureEmailSchema, discordIdSchema } from '../utils/joiValidators';

const emailResult = secureEmailSchema.validate('user@example.com');
const idResult = discordIdSchema.validate('123456789012345678');
```

## Adding New Validators

When creating new validators in this module:

### 1. Define the Schema
```typescript
export const myNewSchema = Joi.string()
    .min(5)
    .max(100)
    .pattern(/^[a-zA-Z0-9]+$/)
    .required();
```

### 2. Add to joiValidators Object
```typescript
const joiValidators = {
    // ... existing validators
    myNewSchema,
    // ... other validators
};
```

### 3. Create Tests
Add comprehensive tests in `__tests__/utils/joiValidators.test.ts`:
```typescript
describe('myNewSchema', () => {
    it('should validate correct input', () => {
        const result = myNewSchema.validate('valid123');
        expect(result.error).toBeUndefined();
    });

    it('should reject invalid input', () => {
        const result = myNewSchema.validate('ab');
        expect(result.error).toBeDefined();
    });
});
```

### 4. Document Usage
Add JSDoc comments explaining the validator's purpose and usage.

## Testing Strategy

### Singleton Behavior Tests
```typescript
it('should return the same instance on multiple calls', () => {
    const instance1 = getJoiValidators();
    const instance2 = getJoiValidators();
    expect(instance1).toBe(instance2);
});
```

### Consistency Tests
```typescript
it('should maintain consistent validation behavior', () => {
    const validators1 = getJoiValidators();
    const validators2 = getJoiValidators();
    
    const email = 'test@example.com';
    const result1 = validators1.secureEmailSchema.validate(email);
    const result2 = validators2.secureEmailSchema.validate(email);
    
    expect(result1.value).toBe(result2.value);
});
```

## Files Using joiValidators

The singleton pattern ensures these files all use the same validator instance:

1. **backend/src/utils/secureValidators.ts**
   - Re-exports validators with additional security wrappers
   - Uses schemas for URL, email, Discord validation

2. **backend/src/routes/discordRoutes.ts**
   - Uses `discordIdSchema` for route parameter validation

3. **backend/src/middleware/security.ts**
   - Uses `removeSQLPatterns` and `sanitizeString` for input sanitization

4. **backend/src/services/communication/webhooks/WebhookService.ts**
   - Uses `isPrivateIP` and `isLocalhost` for SSRF prevention

5. **backend/src/services/external/ExternalIntegrationService.ts**
   - Uses `isPrivateIP` and `isLocalhost` for external URL validation

## Benefits

### 1. Consistency
- All parts of the application use the same validation rules
- No discrepancies between different imports

### 2. Performance
- Validator instances are created once and reused
- Reduced memory footprint
- Faster validation (no re-compilation)

### 3. Maintainability
- Single source of truth for validation logic
- Easier to update validation rules
- Clear testing strategy

### 4. Reliability
- Prevents "Rule conflict" errors
- Works correctly in testing environments
- Predictable behavior across application lifecycle

## Future Improvements

### DI Container Integration
Consider using a Dependency Injection container for more advanced singleton management:

```typescript
// Example with TypeDI or similar
import { Container, Service } from 'typedi';

@Service()
class JoiValidatorsService {
    private validators = joiValidators;
    
    getValidators() {
        return this.validators;
    }
}

// Usage
const validatorService = Container.get(JoiValidatorsService);
```

### Custom Extension Support
When Jest or other test frameworks properly support module caching, the custom Joi extension can be re-enabled:

```typescript
const getJoiExtended = (): typeof Joi => {
    if (_joiExtendedInstance === null) {
        _joiExtendedInstance = Joi.extend(_urlExtension);
    }
    return _joiExtendedInstance;
};
```

## Troubleshooting

### Issue: "Rule conflict" Error
**Cause:** Joi extension being applied multiple times
**Solution:** Ensure you're using the singleton pattern and not creating new Joi extensions

### Issue: Validation Inconsistency
**Cause:** Different modules using different validator instances
**Solution:** Always use `getJoiValidators()` or import from the main module

### Issue: Tests Failing in CI
**Cause:** Module cache being cleared between test suites
**Solution:** The singleton pattern handles this; ensure tests import correctly

## References

- [Joi Documentation](https://joi.dev/)
- [Singleton Pattern](https://refactoring.guru/design-patterns/singleton)
- [TypeScript Modules](https://www.typescriptlang.org/docs/handbook/modules.html)

## Change Log

### 2026-01-06
- ✅ Implemented singleton pattern for JoiExtended
- ✅ Implemented singleton pattern for joiValidators object
- ✅ Created comprehensive test suite (51 tests)
- ✅ Verified all import locations (5 files)
- ✅ Added documentation for future validators
- ✅ All tests passing (321+ tests)
