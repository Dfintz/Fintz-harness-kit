import Joi from 'joi';
export declare const jobDashboardSchemas: {
    getDashboardOverview: {
        query: Joi.ObjectSchema<any>;
    };
    getJobStatus: {
        params: Joi.ObjectSchema<any>;
    };
    getAllJobStatuses: {
        query: Joi.ObjectSchema<any>;
    };
    getJobExecutionHistory: {
        params: Joi.ObjectSchema<any>;
        query: Joi.ObjectSchema<any>;
    };
    getRecentExecutions: {
        query: Joi.ObjectSchema<any>;
    };
    getActiveAlerts: {};
    getJobAlerts: {
        params: Joi.ObjectSchema<any>;
    };
    acknowledgeAlert: {
        params: Joi.ObjectSchema<any>;
        body: Joi.ObjectSchema<any>;
    };
    resolveAlert: {
        params: Joi.ObjectSchema<any>;
    };
    getJobPerformanceTrends: {
        params: Joi.ObjectSchema<any>;
        query: Joi.ObjectSchema<any>;
    };
};
//# sourceMappingURL=jobDashboardSchemas.d.ts.map