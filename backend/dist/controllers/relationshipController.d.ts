import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class RelationshipController extends BaseController {
    private readonly relationshipService;
    constructor();
    createRelationship: (req: Request, res: Response) => Promise<void>;
    getRelationship: (req: Request, res: Response) => Promise<void>;
    getOrganizationRelationships: (req: Request, res: Response) => Promise<void>;
    updateRelationship: (req: Request, res: Response) => Promise<void>;
    getRelationshipHistory: (req: Request, res: Response) => Promise<void>;
    getRelationshipTimeline: (req: Request, res: Response) => Promise<void>;
    getRelationshipAnalytics: (req: Request, res: Response) => Promise<void>;
    getSentimentTrend: (req: Request, res: Response) => Promise<void>;
    recordInteraction: (req: Request, res: Response) => Promise<void>;
    updateTrustScore: (req: Request, res: Response) => Promise<void>;
    getTrustHistory: (req: Request, res: Response) => Promise<void>;
    getTrustRecommendations: (req: Request, res: Response) => Promise<void>;
    getRelationshipHealthSummary: (req: Request, res: Response) => Promise<void>;
    getRelationshipsNeedingReview: (req: Request, res: Response) => Promise<void>;
    establishMutualRelationship: (req: Request, res: Response) => Promise<void>;
    terminateRelationship: (req: Request, res: Response) => Promise<void>;
    getRelationshipTypes: (req: Request, res: Response) => Promise<void>;
    getChangeTypes: (req: Request, res: Response) => Promise<void>;
    getInteractionSentiments: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=relationshipController.d.ts.map