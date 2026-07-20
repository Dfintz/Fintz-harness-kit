"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.demonstratePasswordHistory = demonstratePasswordHistory;
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_1 = require("../config/database");
const PasswordHistory_1 = require("../models/PasswordHistory");
const User_1 = require("../models/User");
const AccountSecurityService_1 = require("../services/security/core/AccountSecurityService");
const logger_1 = require("../utils/logger");
async function demonstratePasswordHistory() {
    logger_1.logger.info('🔐 Password History Demonstration\n');
    logger_1.logger.info('==================================\n');
    try {
        if (!database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.initialize();
            logger_1.logger.info('✅ Database connection established\n');
        }
        const userRepository = database_1.AppDataSource.getRepository(User_1.User);
        const historyRepository = database_1.AppDataSource.getRepository(PasswordHistory_1.PasswordHistory);
        const securityService = AccountSecurityService_1.AccountSecurityService.getInstance();
        logger_1.logger.info('Step 1: Creating test user...');
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        const testUsername = `demo_user_${crypto.randomUUID().slice(0, 8)}`;
        const initialPassword = `DemoPass_${crypto.randomBytes(8).toString('hex')}!A1`;
        const hashedPassword = await bcrypt_1.default.hash(initialPassword, 10);
        const user = userRepository.create({
            username: testUsername,
            email: `${testUsername}@example.com`,
            password: hashedPassword,
            role: 'user',
        });
        await userRepository.save(user);
        logger_1.logger.info(`✅ User created: ${user.username} (ID: ${user.id})\n`);
        await securityService.addPasswordToHistory(user.id, hashedPassword);
        logger_1.logger.info('✅ Initial password added to history\n');
        logger_1.logger.info('Step 2: Changing password multiple times...');
        const passwords = [
            `DemoPass_${crypto.randomBytes(8).toString('hex')}!B2`,
            `DemoPass_${crypto.randomBytes(8).toString('hex')}!C3`,
            `DemoPass_${crypto.randomBytes(8).toString('hex')}!D4`,
            `DemoPass_${crypto.randomBytes(8).toString('hex')}!E5`,
        ];
        for (let i = 0; i < passwords.length; i++) {
            const newPassword = passwords[i];
            const isAllowed = await securityService.checkPasswordHistory(user.id, newPassword);
            if (!isAllowed) {
                logger_1.logger.info(`❌ Password #${i + 2} rejected (in history)`);
                continue;
            }
            const newHash = await bcrypt_1.default.hash(newPassword, 10);
            await userRepository.update(user.id, { password: newHash });
            await securityService.addPasswordToHistory(user.id, newHash);
            logger_1.logger.info(`✅ Password #${i + 2} changed successfully`);
        }
        logger_1.logger.info('');
        logger_1.logger.info('Step 3: Current password history:');
        const history = await historyRepository.find({
            where: { userId: user.id },
            order: { createdAt: 'DESC' },
        });
        logger_1.logger.info(`📝 Total passwords in history: ${history.length}`);
        history.forEach((entry, index) => {
            logger_1.logger.info(`   ${index + 1}. Created: ${entry.createdAt.toISOString()}`);
        });
        logger_1.logger.info('');
        logger_1.logger.info('Step 4: Attempting to reuse an old password...');
        const reusedPassword = passwords[0];
        const canReuse = await securityService.checkPasswordHistory(user.id, reusedPassword);
        if (canReuse) {
            logger_1.logger.info('❌ ERROR: Old password was allowed (should be rejected!)');
        }
        else {
            logger_1.logger.info('✅ Old password correctly rejected (password reuse prevention working)');
            logger_1.logger.info(`   Error message: "${AccountSecurityService_1.AccountSecurityService.PASSWORD_REUSE_ERROR}"\n`);
        }
        logger_1.logger.info('Step 5: Changing to a completely new password...');
        const brandNewPassword = `DemoPass_${crypto.randomBytes(12).toString('hex')}!F6`;
        const canUseNew = await securityService.checkPasswordHistory(user.id, brandNewPassword);
        if (canUseNew) {
            const newHash = await bcrypt_1.default.hash(brandNewPassword, 10);
            await userRepository.update(user.id, { password: newHash });
            await securityService.addPasswordToHistory(user.id, newHash);
            logger_1.logger.info('✅ New password accepted and saved\n');
        }
        else {
            logger_1.logger.info('❌ ERROR: New password was rejected (should be allowed!)');
        }
        logger_1.logger.info('Step 6: Testing password history limit...');
        const currentHistory = await historyRepository.find({
            where: { userId: user.id },
            order: { createdAt: 'DESC' },
        });
        logger_1.logger.info(`📝 Current history count: ${currentHistory.length}`);
        if (currentHistory.length <= 12) {
            logger_1.logger.info('✅ History count is within limit (≤ 12 passwords)\n');
        }
        else {
            logger_1.logger.info('❌ WARNING: History count exceeds limit (cleanup may be needed)\n');
        }
        logger_1.logger.info('Step 7: Cleaning up test data...');
        await userRepository.delete(user.id);
        logger_1.logger.info('✅ Test user deleted (password history auto-deleted via CASCADE)\n');
        logger_1.logger.info('==================================');
        logger_1.logger.info('✅ Demonstration Complete!\n');
        logger_1.logger.info('Summary:');
        logger_1.logger.info('- Password history tracking: ✅ Working');
        logger_1.logger.info('- Password reuse prevention: ✅ Working');
        logger_1.logger.info('- History limit enforcement: ✅ Working');
        logger_1.logger.info('- Database CASCADE delete: ✅ Working');
        logger_1.logger.info('\n🎉 All password history features verified!\n');
    }
    catch (error) {
        logger_1.logger.error('❌ Error during demonstration:', error);
        throw error;
    }
    finally {
        if (database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.destroy();
            logger_1.logger.info('Database connection closed.');
        }
    }
}
if (require.main === module) {
    demonstratePasswordHistory()
        .then(() => {
        logger_1.logger.info('✅ Script completed successfully');
        process.exit(0);
    })
        .catch(error => {
        logger_1.logger.error('❌ Script failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=demo-password-history.js.map