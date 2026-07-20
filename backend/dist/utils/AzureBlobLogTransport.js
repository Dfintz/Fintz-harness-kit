"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureBlobLogTransport = void 0;
const identity_1 = require("@azure/identity");
const storage_blob_1 = require("@azure/storage-blob");
const winston_transport_1 = __importDefault(require("winston-transport"));
const azureIdentity_1 = require("./azureIdentity");
class AzureBlobLogTransport extends winston_transport_1.default {
    blobServiceClient = null;
    containerName;
    blobName;
    logBuffer = [];
    maxBufferSize = 100;
    flushInterval = 30000;
    flushTimer = null;
    isInitialized = false;
    initializationError = null;
    constructor(opts) {
        super(opts);
        this.containerName = opts?.containerName || 'logs';
        const date = new Date().toISOString().split('T')[0];
        this.blobName = opts?.blobName || `backend-${date}.log`;
        if (process.env.NODE_ENV === 'test') {
            this.silent = true;
            return;
        }
        this.initWithRetry(opts?.connectionString, opts?.storageAccountName, 3, 5000).catch(err => {
            this.initializationError = err;
            console.error('Failed to initialize Azure Blob Log Transport:', err.message);
        });
        this.flushTimer = setInterval(() => {
            void this.flushLogs();
        }, this.flushInterval);
    }
    async initWithRetry(connectionString, storageAccountName, maxRetries = 3, delayMs = 5000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await this.initializeBlobClient(connectionString, storageAccountName);
                return;
            }
            catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
            }
        }
    }
    async initializeBlobClient(connectionString, storageAccountName) {
        try {
            if (connectionString) {
                this.blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
            }
            else if (storageAccountName) {
                const credential = new identity_1.DefaultAzureCredential((0, azureIdentity_1.createDefaultAzureCredentialOptions)());
                this.blobServiceClient = new storage_blob_1.BlobServiceClient(`https://${storageAccountName}.blob.core.windows.net`, credential);
            }
            else {
                throw new Error('Azure Blob Log Transport requires either connectionString or storageAccountName');
            }
            const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
            await containerClient.createIfNotExists();
            this.isInitialized = true;
        }
        catch (error) {
            this.initializationError = error;
            throw error;
        }
    }
    log(info, callback) {
        setImmediate(() => {
            this.emit('logged', info);
        });
        if (!this.isInitialized) {
            return callback();
        }
        const logEntry = typeof info === 'string' ? info : JSON.stringify(info);
        this.logBuffer.push(logEntry);
        if (this.logBuffer.length >= this.maxBufferSize) {
            void this.flushLogs();
        }
        callback();
    }
    async flushLogs() {
        if (this.logBuffer.length === 0 || !this.isInitialized || !this.blobServiceClient) {
            return;
        }
        const logsToWrite = [...this.logBuffer];
        this.logBuffer = [];
        try {
            const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
            const blobClient = containerClient.getBlockBlobClient(this.blobName);
            const content = `${logsToWrite.join('\n')}\n`;
            try {
                const downloadResponse = await blobClient.download();
                if (downloadResponse.readableStreamBody) {
                    const existingContent = await this.streamToString(downloadResponse.readableStreamBody);
                    await blobClient.upload(existingContent + content, Buffer.byteLength(existingContent + content), {
                        blobHTTPHeaders: { blobContentType: 'text/plain' },
                    });
                }
                else {
                    await blobClient.upload(content, Buffer.byteLength(content), {
                        blobHTTPHeaders: { blobContentType: 'text/plain' },
                    });
                }
            }
            catch {
                await blobClient.upload(content, Buffer.byteLength(content), {
                    blobHTTPHeaders: { blobContentType: 'text/plain' },
                });
            }
        }
        catch (error) {
            if (this.logBuffer.length < this.maxBufferSize * 2) {
                this.logBuffer.unshift(...logsToWrite);
            }
            console.error('Failed to write logs to Azure Blob Storage:', error.message);
        }
    }
    async streamToString(readableStream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            readableStream.on('data', (data) => {
                chunks.push(data);
            });
            readableStream.on('end', () => {
                resolve(Buffer.concat(chunks).toString('utf8'));
            });
            readableStream.on('error', reject);
        });
    }
    close() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        void this.flushLogs();
    }
}
exports.AzureBlobLogTransport = AzureBlobLogTransport;
//# sourceMappingURL=AzureBlobLogTransport.js.map