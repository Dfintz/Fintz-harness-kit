import { Request, Response } from 'express';
import { BaseController } from './BaseController';
declare class OpportunitySearchController extends BaseController {
    private readonly service;
    constructor();
    searchOpportunities: (req: Request, res: Response) => Promise<void>;
}
export declare function getOpportunitySearchController(): OpportunitySearchController;
export declare const opportunitySearchController: {
    searchOpportunities: (req: Request, res: Response) => Promise<void>;
};
export {};
//# sourceMappingURL=opportunitySearchController.d.ts.map