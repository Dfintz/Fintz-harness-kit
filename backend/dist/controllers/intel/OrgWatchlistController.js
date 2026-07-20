"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgWatchlistController = void 0;
const OrgWatchlistService_1 = require("../../services/intel/OrgWatchlistService");
const BaseController_1 = require("../BaseController");
class OrgWatchlistController extends BaseController_1.BaseController {
    watchlistService = null;
    getService() {
        this.watchlistService ??= new OrgWatchlistService_1.OrgWatchlistService();
        return this.watchlistService;
    }
    listEntries = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            const query = req.query;
            if (query.reasons && !Array.isArray(query.reasons)) {
                query.reasons = [query.reasons];
            }
            if (query.threatLevels && !Array.isArray(query.threatLevels)) {
                query.threatLevels = [query.threatLevels];
            }
            return this.getService().listEntries(orgId, query);
        });
    };
    getEntryById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, entryId } = req.params;
            const entry = await this.getService().getEntryById(orgId, entryId);
            if (!entry) {
                res.status(404).json({ error: 'Watchlist entry not found' });
                return null;
            }
            return entry;
        });
    };
    createEntry = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const { orgId } = req.params;
            const dto = req.body;
            return this.getService().createEntry(orgId, user.id, dto);
        }, 201);
    };
    updateEntry = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, entryId } = req.params;
            const dto = req.body;
            return this.getService().updateEntry(orgId, entryId, dto);
        });
    };
    deleteEntry = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, entryId } = req.params;
            const deleted = await this.getService().deleteEntry(orgId, entryId);
            if (!deleted) {
                res.status(404).json({ error: 'Watchlist entry not found' });
                return null;
            }
            return { success: true };
        });
    };
}
exports.OrgWatchlistController = OrgWatchlistController;
//# sourceMappingURL=OrgWatchlistController.js.map