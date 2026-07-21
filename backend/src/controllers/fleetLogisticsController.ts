import { Request, Response } from 'express';

import { FleetLogisticsService } from '../services/fleet/FleetLogisticsService';
import { extractPaginationOptions } from '../utils/pagination';

import { BaseController } from './BaseController';

export class FleetLogisticsController extends BaseController {
  private readonly logisticsService = new FleetLogisticsService();

  constructor() {
    super();
  }

  createLogistics = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const logistics = await this.logisticsService.create(req.body);
      res.status(201).json(logistics);
    });
  };

  getLogistics = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { fleetId } = req.query;
      const paginationOptions = extractPaginationOptions(req);
      return this.logisticsService.findAll(paginationOptions, fleetId as string | undefined);
    });
  };

  getLogisticsById = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.logisticsService.findById(req.params.id)
    );
  };

  updateLogistics = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.logisticsService.update(req.params.id, req.body)
    );
  };

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.logisticsService.updateStatus(req.params.id, req.body.status)
    );
  };

  calculateFuelRequirements = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const logistics = await this.logisticsService.findById(req.params.id);
      return this.logisticsService.calculateFuelRequirements(logistics);
    });
  };

  calculateCargoCapacity = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const logistics = await this.logisticsService.findById(req.params.id);
      return this.logisticsService.calculateCargoCapacity(logistics);
    });
  };

  calculateJumpRange = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const logistics = await this.logisticsService.findById(req.params.id);
      return this.logisticsService.calculateJumpRange(logistics);
    });
  };

  deleteLogistics = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      await this.logisticsService.delete(req.params.id);
      return { message: 'Fleet logistics deleted successfully' };
    });
  };
}
