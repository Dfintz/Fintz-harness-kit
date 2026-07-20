"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.opportunitySearchController = void 0;
exports.getOpportunitySearchController = getOpportunitySearchController;
const OpportunitySearchService_1 = require("../services/search/OpportunitySearchService");
const BaseController_1 = require("./BaseController");
function parseCommaSeparated(value) {
    if (!value) {
        return [];
    }
    return typeof value === 'string' ? value.split(',').map(v => v.trim()) : value;
}
class OpportunitySearchController extends BaseController_1.BaseController {
    service;
    constructor() {
        super();
        this.service = new OpportunitySearchService_1.OpportunitySearchService();
    }
    searchOpportunities = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const query = req.query;
            const filters = {};
            if (query.sourceType) {
                filters.sourceType = query.sourceType;
            }
            if (query.searchTerm) {
                filters.searchTerm = String(query.searchTerm).trim();
            }
            if (query.organizationId) {
                filters.organizationId = query.organizationId;
            }
            if (query.tags) {
                filters.tags = parseCommaSeparated(query.tags);
            }
            if (query.jobTypes) {
                filters.jobTypes = parseCommaSeparated(query.jobTypes);
            }
            if (query.payTypes) {
                filters.payTypes = parseCommaSeparated(query.payTypes);
            }
            if (query.listingCategory) {
                filters.listingCategory = query.listingCategory;
            }
            if (query.minPay) {
                filters.minPay = Number.parseInt(query.minPay, 10);
            }
            if (query.maxPay) {
                filters.maxPay = Number.parseInt(query.maxPay, 10);
            }
            if (query.activityTypes) {
                filters.activityTypes = parseCommaSeparated(query.activityTypes);
            }
            if (query.activityStatus) {
                filters.activityStatus = parseCommaSeparated(query.activityStatus);
            }
            if (query.hasOpenSlots !== undefined) {
                filters.hasOpenSlots = query.hasOpenSlots === 'true';
            }
            if (query.isFeatured !== undefined) {
                filters.isFeatured = query.isFeatured === 'true';
            }
            if (query.startDate) {
                filters.startDate = new Date(query.startDate);
            }
            if (query.endDate) {
                filters.endDate = new Date(query.endDate);
            }
            if (query.minReputationScore !== undefined) {
                filters.minReputationScore = Number.parseInt(query.minReputationScore, 10);
            }
            if (query.reputationTiers) {
                filters.reputationTiers = parseCommaSeparated(query.reputationTiers);
            }
            if (query.minSuccessRate !== undefined) {
                filters.minSuccessRate = Number.parseInt(query.minSuccessRate, 10);
            }
            const pagination = {
                page: Number.parseInt(query.page ?? '1', 10) || 1,
                limit: Math.min(Number.parseInt(query.limit ?? '20', 10) || 20, 100),
                sortBy: query.sortBy ?? 'postedAt',
                sortOrder: (query.sortOrder ?? 'DESC'),
            };
            return this.service.searchOpportunities(filters, pagination);
        });
    };
}
let _instance;
function getOpportunitySearchController() {
    if (!_instance) {
        _instance = new OpportunitySearchController();
    }
    return _instance;
}
exports.opportunitySearchController = {
    searchOpportunities: (req, res) => getOpportunitySearchController().searchOpportunities(req, res),
};
//# sourceMappingURL=opportunitySearchController.js.map