"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const sharePermissions = ['view', 'download', 'edit'];
const mimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
];
exports.documentSchemas = {
    upload: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).required(),
        description: joi_1.default.string().trim().max(2000).optional(),
        folderId: joi_1.default.string().uuid().optional(),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        isPublic: joi_1.default.boolean().default(false),
    }),
    update: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).optional(),
        description: joi_1.default.string().trim().max(2000).optional().allow(null),
        folderId: joi_1.default.string().uuid().optional().allow(null),
        tags: joi_1.default.array().items(joi_1.default.string().trim().max(50)).max(20).optional(),
        isPublic: joi_1.default.boolean().optional(),
    }).min(1),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        folderId: joi_1.default.string().uuid().optional(),
        mimeType: joi_1.default.string()
            .valid(...mimeTypes)
            .optional(),
        search: joi_1.default.string().trim().max(200).optional(),
        sortBy: joi_1.default.string().valid('createdAt', 'name', 'fileSize', 'mimeType').default('createdAt'),
        sortOrder: joi_1.default.string().valid('ASC', 'DESC').default('DESC'),
    }),
    share: joi_1.default.object({
        sharedWithUserId: joi_1.default.string().uuid().optional(),
        sharedWithRole: joi_1.default.string().trim().max(100).optional(),
        permission: joi_1.default.string()
            .valid(...sharePermissions)
            .required(),
        expiresAt: joi_1.default.date().iso().min('now').optional(),
    }).or('sharedWithUserId', 'sharedWithRole'),
    uploadVersion: joi_1.default.object({
        changeNote: joi_1.default.string().trim().max(500).optional(),
    }),
    createFolder: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).required(),
        parentId: joi_1.default.string().uuid().optional(),
    }),
    updateFolder: joi_1.default.object({
        name: joi_1.default.string().trim().min(1).max(255).optional(),
        sortOrder: joi_1.default.number().integer().min(0).optional(),
    }).min(1),
    documentParam: joi_1.default.object({
        documentId: joi_1.default.string().uuid().required(),
    }),
    folderParam: joi_1.default.object({
        folderId: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=documentSchemas.js.map