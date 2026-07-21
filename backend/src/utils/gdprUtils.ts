import { Repository } from 'typeorm';

import { AppDataSource } from '../config/database';
import { Organization } from '../models/Organization';
import { OrganizationMembership } from '../models/OrganizationMembership';

import { obfuscateEmail, obfuscateIP, obfuscateUserAgent, obfuscateUsername } from './encryption';

/**
 * GDPR-compliant utilities for handling personal data
 * These utilities help ensure compliance with data protection requirements
 */

/**
 * Obfuscate user information for display purposes
 * Returns a safe version of user data that can be shown in logs or UI
 */
export interface ObfuscatedUserData {
  username: string;
  email: string;
  id: string;
}

export function obfuscateUserData(user: {
  username: string;
  email: string;
  id: string;
}): ObfuscatedUserData {
  return {
    username: obfuscateUsername(user.username),
    email: obfuscateEmail(user.email),
    id: user.id, // IDs are typically not PII and can be shown
  };
}

/**
 * Obfuscate request metadata for logging
 * Ensures IP addresses and user agents are obfuscated in logs
 */
export interface ObfuscatedRequestData {
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export function obfuscateRequestData(req: {
  ip?: string;
  headers?: { 'user-agent'?: string };
}): ObfuscatedRequestData {
  return {
    ipAddress: req.ip ? obfuscateIP(req.ip) : undefined,
    userAgent: req.headers?.['user-agent']
      ? obfuscateUserAgent(req.headers['user-agent'])
      : undefined,
    timestamp: new Date(),
  };
}

/**
 * Check if encryption is enabled in the environment
 */
export function isEncryptionEnabled(): boolean {
  return process.env.ENCRYPTION_ENABLED === 'true';
}

/**
 * Get data retention policy from environment
 * Returns number of days to retain personal data
 * Default: 365 days (1 year)
 */
export function getDataRetentionDays(): number {
  const days = parseInt(process.env.DATA_RETENTION_DAYS || '365', 10);
  return isNaN(days) ? 365 : days;
}

/**
 * Calculate if data should be deleted based on retention policy
 */
export function shouldDeleteData(createdAt: Date): boolean {
  const retentionDays = getDataRetentionDays();
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays > retentionDays;
}

/**
 * GDPR data categories for classification
 */
export enum GDPRDataCategory {
  PERSONAL_IDENTIFIABLE = 'personal_identifiable', // Email, phone, address
  AUTHENTICATION = 'authentication', // Passwords, 2FA secrets
  BEHAVIORAL = 'behavioral', // Access logs, activity tracking
  TECHNICAL = 'technical', // IP addresses, user agents
  PROFILE = 'profile', // Username, preferences, settings
  SENSITIVE = 'sensitive', // Special category data
}

/**
 * Classify data field by GDPR category
 */
export function classifyDataField(fieldName: string): GDPRDataCategory {
  const lowerField = fieldName.toLowerCase();

  // Check technical first (before address) to handle ipaddress correctly
  if (
    lowerField.includes('ip') ||
    lowerField.includes('useragent') ||
    lowerField.includes('user-agent')
  ) {
    return GDPRDataCategory.TECHNICAL;
  }

  if (
    lowerField.includes('password') ||
    lowerField.includes('secret') ||
    lowerField.includes('token')
  ) {
    return GDPRDataCategory.AUTHENTICATION;
  }

  if (
    lowerField.includes('email') ||
    lowerField.includes('phone') ||
    lowerField.includes('address')
  ) {
    return GDPRDataCategory.PERSONAL_IDENTIFIABLE;
  }

  if (
    lowerField.includes('log') ||
    lowerField.includes('access') ||
    lowerField.includes('activity')
  ) {
    return GDPRDataCategory.BEHAVIORAL;
  }

  if (
    lowerField.includes('username') ||
    lowerField.includes('displayname') ||
    lowerField.includes('preference')
  ) {
    return GDPRDataCategory.PROFILE;
  }

  return GDPRDataCategory.PROFILE; // Default to profile data
}

/**
 * Check if a field requires encryption based on GDPR category
 */
export function requiresEncryption(category: GDPRDataCategory): boolean {
  return [
    GDPRDataCategory.PERSONAL_IDENTIFIABLE,
    GDPRDataCategory.AUTHENTICATION,
    GDPRDataCategory.SENSITIVE,
  ].includes(category);
}

/**
 * Check if a field requires obfuscation in logs
 */
export function requiresObfuscation(category: GDPRDataCategory): boolean {
  return [
    GDPRDataCategory.PERSONAL_IDENTIFIABLE,
    GDPRDataCategory.TECHNICAL,
    GDPRDataCategory.PROFILE,
  ].includes(category);
}

/**
 * Get the user's primary organization for GDPR settings
 * This is a shared utility to avoid duplication across services
 * Returns the user's earliest (first joined) organization
 * @param userId User ID
 * @returns Organization or null if not found
 */
export async function getUserPrimaryOrganization(userId: string): Promise<Organization | null> {
  const userOrganizationRepository: Repository<OrganizationMembership> =
    AppDataSource.getRepository(OrganizationMembership);
  const organizationRepository: Repository<Organization> =
    AppDataSource.getRepository(Organization);

  const userOrg = await userOrganizationRepository.findOne({
    where: { userId, isActive: true },
    order: { joinedAt: 'ASC' }, // Get the earliest organization they joined
  });

  if (!userOrg) {
    return null;
  }

  const organization = await organizationRepository.findOne({
    where: { id: userOrg.organizationId },
  });

  return organization;
}
