import { TrustedDevice } from '../../../models/TrustedDevice';
export interface DeviceFingerprintData {
    userAgent: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    platform?: string;
    colorDepth?: number;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    touchSupport?: boolean;
    webglRenderer?: string;
    canvasFingerprint?: string;
}
export declare class TrustedDeviceService {
    private trustedDeviceRepository;
    constructor();
    generateFingerprint(data: DeviceFingerprintData): string;
    registerDevice(userId: string, fingerprintData: DeviceFingerprintData, metadata?: {
        deviceName?: string;
        ipAddress?: string;
        location?: string;
        verificationMethod?: 'email' | '2fa' | 'sso';
    }): Promise<TrustedDevice>;
    verifyDevice(userId: string, fingerprintData: DeviceFingerprintData): Promise<{
        isTrusted: boolean;
        device?: TrustedDevice;
        trustLevel?: string;
    }>;
    private findDeviceByFingerprint;
    getUserDevices(userId: string): Promise<TrustedDevice[]>;
    revokeDevice(userId: string, deviceId: string): Promise<boolean>;
    revokeAllDevices(userId: string): Promise<number>;
    deleteAllDevices(userId: string): Promise<number>;
    assessLoginRisk(userId: string, fingerprintData: DeviceFingerprintData, ipAddress?: string): Promise<{
        riskLevel: 'low' | 'medium' | 'high';
        reasons: string[];
        requiresVerification: boolean;
    }>;
    private inferDeviceName;
    cleanupInactiveDevices(maxAgeMs?: number): Promise<number>;
    applyTrustDecay(): Promise<{
        highToMedium: number;
        mediumToLow: number;
        deactivated: number;
    }>;
    applyUserTrustDecay(userId: string): Promise<number>;
    elevateTrustLevel(userId: string, deviceId: string, newTrustLevel: 'low' | 'medium' | 'high'): Promise<TrustedDevice | null>;
}
export declare const getTrustedDeviceService: () => TrustedDeviceService;
//# sourceMappingURL=TrustedDeviceService.d.ts.map