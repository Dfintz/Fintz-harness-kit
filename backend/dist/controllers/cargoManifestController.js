"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CargoManifestController = void 0;
const CargoManifestService_1 = require("../services/fleet/CargoManifestService");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
const getRequestOrganizationId = (req) => req.tenantContext?.organizationId || req.user?.currentOrganizationId || null;
class CargoManifestController extends BaseController_1.BaseController {
    manifestService = new CargoManifestService_1.CargoManifestService();
    constructor() {
        super();
    }
    createManifest = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = getRequestOrganizationId(req);
            if (!organizationId) {
                res.status(400).json({
                    error: 'No active organization selected',
                    message: 'Please select an organization to continue',
                    requiresOrgSelection: true,
                });
                return;
            }
            const ownerId = req.user?.id;
            if (!ownerId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const manifest = await this.manifestService.create(req.body, organizationId, ownerId);
            res.status(201).json(manifest);
        });
    };
    getManifests = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = getRequestOrganizationId(req);
            if (!organizationId) {
                res.status(400).json({
                    error: 'No active organization selected',
                    message: 'Please select an organization to continue',
                    requiresOrgSelection: true,
                });
                return;
            }
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.manifestService.findAll(paginationOptions, organizationId);
        });
    };
    getManifestById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = getRequestOrganizationId(req);
            if (!organizationId) {
                res.status(400).json({
                    error: 'No active organization selected',
                    message: 'Please select an organization to continue',
                    requiresOrgSelection: true,
                });
                return;
            }
            return this.manifestService.findById(req.params.id, organizationId);
        });
    };
    addCargoItem = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = getRequestOrganizationId(req);
            if (!organizationId) {
                res.status(400).json({
                    error: 'No active organization selected',
                    message: 'Please select an organization to continue',
                    requiresOrgSelection: true,
                });
                return;
            }
            return this.manifestService.addCargoItem(req.params.id, organizationId, req.body);
        });
    };
    updateStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = getRequestOrganizationId(req);
            if (!organizationId) {
                res.status(400).json({
                    error: 'No active organization selected',
                    message: 'Please select an organization to continue',
                    requiresOrgSelection: true,
                });
                return;
            }
            return this.manifestService.updateStatus(req.params.id, organizationId, req.body.status);
        });
    };
    updateSharing = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = getRequestOrganizationId(req);
            if (!organizationId) {
                res.status(400).json({
                    error: 'No active organization selected',
                    message: 'Please select an organization to continue',
                    requiresOrgSelection: true,
                });
                return;
            }
            return this.manifestService.updateSharing(req.params.id, organizationId, req.body);
        });
    };
}
exports.CargoManifestController = CargoManifestController;
//# sourceMappingURL=cargoManifestController.js.map