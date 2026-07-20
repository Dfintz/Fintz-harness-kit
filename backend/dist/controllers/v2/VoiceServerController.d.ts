import { Request, Response } from 'express';
import { BaseController } from '../BaseController';
export declare class VoiceServerController extends BaseController {
    private readonly voiceService;
    getOrgConfig: (req: Request, res: Response) => Promise<void>;
    getOrgStatus: (req: Request, res: Response) => Promise<void>;
    getOrgStats: (req: Request, res: Response) => Promise<void>;
    updateOrgConfig: (req: Request, res: Response) => Promise<void>;
    deleteOrgConfig: (req: Request, res: Response) => Promise<void>;
    getOrgWhitelistSuggestions: (req: Request, res: Response) => Promise<void>;
    getFedConfig: (req: Request, res: Response) => Promise<void>;
    getFedStatus: (req: Request, res: Response) => Promise<void>;
    getFedStats: (req: Request, res: Response) => Promise<void>;
    updateFedConfig: (req: Request, res: Response) => Promise<void>;
    deleteFedConfig: (req: Request, res: Response) => Promise<void>;
    getFedWhitelistSuggestions: (req: Request, res: Response) => Promise<void>;
    listAccessible: (req: Request, res: Response) => Promise<void>;
    lookupOrgByRsiSid: (req: Request, res: Response) => Promise<void>;
    getPositiveRelationshipFederations: (req: Request, res: Response) => Promise<void>;
    updatePlatformChannelData: (req: Request, res: Response) => Promise<void>;
    generateVoiceToken: (req: Request, res: Response) => Promise<void>;
    validateVoiceToken: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=VoiceServerController.d.ts.map