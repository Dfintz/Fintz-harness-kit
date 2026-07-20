import Joi from 'joi';
export declare const eventSchemas: {
    create: Joi.ObjectSchema<any>;
    update: Joi.ObjectSchema<any>;
    query: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
};
export declare const normalizeEventDate: (body: Record<string, unknown>) => void;
//# sourceMappingURL=eventSchemas.d.ts.map