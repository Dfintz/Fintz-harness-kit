import Joi from 'joi';
export declare const sharedAccountSchemas: {
    create: Joi.ObjectSchema<any>;
    update: Joi.ObjectSchema<any>;
    updatePassword: Joi.ObjectSchema<any>;
    update2FA: Joi.ObjectSchema<any>;
    grantPermission: Joi.ObjectSchema<any>;
    bulkImport: Joi.ObjectSchema<any>;
    query: Joi.ObjectSchema<any>;
    params: {
        organizationId: Joi.ObjectSchema<any>;
        accountId: Joi.ObjectSchema<any>;
    };
};
//# sourceMappingURL=sharedAccountSchemas.d.ts.map