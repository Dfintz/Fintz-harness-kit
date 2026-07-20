"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrustedDeviceService = exports.TrustedDeviceService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const data_source_1 = require("../../../data-source");
const TrustedDevice_1 = require("../../../models/TrustedDevice");
const logger_1 = require("../../../utils/logger");
class TrustedDeviceService {
    trustedDeviceRepository;
    constructor() {
        this.trustedDeviceRepository = data_source_1.AppDataSource.getRepository(TrustedDevice_1.TrustedDevice);
    }
    generateFingerprint(data) {
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
        return crypto_1.default.createHash('sha256').update(fingerprintString).digest('hex');
    }
    async registerDevice(userId, fingerprintData, metadata) {
        const fingerprint = this.generateFingerprint(fingerprintData);
        const existingDevice = await this.findDeviceByFingerprint(userId, fingerprint);
        if (existingDevice) {
            existingDevice.lastUsed = new Date();
            existingDevice.ipAddress = metadata?.ipAddress || existingDevice.ipAddress;
            await this.trustedDeviceRepository.save(existingDevice);
            logger_1.logger.info(`Device already registered for user ${userId}, updating last used`);
            return existingDevice;
        }
        const device = this.trustedDeviceRepository.create({
            id: crypto_1.default.randomUUID(),
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
        logger_1.logger.info(`New trusted device registered for user ${userId}: ${device.deviceName}`);
        return device;
    }
    async verifyDevice(userId, fingerprintData) {
        const fingerprint = this.generateFingerprint(fingerprintData);
        const device = await this.findDeviceByFingerprint(userId, fingerprint);
        if (!device) {
            logger_1.logger.warn(`Unknown device detected for user ${userId}`);
            return { isTrusted: false };
        }
        if (!device.isActive) {
            logger_1.logger.warn(`Inactive device attempted access for user ${userId}`);
            return { isTrusted: false, device };
        }
        device.lastUsed = new Date();
        await this.trustedDeviceRepository.save(device);
        logger_1.logger.info(`Trusted device verified for user ${userId}: ${device.deviceName}`);
        return { isTrusted: true, device, trustLevel: device.trustLevel };
    }
    async findDeviceByFingerprint(userId, fingerprint) {
        return this.trustedDeviceRepository.findOne({
            where: {
                userId,
                deviceFingerprint: fingerprint
            }
        });
    }
    async getUserDevices(userId) {
        return this.trustedDeviceRepository.find({
            where: { userId },
            order: { lastUsed: 'DESC' }
        });
    }
    async revokeDevice(userId, deviceId) {
        const device = await this.trustedDeviceRepository.findOne({
            where: { id: deviceId, userId }
        });
        if (!device) {
            logger_1.logger.warn(`Device ${deviceId} not found for user ${userId}`);
            return false;
        }
        device.isActive = false;
        await this.trustedDeviceRepository.save(device);
        logger_1.logger.info(`Device ${deviceId} revoked for user ${userId}`);
        return true;
    }
    async revokeAllDevices(userId) {
        const result = await this.trustedDeviceRepository.update({ userId, isActive: true }, { isActive: false });
        const revokedCount = result.affected || 0;
        logger_1.logger.info(`${revokedCount} devices revoked for user ${userId}`);
        return revokedCount;
    }
    async deleteAllDevices(userId) {
        const result = await this.trustedDeviceRepository.delete({ userId });
        const deletedCount = result.affected || 0;
        logger_1.logger.info(`${deletedCount} devices deleted for user ${userId}`);
        return deletedCount;
    }
    async assessLoginRisk(userId, fingerprintData, ipAddress) {
        const reasons = [];
        let riskLevel = 'low';
        const { isTrusted, device } = await this.verifyDevice(userId, fingerprintData);
        if (!isTrusted) {
            reasons.push('Login from unknown device');
            riskLevel = 'medium';
        }
        if (device && ipAddress && device.ipAddress && device.ipAddress !== ipAddress) {
            reasons.push('IP address differs from usual device location');
            riskLevel = riskLevel === 'medium' ? 'high' : 'medium';
        }
        if (device && fingerprintData.userAgent !== device.userAgent) {
            reasons.push('Browser or user agent changed');
        }
        const userDevices = await this.getUserDevices(userId);
        if (userDevices.length === 0) {
            reasons.push('First login attempt - new account setup');
        }
        const requiresVerification = riskLevel === 'high' || !isTrusted;
        if (reasons.length > 0) {
            logger_1.logger.info(`Login risk assessment for user ${userId}: ${riskLevel}`, { reasons });
        }
        return {
            riskLevel,
            reasons,
            requiresVerification
        };
    }
    inferDeviceName(data) {
        const userAgent = data.userAgent.toLowerCase();
        let deviceType = 'Unknown Device';
        if (userAgent.includes('mobile') || userAgent.includes('android')) {
            deviceType = 'Mobile';
        }
        else if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
            deviceType = 'Tablet';
        }
        else {
            deviceType = 'Desktop';
        }
        let browser = 'Unknown Browser';
        if (userAgent.includes('chrome')) {
            browser = 'Chrome';
        }
        else if (userAgent.includes('firefox')) {
            browser = 'Firefox';
        }
        else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
            browser = 'Safari';
        }
        else if (userAgent.includes('edge')) {
            browser = 'Edge';
        }
        let os = 'Unknown OS';
        if (userAgent.includes('windows')) {
            os = 'Windows';
        }
        else if (userAgent.includes('mac')) {
            os = 'macOS';
        }
        else if (userAgent.includes('linux')) {
            os = 'Linux';
        }
        else if (userAgent.includes('android')) {
            os = 'Android';
        }
        else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
            os = 'iOS';
        }
        return `${deviceType} - ${browser} on ${os}`;
    }
    async cleanupInactiveDevices(maxAgeMs = 90 * 24 * 60 * 60 * 1000) {
        const cutoffDate = new Date(Date.now() - maxAgeMs);
        const result = await this.trustedDeviceRepository
            .createQueryBuilder()
            .delete()
            .where('isActive = :isActive', { isActive: false })
            .andWhere('lastUsed < :cutoffDate', { cutoffDate })
            .execute();
        const cleanedCount = result.affected || 0;
        logger_1.logger.info(`Cleaned up ${cleanedCount} inactive devices`);
        return cleanedCount;
    }
    async applyTrustDecay() {
        const now = Date.now();
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
        const highToMediumResult = await this.trustedDeviceRepository
            .createQueryBuilder()
            .update()
            .set({ trustLevel: 'medium' })
            .where('isActive = :isActive', { isActive: true })
            .andWhere('trustLevel = :trustLevel', { trustLevel: 'high' })
            .andWhere('lastUsed < :cutoffDate', { cutoffDate: fourteenDaysAgo })
            .execute();
        const mediumToLowResult = await this.trustedDeviceRepository
            .createQueryBuilder()
            .update()
            .set({ trustLevel: 'low' })
            .where('isActive = :isActive', { isActive: true })
            .andWhere('trustLevel = :trustLevel', { trustLevel: 'medium' })
            .andWhere('lastUsed < :cutoffDate', { cutoffDate: thirtyDaysAgo })
            .execute();
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
            logger_1.logger.info(`Trust decay applied: ${summary.highToMedium} high->medium, ` +
                `${summary.mediumToLow} medium->low, ${summary.deactivated} deactivated`);
        }
        return summary;
    }
    async applyUserTrustDecay(userId) {
        const now = Date.now();
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
        const devices = await this.trustedDeviceRepository.find({
            where: { userId, isActive: true }
        });
        let decayCount = 0;
        for (const device of devices) {
            let newTrustLevel = device.trustLevel;
            if (device.trustLevel === 'high' && device.lastUsed < fourteenDaysAgo) {
                newTrustLevel = 'medium';
            }
            else if (device.trustLevel === 'medium' && device.lastUsed < thirtyDaysAgo) {
                newTrustLevel = 'low';
            }
            if (newTrustLevel !== device.trustLevel) {
                const previousLevel = device.trustLevel;
                device.trustLevel = newTrustLevel;
                await this.trustedDeviceRepository.save(device);
                decayCount++;
                logger_1.logger.info(`Trust decay for device ${device.id}: ${previousLevel} -> ${newTrustLevel}`);
            }
        }
        return decayCount;
    }
    async elevateTrustLevel(userId, deviceId, newTrustLevel) {
        const device = await this.trustedDeviceRepository.findOne({
            where: { id: deviceId, userId }
        });
        if (!device) {
            logger_1.logger.warn(`Device ${deviceId} not found for user ${userId}`);
            return null;
        }
        const previousLevel = device.trustLevel;
        device.trustLevel = newTrustLevel;
        device.lastUsed = new Date();
        await this.trustedDeviceRepository.save(device);
        logger_1.logger.info(`Trust elevated for device ${deviceId}: ${previousLevel} -> ${newTrustLevel}`);
        return device;
    }
}
exports.TrustedDeviceService = TrustedDeviceService;
let instance = null;
const getTrustedDeviceService = () => {
    if (!instance) {
        instance = new TrustedDeviceService();
        logger_1.logger.info('TrustedDeviceService initialized with database persistence');
    }
    return instance;
};
exports.getTrustedDeviceService = getTrustedDeviceService;
//# sourceMappingURL=TrustedDeviceService.js.map