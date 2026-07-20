import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare abstract class BaseController {
    protected execute(req: Request | AuthRequest, res: Response, action: (req: Request | AuthRequest, res: Response) => Promise<void>): Promise<void>;
    protected executeAndReturn<T>(req: Request | AuthRequest, res: Response, action: (req: Request | AuthRequest) => Promise<T>, statusCode?: number): Promise<void>;
    protected executeWithPagination<T>(req: Request | AuthRequest, res: Response, action: (req: Request | AuthRequest, page: number, limit: number) => Promise<{
        data: T[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>): Promise<void>;
    protected handleError(res: Response, error: unknown, defaultMessage?: string): void;
    private logControllerError;
    protected validateRequired(body: Record<string, unknown>, ...fields: string[]): void;
    protected validateQueryParams(query: Record<string, unknown>, ...params: string[]): void;
    protected getAuthUser(req: AuthRequest): NonNullable<AuthRequest['user']>;
    protected getOrganizationId(req: AuthRequest): string;
    protected requireRole(req: AuthRequest, ...allowedRoles: string[]): void;
    protected sendSuccess<T>(res: Response, data: T, statusCode?: number): void;
    protected sendMessage(res: Response, message: string, statusCode?: number): void;
    protected getPaginationParams(req: Request, defaultLimit?: number, maxLimit?: number): {
        page: number;
        limit: number;
        offset: number;
    };
    protected createPaginatedResponse<T>(data: T[], total: number, page: number, limit: number): {
        data: T[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
            hasNext: boolean;
            hasPrevious: boolean;
        };
    };
    protected verifyOrganizationMembership(req: AuthRequest, organizationId: string): void;
}
//# sourceMappingURL=BaseController.d.ts.map