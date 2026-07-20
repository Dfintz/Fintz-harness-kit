export declare class TokenEncryptionService {
    private readonly algorithm;
    private readonly ivLength;
    private readonly authTagLength;
    private readonly key;
    constructor();
    encrypt(token: string): {
        encrypted: string;
        iv: string;
        authTag: string;
    };
    decrypt(encrypted: string, iv: string, authTag: string): string;
    test(): boolean;
}
export declare const getTokenEncryptionService: () => TokenEncryptionService;
//# sourceMappingURL=TokenEncryptionService.d.ts.map