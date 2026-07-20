import { User } from './User';
export declare class WebAuthnCredential {
    id: string;
    userId: string;
    user?: User;
    credentialId: string;
    credentialPublicKey: string;
    counter: number;
    aaguid?: string;
    credentialType: string;
    deviceName?: string;
    transports?: string[];
    backedUp: boolean;
    backupEligible: boolean;
    attestationFormat?: string;
    isActive: boolean;
    lastUsedAt?: Date;
    useCount: number;
    registrationIp?: string;
    registrationUserAgent?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=WebAuthnCredential.d.ts.map