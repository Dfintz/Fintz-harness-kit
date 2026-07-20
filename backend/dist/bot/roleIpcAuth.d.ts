export declare function isRoleIpcSigningSecretConfigured(): boolean;
export interface RoleIpcPayloadBase extends Record<string, unknown> {
    guildId: string;
    userId: string;
    roleId: string;
    organizationId: string;
}
export interface SignedRoleIpcPayload extends RoleIpcPayloadBase {
    issuedAt: number;
    signature: string;
}
export declare function buildSignedRoleIpcPayload(action: string, payload: RoleIpcPayloadBase, issuedAt?: number): SignedRoleIpcPayload;
export declare function isSignedRoleIpcPayload(data: Record<string, unknown>): data is SignedRoleIpcPayload;
export declare function verifySignedRoleIpcPayload(action: string, payload: SignedRoleIpcPayload): {
    valid: boolean;
    reason?: string;
};
export declare function consumeRoleIpcReplayToken(action: string, payload: SignedRoleIpcPayload): {
    valid: boolean;
    reason?: string;
};
export declare function clearRoleIpcReplayCacheForTests(): void;
//# sourceMappingURL=roleIpcAuth.d.ts.map