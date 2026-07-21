import { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { EquipmentService } from '../../services/equipment/EquipmentService';
import { BaseController } from '../BaseController';

/**
 * Equipment & Gear Controller (v2)
 *
 * Manages equipment inventory, compatibility, and transfers.
 * Follows BaseController pattern with proper auth + tenant scoping.
 */
export class EquipmentController extends BaseController {
  private readonly equipmentService: EquipmentService;

  constructor() {
    super();
    this.equipmentService = new EquipmentService();
  }

  list = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { type, status, ownerId, shipId } = req.query as Record<string, string>;
      const { page, limit } = this.getPaginationParams(req);

      const { equipment, total } = await this.equipmentService.listEquipment(organizationId, {
        type,
        status,
        ownerId,
        shipId,
      });

      res.json({
        success: true,
        ...this.createPaginatedResponse(equipment, total, page, limit),
      });
    });
  };

  create = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;

      const item = await this.equipmentService.createEquipment(organizationId, userId, req.body);

      res.status(201).json({ success: true, data: item });
    });
  };

  getById = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { equipmentId } = req.params;

      const item = await this.equipmentService.getEquipment(equipmentId, organizationId);
      if (!item) {
        res.status(404).json({ success: false, error: 'Equipment not found' });
        return;
      }

      res.json({ success: true, data: item });
    });
  };

  update = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { equipmentId } = req.params;

      const item = await this.equipmentService.updateEquipment(
        equipmentId,
        organizationId,
        userId,
        req.body
      );

      res.json({ success: true, data: item });
    });
  };

  delete = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { equipmentId } = req.params;

      await this.equipmentService.deleteEquipment(equipmentId, organizationId, userId);

      res.json({ success: true, message: `Equipment ${equipmentId} deleted` });
    });
  };

  checkCompatibility = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { equipmentId } = req.params;
      const shipId = req.query.shipId as string | undefined;

      const result = await this.equipmentService.checkCompatibility(
        equipmentId,
        shipId ?? '',
        organizationId
      );

      res.json({ success: true, data: result });
    });
  };

  getUserInventory = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const { userId } = req.params;

      const inventory = await this.equipmentService.getUserInventory(organizationId, userId);

      res.json({ success: true, data: inventory });
    });
  };

  transfer = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = this.getOrganizationId(req);
      const userId = this.getAuthUser(req).id;
      const { equipmentId } = req.params;
      const { toUserId } = req.body as { toUserId: string };

      const item = await this.equipmentService.transfer(
        equipmentId,
        organizationId,
        userId,
        toUserId
      );

      res.json({ success: true, data: item });
    });
  };
}
