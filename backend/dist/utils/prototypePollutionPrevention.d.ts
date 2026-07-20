export declare function isSafeKey(key: string | symbol): boolean;
export declare function safeAssign<T extends Record<string, unknown>>(target: T, source: Record<string, unknown> | null | undefined): T;
export declare function sanitizeObject<T = Record<string, unknown>>(input: Record<string, unknown> | null | undefined, allowedKeys?: readonly string[]): Partial<T>;
export declare function safeSetProperty<T extends Record<string, unknown>>(obj: T, key: string, value: unknown): boolean;
export declare function sanitizeQueryParams<T = Record<string, unknown>>(query: Record<string, unknown>, schema: Record<string, 'string' | 'number' | 'boolean' | 'array'>): Partial<T>;
//# sourceMappingURL=prototypePollutionPrevention.d.ts.map