"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetViewController = void 0;
const multer_1 = __importDefault(require("multer"));
const database_1 = require("../config/database");
const Organization_1 = require("../models/Organization");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const FleetViewService_1 = require("../services/fleet/FleetViewService");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const queryUtils_1 = require("../utils/queryUtils");
const roleUtils_1 = require("../utils/roleUtils");
const BaseController_1 = require("./BaseController");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/json') {
            cb(null, true);
        }
        else {
            cb(new Error('Only JSON files are allowed'));
        }
    },
});
class FleetViewController extends BaseController_1.BaseController {
    fleetViewService = new FleetViewService_1.FleetViewService();
    organizationRepository = database_1.AppDataSource.getRepository(Organization_1.Organization);
    userOrganizationRepository = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    static IMPORT_OPTION_FIELDS = new Set(['merge', 'skipDuplicates']);
    uploadMiddleware = upload.single('file');
    normalizeFleetViewSchema(rawSchema) {
        let parsedSchema = rawSchema;
        if (typeof parsedSchema === 'string') {
            try {
                parsedSchema = JSON.parse(parsedSchema);
            }
            catch (parseError) {
                throw new apiErrors_1.ValidationError('Invalid JSON schema format', {
                    parseError: parseError instanceof Error ? parseError.message : String(parseError),
                });
            }
        }
        if (Array.isArray(parsedSchema)) {
            return { ships: parsedSchema };
        }
        if (parsedSchema && typeof parsedSchema === 'object') {
            const schemaObject = parsedSchema;
            if (Array.isArray(schemaObject.ships)) {
                return parsedSchema;
            }
        }
        throw new apiErrors_1.ValidationError('Invalid FleetView schema format. JSON must be an array of ships or an object with a "ships" array.');
    }
    hasDirectSchemaInBody(body) {
        if (!body || typeof body !== 'object') {
            return false;
        }
        const bodyObject = body;
        return Object.keys(bodyObject).some(key => !FleetViewController.IMPORT_OPTION_FIELDS.has(key));
    }
    parseFleetViewSchema(req) {
        let rawSchema;
        if (req.file) {
            const fileContent = req.file.buffer.toString('utf-8');
            try {
                rawSchema = JSON.parse(fileContent);
            }
            catch (parseError) {
                throw new apiErrors_1.ValidationError('Invalid JSON file format', {
                    parseError: parseError instanceof Error ? parseError.message : String(parseError),
                });
            }
        }
        else if (req.body?.schema !== undefined) {
            rawSchema = req.body.schema;
        }
        else if (this.hasDirectSchemaInBody(req.body)) {
            rawSchema = req.body;
        }
        else {
            throw new apiErrors_1.ValidationError('No FleetView data provided. Send either a JSON file or schema in request body.');
        }
        return this.normalizeFleetViewSchema(rawSchema);
    }
    exportUserFleet = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('User not authenticated');
            }
            const includeStatistics = req.query.includeStatistics !== 'false';
            const includeInactive = (0, queryUtils_1.parseBooleanQuery)(req.query.includeInactive);
            const options = {
                userId,
                includeStatistics,
                includeInactive,
            };
            const schema = await this.fleetViewService.exportToFleetView(options);
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="my-fleet-${Date.now()}.json"`);
            return schema;
        });
    };
    exportOrgFleet = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('User not authenticated');
            }
            const { organizationId } = req.params;
            const userOrg = await this.userOrganizationRepository.findOne({
                where: { userId, organizationId, isActive: true },
            });
            if (!userOrg ||
                ((0, roleUtils_1.getRoleName)(userOrg.role) !== 'admin' &&
                    (0, roleUtils_1.getRoleName)(userOrg.role) !== 'owner' &&
                    (0, roleUtils_1.getRoleName)(userOrg.role) !== 'founder')) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized: Only organization leaders can export organization fleets');
            }
            const includeStatistics = req.query.includeStatistics !== 'false';
            const includeInactive = (0, queryUtils_1.parseBooleanQuery)(req.query.includeInactive);
            const options = {
                organizationId,
                includeStatistics,
                includeInactive,
            };
            const schema = await this.fleetViewService.exportToFleetView(options);
            const org = await this.organizationRepository.findOne({
                where: { id: organizationId },
            });
            const orgName = org?.name.replaceAll(/[^a-z0-9]/gi, '-').toLowerCase() || organizationId;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${orgName}-fleet-${Date.now()}.json"`);
            return schema;
        });
    };
    importUserFleet = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('User not authenticated');
            }
            const schema = this.parseFleetViewSchema(req);
            if (!this.fleetViewService.validateSchema(schema)) {
                throw new apiErrors_1.ValidationError('Invalid FleetView schema format');
            }
            const organizationId = `user-${userId}`;
            const options = {
                merge: req.body.merge !== false,
                skipDuplicates: req.body.skipDuplicates !== false,
                organizationId,
                userId,
            };
            const result = await this.fleetViewService.importFromFleetView(schema, options);
            return result;
        });
    };
    importOrgFleet = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('User not authenticated');
            }
            const { organizationId } = req.params;
            const userOrg = await this.userOrganizationRepository.findOne({
                where: { userId, organizationId, isActive: true },
            });
            if (!userOrg ||
                ((0, roleUtils_1.getRoleName)(userOrg.role) !== 'admin' &&
                    (0, roleUtils_1.getRoleName)(userOrg.role) !== 'owner' &&
                    (0, roleUtils_1.getRoleName)(userOrg.role) !== 'founder')) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized: Only organization leaders can import to organization fleets');
            }
            const schema = this.parseFleetViewSchema(req);
            if (!this.fleetViewService.validateSchema(schema)) {
                throw new apiErrors_1.ValidationError('Invalid FleetView schema format');
            }
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID is required');
            }
            const options = {
                merge: req.body.merge !== false,
                skipDuplicates: req.body.skipDuplicates !== false,
                organizationId,
                userId,
            };
            const result = await this.fleetViewService.importFromFleetView(schema, options);
            return result;
        });
    };
    validateSchema = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            let rawSchema;
            if (req.file) {
                const fileContent = req.file.buffer.toString('utf-8');
                try {
                    rawSchema = JSON.parse(fileContent);
                }
                catch (parseError) {
                    logger_1.logger.warn('FleetView validation failed due to invalid JSON payload', {
                        parseError: parseError instanceof Error ? parseError.message : String(parseError),
                    });
                    return {
                        valid: false,
                        error: 'Invalid JSON format',
                    };
                }
            }
            else {
                rawSchema = req.body?.schema ?? req.body;
            }
            let schema;
            try {
                schema = this.normalizeFleetViewSchema(rawSchema);
            }
            catch (parseError) {
                logger_1.logger.warn('FleetView validation failed due to invalid schema format', {
                    parseError: parseError instanceof Error ? parseError.message : String(parseError),
                });
                return {
                    valid: false,
                    error: 'Invalid FleetView schema format',
                };
            }
            const isValid = this.fleetViewService.validateSchema(schema);
            if (!isValid) {
                return {
                    valid: false,
                    error: 'Invalid FleetView schema format',
                };
            }
            return {
                valid: true,
                shipCount: schema.ships.length,
                message: 'Schema is valid and ready for import',
            };
        });
    };
}
exports.FleetViewController = FleetViewController;
//# sourceMappingURL=fleetViewController.js.map