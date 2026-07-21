import { Request, Response } from 'express';

import {
  GlobalSearchResultType,
  GlobalSearchService,
} from '../services/search/GlobalSearchService';
import { ApiErrorCode } from '../types/api';
import { logger } from '../utils/logger';

/**
 * Controller for global search across organizations, federations, and users.
 * All results are public data only — no PII is returned.
 */
class GlobalSearchController {
  private readonly service: GlobalSearchService;

  constructor() {
    this.service = new GlobalSearchService();
  }

  /**
   * GET /api/v2/search/global
   * Search across organizations, federations, and users
   */
  search = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = req.query.q as string;
      // Joi custom validator parses comma-separated types and validates against allowed values
      const types = req.query.types as GlobalSearchResultType[] | undefined;
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : undefined;

      const results = await this.service.search({ query, types, limit });
      res.success(results);
    } catch (error: unknown) {
      logger.error('Global search failed', { error });
      res.error(ApiErrorCode.INTERNAL_ERROR, 'Search failed', undefined, 500);
    }
  };
}

// Lazy initialization to avoid EntityMetadataNotFoundError before DB is ready
let _instance: GlobalSearchController;
function getGlobalSearchController(): GlobalSearchController {
  if (!_instance) {
    _instance = new GlobalSearchController();
  }
  return _instance;
}

export const globalSearchController = {
  search: (req: Request, res: Response) => getGlobalSearchController().search(req, res),
};
