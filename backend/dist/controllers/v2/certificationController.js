"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CertificationController = void 0;
const CertificationService_1 = require("../../services/certification/CertificationService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class CertificationController extends BaseController_1.BaseController {
    certificationService;
    constructor() {
        super();
        this.certificationService = new CertificationService_1.CertificationService();
    }
    listCertifications = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { limit, search } = req.query;
            const data = await this.certificationService.listCertifications(organizationId, {
                limit: limit ? Math.min(parseInt(limit, 10), 200) : undefined,
                search: search,
            });
            res.json({ success: true, data });
        });
    };
    getCertification = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const cert = await this.certificationService.getCertification(organizationId, req.params.certificationId);
            if (!cert) {
                res.status(404).json({ success: false, error: 'Certification not found' });
                return;
            }
            res.json({ success: true, data: cert });
        });
    };
    createCertification = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const body = req.body;
            const cert = await this.certificationService.createCertification(organizationId, userId, body);
            res.status(201).json({ success: true, data: cert });
        });
    };
    updateCertification = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const body = req.body;
            const cert = await this.certificationService.updateCertification(organizationId, req.params.certificationId, body);
            res.json({ success: true, data: cert });
        });
    };
    deleteCertification = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            await this.certificationService.deleteCertification(organizationId, req.params.certificationId);
            res.json({ success: true, message: 'Certification deleted' });
        });
    };
    awardCertification = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { userId: targetUserId } = req.body;
            const userCert = await this.certificationService.awardCertification(organizationId, userId, req.params.certificationId, targetUserId);
            res.status(201).json({ success: true, data: userCert });
        });
    };
    revokeCertification = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { userId: targetUserId, reason } = req.body;
            const userCert = await this.certificationService.revokeCertification(organizationId, userId, req.params.certificationId, targetUserId, reason);
            res.json({ success: true, data: userCert });
        });
    };
    getUserCertifications = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const certs = await this.certificationService.getUserCertifications(organizationId, req.params.userId);
            res.json({ success: true, data: certs });
        });
    };
    getCertificationHolders = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const holders = await this.certificationService.getCertificationHolders(organizationId, req.params.certificationId);
            res.json({ success: true, data: holders });
        });
    };
}
exports.CertificationController = CertificationController;
//# sourceMappingURL=certificationController.js.map