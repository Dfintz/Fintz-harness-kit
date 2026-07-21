import {
    obfuscateUserData,
    obfuscateRequestData,
    isEncryptionEnabled,
    getDataRetentionDays,
    shouldDeleteData,
    GDPRDataCategory,
    classifyDataField,
    requiresEncryption,
    requiresObfuscation
} from '../../utils/gdprUtils';

describe('GDPR Utilities', () => {
    const originalEncryptionEnabled = process.env.ENCRYPTION_ENABLED;
    const originalRetentionDays = process.env.DATA_RETENTION_DAYS;

    afterEach(() => {
        if (originalEncryptionEnabled) {
            process.env.ENCRYPTION_ENABLED = originalEncryptionEnabled;
        } else {
            delete process.env.ENCRYPTION_ENABLED;
        }
        
        if (originalRetentionDays) {
            process.env.DATA_RETENTION_DAYS = originalRetentionDays;
        } else {
            delete process.env.DATA_RETENTION_DAYS;
        }
    });

    describe('obfuscateUserData', () => {
        it('should obfuscate user information', () => {
            const user = {
                username: 'john_doe',
                email: 'john@example.com',
                id: 'user-123'
            };

            const obfuscated = obfuscateUserData(user);

            expect(obfuscated.username).toBe('j***e');
            expect(obfuscated.email).toBe('j***n@e***e.c***m');
            expect(obfuscated.id).toBe('user-123'); // ID should not be obfuscated
        });
    });

    describe('obfuscateRequestData', () => {
        it('should obfuscate request metadata', () => {
            const req = {
                ip: '192.168.1.100',
                headers: {
                    'user-agent': 'Mozilla/5.0 Chrome/91.0'
                }
            };

            const obfuscated = obfuscateRequestData(req);

            expect(obfuscated.ipAddress).toBe('192.168.***.***');
            expect(obfuscated.userAgent).toBe('Chrome/***');
            expect(obfuscated.timestamp).toBeInstanceOf(Date);
        });

        it('should handle missing IP and user agent', () => {
            const req = {};
            const obfuscated = obfuscateRequestData(req);

            expect(obfuscated.ipAddress).toBeUndefined();
            expect(obfuscated.userAgent).toBeUndefined();
            expect(obfuscated.timestamp).toBeInstanceOf(Date);
        });
    });

    describe('isEncryptionEnabled', () => {
        it('should return true when ENCRYPTION_ENABLED is true', () => {
            process.env.ENCRYPTION_ENABLED = 'true';
            expect(isEncryptionEnabled()).toBe(true);
        });

        it('should return false when ENCRYPTION_ENABLED is false', () => {
            process.env.ENCRYPTION_ENABLED = 'false';
            expect(isEncryptionEnabled()).toBe(false);
        });

        it('should return false when ENCRYPTION_ENABLED is not set', () => {
            delete process.env.ENCRYPTION_ENABLED;
            expect(isEncryptionEnabled()).toBe(false);
        });
    });

    describe('getDataRetentionDays', () => {
        it('should return default 365 days when not set', () => {
            delete process.env.DATA_RETENTION_DAYS;
            expect(getDataRetentionDays()).toBe(365);
        });

        it('should return configured retention days', () => {
            process.env.DATA_RETENTION_DAYS = '90';
            expect(getDataRetentionDays()).toBe(90);
        });

        it('should return default when value is invalid', () => {
            process.env.DATA_RETENTION_DAYS = 'invalid';
            expect(getDataRetentionDays()).toBe(365);
        });
    });

    describe('shouldDeleteData', () => {
        it('should return true for old data', () => {
            const oldDate = new Date();
            oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 years ago
            
            process.env.DATA_RETENTION_DAYS = '365';
            expect(shouldDeleteData(oldDate)).toBe(true);
        });

        it('should return false for recent data', () => {
            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 30); // 30 days ago
            
            process.env.DATA_RETENTION_DAYS = '365';
            expect(shouldDeleteData(recentDate)).toBe(false);
        });

        it('should use custom retention period', () => {
            const date = new Date();
            date.setDate(date.getDate() - 100); // 100 days ago
            
            process.env.DATA_RETENTION_DAYS = '90';
            expect(shouldDeleteData(date)).toBe(true);
            
            process.env.DATA_RETENTION_DAYS = '180';
            expect(shouldDeleteData(date)).toBe(false);
        });
    });

    describe('classifyDataField', () => {
        it('should classify email as personal identifiable', () => {
            expect(classifyDataField('email')).toBe(GDPRDataCategory.PERSONAL_IDENTIFIABLE);
            expect(classifyDataField('userEmail')).toBe(GDPRDataCategory.PERSONAL_IDENTIFIABLE);
        });

        it('should classify password as authentication', () => {
            expect(classifyDataField('password')).toBe(GDPRDataCategory.AUTHENTICATION);
            expect(classifyDataField('twoFactorSecret')).toBe(GDPRDataCategory.AUTHENTICATION);
            expect(classifyDataField('authToken')).toBe(GDPRDataCategory.AUTHENTICATION);
        });

        it('should classify IP as technical', () => {
            expect(classifyDataField('ipAddress')).toBe(GDPRDataCategory.TECHNICAL);
            expect(classifyDataField('user-agent')).toBe(GDPRDataCategory.TECHNICAL);
        });

        it('should classify logs as behavioral', () => {
            expect(classifyDataField('accessLog')).toBe(GDPRDataCategory.BEHAVIORAL);
            expect(classifyDataField('activityLog')).toBe(GDPRDataCategory.BEHAVIORAL);
        });

        it('should classify username as profile', () => {
            expect(classifyDataField('username')).toBe(GDPRDataCategory.PROFILE);
            expect(classifyDataField('displayName')).toBe(GDPRDataCategory.PROFILE);
        });

        it('should default to profile for unknown fields', () => {
            expect(classifyDataField('randomField')).toBe(GDPRDataCategory.PROFILE);
        });
    });

    describe('requiresEncryption', () => {
        it('should require encryption for personal identifiable data', () => {
            expect(requiresEncryption(GDPRDataCategory.PERSONAL_IDENTIFIABLE)).toBe(true);
        });

        it('should require encryption for authentication data', () => {
            expect(requiresEncryption(GDPRDataCategory.AUTHENTICATION)).toBe(true);
        });

        it('should require encryption for sensitive data', () => {
            expect(requiresEncryption(GDPRDataCategory.SENSITIVE)).toBe(true);
        });

        it('should not require encryption for behavioral data', () => {
            expect(requiresEncryption(GDPRDataCategory.BEHAVIORAL)).toBe(false);
        });

        it('should not require encryption for technical data', () => {
            expect(requiresEncryption(GDPRDataCategory.TECHNICAL)).toBe(false);
        });
    });

    describe('requiresObfuscation', () => {
        it('should require obfuscation for personal identifiable data', () => {
            expect(requiresObfuscation(GDPRDataCategory.PERSONAL_IDENTIFIABLE)).toBe(true);
        });

        it('should require obfuscation for technical data', () => {
            expect(requiresObfuscation(GDPRDataCategory.TECHNICAL)).toBe(true);
        });

        it('should require obfuscation for profile data', () => {
            expect(requiresObfuscation(GDPRDataCategory.PROFILE)).toBe(true);
        });

        it('should not require obfuscation for authentication data', () => {
            expect(requiresObfuscation(GDPRDataCategory.AUTHENTICATION)).toBe(false);
        });

        it('should not require obfuscation for behavioral data', () => {
            expect(requiresObfuscation(GDPRDataCategory.BEHAVIORAL)).toBe(false);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
