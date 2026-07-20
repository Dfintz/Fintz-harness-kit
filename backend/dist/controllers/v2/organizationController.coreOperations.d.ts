import { Request, Response } from 'express';
import { OrganizationService } from '../../services/organization/OrganizationService';
export declare function listOrganizationsCoreHandler(req: Request, res: Response): Promise<void>;
export declare function getOrganizationCoreHandler(req: Request, res: Response): Promise<void>;
export declare function createOrganizationCoreHandler(req: Request, res: Response, organizationService: OrganizationService): Promise<void>;
export declare function updateOrganizationCoreHandler(req: Request, res: Response, organizationService: OrganizationService): Promise<void>;
export declare function deleteOrganizationCoreHandler(req: Request, res: Response, organizationService: OrganizationService): Promise<void>;
//# sourceMappingURL=organizationController.coreOperations.d.ts.map