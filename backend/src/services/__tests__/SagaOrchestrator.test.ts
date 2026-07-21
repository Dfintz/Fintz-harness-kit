import { SagaOrchestrator, SagaStep, createSaga } from '../aggregators/SagaOrchestrator';

describe('SagaOrchestrator', () => {
    let saga: SagaOrchestrator<{ value: number; results: Record<string, unknown> }>;

    beforeEach(() => {
        jest.clearAllMocks();
        saga = new SagaOrchestrator({ name: 'TestSaga', maxRetries: 2, retryDelayMs: 100 });
    });

    describe('Basic Execution', () => {
        it('should execute all steps successfully', async () => {
            // Arrange
            saga.addStep({
                name: 'step1',
                execute: async (ctx) => {
                    ctx.results.step1 = 'done';
                    return 'step1-result';
                },
                compensate: async () => { /* noop */ }
            });

            saga.addStep({
                name: 'step2',
                execute: async (ctx) => {
                    ctx.results.step2 = 'done';
                    return 'step2-result';
                },
                compensate: async () => { /* noop */ }
            });

            // Act
            const result = await saga.execute({ value: 42, results: {} });

            // Assert
            expect(result.success).toBe(true);
            expect(result.completed).toEqual(['step1', 'step2']);
            expect(result.data).toEqual({
                step1: 'step1-result',
                step2: 'step2-result'
            });
        });

        it('should return step results via getStepResult', async () => {
            // Arrange
            saga.addStep({
                name: 'createItem',
                execute: async () => ({ id: 'item-123', name: 'Test Item' }),
                compensate: async () => { /* noop */ }
            });

            // Act
            await saga.execute({ value: 1, results: {} });
            const result = saga.getStepResult<{ id: string; name: string }>('createItem');

            // Assert
            expect(result).toEqual({ id: 'item-123', name: 'Test Item' });
        });
    });

    describe('Compensation', () => {
        it('should compensate in reverse order when step fails', async () => {
            // Arrange
            const compensationOrder: string[] = [];

            saga.addStep({
                name: 'step1',
                execute: async () => 'result1',
                compensate: async () => { compensationOrder.push('step1'); }
            });

            saga.addStep({
                name: 'step2',
                execute: async () => 'result2',
                compensate: async () => { compensationOrder.push('step2'); }
            });

            saga.addStep({
                name: 'step3',
                execute: async () => { throw new Error('Step 3 failed'); },
                compensate: async () => { compensationOrder.push('step3'); }
            });

            // Act
            const result = await saga.execute({ value: 1, results: {} });

            // Assert
            expect(result.success).toBe(false);
            expect(result.failed).toBe('step3');
            expect(result.completed).toEqual(['step1', 'step2']);
            expect(result.compensated).toEqual(['step2', 'step1']); // Reverse order
            expect(compensationOrder).toEqual(['step2', 'step1']); // step3 wasn't completed
        });

        it('should pass result to compensate function', async () => {
            // Arrange
            let compensatedValue: unknown = null;

            saga.addStep({
                name: 'create',
                execute: async () => ({ id: 'created-item-123' }),
                compensate: async (_ctx, result) => {
                    compensatedValue = result;
                }
            });

            saga.addStep({
                name: 'fail',
                execute: async () => { throw new Error('Failure'); },
                compensate: async () => { /* noop */ }
            });

            // Act
            await saga.execute({ value: 1, results: {} });

            // Assert
            expect(compensatedValue).toEqual({ id: 'created-item-123' });
        });

        it('should continue compensation even if one compensate fails', async () => {
            // Arrange
            const compensationOrder: string[] = [];

            saga.addStep({
                name: 'step1',
                execute: async () => 'result1',
                compensate: async () => { compensationOrder.push('step1'); }
            });

            saga.addStep({
                name: 'step2',
                execute: async () => 'result2',
                compensate: async () => { throw new Error('Compensation failed'); }
            });

            saga.addStep({
                name: 'step3',
                execute: async () => { throw new Error('Step 3 failed'); },
                compensate: async () => { /* noop */ }
            });

            // Act
            const result = await saga.execute({ value: 1, results: {} });

            // Assert
            expect(result.success).toBe(false);
            expect(result.compensated).toContain('step1'); // step1 should still be compensated
        });
    });

    describe('Retry Logic', () => {
        it('should retry failed steps up to maxRetries', async () => {
            // Arrange
            let attempts = 0;

            saga.addStep({
                name: 'retryableStep',
                execute: async () => {
                    attempts++;
                    if (attempts < 3) {
                        throw new Error('Transient failure');
                    }
                    return 'success';
                },
                compensate: async () => { /* noop */ }
            });

            // Act
            const result = await saga.execute({ value: 1, results: {} });

            // Assert
            expect(result.success).toBe(true);
            expect(attempts).toBe(3); // Initial + 2 retries
        });

        it('should fail after exceeding maxRetries', async () => {
            // Arrange
            let attempts = 0;

            saga.addStep({
                name: 'failingStep',
                execute: async () => {
                    attempts++;
                    throw new Error('Permanent failure');
                },
                compensate: async () => { /* noop */ }
            });

            // Act
            const result = await saga.execute({ value: 1, results: {} });

            // Assert
            expect(result.success).toBe(false);
            expect(attempts).toBe(3); // Initial + 2 retries (maxRetries = 2)
        });
    });

    describe('State Management', () => {
        it('should track saga state correctly', async () => {
            // Arrange
            saga.addStep({
                name: 'step1',
                execute: async () => 'done',
                compensate: async () => { /* noop */ }
            });

            // Act
            await saga.execute({ value: 1, results: {} });
            const state = saga.getState();

            // Assert
            expect(state.status).toBe('completed');
            expect(state.name).toBe('TestSaga');
            expect(state.steps[0].status).toBe('completed');
            expect(state.completedAt).toBeDefined();
        });

        it('should reset saga for reuse', async () => {
            // Arrange
            saga.addStep({
                name: 'step1',
                execute: async () => 'result1',
                compensate: async () => { /* noop */ }
            });

            await saga.execute({ value: 1, results: {} });

            // Act
            saga.reset();
            const state = saga.getState();

            // Assert
            expect(state.status).toBe('running');
            expect(state.steps[0].status).toBe('pending');
            expect(saga.getStepResult('step1')).toBeUndefined();
        });
    });

    describe('Events', () => {
        it('should emit events during execution', async () => {
            // Arrange
            const events: string[] = [];

            saga.on('saga:start', () => events.push('saga:start'));
            saga.on('step:start', () => events.push('step:start'));
            saga.on('step:completed', () => events.push('step:completed'));
            saga.on('saga:completed', () => events.push('saga:completed'));

            saga.addStep({
                name: 'step1',
                execute: async () => 'done',
                compensate: async () => { /* noop */ }
            });

            // Act
            await saga.execute({ value: 1, results: {} });

            // Assert
            expect(events).toContain('saga:start');
            expect(events).toContain('step:start');
            expect(events).toContain('step:completed');
            expect(events).toContain('saga:completed');
        });

        it('should emit failure events', async () => {
            // Arrange
            const events: string[] = [];

            saga.on('step:failed', () => events.push('step:failed'));
            saga.on('saga:compensating', () => events.push('saga:compensating'));
            saga.on('saga:compensated', () => events.push('saga:compensated'));

            saga.addStep({
                name: 'failStep',
                execute: async () => { throw new Error('Failed'); },
                compensate: async () => { /* noop */ },
                retryCount: 0 // No retries for this test
            });

            // Act
            await saga.execute({ value: 1, results: {} });

            // Assert
            expect(events).toContain('step:failed');
        });
    });

    describe('createSaga helper', () => {
        it('should create saga with fluent API', async () => {
            // Arrange & Act
            const saga = createSaga<{ x: number }>({ name: 'FluentSaga' })
                .addStep({
                    name: 'double',
                    execute: async (ctx) => ctx.x * 2,
                    compensate: async () => { /* noop */ }
                })
                .addStep({
                    name: 'stringify',
                    execute: async (ctx) => `Result: ${ctx.x}`,
                    compensate: async () => { /* noop */ }
                });

            const result = await saga.execute({ x: 21 });

            // Assert
            expect(result.success).toBe(true);
            expect(result.completed).toEqual(['double', 'stringify']);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty saga', async () => {
            // Act
            const result = await saga.execute({ value: 1, results: {} });

            // Assert
            expect(result.success).toBe(true);
            expect(result.completed).toEqual([]);
        });

        it('should handle first step failure', async () => {
            // Arrange
            saga.addStep({
                name: 'failFirst',
                execute: async () => { throw new Error('First step failed'); },
                compensate: async () => { /* noop */ },
                retryCount: 0
            });

            saga.addStep({
                name: 'neverReached',
                execute: async () => 'never',
                compensate: async () => { /* noop */ }
            });

            // Act
            const result = await saga.execute({ value: 1, results: {} });

            // Assert
            expect(result.success).toBe(false);
            expect(result.failed).toBe('failFirst');
            expect(result.completed).toEqual([]);
            expect(result.compensated).toEqual([]);
        });

        it('should handle context mutation between steps', async () => {
            // Arrange
            saga.addStep({
                name: 'mutate',
                execute: async (ctx) => {
                    ctx.results.data = 'mutated';
                    return true;
                },
                compensate: async () => { /* noop */ }
            });

            saga.addStep({
                name: 'checkMutation',
                execute: async (ctx) => {
                    return ctx.results.data === 'mutated';
                },
                compensate: async () => { /* noop */ }
            });

            // Act
            const result = await saga.execute({ value: 1, results: {} });

            // Assert
            expect(result.success).toBe(true);
            expect(saga.getStepResult('checkMutation')).toBe(true);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});

