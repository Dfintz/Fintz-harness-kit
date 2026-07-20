import type { LootOcrResult } from '@sc-fleet-manager/shared-types';
export declare class LootOcrService {
    private static readonly PROVIDER;
    private static readonly API_VERSION;
    private get endpoint();
    private get apiKey();
    isConfigured(): boolean;
    extractItems(imageBuffer: Buffer): Promise<LootOcrResult>;
    private collectLines;
    private parseLines;
    private guessCategory;
}
export declare function getLootOcrService(): LootOcrService;
//# sourceMappingURL=LootOcrService.d.ts.map