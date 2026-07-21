import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { LootPoolStatus } from '../models/LootPool';
import {
  AddLootItemDTO,
  ClaimItemDTO,
  CreateLootPoolDTO,
  getLootDistributionService,
  LootDistributionService,
  LootPoolFilters,
  UpdateLootItemDTO,
  UpdateLootPoolDTO,
} from '../services/loot/LootDistributionService';
import { getLootOcrService, LootOcrService } from '../services/loot/LootOcrService';
import { ConflictError, ValidationError } from '../utils/apiErrors';
import { parsePaginationQuery } from '../utils/pagination';

import { BaseController } from './BaseController';

/**
 * Loot Controller
 *
 * Provides /api/v2/loot endpoints for mission loot pools: collecting looted
 * items (incl. OCR pre-fill), configuring distribution rules, participant
 * claims/bids, and distributing the pool.
 */
export class LootController extends BaseController {
  private readonly lootService: LootDistributionService;
  private readonly ocrService: LootOcrService;

  constructor() {
    super();
    this.lootService = getLootDistributionService();
    this.ocrService = getLootOcrService();
  }

  // ==================== POOLS ====================

  listPools = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const pagination = parsePaginationQuery(req.query);
      const filters: LootPoolFilters = {
        activityId: req.query.activityId as string | undefined,
        status: req.query.status as LootPoolStatus | undefined,
      };
      const result = await this.lootService.listPools(organizationId, pagination, filters);
      res.json(result);
    });
  };

  getPool = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { poolId } = req.params;
      const pool = await this.lootService.getPoolDetail(organizationId, poolId);
      if (!pool) {
        res.status(404).json({ message: 'Loot pool not found' });
        return;
      }
      res.json(pool);
    });
  };

  createPool = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const dto: CreateLootPoolDTO = req.body;
      const pool = await this.lootService.createPool(organizationId, userId, dto);
      res.status(201).json(pool);
    });
  };

  updatePool = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId } = req.params;
      const dto: UpdateLootPoolDTO = req.body;
      const pool = await this.lootService.updatePool(organizationId, poolId, userId, dto);
      res.json(pool);
    });
  };

  lockPool = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId } = req.params;
      const pool = await this.lootService.lockPool(organizationId, poolId, userId);
      res.json(pool);
    });
  };

  cancelPool = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId } = req.params;
      const pool = await this.lootService.cancelPool(organizationId, poolId, userId);
      res.json(pool);
    });
  };

  distributePool = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId } = req.params;
      const result = await this.lootService.distribute(organizationId, poolId, userId);
      res.json(result);
    });
  };

  retryDistribution = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId } = req.params;
      const result = await this.lootService.retryDistribution(organizationId, poolId, userId);
      res.json(result);
    });
  };

  getEligibleParticipants = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { poolId } = req.params;
      const pool = await this.lootService.getPoolById(organizationId, poolId);
      if (!pool) {
        res.status(404).json({ message: 'Loot pool not found' });
        return;
      }
      const participants = await this.lootService.getEligibleParticipants(pool);
      res.json(participants);
    });
  };

  // ==================== ITEMS ====================

  addItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId } = req.params;
      const dto: AddLootItemDTO = req.body;
      const item = await this.lootService.addItem(organizationId, poolId, userId, dto);
      res.status(201).json(item);
    });
  };

  addItemsBulk = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId } = req.params;
      const items: AddLootItemDTO[] = req.body.items;
      const created = await this.lootService.addItemsBulk(organizationId, poolId, userId, items);
      res.status(201).json(created);
    });
  };

  updateItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId, itemId } = req.params;
      const dto: UpdateLootItemDTO = req.body;
      const item = await this.lootService.updateItem(organizationId, poolId, itemId, userId, dto);
      res.json(item);
    });
  };

  removeItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId, itemId } = req.params;
      await this.lootService.removeItem(organizationId, poolId, itemId, userId);
      res.status(204).send();
    });
  };

  assignItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId, itemId } = req.params;
      const targetUserId: string = req.body.userId;
      const item = await this.lootService.assignItem(
        organizationId,
        poolId,
        itemId,
        userId,
        targetUserId
      );
      res.json(item);
    });
  };

  // ==================== CLAIMS ====================

  claimItem = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const user = this.getAuthUser(req);
      const { poolId, itemId } = req.params;
      const dto: ClaimItemDTO = req.body;
      const claim = await this.lootService.claimItem(
        organizationId,
        poolId,
        itemId,
        { id: user.id, name: user.username ?? user.id },
        dto
      );
      res.status(201).json(claim);
    });
  };

  withdrawClaim = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId, itemId } = req.params;
      await this.lootService.withdrawClaim(organizationId, poolId, itemId, userId);
      res.status(204).send();
    });
  };

  // ==================== OCR ====================

  /**
   * Run an uploaded inventory screenshot through OCR and return suggested loot
   * items (not persisted). The leader can then confirm them via the bulk-add
   * endpoint.
   */
  scanImage = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      // ensure org context / auth are present
      this.getOrganizationId(req);
      const file = (req as AuthRequest & { file?: { buffer: Buffer } }).file;
      if (!file?.buffer) {
        throw new ValidationError('An image file is required (field name: "image")');
      }
      const result = await this.ocrService.extractItems(file.buffer);
      res.json(result);
    });
  };

  /**
   * Pool-scoped OCR endpoint. Authorizes against the specific pool so
   * creator/leader/assigned assistants can scan for that pool only.
   */
  scanImageForPool = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { poolId } = req.params;

      const pool = await this.lootService.getPoolById(organizationId, poolId);
      if (!pool) {
        res.status(404).json({ message: 'Loot pool not found' });
        return;
      }

      if (pool.status !== LootPoolStatus.OPEN) {
        throw new ConflictError('OCR scanning is only available while the loot pool is open');
      }

      await this.lootService.assertCanManagePool(organizationId, poolId, userId);

      const file = (req as AuthRequest & { file?: { buffer: Buffer } }).file;
      if (!file?.buffer) {
        throw new ValidationError('An image file is required (field name: "image")');
      }

      const result = await this.ocrService.extractItems(file.buffer);
      res.json(result);
    });
  };
}
