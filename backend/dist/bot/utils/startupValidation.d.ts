export interface BotInternalSecretValidationOptions {
    contextLabel: string;
    onFailure: 'throw' | 'exit';
    logSuccess?: boolean;
}
export declare function validateBotInternalSecret({ contextLabel, onFailure, logSuccess, }: BotInternalSecretValidationOptions): void;
//# sourceMappingURL=startupValidation.d.ts.map