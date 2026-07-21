import crypto from 'crypto';

import { Repository } from 'typeorm';

import { AppDataSource } from '../../../data-source';
import { TrustedDevice } from '../../../models/TrustedDevice';
import { logger } from '../../../utils/logger';

/**
 * Device fingerprint data collected from the client
 */
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

/**
 * Trusted Device Service
 * Manages device fingerprinting and trusted device tracking for Zero Trust security
 * 
 * Zero Trust Principles:
 * - Never trust, always verify
 * - Track and verify known devices
 * - Flag suspicious login attempts from unknown devices
 * - Require additional verification for sensitive operations from new devices
 * 
 * UPDATED: Now uses database persistence instead of in-memory storage
 * for data persistence across server restarts.
 */
export class TrustedDeviceService {
    private trustedDeviceRepository: Repository<TrustedDevice>;

    constructor() {
        this.trustedDeviceRepository = AppDataSource.getRepository(TrustedDevice);
    }

    /**
     * Generate a device fingerprint from collected data
     * Uses SHA-256 hash of combined device characteristics
     * @param data Device fingerprint data from client
     * @returns Hashed device fingerprint
     */
    public generateFingerprint(data: DeviceFingerprintData): string {
        const components = [
            data.userAgent || '',
            data.screenResolution || '',
            data.timezone || '',
            data.language || '',
            data.platform || '',
            String(data.colorDepth || ''),
            String(data.hardwareConcurrency || ''),
            String(data.deviceMemory || ''),
            String(data.touchSupport || ''),
            data.webglRenderer || '',
            data.canvasFingerprint || ''
        ];

        const fingerprintString = components.join('|');
        return crypto.createHash('sha256').update(fingerprintString).digest('hex');
    }

    /**
     * Register a new trusted device for a user
     * @param userId User ID
     * @param fingerprintData Device fingerprint data
     * @param metadata Additional device metadata
     * @returns The registered trusted device
     */
    public async registerDevice(
        userId: string,
        fingerprintData: DeviceFingerprintData,
        metadata?: {
            deviceName?: string;
            ipAddress?: string;
            location?: string;
            verificationMethod?: 'email' | '2fa' | 'sso';
        }
    ): Promise<TrustedDevice> {
        const fingerprint = this.generateFingerprint(fingerprintData);
        
        // Check if device already exists
        const existingDevice = await this.findDeviceByFingerprint(userId, fingerprint);
        if (existingDevice) {
            // Update last used timestamp
            existingDevice.lastUsed = new Date();
            existingDevice.ipAddress = metadata?.ipAddress || existingDevice.ipAddress;
            await this.trustedDeviceRepository.save(existingDevice);
            logger.info(`Device already registered for user ${userId}, updating last used`);
            return existingDevice;
        }

        const device = this.trustedDeviceRepository.create({
            id: crypto.randomUUID(),
            userId,
            deviceFingerprint: fingerprint,
            deviceName: metadata?.deviceName || this.inferDeviceName(fingerprintData),
            userAgent: fingerprintData.userAgent,
            ipAddress: metadata?.ipAddress,
            location: metadata?.location,
            lastUsed: new Date(),
            isActive: true,
            trustLevel: metadata?.verificationMethod === '2fa' ? 'high' : 'medium',
            verificationMethod: metadata?.verificationMethod
        });

        await this.trustedDeviceRepository.save(device);

        logger.info(`New trusted device registered for user ${userId}: ${device.deviceName}`);
        return device;
    }

    /**
     * Verify if a device is trusted for a user
     * @param userId User ID
     * @param fingerprintData Device fingerprint data
     * @returns Whether the device is trusted and the trust level
     */
    public async verifyDevice(
        userId: string,
        fingerprintData: DeviceFingerprintData
    ): Promise<{ isTrusted: boolean; device?: TrustedDevice; trustLevel?: string }> {
        const fingerprint = this.generateFingerprint(fingerprintData);
        const device = await this.findDeviceByFingerprint(userId, fingerprint);

        if (!device) {
            logger.warn(`Unknown device detected for user ${userId}`);
            return { isTrusted: false };
        }

        if (!device.isActive) {
            logger.warn(`Inactive device attempted access for user ${userId}`);
            return { isTrusted: false, device };
        }

        // Update last used timestamp
        device.lastUsed = new Date();
        await this.trustedDeviceRepository.save(device);

        logger.info(`Trusted device verified for user ${userId}: ${device.deviceName}`);
        return { isTrusted: true, device, trustLevel: device.trustLevel };
    }

    /**
     * Find a device by fingerprint
     * @param userId User ID
     * @param fingerprint Device fingerprint
     * @returns The trusted device if found
     */
    private async findDeviceByFingerprint(
        userId: string,
        fingerprint: string
    ): Promise<TrustedDevice | null> {
        return this.trustedDeviceRepository.findOne({
            where: {
                userId,
                deviceFingerprint: fingerprint
            }
        });
    }

    /**
     * Get all trusted devices for a user
     * @param userId User ID
     * @returns List of trusted devices
     */
    public async getUserDevices(userId: string): Promise<TrustedDevice[]> {
        return this.trustedDeviceRepository.find({
            where: { userId },
            order: { lastUsed: 'DESC' }
        });
    }

    /**
     * Revoke a trusted device
     * @param userId User ID
     * @param deviceId Device ID to revoke
     * @returns Whether the device was revoked
     */
    public async revokeDevice(userId: string, deviceId: string): Promise<boolean> {
        const device = await this.trustedDeviceRepository.findOne({
            where: { id: deviceId, userId }
        });

        if (!device) {
            logger.warn(`Device ${deviceId} not found for user ${userId}`);
            return false;
        }

        device.isActive = false;
        await this.trustedDeviceRepository.save(device);
        logger.info(`Device ${deviceId} revoked for user ${userId}`);
        return true;
    }

    /**
     * Revoke all trusted devices for a user
     * @param userId User ID
     * @returns Number of devices revoked
     */
    public async revokeAllDevices(userId: string): Promise<number> {
        const result = await this.trustedDeviceRepository.update(
            { userId, isActive: true },
            { isActive: false }
        );

        const revokedCount = result.affected || 0;
        logger.info(`${revokedCount} devices revoked for user ${userId}`);
        return revokedCount;
    }

    /**
     * Delete all devices for a user (for GDPR deletion)
     * @param userId User ID
     * @returns Number of devices deleted
     */
    public async deleteAllDevices(userId: string): Promise<number> {
        const result = await this.trustedDeviceRepository.delete({ userId });
        const deletedCount = result.affected || 0;
        logger.info(`${deletedCount} devices deleted for user ${userId}`);
        return deletedCount;
    }

    /**
     * Check if a login attempt is suspicious
     * @param userId User ID
     * @param fingerprintData Device fingerprint data
     * @param ipAddress Current IP address
     * @returns Risk assessment result
     */
    public async assessLoginRisk(
        userId: string,
        fingerprintData: DeviceFingerprintData,
        ipAddress?: string
    ): Promise<{
        riskLevel: 'low' | 'medium' | 'high';
        reasons: string[];
        requiresVerification: boolean;
    }> {
        const reasons: string[] = [];
        let riskLevel: 'low' | 'medium' | 'high' = 'low';

        // Check if device is known
        const { isTrusted, device } = await this.verifyDevice(userId, fingerprintData);

        if (!isTrusted) {
            reasons.push('Login from unknown device');
            riskLevel = 'medium';
        }

        // Check for IP address mismatch if device is known
        if (device && ipAddress && device.ipAddress && device.ipAddress !== ipAddress) {
            reasons.push('IP address differs from usual device location');
            riskLevel = riskLevel === 'medium' ? 'high' : 'medium';
        }

        // Check user agent changes for known device
        if (device && fingerprintData.userAgent !== device.userAgent) {
            reasons.push('Browser or user agent changed');
            // Don't elevate risk level too much for this alone
        }

        // Get user's device history
        const userDevices = await this.getUserDevices(userId);
        if (userDevices.length === 0) {
            reasons.push('First login attempt - new account setup');
        }

        const requiresVerification = riskLevel === 'high' || !isTrusted;

        if (reasons.length > 0) {
            logger.info(`Login risk assessment for user ${userId}: ${riskLevel}`, { reasons });
        }

        return {
            riskLevel,
            reasons,
            requiresVerification
        };
    }

    /**
     * Infer device name from fingerprint data
     * @param data Device fingerprint data
     * @returns Inferred device name
     */
    private inferDeviceName(data: DeviceFingerprintData): string {
        const userAgent = data.userAgent.toLowerCase();
        
        // Detect device type
        let deviceType = 'Unknown Device';
        if (userAgent.includes('mobile') || userAgent.includes('android')) {
            deviceType = 'Mobile';
        } else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
            deviceType = 'Tablet';
        } else {
            deviceType = 'Desktop';
        }

        // Detect browser
        let browser = 'Unknown Browser';
        if (userAgent.includes('chrome')) {
            browser = 'Chrome';
        } else if (userAgent.includes('firefox')) {
            browser = 'Firefox';
        } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
            browser = 'Safari';
        } else if (userAgent.includes('edge')) {
            browser = 'Edge';
        }

        // Detect OS
        let os = 'Unknown OS';
        if (userAgent.includes('windows')) {
            os = 'Windows';
        } else if (userAgent.includes('mac')) {
            os = 'macOS';
        } else if (userAgent.includes('linux')) {
            os = 'Linux';
        } else if (userAgent.includes('android')) {
            os = 'Android';
        } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
            os = 'iOS';
        }

        return `${deviceType} - ${browser} on ${os}`;
    }

    /**
     * Clean up old inactive devices
     * @param maxAgeMs Maximum age in milliseconds for inactive devices
     * @returns Number of devices cleaned up
     */
    public async cleanupInactiveDevices(maxAgeMs: number = 90 * 24 * 60 * 60 * 1000): Promise<number> {
        const cutoffDate = new Date(Date.now() - maxAgeMs);

        const result = await this.trustedDeviceRepository
            .createQueryBuilder()
            .delete()
            .where('isActive = :isActive', { isActive: false })
            .andWhere('lastUsed < :cutoffDate', { cutoffDate })
            .execute();

        const cleanedCount = result.affected || 0;
        logger.info(`Cleaned up ${cleanedCount} inactive devices`);
        return cleanedCount;
    }

    /**
     * Apply trust decay to devices based on inactivity
     * Devices that haven't been used recently will have their trust level reduced
     * 
     * Trust decay schedule:
     * - High -> Medium after 14 days of inactivity
     * - Medium -> Low after 30 days of inactivity
     * - Low devices older than 60 days are deactivated
     * 
     * @returns Summary of trust decay actions taken
     */
    public async applyTrustDecay(): Promise<{
        highToMedium: number;
        mediumToLow: number;
        deactivated: number;
    }> {
        const now = Date.now();
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);

        // High -> Medium after 14 days
        const highToMediumResult = await this.trustedDeviceRepository
            .createQueryBuilder()
            .update()
            .set({ trustLevel: 'medium' })
            .where('isActive = :isActive', { isActive: true })
            .andWhere('trustLevel = :trustLevel', { trustLevel: 'high' })
            .andWhere('lastUsed < :cutoffDate', { cutoffDate: fourteenDaysAgo })
            .execute();

        // Medium -> Low after 30 days
        const mediumToLowResult = await this.trustedDeviceRepository
            .createQueryBuilder()
            .update()
            .set({ trustLevel: 'low' })
            .where('isActive = :isActive', { isActive: true })
            .andWhere('trustLevel = :trustLevel', { trustLevel: 'medium' })
            .andWhere('lastUsed < :cutoffDate', { cutoffDate: thirtyDaysAgo })
            .execute();

        // Deactivate low trust devices after 60 days
        const deactivatedResult = await this.trustedDeviceRepository
            .createQueryBuilder()
            .update()
            .set({ isActive: false })
            .where('isActive = :isActive', { isActive: true })
            .andWhere('trustLevel = :trustLevel', { trustLevel: 'low' })
            .andWhere('lastUsed < :cutoffDate', { cutoffDate: sixtyDaysAgo })
            .execute();

        const summary = {
            highToMedium: highToMediumResult.affected || 0,
            mediumToLow: mediumToLowResult.affected || 0,
            deactivated: deactivatedResult.affected || 0
        };

        if (summary.highToMedium > 0 || summary.mediumToLow > 0 || summary.deactivated > 0) {
            logger.info(
                `Trust decay applied: ${summary.highToMedium} high->medium, ` +
                `${summary.mediumToLow} medium->low, ${summary.deactivated} deactivated`
            );
        }

        return summary;
    }

    /**
     * Apply trust decay for a specific user's devices
     * @param userId User ID
     * @returns Number of devices with reduced trust
     */
    public async applyUserTrustDecay(userId: string): Promise<number> {
        const now = Date.now();
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        // Get user's devices
        const devices = await this.trustedDeviceRepository.find({
            where: { userId, isActive: true }
        });

        let decayCount = 0;

        for (const device of devices) {
            let newTrustLevel = device.trustLevel;
            
            if (device.trustLevel === 'high' && device.lastUsed < fourteenDaysAgo) {
                newTrustLevel = 'medium';
            } else if (device.trustLevel === 'medium' && device.lastUsed < thirtyDaysAgo) {
                newTrustLevel = 'low';
            }

            if (newTrustLevel !== device.trustLevel) {
                const previousLevel = device.trustLevel;
                device.trustLevel = newTrustLevel;
                await this.trustedDeviceRepository.save(device);
                decayCount++;
                logger.info(`Trust decay for device ${device.id}: ${previousLevel} -> ${newTrustLevel}`);
            }
        }

        return decayCount;
    }

    /**
     * Elevate trust level for a device (after successful re-verification)
     * @param userId User ID
     * @param deviceId Device ID
     * @param newTrustLevel New trust level
     * @returns Updated device or null if not found
     */
    public async elevateTrustLevel(
        userId: string,
        deviceId: string,
        newTrustLevel: 'low' | 'medium' | 'high'
    ): Promise<TrustedDevice | null> {
        const device = await this.trustedDeviceRepository.findOne({
            where: { id: deviceId, userId }
        });

        if (!device) {
            logger.warn(`Device ${deviceId} not found for user ${userId}`);
            return null;
        }

        const previousLevel = device.trustLevel;
        device.trustLevel = newTrustLevel;
        device.lastUsed = new Date();

        await this.trustedDeviceRepository.save(device);
        logger.info(`Trust elevated for device ${deviceId}: ${previousLevel} -> ${newTrustLevel}`);

        return device;
    }
}

// Singleton instance
let instance: TrustedDeviceService | null = null;

export const getTrustedDeviceService = (): TrustedDeviceService => {
    if (!instance) {
        instance = new TrustedDeviceService();
        logger.info('TrustedDeviceService initialized with database persistence');
    }
    return instance;
};

