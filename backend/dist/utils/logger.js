"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const winston_1 = __importDefault(require("winston"));
const ApplicationInsightsTransport_1 = require("./ApplicationInsightsTransport");
const AzureBlobLogTransport_1 = require("./AzureBlobLogTransport");
const logRedaction_1 = require("./logRedaction");
const requestContext_1 = require("./requestContext");
const correlationFormat = winston_1.default.format(info => {
    const ctx = requestContext_1.requestContextStorage.getStore();
    if (ctx) {
        info.requestId = info.requestId || ctx.requestId;
        info.correlationId = info.correlationId || ctx.correlationId;
        if (ctx.userId) {
            info.userId = info.userId || ctx.userId;
        }
    }
    return info;
});
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), correlationFormat(), winston_1.default.format.splat(), (0, logRedaction_1.redactionFormat)(), winston_1.default.format.json());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), (0, logRedaction_1.redactionFormat)(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }
    return log;
}));
const logsDir = node_path_1.default.join(process.cwd(), 'logs');
let canWriteLogs = false;
try {
    if (!node_fs_1.default.existsSync(logsDir)) {
        node_fs_1.default.mkdirSync(logsDir, { recursive: true });
    }
    node_fs_1.default.accessSync(logsDir, node_fs_1.default.constants.W_OK);
    canWriteLogs = true;
}
catch (error) {
    if (process.env.NODE_ENV !== 'production') {
        console.warn(`Unable to create or write to logs directory: ${logsDir}. File logging will be disabled.`, error instanceof Error ? error.message : String(error));
    }
    canWriteLogs = false;
}
const transports = [];
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    try {
        transports.push(new ApplicationInsightsTransport_1.ApplicationInsightsTransport({
            level: process.env.LOG_LEVEL || 'info',
        }));
        console.log('✅ Application Insights logging enabled');
    }
    catch (error) {
        console.warn('⚠️  Failed to initialize Application Insights logging:', error.message);
    }
}
if (process.env.NODE_ENV === 'production') {
    const azureStorageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const azureStorageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    if (azureStorageConnectionString || azureStorageAccountName) {
        try {
            transports.push(new AzureBlobLogTransport_1.AzureBlobLogTransport({
                level: 'info',
                containerName: 'logs',
                connectionString: azureStorageConnectionString,
                storageAccountName: azureStorageAccountName,
            }));
            console.log('✅ Azure Blob Storage logging enabled');
        }
        catch (error) {
            console.warn('⚠️  Failed to initialize Azure Blob Storage logging:', error.message);
        }
    }
}
if (canWriteLogs && process.env.NODE_ENV !== 'production') {
    transports.push(new winston_1.default.transports.File({
        filename: node_path_1.default.join(logsDir, 'combined.log'),
        maxsize: 5242880,
        maxFiles: 5,
    }), new winston_1.default.transports.File({
        filename: node_path_1.default.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5,
    }));
}
transports.push(new winston_1.default.transports.Console({
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
}));
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'sc-fleet-manager' },
    transports,
});
if (process.env.NODE_ENV === 'test') {
    exports.logger.transports.forEach(transport => {
        transport.silent = true;
    });
}
//# sourceMappingURL=logger.js.map