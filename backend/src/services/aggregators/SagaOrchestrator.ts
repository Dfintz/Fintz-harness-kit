import { EventEmitter } from 'events';

import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../utils/logger';

/**
 * Step execution result
 */
export interface StepResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Saga step definition
 */
export interface SagaStep<TContext = unknown, TResult = unknown> {
  name: string;
  execute: (context: TContext) => Promise<TResult>;
  compensate: (context: TContext, result?: TResult) => Promise<void>;
  retryCount?: number;
  retryDelayMs?: number;
}

/**
 * Saga execution result
 */
export interface SagaResult<T = unknown> {
  success: boolean;
  completed: string[];
  failed?: string;
  compensated?: string[];
  data?: T;
  error?: Error;
}

/**
 * Saga execution state
 */
export interface SagaState {
  sagaId: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';
  currentStep: number;
  steps: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'compensated';
    result?: unknown;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }>;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Saga configuration options
 */
export interface SagaOptions {
  name: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeout?: number;
}

/**
 * Saga Orchestrator
 *
 * Implements the Saga pattern for distributed transactions.
 * Provides automatic compensation (rollback) when a step fails,
 * executing compensating transactions in reverse order.
 *
 * Features:
 * - Step-by-step execution with compensation
 * - Automatic rollback on failure
 * - Retry logic for transient failures
 * - Event emission for monitoring
 * - Saga state tracking
 *
 * @example
 * ```typescript
 * const saga = new SagaOrchestrator({ name: 'CreateFleetWithShips' });
 *
 * saga.addStep({
 *   name: 'createFleet',
 *   execute: async (ctx) => fleetService.create(ctx.organizationId, ctx.fleetData),
 *   compensate: async (ctx, fleet) => fleetService.delete(ctx.organizationId, fleet.id)
 * });
 *
 * saga.addStep({
 *   name: 'addShips',
 *   execute: async (ctx) => shipService.addToFleet(ctx.fleetId, ctx.ships),
 *   compensate: async (ctx) => shipService.removeFromFleet(ctx.fleetId, ctx.ships)
 * });
 *
 * const result = await saga.execute(context);
 * ```
 */
export class SagaOrchestrator<TContext = Record<string, unknown>> extends EventEmitter {
  private readonly steps: SagaStep<TContext, unknown>[] = [];
  private readonly options: Required<SagaOptions>;
  private state: SagaState;
  private readonly stepResults: Map<string, unknown> = new Map();

  constructor(options: SagaOptions) {
    super();
    this.options = {
      name: options.name,
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
      timeout: options.timeout ?? 30000,
    };

    this.state = this.initializeState();
  }

  /**
   * Initialize saga state
   */
  private initializeState(): SagaState {
    return {
      sagaId: this.generateSagaId(),
      name: this.options.name,
      status: 'running',
      currentStep: 0,
      steps: [],
      startedAt: new Date(),
    };
  }

  /**
   * Generate unique saga ID
   */
  private generateSagaId(): string {
    return `saga-${uuidv4()}`;
  }

  /**
   * Add a step to the saga
   * @param step - Step definition with execute and compensate functions
   */
  public addStep<TResult = unknown>(step: SagaStep<TContext, TResult>): this {
    this.steps.push(step as SagaStep<TContext, unknown>);
    this.state.steps.push({
      name: step.name,
      status: 'pending',
    });
    return this;
  }

  /**
   * Get the result of a specific step
   * @param stepName - Name of the step
   */
  public getStepResult<T = unknown>(stepName: string): T | undefined {
    return this.stepResults.get(stepName) as T | undefined;
  }

  /**
   * Get all step results
   */
  public getAllStepResults(): Record<string, unknown> {
    const results: Record<string, unknown> = {};
    this.stepResults.forEach((value, key) => {
      results[key] = value;
    });
    return results;
  }

  /**
   * Get current saga state
   */
  public getState(): SagaState {
    return { ...this.state };
  }

  /**
   * Execute the saga
   * @param context - Context object passed to all steps
   */
  public async execute(context: TContext): Promise<SagaResult<Record<string, unknown>>> {
    const completedSteps: string[] = [];
    const stepResultsToCompensate: Array<{ step: SagaStep<TContext, unknown>; result: unknown }> =
      [];

    logger.info(`Starting saga: ${this.options.name}`, {
      sagaId: this.state.sagaId,
      stepCount: this.steps.length,
    });

    this.emit('saga:start', { sagaId: this.state.sagaId, name: this.options.name });

    try {
      // Execute each step in order
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];
        this.state.currentStep = i;
        this.state.steps[i].status = 'running';
        this.state.steps[i].startedAt = new Date();

        logger.info(`Executing saga step: ${step.name}`, {
          sagaId: this.state.sagaId,
          stepIndex: i,
        });

        this.emit('step:start', {
          sagaId: this.state.sagaId,
          stepName: step.name,
          stepIndex: i,
        });

        const result = await this.executeStepWithRetry(step, context);

        if (!result.success) {
          // Step failed - initiate compensation
          this.state.steps[i].status = 'failed';
          this.state.steps[i].error = result.error?.message;
          this.state.status = 'compensating';

          logger.error(`Saga step failed: ${step.name}`, {
            sagaId: this.state.sagaId,
            error: result.error?.message,
          });

          this.emit('step:failed', {
            sagaId: this.state.sagaId,
            stepName: step.name,
            error: result.error,
          });

          // Compensate in reverse order
          const compensated = await this.compensate(context, stepResultsToCompensate);

          this.state.status = 'compensated';
          this.state.completedAt = new Date();

          return {
            success: false,
            completed: completedSteps,
            failed: step.name,
            compensated,
            error: result.error,
          };
        }

        // Step succeeded
        this.state.steps[i].status = 'completed';
        this.state.steps[i].result = result.data;
        this.state.steps[i].completedAt = new Date();

        completedSteps.push(step.name);
        stepResultsToCompensate.push({ step, result: result.data });
        this.stepResults.set(step.name, result.data);

        this.emit('step:completed', {
          sagaId: this.state.sagaId,
          stepName: step.name,
          result: result.data,
        });

        logger.info(`Saga step completed: ${step.name}`, {
          sagaId: this.state.sagaId,
        });
      }

      // All steps completed successfully
      this.state.status = 'completed';
      this.state.completedAt = new Date();

      logger.info(`Saga completed successfully: ${this.options.name}`, {
        sagaId: this.state.sagaId,
        stepsCompleted: completedSteps.length,
      });

      this.emit('saga:completed', {
        sagaId: this.state.sagaId,
        completed: completedSteps,
      });

      return {
        success: true,
        completed: completedSteps,
        data: this.getAllStepResults(),
      };
    } catch (error: unknown) {
      // Unexpected error - compensate
      this.state.status = 'failed';
      this.state.completedAt = new Date();

      logger.error(`Saga failed unexpectedly: ${this.options.name}`, {
        sagaId: this.state.sagaId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.emit('saga:failed', {
        sagaId: this.state.sagaId,
        error,
      });

      const compensated = await this.compensate(context, stepResultsToCompensate);

      return {
        success: false,
        completed: completedSteps,
        compensated,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  /**
   * Execute a step with retry logic
   */
  private async executeStepWithRetry<TResult>(
    step: SagaStep<TContext, TResult>,
    context: TContext
  ): Promise<StepResult<TResult>> {
    const maxRetries = step.retryCount ?? this.options.maxRetries;
    const retryDelay = step.retryDelayMs ?? this.options.retryDelayMs;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const data = await step.execute(context);
        return { success: true, data };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          logger.warn(`Step ${step.name} failed, retrying...`, {
            attempt: attempt + 1,
            maxRetries,
            error: lastError.message,
          });
          await this.delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    return { success: false, error: lastError };
  }

  /**
   * Execute compensation for completed steps in reverse order
   */
  private async compensate(
    context: TContext,
    stepsToCompensate: Array<{ step: SagaStep<TContext, unknown>; result: unknown }>
  ): Promise<string[]> {
    const compensated: string[] = [];

    logger.info(`Starting saga compensation: ${this.options.name}`, {
      sagaId: this.state.sagaId,
      stepsToCompensate: stepsToCompensate.length,
    });

    this.emit('saga:compensating', {
      sagaId: this.state.sagaId,
      steps: stepsToCompensate.map(s => s.step.name),
    });

    // Compensate in reverse order
    for (let i = stepsToCompensate.length - 1; i >= 0; i--) {
      const { step, result } = stepsToCompensate[i];

      try {
        logger.info(`Compensating step: ${step.name}`, {
          sagaId: this.state.sagaId,
        });

        this.emit('step:compensating', {
          sagaId: this.state.sagaId,
          stepName: step.name,
        });

        await step.compensate(context, result);

        // Update state
        const stateIndex = this.state.steps.findIndex(s => s.name === step.name);
        if (stateIndex >= 0) {
          this.state.steps[stateIndex].status = 'compensated';
        }

        compensated.push(step.name);

        this.emit('step:compensated', {
          sagaId: this.state.sagaId,
          stepName: step.name,
        });

        logger.info(`Compensation completed: ${step.name}`, {
          sagaId: this.state.sagaId,
        });
      } catch (error: unknown) {
        // Log but continue compensation for other steps
        logger.error(`Compensation failed for step: ${step.name}`, {
          sagaId: this.state.sagaId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        this.emit('step:compensation-failed', {
          sagaId: this.state.sagaId,
          stepName: step.name,
          error,
        });
      }
    }

    logger.info(`Saga compensation completed: ${this.options.name}`, {
      sagaId: this.state.sagaId,
      compensated,
    });

    this.emit('saga:compensated', {
      sagaId: this.state.sagaId,
      compensated,
    });

    return compensated;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset the saga for reuse
   */
  public reset(): void {
    this.stepResults.clear();
    this.state = this.initializeState();
    this.state.steps = this.steps.map(step => ({
      name: step.name,
      status: 'pending' as const,
    }));
  }
}

/**
 * Create a saga builder for fluent API
 */
export function createSaga<TContext = Record<string, unknown>>(
  options: SagaOptions
): SagaOrchestrator<TContext> {
  return new SagaOrchestrator<TContext>(options);
}

