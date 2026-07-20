import Joi from 'joi';
export declare const bountySchemas: {
    create: Joi.ObjectSchema<any>;
    update: Joi.ObjectSchema<any>;
    claim: Joi.ObjectSchema<any>;
    complete: Joi.ObjectSchema<any>;
    verify: Joi.ObjectSchema<any>;
    pay: Joi.ObjectSchema<any>;
    cancel: Joi.ObjectSchema<any>;
    query: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
    listMine: Joi.ObjectSchema<any>;
};
export declare const claimSchemas: {
    create: Joi.ObjectSchema<any>;
    submit: Joi.ObjectSchema<any>;
    abandon: Joi.ObjectSchema<any>;
    verify: Joi.ObjectSchema<any>;
    approve: Joi.ObjectSchema<any>;
    reject: Joi.ObjectSchema<any>;
    pay: Joi.ObjectSchema<any>;
    query: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
};
export declare const evidenceSchemas: {
    submit: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
    query: Joi.ObjectSchema<any>;
};
//# sourceMappingURL=bountySchemas.d.ts.map