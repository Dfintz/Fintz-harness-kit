import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare const validateSchema: (schema: Joi.ObjectSchema, property?: "body" | "query" | "params") => (req: Request, res: Response, next: NextFunction) => void;
export declare const schemas: {
    id: Joi.ObjectSchema<any>;
    organization: {
        create: Joi.ObjectSchema<any>;
        update: Joi.ObjectSchema<any>;
    };
    fleet: {
        member: Joi.ObjectSchema<any>;
    };
    tradingRoute: {
        create: Joi.ObjectSchema<any>;
        updatePerformance: Joi.ObjectSchema<any>;
        updateStatus: Joi.ObjectSchema<any>;
    };
    shipLoan: {
        request: Joi.ObjectSchema<any>;
        updateStatus: Joi.ObjectSchema<any>;
    };
    miningOperation: {
        create: Joi.ObjectSchema<any>;
        addCrew: Joi.ObjectSchema<any>;
        recordResources: Joi.ObjectSchema<any>;
        updateStatus: Joi.ObjectSchema<any>;
    };
    shipMaintenance: {
        schedule: Joi.ObjectSchema<any>;
        updateStatus: Joi.ObjectSchema<any>;
    };
    bounty: {
        create: Joi.ObjectSchema<any>;
        claim: Joi.ObjectSchema<any>;
        complete: Joi.ObjectSchema<any>;
    };
    cargoManifest: {
        create: Joi.ObjectSchema<any>;
        addCargo: Joi.ObjectSchema<any>;
        updateStatus: Joi.ObjectSchema<any>;
        updateSharing: Joi.ObjectSchema<any>;
    };
    crewAssignment: {
        create: Joi.ObjectSchema<any>;
        update: Joi.ObjectSchema<any>;
    };
    reputation: {
        create: Joi.ObjectSchema<any>;
        update: Joi.ObjectSchema<any>;
    };
    contract: {
        create: Joi.ObjectSchema<any>;
        update: Joi.ObjectSchema<any>;
    };
    allianceDiplomacy: {
        create: Joi.ObjectSchema<any>;
        update: Joi.ObjectSchema<any>;
    };
};
//# sourceMappingURL=schemaValidation.d.ts.map