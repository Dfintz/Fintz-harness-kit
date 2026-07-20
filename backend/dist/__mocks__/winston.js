"use strict";
const mockTransport = {
    silent: false,
};
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
    log: jest.fn(),
    trace: jest.fn(),
    transports: [mockTransport],
};
module.exports = {
    createLogger: jest.fn(() => mockLogger),
    format: Object.assign(jest.fn((transform) => jest.fn((options) => ({ transform, options }))), {
        combine: jest.fn((formats) => formats),
        timestamp: jest.fn(() => ({})),
        errors: jest.fn(() => ({})),
        splat: jest.fn(() => ({})),
        json: jest.fn(() => ({})),
        colorize: jest.fn(() => ({})),
        printf: jest.fn((fn) => fn),
    }),
    transports: {
        Console: jest.fn(function () {
            this.silent = false;
        }),
        File: jest.fn(function () {
            this.silent = false;
        }),
    },
};
//# sourceMappingURL=winston.js.map