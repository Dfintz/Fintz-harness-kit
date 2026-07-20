"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GDPRDataCategory = void 0;
exports.obfuscateUserData = obfuscateUserData;
exports.obfuscateRequestData = obfuscateRequestData;
exports.isEncryptionEnabled = isEncryptionEnabled;
exports.getDataRetentionDays = getDataRetentionDays;
exports.shouldDeleteData = shouldDeleteData;
exports.classifyDataField = classifyDataField;
exports.requiresEncryption = requiresEncryption;
exports.requiresObfuscation = requiresObfuscation;
exports.getUserPrimaryOrganization = getUserPrimaryOrganization;
const database_1 = require("../config/database");
const Organization_1 = require("../models/Organization");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const encryption_1 = require("./encryption");
function obfuscateUserData(user) {
    return {
        username: (0, encryption_1.obfuscateUsername)(user.username),
        email: (0, encryption_1.obfuscateEmail)(user.email),
        id: user.id,
    };
}
function obfuscateRequestData(req) {
    return {
        ipAddress: req.ip ? (0, encryption_1.obfuscateIP)(req.ip) : undefined,
        userAgent: req.headers?.['user-agent']
            ? (0, encryption_1.obfuscateUserAgent)(req.headers['user-agent'])
            : undefined,
        timestamp: new Date(),
    };
}
function isEncryptionEnabled() {
    return process.env.ENCRYPTION_ENABLED === 'true';
}
function getDataRetentionDays() {
    const days = parseInt(process.env.DATA_RETENTION_DAYS || '365', 10);
    return isNaN(days) ? 365 : days;
}
function shouldDeleteData(createdAt) {
    const retentionDays = getDataRetentionDays();
    const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays > retentionDays;
}
var GDPRDataCategory;
(function (GDPRDataCategory) {
    GDPRDataCategory["PERSONAL_IDENTIFIABLE"] = "personal_identifiable";
    GDPRDataCategory["AUTHENTICATION"] = "authentication";
    GDPRDataCategory["BEHAVIORAL"] = "behavioral";
    GDPRDataCategory["TECHNICAL"] = "technical";
    GDPRDataCategory["PROFILE"] = "profile";
    GDPRDataCategory["SENSITIVE"] = "sensitive";
})(GDPRDataCategory || (exports.GDPRDataCategory = GDPRDataCategory = {}));
function classifyDataField(fieldName) {
    const lowerField = fieldName.toLowerCase();
    if (lowerField.includes('ip') ||
        lowerField.includes('useragent') ||
        lowerField.includes('user-agent')) {
        return GDPRDataCategory.TECHNICAL;
    }
    if (lowerField.includes('password') ||
        lowerField.includes('secret') ||
        lowerField.includes('token')) {
        return GDPRDataCategory.AUTHENTICATION;
    }
    if (lowerField.includes('email') ||
        lowerField.includes('phone') ||
        lowerField.includes('address')) {
        return GDPRDataCategory.PERSONAL_IDENTIFIABLE;
    }
    if (lowerField.includes('log') ||
        lowerField.includes('access') ||
        lowerField.includes('activity')) {
        return GDPRDataCategory.BEHAVIORAL;
    }
    if (lowerField.includes('username') ||
        lowerField.includes('displayname') ||
        lowerField.includes('preference')) {
        return GDPRDataCategory.PROFILE;
    }
    return GDPRDataCategory.PROFILE;
}
function requiresEncryption(category) {
    return [
        GDPRDataCategory.PERSONAL_IDENTIFIABLE,
        GDPRDataCategory.AUTHENTICATION,
        GDPRDataCategory.SENSITIVE,
    ].includes(category);
}
function requiresObfuscation(category) {
    return [
        GDPRDataCategory.PERSONAL_IDENTIFIABLE,
        GDPRDataCategory.TECHNICAL,
        GDPRDataCategory.PROFILE,
    ].includes(category);
}
async function getUserPrimaryOrganization(userId) {
    const userOrganizationRepository = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    const organizationRepository = database_1.AppDataSource.getRepository(Organization_1.Organization);
    const userOrg = await userOrganizationRepository.findOne({
        where: { userId, isActive: true },
        order: { joinedAt: 'ASC' },
    });
    if (!userOrg) {
        return null;
    }
    const organization = await organizationRepository.findOne({
        where: { id: userOrg.organizationId },
    });
    return organization;
}
//# sourceMappingURL=gdprUtils.js.map