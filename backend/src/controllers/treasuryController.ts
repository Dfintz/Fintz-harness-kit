import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import {
  CommissaryFilters,
  CommissaryService,
  CreateCommissaryItemDTO,
  UpdateCommissaryItemDTO,
} from '../services/treasury/CommissaryService';
import { CreateDuesDTO, DuesService, UpdateDuesDTO } from '../services/treasury/DuesService';
import {
  EarnCreditsDTO,
  getTreasuryService,
  SpendCreditsDTO,
  TransactionFilters,
  TransferCreditsDTO,
  TreasuryService,
} from '../services/treasury/TreasuryService';
import { parsePaginationQuery } from '../utils/pagination';
import { parseBooleanQuery } from '../utils/queryUtils';

import { BaseController } from './BaseController';

/**
 * Treasury Controller
 *
 * Provides /api/v2/credits endpoints for credit pool, transactions,
 * dues management, and commissary operations.
 */
export class TreasuryController extends BaseController {
  private readonly treasuryService: TreasuryService;
  private readonly duesService: DuesService;
  private readonly commissaryService: CommissaryService;

  constructor() {
    super();
    this.treasuryService = getTreasuryService();
    this.duesService = new DuesService();
    this.commissaryService = new CommissaryService();
  }

  // ==================== CREDIT OPERATIONS ====================

  getBalance = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const balance = await this.treasuryService.getBalance(organizationId);
      res.json(balance);
    });
  };

  getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const pagination = parsePaginationQuery(req.query);
      const filters: TransactionFilters = {
        type: req.query.type as TransactionFilters['type'],
        category: req.query.category as string,
        fromUserId: req.query.fromUserId as string,
        toUserId: req.query.toUserId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
      };

      const result = await this.treasuryService.getTransactions(
        organizationId,
        pagination,
        filters
      );
      res.json(result);
    });
  };

  earnCredits = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const dto: EarnCreditsDTO = req.body;

      const txn = await this.treasuryService.earnCredits(organizationId, userId, dto);
      res.status(201).json(txn);
    });
  };

  spendCredits = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const dto: SpendCreditsDTO = req.body;

      const txn = await this.treasuryService.spendCredits(organizationId, userId, dto);
      res.status(201).json(txn);
    });
  };

  transferCredits = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const dto: TransferCreditsDTO = req.body;

      const txn = await this.treasuryService.transferCredits(organizationId, userId, dto);
      res.status(201).json(txn);
    });
  };

  getStatistics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const period = req.query.period as string | undefined;

      const stats = await this.treasuryService.getStatistics(organizationId, period);
      res.json(stats);
    });
  };

  getLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      const limit = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : 10;

      const leaderboard = await this.treasuryService.getLeaderboard(
        organizationId,
        Number.isFinite(limit) && limit > 0 ? limit : 10
      );
      res.json(leaderboard);
    });
  };

  // ==================== DUES ====================

  listDues = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const pagination = parsePaginationQuery(req.query);
      const activeOnly = parseBooleanQuery(req.query.activeOnly);

      const result = await this.duesService.listDues(organizationId, pagination, activeOnly);
      res.json(result);
    });
  };

  createDues = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const dto: CreateDuesDTO = req.body;

      const dues = await this.duesService.createDues(organizationId, userId, dto);
      res.status(201).json(dues);
    });
  };

  updateDues = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { duesId } = req.params;
      const dto: UpdateDuesDTO = req.body;

      const dues = await this.duesService.updateDues(organizationId, duesId, dto);
      res.json(dues);
    });
  };

  deleteDues = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { duesId } = req.params;

      await this.duesService.deleteDues(organizationId, duesId);
      res.status(204).send();
    });
  };

  // ==================== COMMISSARY ====================

  listCommissaryItems = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const pagination = parsePaginationQuery(req.query);
      const filters: CommissaryFilters = {
        category: req.query.category as string,
        activeOnly: req.query.activeOnly !== 'false',
        searchTerm: req.query.searchTerm as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'ASC' | 'DESC',
      };

      const result = await this.commissaryService.listItems(organizationId, pagination, filters);
      res.json(result);
    });
  };

  createCommissaryItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const dto: CreateCommissaryItemDTO = req.body;

      const item = await this.commissaryService.createItem(organizationId, userId, dto);
      res.status(201).json(item);
    });
  };

  updateCommissaryItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { itemId } = req.params;
      const dto: UpdateCommissaryItemDTO = req.body;

      const item = await this.commissaryService.updateItem(organizationId, itemId, dto);
      res.json(item);
    });
  };

  deleteCommissaryItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { itemId } = req.params;

      await this.commissaryService.deleteItem(organizationId, itemId);
      res.status(204).send();
    });
  };

  purchaseItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { itemId } = req.params;
      const { quantity } = req.body;

      const purchase = await this.commissaryService.purchaseItem(organizationId, userId, {
        itemId,
        quantity,
      });
      res.status(201).json(purchase);
    });
  };

  getPurchaseHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const pagination = parsePaginationQuery(req.query);
      const buyerId = req.query.buyerId as string | undefined;

      const result = await this.commissaryService.getPurchaseHistory(
        organizationId,
        pagination,
        buyerId
      );
      res.json(result);
    });
  };
}
