import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
export declare class StarCommsV2Controller extends BaseController {
    private readonly accessService;
    private readonly federationService;
    private readonly federationMemberRepo;
    private readonly membershipRepo;
    listAccessible: (req: Request, res: Response) => Promise<void>;
    getFederationConfig: (req: Request, res: Response) => Promise<void>;
    updateFederationConfig: (req: Request, res: Response) => Promise<void>;
    getFederationSharingSuggestions: (req: Request, res: Response) => Promise<void>;
    private ensureUserCanViewFederation;
    private getUserId;
}
//# sourceMappingURL=starCommsV2Controller.d.ts.map