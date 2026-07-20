"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SagaOrchestrator = void 0;
exports.createSaga = createSaga;
const events_1 = require("events");
const uuid_1 = require("uuid");
const logger_1 = require("../../utils/logger");
class SagaOrchestrator extends events_1.EventEmitter {
    steps = [];
    options;
    state;
    stepResults = new Map();
    constructor(options) {
        super();
        this.options = {
            name: options.name,
            maxRetries: options.maxRetries ?? 3,
            retryDelayMs: options.retryDelayMs ?? 1000,
            timeout: options.timeout ?? 30000,
        };
        this.state = this.initializeState();
    }
    initializeState() {
        return {
            sagaId: this.generateSagaId(),
            name: this.options.name,
            status: 'running',
            currentStep: 0,
            steps: [],
            startedAt: new Date(),
        };
    }
    generateSagaId() {
        return `saga-${(0, uuid_1.v4)()}`;
    }
    addStep(step) {
        this.steps.push(step);
        this.state.steps.push({
            name: step.name,
            status: 'pending',
        });
        return this;
    }
    getStepResult(stepName) {
        return this.stepResults.get(stepName);
    }
    getAllStepResults() {
        const results = {};
        this.stepResults.forEach((value, key) => {
            results[key] = value;
        });
        return results;
    }
    getState() {
        return { ...this.state };
    }
    async execute(context) {
        const completedSteps = [];
        const stepResultsToCompensate = [];
        logger_1.logger.info(`Starting saga: ${this.options.name}`, {
            sagaId: this.state.sagaId,
            stepCount: this.steps.length,
        });
        this.emit('saga:start', { sagaId: this.state.sagaId, name: this.options.name });
        try {
            for (let i = 0; i < this.steps.length; i++) {
                const step = this.steps[i];
                this.state.currentStep = i;
                this.state.steps[i].status = 'running';
                this.state.steps[i].startedAt = new Date();
                logger_1.logger.info(`Executing saga step: ${step.name}`, {
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
                    this.state.steps[i].status = 'failed';
                    this.state.steps[i].error = result.error?.message;
                    this.state.status = 'compensating';
                    logger_1.logger.error(`Saga step failed: ${step.name}`, {
                        sagaId: this.state.sagaId,
                        error: result.error?.message,
                    });
                    this.emit('step:failed', {
                        sagaId: this.state.sagaId,
                        stepName: step.name,
                        error: result.error,
                    });
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
                logger_1.logger.info(`Saga step completed: ${step.name}`, {
                    sagaId: this.state.sagaId,
                });
            }
            this.state.status = 'completed';
            this.state.completedAt = new Date();
            logger_1.logger.info(`Saga completed successfully: ${this.options.name}`, {
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
        }
        catch (error) {
            this.state.status = 'failed';
            this.state.completedAt = new Date();
            logger_1.logger.error(`Saga failed unexpectedly: ${this.options.name}`, {
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
    async executeStepWithRetry(step, context) {
        const maxRetries = step.retryCount ?? this.options.maxRetries;
        const retryDelay = step.retryDelayMs ?? this.options.retryDelayMs;
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const data = await step.execute(context);
                return { success: true, data };
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < maxRetries) {
                    logger_1.logger.warn(`Step ${step.name} failed, retrying...`, {
                        attempt: attempt + 1,
                        maxRetries,
                        error: lastError.message,
                    });
                    await this.delay(retryDelay * Math.pow(2, attempt));
                }
            }
        }
        return { success: false, error: lastError };
    }
    async compensate(context, stepsToCompensate) {
        const compensated = [];
        logger_1.logger.info(`Starting saga compensation: ${this.options.name}`, {
            sagaId: this.state.sagaId,
            stepsToCompensate: stepsToCompensate.length,
        });
        this.emit('saga:compensating', {
            sagaId: this.state.sagaId,
            steps: stepsToCompensate.map(s => s.step.name),
        });
        for (let i = stepsToCompensate.length - 1; i >= 0; i--) {
            const { step, result } = stepsToCompensate[i];
            try {
                logger_1.logger.info(`Compensating step: ${step.name}`, {
                    sagaId: this.state.sagaId,
                });
                this.emit('step:compensating', {
                    sagaId: this.state.sagaId,
                    stepName: step.name,
                });
                await step.compensate(context, result);
                const stateIndex = this.state.steps.findIndex(s => s.name === step.name);
                if (stateIndex >= 0) {
                    this.state.steps[stateIndex].status = 'compensated';
                }
                compensated.push(step.name);
                this.emit('step:compensated', {
                    sagaId: this.state.sagaId,
                    stepName: step.name,
                });
                logger_1.logger.info(`Compensation completed: ${step.name}`, {
                    sagaId: this.state.sagaId,
                });
            }
            catch (error) {
                logger_1.logger.error(`Compensation failed for step: ${step.name}`, {
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
        logger_1.logger.info(`Saga compensation completed: ${this.options.name}`, {
            sagaId: this.state.sagaId,
            compensated,
        });
        this.emit('saga:compensated', {
            sagaId: this.state.sagaId,
            compensated,
        });
        return compensated;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    reset() {
        this.stepResults.clear();
        this.state = this.initializeState();
        this.state.steps = this.steps.map(step => ({
            name: step.name,
            status: 'pending',
        }));
    }
}
exports.SagaOrchestrator = SagaOrchestrator;
function createSaga(options) {
    return new SagaOrchestrator(options);
}
//# sourceMappingURL=SagaOrchestrator.js.map