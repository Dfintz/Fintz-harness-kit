import bcrypt from 'bcrypt';

import { AppDataSource } from '../../data-source';
import { User } from '../../models/User';
import { AccountSecurityService } from '../security/core/AccountSecurityService';

/**
 * User Authentication Service
 * Handles authentication, credentials, and password management
 */
export class UserAuthenticationService {
  private userRepository = AppDataSource.getRepository(User);

  // ==================== CREDENTIAL VALIDATION ====================

  /**
   * Validate user credentials using bcrypt password comparison
   * @param username Username to validate
   * @param password Plain text password to compare
   * @returns User object if credentials are valid, null otherwise
   */
  async validateCredentials(username: string, password: string): Promise<User | null> {
    // Need to explicitly select password field since it's excluded by default
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.username = :username', { username })
      .addSelect('user.password')
      .getOne();

    if (!user?.password) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return null;
    }

    // Remove password from returned user object
    const authenticatedUser: User = { ...user, password: undefined };
    return authenticatedUser;
  }

  /**
   * Validate user credentials by email
   * @param email Email to validate
   * @param password Plain text password to compare
   * @returns User object if credentials are valid, null otherwise
   */
  async validateCredentialsByEmail(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.password')
      .getOne();

    if (!user?.password) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return null;
    }

    // Remove password from returned user object
    const authenticatedUser: User = { ...user, password: undefined };
    return authenticatedUser;
  }

  // ==================== PASSWORD MANAGEMENT ====================

  /**
   * Update user password with old password verification
   * @param userId User ID
   * @param oldPassword Current password for verification
   * @param newPassword New password (will be hashed)
   * @returns Promise resolving when password is updated
   * @throws Error if old password is incorrect or password is in history
   */
  async updatePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    // Get user with password
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .addSelect('user.password')
      .getOne();

    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password if user has one
    if (user.password) {
      const isValidPassword = await bcrypt.compare(oldPassword, user.password);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }
    }

    // Check password history to prevent reuse
    const securityService = AccountSecurityService.getInstance();
    const isPasswordAllowed = await securityService.checkPasswordHistory(userId, newPassword);

    if (!isPasswordAllowed) {
      throw new Error(AccountSecurityService.PASSWORD_REUSE_ERROR);
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(userId, { password: hashedPassword });

    // Add password to history
    await securityService.addPasswordToHistory(userId, hashedPassword);
  }

  /**
   * Set user password (for new users or password reset)
   * @param userId User ID
   * @param newPassword New password (will be hashed)
   * @returns Promise resolving when password is set
   * @throws Error if password is in history
   */
  async setPassword(userId: string, newPassword: string): Promise<void> {
    // Check password history to prevent reuse
    const securityService = AccountSecurityService.getInstance();
    const isPasswordAllowed = await securityService.checkPasswordHistory(userId, newPassword);

    if (!isPasswordAllowed) {
      throw new Error(AccountSecurityService.PASSWORD_REUSE_ERROR);
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.userRepository.update(userId, { password: hashedPassword });

    // Add password to history
    await securityService.addPasswordToHistory(userId, hashedPassword);
  }

  /**
   * Hash password for storage
   * @param password Plain text password
   * @returns Hashed password
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  /**
   * Verify password against hash
   * @param password Plain text password
   * @param hash Hashed password
   * @returns True if password matches hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Get user by ID with password field included
   * Since password field has `select: false` in the User model, this method
   * explicitly selects it using query builder
   * @param userId User ID
   * @returns User with password field, or null if not found
   */
  async getUserWithPassword(userId: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.id = :userId', { userId })
      .addSelect('user.password')
      .getOne();
  }

  // ==================== SECURITY OPERATIONS ====================

  /**
   * Check if user has password set
   * @param userId User ID
   * @returns True if user has password
   */
  async hasPassword(userId: string): Promise<boolean> {
    const user = await this.getUserWithPassword(userId);
    return user?.password ? true : false;
  }

  /**
   * Get password last changed date
   * @param userId User ID
   * @returns Date when password was last changed
   */
  async getPasswordLastChanged(userId: string): Promise<Date | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['passwordChangedAt'],
    });

    return user?.passwordChangedAt || null;
  }

  /**
   * Update password changed timestamp
   * @param userId User ID
   */
  async updatePasswordChangedAt(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      passwordChangedAt: new Date(),
    });
  }

  /**
   * Check if password needs to be changed (based on age)
   * @param userId User ID
   * @param maxAgeInDays Maximum password age in days
   * @returns True if password needs to be changed
   */
  async passwordNeedsChange(userId: string, maxAgeInDays: number = 90): Promise<boolean> {
    const lastChanged = await this.getPasswordLastChanged(userId);

    if (!lastChanged) {
      return true; // No password change date means it should be changed
    }

    const ageInMs = Date.now() - lastChanged.getTime();
    const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

    return ageInDays > maxAgeInDays;
  }

  // ==================== LOGIN TRACKING ====================

  /**
   * Record successful login
   * @param userId User ID
   * @param ipAddress IP address of login
   * @param userAgent User agent string
   */
  async recordLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    void userAgent;

    const updates: Partial<User> = {
      lastLoginAt: new Date(),
      loginCount: (user.loginCount || 0) + 1,
    };

    if (ipAddress) {
      updates.lastLoginIp = ipAddress;
    }

    await this.userRepository.update(userId, updates);
  }

  /**
   * Record failed login attempt
   * @param usernameOrEmail Username or email attempted
   * @param ipAddress IP address of attempt
   */
  async recordFailedLogin(usernameOrEmail: string, ipAddress?: string): Promise<void> {
    // This could be logged to a separate failed login attempts table
    // For now, we'll just increment a counter on the user if they exist
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

  /**
   * Reset failed login attempts
   * @param userId User ID
   */
  async resetFailedLoginAttempts(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      failedLoginAttempts: 0,
      lastFailedLoginAt: undefined,
    });
  }

  /**
   * Check if account is locked due to failed attempts
   * @param userId User ID
   * @param maxAttempts Maximum failed attempts before lock
   * @param lockoutDurationMinutes Lockout duration in minutes
   * @returns True if account is locked
   */
  async isAccountLocked(
    userId: string,
    maxAttempts: number = 5,
    lockoutDurationMinutes: number = 30
  ): Promise<boolean> {
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

    const lockoutEndTime = new Date(
      user.lastFailedLoginAt.getTime() + lockoutDurationMinutes * 60 * 1000
    );
    return new Date() < lockoutEndTime;
  }

  // ==================== TWO-FACTOR AUTHENTICATION ====================

  /**
   * Enable two-factor authentication for user
   * @param userId User ID
   * @param secret 2FA secret
   */
  async enableTwoFactorAuth(userId: string, secret: string): Promise<void> {
    await this.userRepository.update(userId, {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
    });
  }

  /**
   * Disable two-factor authentication for user
   * @param userId User ID
   */
  async disableTwoFactorAuth(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      twoFactorSecret: undefined,
      twoFactorEnabled: false,
    });
  }

  /**
   * Check if user has two-factor authentication enabled
   * @param userId User ID
   * @returns True if 2FA is enabled
   */
  async hasTwoFactorAuth(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['twoFactorEnabled'],
    });

    return user?.twoFactorEnabled || false;
  }

  /**
   * Get two-factor authentication secret
   * @param userId User ID
   * @returns 2FA secret or null
   */
  async getTwoFactorSecret(userId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['twoFactorSecret'],
    });

    return user?.twoFactorSecret || null;
  }
}

