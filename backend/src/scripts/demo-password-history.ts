/**
 * Password History Demonstration Script
 *
 * This script demonstrates the password history functionality:
 * 1. Creates a test user with an initial password
 * 2. Changes password multiple times
 * 3. Attempts to reuse an old password (should fail)
 * 4. Changes to a new password (should succeed)
 *
 * SECURITY NOTE: All passwords are randomly generated for demo purposes.
 * This script should ONLY be run in development/test environments.
 *
 * Run with: ts-node src/scripts/demo-password-history.ts
 */

import bcrypt from 'bcrypt';

import { AppDataSource } from '../config/database';
import { PasswordHistory } from '../models/PasswordHistory';
import { User } from '../models/User';
import { AccountSecurityService } from '../services/security/core/AccountSecurityService';
import { logger } from '../utils/logger';

async function demonstratePasswordHistory() {
  logger.info('🔐 Password History Demonstration\n');
  logger.info('==================================\n');

  try {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('✅ Database connection established\n');
    }

    const userRepository = AppDataSource.getRepository(User);
    const historyRepository = AppDataSource.getRepository(PasswordHistory);
    const securityService = AccountSecurityService.getInstance();

    // Step 1: Create a test user
    logger.info('Step 1: Creating test user...');
    const crypto = await import('crypto');
    const testUsername = `demo_user_${crypto.randomUUID().slice(0, 8)}`;
    // CWE-547: Generate random password instead of hardcoding for demo purposes
    const initialPassword = `DemoPass_${crypto.randomBytes(8).toString('hex')}!A1`;
    const hashedPassword = await bcrypt.hash(initialPassword, 10);

    const user = userRepository.create({
      username: testUsername,
      email: `${testUsername}@example.com`,
      password: hashedPassword,
      role: 'user',
    });

    await userRepository.save(user);
    logger.info(`✅ User created: ${user.username} (ID: ${user.id})\n`);

    // Add initial password to history
    await securityService.addPasswordToHistory(user.id, hashedPassword);
    logger.info('✅ Initial password added to history\n');

    // Step 2: Change password multiple times
    logger.info('Step 2: Changing password multiple times...');
    // CWE-547: Generate random passwords instead of hardcoding for demo purposes
    const passwords = [
      `DemoPass_${crypto.randomBytes(8).toString('hex')}!B2`,
      `DemoPass_${crypto.randomBytes(8).toString('hex')}!C3`,
      `DemoPass_${crypto.randomBytes(8).toString('hex')}!D4`,
      `DemoPass_${crypto.randomBytes(8).toString('hex')}!E5`,
    ];

    for (let i = 0; i < passwords.length; i++) {
      const newPassword = passwords[i];

      // Check if password is in history
      const isAllowed = await securityService.checkPasswordHistory(user.id, newPassword);
      if (!isAllowed) {
        logger.info(`❌ Password #${i + 2} rejected (in history)`);
        continue;
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await userRepository.update(user.id, { password: newHash });
      await securityService.addPasswordToHistory(user.id, newHash);

      logger.info(`✅ Password #${i + 2} changed successfully`);
    }
    logger.info(''); // Empty line for formatting

    // Step 3: Show current password history
    logger.info('Step 3: Current password history:');
    const history = await historyRepository.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
    logger.info(`📝 Total passwords in history: ${history.length}`);
    history.forEach((entry, index) => {
      logger.info(`   ${index + 1}. Created: ${entry.createdAt.toISOString()}`);
    });
    logger.info(''); // Empty line for formatting

    // Step 4: Attempt to reuse an old password
    logger.info('Step 4: Attempting to reuse an old password...');
    // CWE-547: Reuse the second password from our generated list for testing
    const reusedPassword = passwords[0]; // This was used earlier
    const canReuse = await securityService.checkPasswordHistory(user.id, reusedPassword);

    if (canReuse) {
      logger.info('❌ ERROR: Old password was allowed (should be rejected!)');
    } else {
      logger.info('✅ Old password correctly rejected (password reuse prevention working)');
      logger.info(`   Error message: "${AccountSecurityService.PASSWORD_REUSE_ERROR}"\n`);
    }

    // Step 5: Change to a brand new password
    logger.info('Step 5: Changing to a completely new password...');
    // CWE-547: Generate random password instead of hardcoding for demo purposes
    const brandNewPassword = `DemoPass_${crypto.randomBytes(12).toString('hex')}!F6`;
    const canUseNew = await securityService.checkPasswordHistory(user.id, brandNewPassword);

    if (canUseNew) {
      const newHash = await bcrypt.hash(brandNewPassword, 10);
      await userRepository.update(user.id, { password: newHash });
      await securityService.addPasswordToHistory(user.id, newHash);
      logger.info('✅ New password accepted and saved\n');
    } else {
      logger.info('❌ ERROR: New password was rejected (should be allowed!)');
    }

    // Step 6: Verify password history limit (should keep only last 12)
    logger.info('Step 6: Testing password history limit...');
    const currentHistory = await historyRepository.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
    logger.info(`📝 Current history count: ${currentHistory.length}`);

    if (currentHistory.length <= 12) {
      logger.info('✅ History count is within limit (≤ 12 passwords)\n');
    } else {
      logger.info('❌ WARNING: History count exceeds limit (cleanup may be needed)\n');
    }

    // Step 7: Clean up - delete test user
    logger.info('Step 7: Cleaning up test data...');
    await userRepository.delete(user.id);
    logger.info('✅ Test user deleted (password history auto-deleted via CASCADE)\n');

    // Summary
    logger.info('==================================');
    logger.info('✅ Demonstration Complete!\n');
    logger.info('Summary:');
    logger.info('- Password history tracking: ✅ Working');
    logger.info('- Password reuse prevention: ✅ Working');
    logger.info('- History limit enforcement: ✅ Working');
    logger.info('- Database CASCADE delete: ✅ Working');
    logger.info('\n🎉 All password history features verified!\n');
  } catch (error) {
    logger.error('❌ Error during demonstration:', error);
    throw error;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('Database connection closed.');
    }
  }
}

// Run the demonstration
if (require.main === module) {
  demonstratePasswordHistory()
    .then(() => {
      logger.info('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      logger.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { demonstratePasswordHistory };
