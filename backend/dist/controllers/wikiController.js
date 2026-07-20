"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiController = void 0;
const WikiService_1 = require("../services/content/WikiService");
const BaseController_1 = require("./BaseController");
class WikiController extends BaseController_1.BaseController {
    wikiService;
    constructor() {
        super();
        this.wikiService = new WikiService_1.WikiService();
    }
    createPage = async (req, res) => {
        await this.execute(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrganizationId(authReq);
            const userId = authReq.user?.id;
            const page = await this.wikiService.createPage(organizationId, userId, req.body);
            res.status(201).json(page);
        });
    };
    getPage = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.wikiService.getPage(organizationId, req.params.pageId);
        });
    };
    getAllPages = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.wikiService.getAllPages(organizationId);
        });
    };
    updatePage = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrganizationId(authReq);
            const userId = authReq.user?.id;
            return this.wikiService.updatePage(organizationId, req.params.pageId, userId, req.body);
        });
    };
    deletePage = async (req, res) => {
        await this.execute(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrganizationId(authReq);
            const userId = authReq.user?.id;
            await this.wikiService.deletePage(organizationId, req.params.pageId, userId);
            res.status(204).send();
        });
    };
    getPageTree = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.wikiService.getPageTree(organizationId);
        });
    };
    movePage = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            await this.wikiService.movePage(organizationId, req.params.pageId, req.body);
            res.status(200).json({ success: true });
        });
    };
    getRevisions = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.wikiService.getRevisions(organizationId, req.params.pageId);
        });
    };
    getRevision = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.wikiService.getRevision(organizationId, req.params.pageId, req.params.revisionId);
        });
    };
    restoreRevision = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrganizationId(authReq);
            const userId = authReq.user?.id;
            return this.wikiService.restoreRevision(organizationId, req.params.pageId, req.body.revisionId, userId);
        });
    };
    searchPages = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const q = req.query.q;
            const limit = Math.min(req.query.limit ? parseInt(req.query.limit, 10) : 20, 200);
            return this.wikiService.searchPages(organizationId, q, limit);
        });
    };
}
exports.WikiController = WikiController;
//# sourceMappingURL=wikiController.js.map