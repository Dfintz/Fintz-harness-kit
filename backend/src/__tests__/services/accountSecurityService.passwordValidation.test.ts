/**
 * Tests for AccountSecurityService password validation
 */

import { AccountSecurityService, PasswordValidationResult } from '../../services/security/core/AccountSecurityService';

describe('AccountSecurityService - Password Validation', () => {
    let securityService: AccountSecurityService;

    beforeAll(() => {
        // Get the singleton instance
        securityService = AccountSecurityService.getInstance();
    });

    describe('getPasswordPolicy', () => {
        it('should return the password policy configuration', () => {
            const policy = securityService.getPasswordPolicy();
            
            expect(policy).toBeDefined();
            expect(policy.minLength).toBe(12);
            expect(policy.maxLength).toBe(128);
            expect(policy.requireUppercase).toBe(true);
            expect(policy.requireLowercase).toBe(true);
            expect(policy.requireNumbers).toBe(true);
            expect(policy.requireSpecialChars).toBe(true);
            expect(policy.disallowCommonPasswords).toBe(true);
            expect(policy.disallowUserInfo).toBe(true);
        });

        it('should return a copy of the policy (not the original)', () => {
            const policy1 = securityService.getPasswordPolicy();
            const policy2 = securityService.getPasswordPolicy();
            
            expect(policy1).not.toBe(policy2);
            expect(policy1).toEqual(policy2);
        });
    });

    describe('validatePassword', () => {
        describe('length requirements', () => {
            it('should reject passwords shorter than minimum length', () => {
                const result = securityService.validatePassword('Short1!');
                
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must be at least 12 characters long');
            });

            it('should reject passwords longer than maximum length', () => {
                const longPassword = 'A'.repeat(129) + 'a1!';
                const result = securityService.validatePassword(longPassword);
                
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must not exceed 128 characters');
            });

            it('should accept passwords within length bounds', () => {
                const result = securityService.validatePassword('ValidPass123!');
                
                expect(result.errors).not.toContain('Password must be at least 12 characters long');
                expect(result.errors).not.toContain('Password must not exceed 128 characters');
            });
        });

        describe('character class requirements', () => {
            it('should require uppercase letters', () => {
                const result = securityService.validatePassword('allowercase123!');
                
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must contain at least one uppercase letter');
            });

            it('should require lowercase letters', () => {
                const result = securityService.validatePassword('ALLUPPERCASE123!');
                
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must contain at least one lowercase letter');
            });

            it('should require numbers', () => {
                const result = securityService.validatePassword('NoNumbersHere!@');
                
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must contain at least one number');
            });

            it('should require special characters', () => {
                const result = securityService.validatePassword('NoSpecialChar123');
                
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Password must contain at least one special character (!@#$%^&*...)');
            });

            it('should accept passwords with all required character classes', () => {
                const result = securityService.validatePassword('ValidPass123!');
                
                expect(result.errors).not.toContain('Password must contain at least one uppercase letter');
                expect(result.errors).not.toContain('Password must contain at least one lowercase letter');
                expect(result.errors).not.toContain('Password must contain at least one number');
                expect(result.errors).not.toContain('Password must contain at least one special character (!@#$%^&*...)');
            });
        });

        describe('common password check', () => {
            it('should reject common passwords', () => {
                const commonPasswords = ['password', 'password123', 'qwerty', 'admin'];
                
                for (const common of commonPasswords) {
                    const result = securityService.validatePassword(common);
                    expect(result.errors).toContain('Password is too common. Please choose a more unique password');
                }
            });

            it('should reject common passwords case-insensitively', () => {
                const result = securityService.validatePassword('PASSWORD');
                
                expect(result.errors).toContain('Password is too common. Please choose a more unique password');
            });
        });

        describe('user info check', () => {
            it('should reject passwords containing username', () => {
                const result = securityService.validatePassword('MyUsername123!@', {
                    username: 'username'
                });
                
                expect(result.errors).toContain('Password cannot contain your username');
            });

            it('should reject passwords containing email prefix', () => {
                const result = securityService.validatePassword('JohnSmith123!@', {
                    email: 'johnsmith@example.com'
                });
                
                expect(result.errors).toContain('Password cannot contain your email address');
            });

            it('should not reject password if userInfo is not provided', () => {
                const result = securityService.validatePassword('ValidPass123!');
                
                expect(result.errors).not.toContain('Password cannot contain your username');
                expect(result.errors).not.toContain('Password cannot contain your email address');
            });
        });

        describe('sequential character check', () => {
            it('should warn about sequential characters', () => {
                const result = securityService.validatePassword('TestAbc123!@#');
                
                expect(result.errors).toContain('Password should not contain sequential characters (e.g., "abc", "123")');
            });

            it('should warn about keyboard sequences', () => {
                const result = securityService.validatePassword('TestQwer123!@#');
                
                expect(result.errors).toContain('Password should not contain sequential characters (e.g., "abc", "123")');
            });
        });

        describe('repeated character check', () => {
            it('should warn about repeated characters', () => {
                const result = securityService.validatePassword('Testttt123!@#');
                
                expect(result.errors).toContain('Password should not contain repeated characters (e.g., "aaa", "111")');
            });
        });

        describe('password strength scoring', () => {
            it('should score weak passwords correctly', () => {
                const result = securityService.validatePassword('short');
                
                expect(result.strength).toBe('weak');
                expect(result.score).toBeLessThan(40);
            });

            it('should score fair passwords correctly', () => {
                const result = securityService.validatePassword('FairPass12');
                
                expect(['weak', 'fair']).toContain(result.strength);
            });

            it('should score good passwords correctly', () => {
                const result = securityService.validatePassword('GoodPass123!');
                
                expect(['fair', 'good', 'strong']).toContain(result.strength);
            });

            it('should score strong passwords correctly', () => {
                const result = securityService.validatePassword('V3ryStr0ngP@ssword!2024');
                
                expect(result.isValid).toBe(true);
                expect(['good', 'strong']).toContain(result.strength);
                expect(result.score).toBeGreaterThanOrEqual(60);
            });

            it('should give bonus for longer passwords', () => {
                const shortResult = securityService.validatePassword('ValidPass123!');
                const longResult = securityService.validatePassword('ThisIsAMuchLongerPassword123!@#');
                
                expect(longResult.score).toBeGreaterThan(shortResult.score);
            });

            it('should cap score at 100', () => {
                const result = securityService.validatePassword('ExtremelyStr0ng&Complex#Password@WithManySpecialChars!2024');
                
                expect(result.score).toBeLessThanOrEqual(100);
            });
        });

        describe('valid password acceptance', () => {
            it('should accept a valid password meeting all requirements', () => {
                const result = securityService.validatePassword('MySecure#Pass99!');
                
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should accept complex passwords', () => {
                const result = securityService.validatePassword('C0mpl3x!P@ssw0rd#2024');
                
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
