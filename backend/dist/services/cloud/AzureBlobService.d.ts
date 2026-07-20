import { Readable } from 'node:stream';
export interface ImageSizeVariant {
    name: string;
    width?: number;
    height?: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}
export interface ImageOptimizationOptions {
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp' | 'avif';
    resize?: {
        width?: number;
        height?: number;
        fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    };
    compress?: boolean;
}
export interface FileValidationResult {
    valid: boolean;
    error?: string;
    detectedMimeType?: string;
    fileSize?: number;
}
export declare class AzureBlobService {
    private readonly blobServiceClient;
    private readonly containerName;
    private readonly connectionString;
    private readonly storageAccountName;
    readonly SIZE_VARIANTS: {
        [key: string]: ImageSizeVariant;
    };
    private readonly ALLOWED_MIME_TYPES;
    private readonly MAX_FILE_SIZE;
    constructor();
    isConfigured(): boolean;
    private ensureContainerExists;
    validateFile(fileBuffer: Buffer | Uint8Array, declaredMimeType: string): Promise<FileValidationResult>;
    optimizeImage(fileBuffer: Buffer, options?: ImageOptimizationOptions): Promise<{
        buffer: Buffer;
        contentType: string;
    }>;
    uploadImage(fileName: string, fileBuffer: Buffer, contentType: string, options?: ImageOptimizationOptions): Promise<string>;
    uploadImageWithVariants(fileName: string, fileBuffer: Buffer, contentType: string, variants?: string[]): Promise<{
        original: string;
        variants: {
            [key: string]: string;
        };
    }>;
    uploadImageFromStream(fileName: string, stream: Readable, contentType: string, size: number): Promise<string>;
    downloadImage(fileName: string): Promise<Buffer>;
    getImageUrl(fileName: string): Promise<string>;
    deleteImage(fileName: string): Promise<boolean>;
    listImages(prefix?: string): Promise<string[]>;
    imageExists(fileName: string): Promise<boolean>;
    private streamToBuffer;
}
//# sourceMappingURL=AzureBlobService.d.ts.map