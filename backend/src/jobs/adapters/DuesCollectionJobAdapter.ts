import {
  DuesCollectionOrchestratorService,
  DuesCollectionSummary,
} from '../../services/treasury/DuesCollectionOrchestratorService';
import { logger } from '../../utils/logger';

/**
 * Job adapter that bridges cron scheduling and orchestration logic.
 */
export class DuesCollectionJobAdapter {
  constructor(
    private readonly orchestrator: DuesCollectionOrchestratorService = new DuesCollectionOrchestratorService()
  ) {}

  async runDailyCollection(): Promise<DuesCollectionSummary> {
    logger.info('Starting daily dues collection...');
    const result = await this.orchestrator.collectAllDues();
    logger.info(
      `Dues collection completed: ${result.collected} collected, ${result.errors} errors`
    );
    return result;
  }
}
