export type InjectionMarker = 'instruction-override' | 'role-reassignment' | 'system-prompt-reference' | 'developer-mode' | 'role-tag-spoofing' | 'control-characters' | 'fence-delimiter';
export interface SanitizeResult {
    sanitized: string;
    flagged: boolean;
    markers: InjectionMarker[];
}
export interface DetectResult {
    flagged: boolean;
    markers: InjectionMarker[];
}
export declare function detectPromptInjection(input: string): DetectResult;
export declare function sanitizeUntrustedText(input: string): SanitizeResult;
export declare function wrapUntrustedField(label: string, value: string): string;
export declare const UNTRUSTED_FENCE: {
    readonly open: "<<<UNTRUSTED_DATA";
    readonly close: "UNTRUSTED_DATA>>>";
};
//# sourceMappingURL=promptInjection.d.ts.map