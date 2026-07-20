import Joi from 'joi';
export declare const intelSchemas: {
    createEntry: Joi.ObjectSchema<any>;
    updateEntry: Joi.ObjectSchema<any>;
    queryEntries: Joi.ObjectSchema<any>;
    appointOfficer: Joi.ObjectSchema<any>;
    updateOfficer: Joi.ObjectSchema<any>;
    queryOfficers: Joi.ObjectSchema<any>;
    removeOfficer: Joi.ObjectSchema<any>;
    createShare: Joi.ObjectSchema<any>;
    shareResponse: Joi.ObjectSchema<any>;
    queryShares: Joi.ObjectSchema<any>;
    queryAuditLogs: Joi.ObjectSchema<any>;
    entryIdParam: Joi.ObjectSchema<any>;
    officerIdParam: Joi.ObjectSchema<any>;
    shareIdParam: Joi.ObjectSchema<any>;
    orgIdParam: Joi.ObjectSchema<any>;
};
//# sourceMappingURL=intelSchemas.d.ts.map