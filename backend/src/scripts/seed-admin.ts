#!/usr/bin/env ts-node
/**
 * Platform Admin Account Seeding Script
 * 
 * This script creates a platform admin account that can be used to access the admin portal.
 * The credentials are read from environment variables for security.
 * 
 * Usage:
 *   npm run seed:admin
 * 
 * Environment Variables:
 *   PLATFORM_ADMIN_USERNAME - Admin username (required)
 *   PLATFORM_ADMIN_PASSWORD - Admin password (required)
 *   PLATFORM_ADMIN_EMAIL - Admin email (required)
 * 
 * The script is idempotent - it will update the account if it already exists.
 */

import crypto from 'crypto';

import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { UserAuthenticationService } from '../services/user/UserAuthenticationService';
import { logger } from '../utils/logger';

async function seedPlatformAdmin(): Promise<void> {
    try {
        logger.info('🔐 Starting platform admin account seeding...');
        
        // Check required environment variables
        const adminUsername = process.env.PLATFORM_ADMIN_USERNAME;
        const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
        const adminEmail = process.env.PLATFORM_ADMIN_EMAIL;
        
        if (!adminUsername || !adminPassword || !adminEmail) {
            logger.error('❌ Missing required environment variables');
            logger.error('   Required: PLATFORM_ADMIN_USERNAME, PLATFORM_ADMIN_PASSWORD, PLATFORM_ADMIN_EMAIL');
            process.exit(1);
        }
        
        // Validate password strength
        if (adminPassword.length < 12) {
            logger.error('❌ Admin password must be at least 12 characters long');
            process.exit(1);
        }
        
        // Connect to database
        logger.info('📡 Connecting to database...');
        await AppDataSource.initialize();
        logger.info('✅ Database connection established');
        
        const userRepository = AppDataSource.getRepository(User);
        const authService = new UserAuthenticationService();
        
        // Check if admin already exists
        const existingAdmin = await userRepository.findOne({
            where: { username: adminUsername }
        });
        
        if (existingAdmin) {
            logger.info(`📝 Platform admin user '${adminUsername}' already exists, updating...`);
            
            // Update email and ensure admin role
            existingAdmin.email = adminEmail;
            existingAdmin.role = 'admin';
            existingAdmin.displayName = 'Platform Administrator';
            await userRepository.save(existingAdmin);
            
            // Update password
            await authService.setPassword(existingAdmin.id, adminPassword);
            
            logger.info(`✅ Platform admin user '${adminUsername}' updated successfully`);
            logger.info(`   - User ID: ${existingAdmin.id}`);
            logger.info(`   - Email: ${adminEmail}`);
            logger.info(`   - Role: admin`);
        } else {
            logger.info(`🆕 Creating new platform admin user '${adminUsername}'...`);
            
            // Create new admin user
            const adminUser = userRepository.create({
                id: crypto.randomUUID(),
                username: adminUsername,
                email: adminEmail,
                discordId: `platform-admin-${crypto.randomUUID()}`, // Synthetic Discord ID - this account won't use Discord OAuth
                role: 'admin',
                displayName: 'Platform Administrator',
                bio: 'Platform Administrator Account',
                lastLoginAt: undefined, // Will be set on first actual login
                rsiVerified: true, // Mark as verified
                rsiVerifiedAt: new Date(),
            });
            
            await userRepository.save(adminUser);
            
            // Set password
            await authService.setPassword(adminUser.id, adminPassword);
            
            logger.info(`✅ Platform admin user '${adminUsername}' created successfully`);
            logger.info(`   - User ID: ${adminUser.id}`);
            logger.info(`   - Email: ${adminEmail}`);
            logger.info(`   - Role: admin`);
        }
        
        logger.info('🎉 Platform admin account seeding completed successfully!');
        logger.info('');
        logger.info('🔒 Admin Login Instructions:');
        logger.info(`   1. Navigate to the admin login page: /admin/login`);
        logger.info(`   2. Use username: ${adminUsername}`);
        logger.info(`   3. Use the password from PLATFORM_ADMIN_PASSWORD environment variable`);
        logger.info('');
        logger.info('⚠️  SECURITY REMINDER:');
        logger.info('   - Keep your admin credentials secure');
        logger.info('   - Do not commit credentials to version control');
        logger.info('   - Use strong passwords (minimum 12 characters)');
        logger.info('   - Rotate passwords regularly');
        logger.info('   - Consider using Azure AD SSO for additional security');
        
        // Close connection
        await AppDataSource.destroy();
        process.exit(0);
        
    } catch (error) {
        logger.error('❌ Platform admin seeding failed:', error);
        
        // Provide helpful error messages
        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                logger.error('💡 Tip: Make sure the database server is running');
            } else if (error.message.includes('password authentication failed')) {
                logger.error('💡 Tip: Check your database credentials');
            } else if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
                logger.error('💡 Tip: Admin user might already exist with a conflicting field (username, email, or discordId)');
                logger.error('   Try using a different username or email, or update the existing admin user');
            }
        }
        
        // Clean up and exit with error code
        try {
            await AppDataSource.destroy();
        } catch {
            // Ignore cleanup errors
        }
        process.exit(1);
    }
}

// Run the seeding
if (require.main === module) {
    void seedPlatformAdmin();
}

export { seedPlatformAdmin };
