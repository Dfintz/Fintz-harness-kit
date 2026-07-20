import { Request } from 'express';
export declare function getAuthenticatedUserId(req: Request): string;
export declare function getActiveOrganizationId(req: Request): string | undefined;
export declare function getOrganizationIdFromContext(req: Request): string;
export declare function isAuthenticated(req: Request): boolean;
//# sourceMappingURL=authHelpers.d.ts.map