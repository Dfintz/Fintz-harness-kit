import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import Transport from 'winston-transport';

import { createDefaultAzureCredentialOptions } from './azureIdentity';

/**
 * Custom Winston transport that writes logs to Azure Blob Storage
 * Supports both connection string (for local dev) and Managed Identity (for production)
 */
export class AzureBlobLogTransport extends Transport {
  private blobServiceClient: BlobServiceClient | null = null;
  private containerName: string;
  private blobName: string;
  private logBuffer: string[] = [];
  private readonly maxBufferSize: number = 100; // Write after 100 log entries
  private readonly flushInterval: number = 30000; // Flush every 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;
  private initializationError: Error | null = null;

  constructor(
    opts?: Transport.TransportStreamOptions & {
      containerName?: string;
      blobName?: string;
      connectionString?: string;
      storageAccountName?: string;
    }
  ) {
    super(opts);

    this.containerName = opts?.containerName || 'logs';
    // Include date in blob name for easier log management
    const date = new Date().toISOString().split('T')[0];
    this.blobName = opts?.blobName || `backend-${date}.log`;

    // During tests we skip remote initialization to avoid noisy credential lookups
    if (process.env.NODE_ENV === 'test') {
      this.silent = true;
      return;
    }

    // Initialize blob client asynchronously with retry for MI cold-start
    this.initWithRetry(opts?.connectionString, opts?.storageAccountName, 3, 5000).catch(err => {
      this.initializationError = err;
      console.error('Failed to initialize Azure Blob Log Transport:', err.message);
    });

    // Set up periodic flush
    this.flushTimer = setInterval(() => {
      void this.flushLogs();
    }, this.flushInterval);
  }

  /**
   * Retry wrapper for initialization — handles MI cold-start token acquisition delays
   */
  private async initWithRetry(
    connectionString?: string,
    storageAccountName?: string,
    maxRetries: number = 3,
    delayMs: number = 5000
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.initializeBlobClient(connectionString, storageAccountName);
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  /**
   * Initialize the blob service client
   */
  private async initializeBlobClient(
    connectionString?: string,
    storageAccountName?: string
  ): Promise<void> {
    try {
      // Try connection string first (for local development)
      if (connectionString) {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      }
      // Try Managed Identity (for production)
      else if (storageAccountName) {
        const credential = new DefaultAzureCredential(createDefaultAzureCredentialOptions());
        this.blobServiceClient = new BlobServiceClient(
          `https://${storageAccountName}.blob.core.windows.net`,
          credential
        );
      } else {
        throw new Error(
          'Azure Blob Log Transport requires either connectionString or storageAccountName'
        );
      }

      // Create container if it doesn't exist
      // Default access level is private - logs may contain sensitive information
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      await containerClient.createIfNotExists();

      this.isInitialized = true;
    } catch (error) {
      this.initializationError = error as Error;
      throw error;
    }
  }

  /**
   * Winston transport log method
   */
  override log(info: Record<string, unknown>, callback: () => void): void {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // If not initialized or failed to initialize, skip
    if (!this.isInitialized) {
      return callback();
    }

    // Format log entry
    const logEntry = typeof info === 'string' ? info : JSON.stringify(info);
    this.logBuffer.push(logEntry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.maxBufferSize) {
      void this.flushLogs();
    }

    callback();
  }

  /**
   * Flush logs to blob storage
   * Note: This implementation appends to existing blobs which has performance limitations.
   * For production use with high log volume, consider implementing log rotation or using
   * Azure Blob Storage's append blob type for better performance.
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.isInitialized || !this.blobServiceClient) {
      return;
    }

    const logsToWrite = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blobClient = containerClient.getBlockBlobClient(this.blobName);

      // Append to existing blob or create new one
      const content = `${logsToWrite.join('\n')}\n`;

      // Try to get existing content and append
      try {
        const downloadResponse = await blobClient.download();
        // Check if readableStreamBody exists before using it
        if (downloadResponse.readableStreamBody) {
          const existingContent = await this.streamToString(downloadResponse.readableStreamBody);
          await blobClient.upload(
            existingContent + content,
            Buffer.byteLength(existingContent + content),
            {
              blobHTTPHeaders: { blobContentType: 'text/plain' },
            }
          );
        } else {
          // If no stream body, treat as new blob
          await blobClient.upload(content, Buffer.byteLength(content), {
            blobHTTPHeaders: { blobContentType: 'text/plain' },
          });
        }
      } catch {
        // If blob doesn't exist, create it
        await blobClient.upload(content, Buffer.byteLength(content), {
          blobHTTPHeaders: { blobContentType: 'text/plain' },
        });
      }
    } catch (error) {
      // Re-add logs to buffer on failure (with limit to prevent memory issues)
      if (this.logBuffer.length < this.maxBufferSize * 2) {
        this.logBuffer.unshift(...logsToWrite);
      }
      console.error('Failed to write logs to Azure Blob Storage:', (error as Error).message);
    }
  }

  /**
   * Helper to convert stream to string
   */
  private async streamToString(readableStream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data: Buffer) => {
        chunks.push(data);
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
      readableStream.on('error', reject);
    });
  }

  /**
   * Close the transport and flush remaining logs
   * Note: This method must be synchronous per the Transport interface contract.
   * We use void to intentionally fire-and-forget the async flush operation.
   * In practice, this is acceptable for cleanup scenarios.
   */
  override close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flushLogs();
  }
}
