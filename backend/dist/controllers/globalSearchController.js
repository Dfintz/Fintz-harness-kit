"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalSearchController = void 0;
const GlobalSearchService_1 = require("../services/search/GlobalSearchService");
const api_1 = require("../types/api");
const logger_1 = require("../utils/logger");
class GlobalSearchController {
    service;
    constructor() {
        this.service = new GlobalSearchService_1.GlobalSearchService();
    }
    search = async (req, res) => {
        try {
            const query = req.query.q;
            const types = req.query.types;
            const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : undefined;
            const results = await this.service.search({ query, types, limit });
            res.success(results);
        }
        catch (error) {
            logger_1.logger.error('Global search failed', { error });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, 'Search failed', undefined, 500);
        }
    };
}
let _instance;
function getGlobalSearchController() {
    if (!_instance) {
        _instance = new GlobalSearchController();
    }
    return _instance;
}
exports.globalSearchController = {
    search: (req, res) => getGlobalSearchController().search(req, res),
};
//# sourceMappingURL=globalSearchController.js.map