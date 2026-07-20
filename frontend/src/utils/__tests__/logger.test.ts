import { logger, LogLevel } from '@/utils/logger';
import { errorTrackingService } from '@/services/errorTracking';

// Mock the error tracking service
jest.mock('../../services/errorTracking', () => ({
    errorTrackingService: {
        trackError: jest.fn(),
    },
    ErrorSeverity: {
        Warning: 2,
        Error: 3,
    },
}));

describe('Logger', () => {
    let consoleDebugSpy: jest.SpyInstance;
    let consoleInfoSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        // Spy on console methods
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Reset error tracking mock
        jest.clearAllMocks();

        // Configure logger for testing (enable console in test mode)
        logger.configure({
            minLevel: LogLevel.DEBUG,
            enableConsole: true,
        });
    });

    afterEach(() => {
        // Restore console methods
        consoleDebugSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('debug', () => {
        it('logs debug messages to console', () => {
            logger.debug('Debug message');

            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] Debug message');
        });

        it('logs debug messages with additional arguments', () => {
            const data = { key: 'value' };
            logger.debug('Debug message', data);

            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] Debug message', data);
        });

        it('does not log when minLevel is higher', () => {
            logger.configure({ minLevel: LogLevel.INFO });
            logger.debug('Debug message');

            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        it('does not log when console is disabled', () => {
            logger.configure({ enableConsole: false });
            logger.debug('Debug message');

            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });
    });

    describe('info', () => {
        it('logs info messages to console', () => {
            logger.info('Info message');

            expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] Info message');
        });

        it('logs info messages with additional arguments', () => {
            const data = { key: 'value' };
            logger.info('Info message', data);

            expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] Info message', data);
        });

        it('does not log when minLevel is higher', () => {
            logger.configure({ minLevel: LogLevel.WARN });
            logger.info('Info message');

            expect(consoleInfoSpy).not.toHaveBeenCalled();
        });
    });

    describe('warn', () => {
        it('logs warning messages to console', () => {
            logger.warn('Warning message');

            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Warning message');
        });

        it('logs warning messages with additional arguments', () => {
            const data = { key: 'value' };
            logger.warn('Warning message', data);

            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Warning message', data);
        });

        it('does not log when minLevel is higher', () => {
            logger.configure({ minLevel: LogLevel.ERROR });
            logger.warn('Warning message');

            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('does not track warning in development mode', () => {
            // In test mode, import.meta.env.PROD is falsy
            logger.warn('Warning message');

            expect(errorTrackingService.trackError).not.toHaveBeenCalled();
        });
    });

    describe('error', () => {
        it('logs error messages to console', () => {
            logger.error('Error message');

            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error message', undefined);
        });

        it('logs error messages with Error object', () => {
            const error = new Error('Test error');
            logger.error('Error message', error);

            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error message', error);
        });

        it('logs error messages with additional arguments', () => {
            const error = new Error('Test error');
            const data = { key: 'value' };
            logger.error('Error message', error, data);

            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Error message', error, data);
        });

        it('tracks errors in error tracking service', () => {
            const error = new Error('Test error');
            logger.error('Error message', error);

            expect(errorTrackingService.trackError).toHaveBeenCalledWith(
                error,
                expect.objectContaining({
                    severity: 3, // ErrorSeverity.Error
                    context: expect.objectContaining({
                        additionalData: expect.objectContaining({
                            message: 'Error message',
                        }),
                    }),
                })
            );
        });

        it('creates Error object when error parameter is not an Error', () => {
            logger.error('Error message', 'not an error');

            expect(errorTrackingService.trackError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.any(Object)
            );
        });

        it('creates Error object when no error parameter is provided', () => {
            logger.error('Error message');

            expect(errorTrackingService.trackError).toHaveBeenCalledWith(
                expect.any(Error),
                expect.any(Object)
            );
        });
    });

    describe('configure', () => {
        it('updates minLevel configuration', () => {
            logger.configure({ minLevel: LogLevel.WARN });
            logger.info('Should not log');
            logger.warn('Should log');

            expect(consoleInfoSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalled();
        });

        it('updates enableConsole configuration', () => {
            logger.configure({ enableConsole: false });
            logger.debug('Should not log');
            logger.info('Should not log');
            logger.warn('Should not log');
            logger.error('Should not log');

            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('partially updates configuration', () => {
            logger.configure({ minLevel: LogLevel.DEBUG, enableConsole: true });
            logger.configure({ minLevel: LogLevel.ERROR }); // Only update minLevel
            
            logger.error('Should log');
            
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('allows chaining multiple configure calls', () => {
            logger.configure({ minLevel: LogLevel.DEBUG });
            logger.configure({ enableConsole: true });
            
            logger.debug('Should log');
            
            expect(consoleDebugSpy).toHaveBeenCalled();
        });
    });

    describe('log level hierarchy', () => {
        it('respects log level hierarchy for DEBUG', () => {
            logger.configure({ minLevel: LogLevel.DEBUG });
            
            logger.debug('test');
            logger.info('test');
            logger.warn('test');
            logger.error('test');
            
            expect(consoleDebugSpy).toHaveBeenCalled();
            expect(consoleInfoSpy).toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('respects log level hierarchy for INFO', () => {
            logger.configure({ minLevel: LogLevel.INFO });
            
            logger.debug('test');
            logger.info('test');
            logger.warn('test');
            logger.error('test');
            
            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('respects log level hierarchy for WARN', () => {
            logger.configure({ minLevel: LogLevel.WARN });
            
            logger.debug('test');
            logger.info('test');
            logger.warn('test');
            logger.error('test');
            
            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });

        it('respects log level hierarchy for ERROR', () => {
            logger.configure({ minLevel: LogLevel.ERROR });
            
            logger.debug('test');
            logger.info('test');
            logger.warn('test');
            logger.error('test');
            
            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();
        });
    });

    describe('multiple arguments', () => {
        it('handles multiple arguments in debug', () => {
            const arg1 = 'arg1';
            const arg2 = { key: 'value' };
            const arg3 = [1, 2, 3];
            
            logger.debug('Message', arg1, arg2, arg3);
            
            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG] Message', arg1, arg2, arg3);
        });

        it('handles multiple arguments in info', () => {
            const arg1 = 'arg1';
            const arg2 = { key: 'value' };
            
            logger.info('Message', arg1, arg2);
            
            expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO] Message', arg1, arg2);
        });

        it('handles multiple arguments in warn', () => {
            const arg1 = 'arg1';
            const arg2 = { key: 'value' };
            
            logger.warn('Message', arg1, arg2);
            
            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN] Message', arg1, arg2);
        });

        it('handles multiple arguments in error', () => {
            const error = new Error('Test');
            const arg1 = 'arg1';
            const arg2 = { key: 'value' };
            
            logger.error('Message', error, arg1, arg2);
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR] Message', error, arg1, arg2);
        });
    });
});
