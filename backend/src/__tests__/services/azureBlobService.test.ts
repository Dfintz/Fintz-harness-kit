import { AzureBlobService } from '../../services/infrastructure';

describe('AzureBlobService', () => {
    let azureBlobService: AzureBlobService;

    beforeEach(() => {
        azureBlobService = new AzureBlobService();
    });

    describe('isConfigured', () => {
        it('should return false when Azure Storage is not configured', () => {
            // When neither AZURE_STORAGE_CONNECTION_STRING nor AZURE_STORAGE_ACCOUNT_NAME is set
            const isConfigured = azureBlobService.isConfigured();
            
            // In test environment without credentials, this should be false
            if (!process.env.AZURE_STORAGE_CONNECTION_STRING && !process.env.AZURE_STORAGE_ACCOUNT_NAME) {
                expect(isConfigured).toBe(false);
            } else {
                expect(isConfigured).toBe(true);
            }
        });
    });

    describe('uploadImage', () => {
        it('should throw error when Azure Storage is not configured', async () => {
            if (!process.env.AZURE_STORAGE_CONNECTION_STRING && !process.env.AZURE_STORAGE_ACCOUNT_NAME) {
                const buffer = Buffer.from('test image data');
                await expect(
                    azureBlobService.uploadImage('test.jpg', buffer, 'image/jpeg')
                ).rejects.toThrow('Azure Blob Storage is not configured');
            }
        });
    });

    describe('downloadImage', () => {
        it('should throw error when Azure Storage is not configured', async () => {
            if (!process.env.AZURE_STORAGE_CONNECTION_STRING && !process.env.AZURE_STORAGE_ACCOUNT_NAME) {
                await expect(
                    azureBlobService.downloadImage('test.jpg')
                ).rejects.toThrow('Azure Blob Storage is not configured');
            }
        });
    });

    describe('getImageUrl', () => {
        it('should throw error when Azure Storage is not configured', async () => {
            if (!process.env.AZURE_STORAGE_CONNECTION_STRING && !process.env.AZURE_STORAGE_ACCOUNT_NAME) {
                await expect(
                    azureBlobService.getImageUrl('test.jpg')
                ).rejects.toThrow('Azure Blob Storage is not configured');
            }
        });
    });

    describe('deleteImage', () => {
        it('should throw error when Azure Storage is not configured', async () => {
            if (!process.env.AZURE_STORAGE_CONNECTION_STRING && !process.env.AZURE_STORAGE_ACCOUNT_NAME) {
                await expect(
                    azureBlobService.deleteImage('test.jpg')
                ).rejects.toThrow('Azure Blob Storage is not configured');
            }
        });
    });

    describe('listImages', () => {
        it('should throw error when Azure Storage is not configured', async () => {
            if (!process.env.AZURE_STORAGE_CONNECTION_STRING && !process.env.AZURE_STORAGE_ACCOUNT_NAME) {
                await expect(
                    azureBlobService.listImages()
                ).rejects.toThrow('Azure Blob Storage is not configured');
            }
        });
    });

    describe('imageExists', () => {
        it('should throw error when Azure Storage is not configured', async () => {
            if (!process.env.AZURE_STORAGE_CONNECTION_STRING && !process.env.AZURE_STORAGE_ACCOUNT_NAME) {
                await expect(
                    azureBlobService.imageExists('test.jpg')
                ).rejects.toThrow('Azure Blob Storage is not configured');
            }
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
