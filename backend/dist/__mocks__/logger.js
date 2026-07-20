"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.mockLogger = void 0;
const createMock = () => jest.fn();
exports.mockLogger = {
    info: createMock(),
    warn: createMock(),
    error: createMock(),
    debug: createMock(),
    silly: createMock(),
    log: createMock(),
    trace: createMock(),
};
exports.logger = exports.mockLogger;
exports.default = exports.mockLogger;
//# sourceMappingURL=logger.js.map