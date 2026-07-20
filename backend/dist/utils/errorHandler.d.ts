import { AxiosError } from 'axios';
export declare function isError(error: unknown): error is Error;
export declare function isAxiosError(error: unknown): error is AxiosError;
export declare function hasMessage(error: unknown): error is {
    message: string;
};
export declare function hasResponse(error: unknown): error is {
    response: {
        data?: {
            message?: string;
        };
    };
};
export declare function getErrorMessage(error: unknown, fallback?: string): string;
export declare function logError(error: unknown, context: string): void;
export declare function formatUserError(error: unknown, includeDetails?: boolean): string;
export declare function withErrorHandling<T>(operation: () => Promise<T>, context: string): Promise<T>;
export declare function safeAsync<T>(operation: () => Promise<T>): Promise<[null, T] | [Error, null]>;
//# sourceMappingURL=errorHandler.d.ts.map