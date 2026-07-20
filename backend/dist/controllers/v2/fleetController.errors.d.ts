import { Response } from 'express';
import { ApiError } from '../../middleware/errorHandlerV2';
import { ApiErrorCode } from '../../types/api';
export declare function resolveErrorStatus(error: unknown): number;
export declare function mapStatusToApiErrorCode(statusCode: number): ApiErrorCode;
export declare function normalizeApiError(error: unknown, fallbackMessage: string): ApiError;
export interface FleetErrorResponseOptions {
    fallbackMessage?: string;
    forceStatusCode?: number;
    logAtOrAboveStatus?: number;
    logMessage?: string;
    path?: string;
    logContext?: Record<string, unknown>;
}
export declare function sendFleetErrorResponse(res: Response, error: unknown, options?: FleetErrorResponseOptions): void;
export declare function sendFleetInternalErrorResponse(res: Response, error: unknown, logMessage: string, path?: string): void;
export declare function sendFleetLoggedErrorResponse(res: Response, error: unknown, logMessage: string, path?: string): void;
export declare function rethrowApiOrSendFleetInternalErrorResponse(res: Response, error: unknown, logMessage: string, path?: string): void;
export declare function sendFleetDefaultErrorResponse(res: Response, error: unknown): void;
export declare function throwIfFleetAggregatorFailed(result: {
    success: boolean;
    error?: unknown;
}, fallbackMessage: string): void;
//# sourceMappingURL=fleetController.errors.d.ts.map