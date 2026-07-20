"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const widgetType = joi_1.default.string()
    .valid('chart', 'table', 'metric', 'list', 'map', 'timeline', 'custom')
    .required();
const position = joi_1.default.object({
    x: joi_1.default.number().integer().min(0).required(),
    y: joi_1.default.number().integer().min(0).required(),
    w: joi_1.default.number().integer().min(1).max(12).required(),
    h: joi_1.default.number().integer().min(1).max(12).required(),
});
exports.dashboardSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().min(1).max(200).trim().required(),
        description: common_1.description,
        type: joi_1.default.string().valid('personal', 'organization', 'fleet', 'logistics').default('personal'),
        layout: joi_1.default.string().valid('grid', 'freeform').default('grid'),
        isDefault: joi_1.default.boolean().default(false),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().min(1).max(200).trim(),
        description: common_1.description,
        type: joi_1.default.string().valid('personal', 'organization', 'fleet', 'logistics'),
        layout: joi_1.default.string().valid('grid', 'freeform'),
        isDefault: joi_1.default.boolean(),
    }).min(1),
    addWidget: joi_1.default.object({
        type: widgetType,
        title: joi_1.default.string().min(1).max(200).trim().required(),
        position,
        config: joi_1.default.object().unknown(true),
        dataSource: joi_1.default.string().max(200).trim(),
    }),
    updateWidget: joi_1.default.object({
        title: joi_1.default.string().min(1).max(200).trim(),
        position,
        config: joi_1.default.object().unknown(true),
        dataSource: joi_1.default.string().max(200).trim(),
    }).min(1),
    share: joi_1.default.object({
        userIds: joi_1.default.array().items(joi_1.default.string().uuid()).min(1).max(50).required(),
        permissions: joi_1.default.string().valid('view', 'edit', 'manage').default('view'),
    }),
    query: common_1.pagination.keys({
        type: joi_1.default.string().valid('personal', 'organization', 'fleet', 'logistics'),
        scope: joi_1.default.string().valid('own', 'shared', 'all').default('own'),
    }),
    param: joi_1.default.object({
        dashboardId: joi_1.default.string().uuid().required(),
    }),
    widgetParam: joi_1.default.object({
        dashboardId: joi_1.default.string().uuid().required(),
        widgetId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=dashboardSchemas.js.map