#!/usr/bin/env ts-node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedPlatformAdmin = seedPlatformAdmin;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const User_1 = require("../models/User");
const UserAuthenticationService_1 = require("../services/user/UserAuthenticationService");
const logger_1 = require("../utils/logger");
async function seedPlatformAdmin() {
    try {
        logger_1.logger.info('🔐 Starting platform admin account seeding...');
        const adminUsername = process.env.PLATFORM_ADMIN_USERNAME;
        const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
        const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
        if (!adminUsername || !adminPassword || !adminEmail) {
            logger_1.logger.error('❌ Missing required environment variables');
            logger_1.logger.error('   Required: PLATFORM_ADMIN_USERNAME, PLATFORM_ADMIN_PASSWORD, PLATFORM_ADMIN_EMAIL');
            process.exit(1);
        }
        if (adminPassword.length < 12) {
            logger_1.logger.error('❌ Admin password must be at least 12 characters long');
            process.exit(1);
        }
        logger_1.logger.info('📡 Connecting to database...');
        await database_1.AppDataSource.initialize();
        logger_1.logger.info('✅ Database connection established');
        const userRepository = database_1.AppDataSource.getRepository(User_1.User);
        const authService = new UserAuthenticationService_1.UserAuthenticationService();
        const existingAdmin = await userRepository.findOne({
            where: { username: adminUsername }
        });
        if (existingAdmin) {
            logger_1.logger.info(`📝 Platform admin user '${adminUsername}' already exists, updating...`);
            existingAdmin.email = adminEmail;
            existingAdmin.role = 'admin';
            existingAdmin.displayName = 'Platform Administrator';
            await userRepository.save(existingAdmin);
            await authService.setPassword(existingAdmin.id, adminPassword);
            logger_1.logger.info(`✅ Platform admin user '${adminUsername}' updated successfully`);
            logger_1.logger.info(`   - User ID: ${existingAdmin.id}`);
            logger_1.logger.info(`   - Email: ${adminEmail}`);
            logger_1.logger.info(`   - Role: admin`);
        }
        else {
            logger_1.logger.info(`🆕 Creating new platform admin user '${adminUsername}'...`);
            const adminUser = userRepository.create({
                id: crypto_1.default.randomUUID(),
                username: adminUsername,
                email: adminEmail,
                discordId: `platform-admin-${crypto_1.default.randomUUID()}`,
                role: 'admin',
                displayName: 'Platform Administrator',
                bio: 'Platform Administrator Account',
                lastLoginAt: undefined,
                rsiVerified: true,
                rsiVerifiedAt: new Date(),
            });
            await userRepository.save(adminUser);
            await authService.setPassword(adminUser.id, adminPassword);
            logger_1.logger.info(`✅ Platform admin user '${adminUsername}' created successfully`);
            logger_1.logger.info(`   - User ID: ${adminUser.id}`);
            logger_1.logger.info(`   - Email: ${adminEmail}`);
            logger_1.logger.info(`   - Role: admin`);
        }
        logger_1.logger.info('🎉 Platform admin account seeding completed successfully!');
        logger_1.logger.info('');
        logger_1.logger.info('🔒 Admin Login Instructions:');
        logger_1.logger.info(`   1. Navigate to the admin login page: /admin/login`);
        logger_1.logger.info(`   2. Use username: ${adminUsername}`);
        logger_1.logger.info(`   3. Use the password from PLATFORM_ADMIN_PASSWORD environment variable`);
        logger_1.logger.info('');
        logger_1.logger.info('⚠️  SECURITY REMINDER:');
        logger_1.logger.info('   - Keep your admin credentials secure');
        logger_1.logger.info('   - Do not commit credentials to version control');
        logger_1.logger.info('   - Use strong passwords (minimum 12 characters)');
        logger_1.logger.info('   - Rotate passwords regularly');
        logger_1.logger.info('   - Consider using Azure AD SSO for additional security');
        await database_1.AppDataSource.destroy();
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('❌ Platform admin seeding failed:', error);
        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                logger_1.logger.error('💡 Tip: Make sure the database server is running');
            }
            else if (error.message.includes('password authentication failed')) {
                logger_1.logger.error('💡 Tip: Check your database credentials');
            }
            else if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
                logger_1.logger.error('💡 Tip: Admin user might already exist with a conflicting field (username, email, or discordId)');
                logger_1.logger.error('   Try using a different username or email, or update the existing admin user');
            }
        }
        try {
            await database_1.AppDataSource.destroy();
        }
        catch {
        }
        process.exit(1);
    }
}
if (require.main === module) {
    void seedPlatformAdmin();
}
//# sourceMappingURL=seed-admin.js.map