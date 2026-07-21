import { Request, Response } from 'express';

import { ActivityStatus, ActivityType } from '../models/Activity';
import { JobType, ListingCategory, PayType } from '../models/PublicJobListing';
import {
  OpportunitySearchService,
  UnifiedOpportunityFilters,
} from '../services/search/OpportunitySearchService';
import { PaginationOptions } from '../utils/pagination';

import { BaseController } from './BaseController';

/**
 * Parse a comma-separated query parameter into a string array.
 */
function parseCommaSeparated(value: unknown): string[] {
  if (!value) {
    return [];
  }
  return typeof value === 'string' ? value.split(',').map(v => v.trim()) : (value as string[]);
}

/**
 * Controller for unified opportunity search
 * Sprint 19-G: Unified Opportunity Pool
 */
class OpportunitySearchController extends BaseController {
  private readonly service: OpportunitySearchService;

  constructor() {
    super();
    this.service = new OpportunitySearchService();
  }

  /**
   * GET /api/v2/search/opportunities
   * Search across jobs and activities with unified filters
   */
  searchOpportunities = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const query = req.query;

      // Parse filters from validated query params
      const filters: UnifiedOpportunityFilters = {};

      if (query.sourceType) {
        filters.sourceType = query.sourceType as 'all' | 'job' | 'activity';
      }
      if (query.searchTerm) {
        filters.searchTerm = String(query.searchTerm).trim();
      }
      if (query.organizationId) {
        filters.organizationId = query.organizationId as string;
      }
      if (query.tags) {
        filters.tags = parseCommaSeparated(query.tags);
      }

      // Job-specific filters
      if (query.jobTypes) {
        filters.jobTypes = parseCommaSeparated(query.jobTypes) as JobType[];
      }
      if (query.payTypes) {
        filters.payTypes = parseCommaSeparated(query.payTypes) as PayType[];
      }
      if (query.listingCategory) {
        filters.listingCategory = query.listingCategory as ListingCategory;
      }
      if (query.minPay) {
        filters.minPay = Number.parseInt(query.minPay as string, 10);
      }
      if (query.maxPay) {
        filters.maxPay = Number.parseInt(query.maxPay as string, 10);
      }

      // Activity-specific filters
      if (query.activityTypes) {
        filters.activityTypes = parseCommaSeparated(query.activityTypes) as ActivityType[];
      }
      if (query.activityStatus) {
        filters.activityStatus = parseCommaSeparated(query.activityStatus) as ActivityStatus[];
      }
      if (query.hasOpenSlots !== undefined) {
        filters.hasOpenSlots = query.hasOpenSlots === 'true';
      }
      if (query.isFeatured !== undefined) {
        filters.isFeatured = query.isFeatured === 'true';
      }
      if (query.startDate) {
        filters.startDate = new Date(query.startDate as string);
      }
      if (query.endDate) {
        filters.endDate = new Date(query.endDate as string);
      }

      // Advanced filters (Sprint 23-E)
      if (query.minReputationScore !== undefined) {
        filters.minReputationScore = Number.parseInt(query.minReputationScore as string, 10);
      }
      if (query.reputationTiers) {
        filters.reputationTiers = parseCommaSeparated(query.reputationTiers);
      }
      if (query.minSuccessRate !== undefined) {
        filters.minSuccessRate = Number.parseInt(query.minSuccessRate as string, 10);
      }

      // Parse pagination
      const pagination: PaginationOptions = {
        page: Number.parseInt((query.page as string) ?? '1', 10) || 1,
        limit: Math.min(Number.parseInt((query.limit as string) ?? '20', 10) || 20, 100),
        sortBy: (query.sortBy as string) ?? 'postedAt',
        sortOrder: ((query.sortOrder as string) ?? 'DESC') as 'ASC' | 'DESC',
      };

      return this.service.searchOpportunities(filters, pagination);
    });
  };
}

// Lazy initialization to avoid EntityMetadataNotFoundError before DB is ready
let _instance: OpportunitySearchController;
export function getOpportunitySearchController(): OpportunitySearchController {
  if (!_instance) {
    _instance = new OpportunitySearchController();
  }
  return _instance;
}

/** @deprecated Use getOpportunitySearchController() for lazy init */
export const opportunitySearchController = {
  searchOpportunities: (req: Request, res: Response) =>
    getOpportunitySearchController().searchOpportunities(req, res),
};
