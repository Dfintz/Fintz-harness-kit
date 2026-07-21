import { Request, Response } from 'express';

import { RegolithService } from '../services/content/RegolithService';
import { MiningOperationService } from '../services/mining/MiningOperationService';
import { extractPaginationOptions } from '../utils/pagination';

import { BaseController } from './BaseController';

/**
 * MiningOperationController - Handles mining operation management and resource tracking
 * Delegates business logic to MiningOperationService
 */
export class MiningOperationController extends BaseController {
  private readonly miningService = new MiningOperationService();

  constructor() {
    super();
  }

  public createMiningOperation = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const operation = await this.miningService.create(req.body);
      res.status(201).json(operation);
    });
  };

  public getMiningOperations = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const paginationOptions = extractPaginationOptions(req);
      return this.miningService.findAll(paginationOptions);
    });
  };

  public getMiningOperationById = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => this.miningService.findById(req.params.id));
  };

  public addCrewMember = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.miningService.addCrewMember(req.params.id, req.body)
    );
  };

  public recordResources = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.miningService.recordResources(req.params.id, req.body)
    );
  };

  public updateStatus = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.miningService.updateStatus(req.params.id, req.body.status)
    );
  };

  public updateMiningOperation = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () =>
      this.miningService.update(req.params.id, req.body)
    );
  };

  public deleteMiningOperation = async (req: Request, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      await this.miningService.delete(req.params.id);
      res.status(204).send();
    });
  };

  public getRegolithSummary = async (req: Request, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const location = decodeURIComponent(req.params.location);
      return RegolithService.getMiningDataSummary(location);
    });
  };
}
