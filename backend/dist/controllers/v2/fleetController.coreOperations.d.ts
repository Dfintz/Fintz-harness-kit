import { Request, Response } from 'express';
import { FleetService } from '../../services/fleet/FleetService';
export declare function listOrgFleetsHandler(req: Request, res: Response): Promise<void>;
export declare function getFleetOverviewHandler(req: Request, res: Response): Promise<void>;
export declare function getFleetByIdHandler(req: Request, res: Response): Promise<void>;
export declare function createFleetHandler(req: Request, res: Response, fleetService: FleetService): Promise<void>;
export declare function updateFleetHandler(req: Request, res: Response): Promise<void>;
export declare function deleteFleetHandler(req: Request, res: Response): Promise<void>;
//# sourceMappingURL=fleetController.coreOperations.d.ts.map