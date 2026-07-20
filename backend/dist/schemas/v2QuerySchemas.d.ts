import Joi from 'joi';
export declare const paginationQuerySchema: Joi.ObjectSchema<any>;
export declare const sortQuerySchema: Joi.ObjectSchema<any>;
export declare const searchQuerySchema: Joi.ObjectSchema<any>;
export declare const fieldsQuerySchema: Joi.ObjectSchema<any>;
export declare const standardListQuerySchema: Joi.ObjectSchema<any>;
export declare const fleetListQuerySchema: Joi.ObjectSchema<any>;
export declare const shipListQuerySchema: Joi.ObjectSchema<any>;
export declare const activityListQuerySchema: Joi.ObjectSchema<any>;
export declare const tradingRouteListQuerySchema: Joi.ObjectSchema<any>;
export declare const userListQuerySchema: Joi.ObjectSchema<any>;
export declare const organizationListQuerySchema: Joi.ObjectSchema<any>;
export declare function validateQueryParams(query: Record<string, unknown>, schema: Joi.ObjectSchema): {
    value: Record<string, unknown>;
    error?: Joi.ValidationError;
};
//# sourceMappingURL=v2QuerySchemas.d.ts.map