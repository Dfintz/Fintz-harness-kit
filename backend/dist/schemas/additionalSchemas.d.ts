import Joi from 'joi';
export declare const tournamentSchemas: {
    create: Joi.ObjectSchema<any>;
    register: Joi.ObjectSchema<any>;
    updateMatch: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
};
export declare const reputationSchemas: {
    update: Joi.ObjectSchema<any>;
    query: Joi.ObjectSchema<any>;
};
export declare const crewSchemas: {
    create: Joi.ObjectSchema<any>;
    addMember: Joi.ObjectSchema<any>;
    removeMember: Joi.ObjectSchema<any>;
    removeCrewParams: Joi.ObjectSchema<any>;
    updateStatus: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
};
export declare const shipLoanSchemas: {
    request: Joi.ObjectSchema<any>;
    updateStatus: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
};
export declare const orgRelationshipSchemas: {
    createRelationship: Joi.ObjectSchema<any>;
    create: Joi.ObjectSchema<any>;
    update: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
};
export declare const diplomacySchemas: {
    proposal: Joi.ObjectSchema<any>;
    incident: Joi.ObjectSchema<any>;
    resolution: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
};
export declare const cargoSchemas: {
    create: Joi.ObjectSchema<any>;
    update: Joi.ObjectSchema<any>;
    addItem: Joi.ObjectSchema<any>;
    updateStatus: Joi.ObjectSchema<any>;
    updateSharing: Joi.ObjectSchema<any>;
    param: Joi.ObjectSchema<any>;
};
//# sourceMappingURL=additionalSchemas.d.ts.map