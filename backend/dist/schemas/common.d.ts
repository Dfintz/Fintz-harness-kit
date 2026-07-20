import Joi from 'joi';
export declare const id: Joi.StringSchema<string>;
export declare const optionalId: Joi.StringSchema<string>;
export declare const uuid: Joi.StringSchema<string>;
export declare const optionalUuid: Joi.StringSchema<string>;
export declare const paginationKeysWith: (limitDefault?: number, maxLimit?: number) => {
    page: Joi.NumberSchema<number>;
    limit: Joi.NumberSchema<number>;
};
export declare const pagination: Joi.ObjectSchema<any>;
export declare const paginationKeys: {
    page: Joi.NumberSchema<number>;
    limit: Joi.NumberSchema<number>;
};
export declare const pageSizeKeysWith: (pageSizeDefault?: number, maxPageSize?: number) => {
    page: Joi.NumberSchema<number>;
    pageSize: Joi.NumberSchema<number>;
};
export declare const dateRange: Joi.ObjectSchema<any>;
export declare const email: Joi.StringSchema<string>;
export declare const optionalEmail: Joi.StringSchema<string>;
export declare const url: Joi.StringSchema<string>;
export declare const optionalUrl: Joi.StringSchema<string>;
export declare const statusActive: Joi.StringSchema<string>;
export declare const idArray: Joi.ArraySchema<string[]>;
export declare const coordinates: Joi.ObjectSchema<any>;
export declare const notes: Joi.StringSchema<string>;
export declare const description: Joi.StringSchema<string>;
export declare const applicationQuestionSchema: Joi.ObjectSchema<any>;
export declare const paramSchemas: {
    id: Joi.ObjectSchema<any>;
    uuid: Joi.ObjectSchema<any>;
    squadronId: Joi.ObjectSchema<any>;
    userId: Joi.ObjectSchema<any>;
    orgId: Joi.ObjectSchema<any>;
    shipId: Joi.ObjectSchema<any>;
    memberId: Joi.ObjectSchema<any>;
    federationId: Joi.ObjectSchema<any>;
    jobId: Joi.ObjectSchema<any>;
    applicationId: Joi.ObjectSchema<any>;
    jobIdAndApplicationId: Joi.ObjectSchema<any>;
    identifier: Joi.ObjectSchema<any>;
};
export declare const querySchemas: {
    pagination: Joi.ObjectSchema<any>;
    dateRange: Joi.ObjectSchema<any>;
    search: Joi.ObjectSchema<any>;
};
//# sourceMappingURL=common.d.ts.map