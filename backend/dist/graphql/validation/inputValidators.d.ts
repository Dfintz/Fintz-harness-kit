import { ObjectSchema, ValidationError } from 'joi';
export interface ValidationResult<T = unknown> {
    valid: boolean;
    data?: T;
    errors?: Array<{
        field: string;
        message: string;
        type?: string;
    }>;
}
export declare function validateGraphQLInput<T>(data: unknown, schema: ObjectSchema, options?: {
    abortEarly?: boolean;
    context?: string;
}): T;
export declare function validateField(value: unknown, schema: ObjectSchema, fieldName: string): void;
export declare function isNullOrUndefined(value: unknown): value is null | undefined;
export declare function createObjectTypeGuard(keys: string[]): (obj: unknown) => obj is Record<string, unknown>;
export declare function validateBatchArguments(args: Record<string, ObjectSchema>, data: Record<string, unknown>): Record<string, unknown>;
export declare function formatValidationError(validationError: ValidationError): {
    field: string;
    message: string;
    type: string;
}[];
//# sourceMappingURL=inputValidators.d.ts.map