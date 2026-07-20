export declare const MAX_CUSTOM_ID_LENGTH = 100;
export interface ParsedCustomId {
    prefix: string;
    action: string;
    params: string[];
}
export declare function buildCustomId(prefix: string, action: string, ...params: string[]): string;
export declare function parseCustomId(customId: string): ParsedCustomId;
export declare function customIdScope(customId: string): string;
export declare function isCustomIdWithinLimit(customId: string): boolean;
//# sourceMappingURL=customId.d.ts.map