import { Request } from 'express';
import { Fleet } from '../../models/Fleet';
export declare function loadAuthorizedFleet(req: Request, fleetId: string, action: 'read' | 'edit' | 'delete'): Promise<Fleet>;
//# sourceMappingURL=fleetController.authorization.d.ts.map