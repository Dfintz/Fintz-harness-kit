import winston from 'winston';
export declare const REDACTED = "[REDACTED]";
export declare function isSensitiveKey(key: string): boolean;
export declare function redactLogInfo(info: Record<string, unknown>): Record<string, unknown>;
export declare const redactionFormat: winston.Logform.FormatWrap;
//# sourceMappingURL=logRedaction.d.ts.map