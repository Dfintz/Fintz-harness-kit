"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAuthenticationService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const data_source_1 = require("../../data-source");
const User_1 = require("../../models/User");
const AccountSecurityService_1 = require("../security/core/AccountSecurityService");
class UserAuthenticationService {
    userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    async validateCredentials(username, password) {
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.username = :username', { username })
            .addSelect('user.password')
            .getOne();
        if (!user?.password) {
            return null;
        }
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return null;
        }
        const authenticatedUser = { ...user, password: undefined };
        return authenticatedUser;
    }
    async validateCredentialsByEmail(email, password) {
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.email = :email', { email })
            .addSelect('user.password')
            .getOne();
        if (!user?.password) {
            return null;
        }
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return null;
        }
        const authenticatedUser = { ...user, password: undefined };
        return authenticatedUser;
    }
    async updatePassword(userId, oldPassword, newPassword) {
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.id = :userId', { userId })
            .addSelect('user.password')
            .getOne();
        if (!user) {
            throw new Error('User not found');
        }
        if (user.password) {
            const isValidPassword = await bcrypt_1.default.compare(oldPassword, user.password);
            if (!isValidPassword) {
                throw new Error('Current password is incorrect');
            }
        }
        const securityService = AccountSecurityService_1.AccountSecurityService.getInstance();
        const isPasswordAllowed = await securityService.checkPasswordHistory(userId, newPassword);
        if (!isPasswordAllowed) {
            throw new Error(AccountSecurityService_1.AccountSecurityService.PASSWORD_REUSE_ERROR);
        }
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
        await this.userRepository.update(userId, { password: hashedPassword });
        await securityService.addPasswordToHistory(userId, hashedPassword);
    }
    async setPassword(userId, newPassword) {
        const securityService = AccountSecurityService_1.AccountSecurityService.getInstance();
        const isPasswordAllowed = await securityService.checkPasswordHistory(userId, newPassword);
        if (!isPasswordAllowed) {
            throw new Error(AccountSecurityService_1.AccountSecurityService.PASSWORD_REUSE_ERROR);
        }
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
        await this.userRepository.update(userId, { password: hashedPassword });
        await securityService.addPasswordToHistory(userId, hashedPassword);
    }
    async hashPassword(password) {
        return bcrypt_1.default.hash(password, 10);
    }
    async verifyPassword(password, hash) {
        return bcrypt_1.default.compare(password, hash);
    }
    async getUserWithPassword(userId) {
        return this.userRepository
            .createQueryBuilder('user')
            .where('user.id = :userId', { userId })
            .addSelect('user.password')
            .getOne();
    }
    async hasPassword(userId) {
        const user = await this.getUserWithPassword(userId);
        return user?.password ? true : false;
    }
    async getPasswordLastChanged(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['passwordChangedAt'],
        });
        return user?.passwordChangedAt || null;
    }
    async updatePasswordChangedAt(userId) {
        await this.userRepository.update(userId, {
            passwordChangedAt: new Date(),
        });
    }
    async passwordNeedsChange(userId, maxAgeInDays = 90) {
        const lastChanged = await this.getPasswordLastChanged(userId);
        if (!lastChanged) {
            return true;
        }
        const ageInMs = Date.now() - lastChanged.getTime();
        const ageInDays = ageInMs / (1000 * 60 * 60 * 24);
        return ageInDays > maxAgeInDays;
    }
    async recordLogin(userId, ipAddress, userAgent) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }
        void userAgent;
        const updates = {
            lastLoginAt: new Date(),
            loginCount: (user.loginCount || 0) + 1,
        };
        if (ipAddress) {
            updates.lastLoginIp = ipAddress;
        }
        await this.userRepository.update(userId, updates);
    }
    async recordFailedLogin(usernameOrEmail, ipAddress) {
        void ipAddress;
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.username = :identifier OR user.email = :identifier', {
            identifier: usernameOrEmail,
        })
            .getOne();
        if (user) {
            await this.userRepository.update(user.id, {
                failedLoginAttempts: (user.failedLoginAttempts ?? 0) + 1,
                lastFailedLoginAt: new Date(),
            });
        }
    }
    async resetFailedLoginAttempts(userId) {
        await this.userRepository.update(userId, {
            failedLoginAttempts: 0,
            lastFailedLoginAt: undefined,
        });
    }
    async isAccountLocked(userId, maxAttempts = 5, lockoutDurationMinutes = 30) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['failedLoginAttempts', 'lastFailedLoginAt'],
        });
        if (!user?.failedLoginAttempts || user.failedLoginAttempts < maxAttempts) {
            return false;
        }
        if (!user.lastFailedLoginAt) {
            return false;
        }
        const lockoutEndTime = new Date(user.lastFailedLoginAt.getTime() + lockoutDurationMinutes * 60 * 1000);
        return new Date() < lockoutEndTime;
    }
    async enableTwoFactorAuth(userId, secret) {
        await this.userRepository.update(userId, {
            twoFactorSecret: secret,
            twoFactorEnabled: true,
        });
    }
    async disableTwoFactorAuth(userId) {
        await this.userRepository.update(userId, {
            twoFactorSecret: undefined,
            twoFactorEnabled: false,
        });
    }
    async hasTwoFactorAuth(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['twoFactorEnabled'],
        });
        return user?.twoFactorEnabled || false;
    }
    async getTwoFactorSecret(userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['twoFactorSecret'],
        });
        return user?.twoFactorSecret || null;
    }
}
exports.UserAuthenticationService = UserAuthenticationService;
//# sourceMappingURL=UserAuthenticationService.js.map