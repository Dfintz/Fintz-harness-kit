import Joi from 'joi';
export declare const webhookSchemas: {
    create: Joi.ObjectSchema<any>;
    update: Joi.ObjectSchema<any>;
    triggerEvent: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
    deliveryQuery: Joi.ObjectSchema<any>;
    testCustom: Joi.ObjectSchema<any>;
    payloadPreview: Joi.ObjectSchema<any>;
    batchConfig: Joi.ObjectSchema<any>;
    batchFlush: Joi.ObjectSchema<any>;
};
export declare const createWebhookSchema: Joi.ObjectSchema<any>;
export declare const updateWebhookSchema: Joi.ObjectSchema<any>;
export declare const triggerEventSchema: Joi.ObjectSchema<any>;
export declare const webhookParamSchema: Joi.ObjectSchema<any>;
export declare const deliveryQuerySchema: Joi.ObjectSchema<any>;
export declare const testCustomSchema: Joi.ObjectSchema<any>;
export declare const payloadPreviewSchema: Joi.ObjectSchema<any>;
export declare const batchConfigSchema: Joi.ObjectSchema<any>;
export declare const batchFlushSchema: Joi.ObjectSchema<any>;
//# sourceMappingURL=webhookSchemas.d.ts.map