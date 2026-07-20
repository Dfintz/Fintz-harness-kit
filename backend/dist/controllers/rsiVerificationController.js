"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RsiVerificationController = void 0;
const rsi_1 = require("../services/rsi");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const BaseController_1 = require("./BaseController");
class RsiVerificationController extends BaseController_1.BaseController {
    rsiVerificationService;
    constructor() {
        super();
        this.rsiVerificationService = new rsi_1.RsiVerificationService();
    }
    initiateVerification = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            this.validateRequired(req.body, 'rsiHandle');
            const body = req.body;
            const result = await this.rsiVerificationService.initiateVerification(user.id, body.rsiHandle);
            if (!result.success) {
                if (result.isExternalError) {
                    throw new apiErrors_1.ServiceUnavailableError(result.error ?? 'RSI API is temporarily unavailable');
                }
                throw new apiErrors_1.ValidationError(result.error ?? 'Verification initiation failed');
            }
            logger_1.logger.info(`RSI verification initiated for user ${user.id}`);
            return {
                message: 'Verification initiated. Add the verification link to your RSI bio — ' +
                    "we'll detect it automatically.",
                verificationCode: result.verificationCode,
                verificationUrl: result.verificationUrl,
                expiresAt: result.expiresAt,
                rsiHandle: result.rsiHandle,
                instructions: [
                    '1. Log in to your RSI account at robertsspaceindustries.com',
                    '2. Edit your profile Short Bio',
                    '3. Paste the verification link anywhere in your bio',
                    '4. Save your profile changes',
                    "5. We'll detect it automatically within a couple of minutes — or click \"Verify Now\"",
                ],
            };
        });
    };
    completeVerification = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const result = await this.rsiVerificationService.completeVerification(user.id);
            if (!result.success) {
                throw new apiErrors_1.ValidationError(result.error ?? 'Verification failed');
            }
            logger_1.logger.info(`RSI verification completed for user ${user.id}, handle: ${result.rsiHandle}`);
            return {
                message: 'RSI account verification successful!',
                verified: result.verified,
                rsiHandle: result.rsiHandle,
                displayName: result.displayName,
            };
        });
    };
    getVerificationStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const status = await this.rsiVerificationService.getVerificationStatus(user.id);
            return status;
        });
    };
    removeVerification = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const result = await this.rsiVerificationService.removeVerification(user.id);
            if (!result.success) {
                throw new apiErrors_1.ValidationError(result.error ?? 'Failed to remove verification');
            }
            logger_1.logger.info(`RSI verification removed for user ${user.id}`);
            return {
                message: 'RSI verification removed successfully',
            };
        });
    };
    initiateOrganizationVerification = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            this.validateRequired(req.body, 'orgId');
            this.validateRequired(req.body, 'rsiOrgSid');
            const body = req.body;
            const result = await this.rsiVerificationService.initiateOrganizationVerification(user.id, body.orgId, body.rsiOrgSid);
            if (!result.success) {
                throw new apiErrors_1.ValidationError(result.error ?? 'Organization verification initiation failed');
            }
            logger_1.logger.info(`RSI organization verification initiated for org ${body.orgId} by user ${user.id}`);
            return {
                message: 'Verification initiated. Add the verification link to your RSI organization page — ' +
                    "we'll detect it automatically.",
                verificationCode: result.verificationCode,
                verificationUrl: result.verificationUrl,
                expiresAt: result.expiresAt,
                rsiOrgSid: result.rsiHandle,
                instructions: [
                    '1. Log in to your RSI account at robertsspaceindustries.com',
                    '2. Navigate to your organization page',
                    '3. Edit your organization settings',
                    '4. Paste the verification link into your Introduction, History, Manifesto, or Charter',
                    '5. Save your organization changes',
                    "6. We'll detect it automatically within a couple of minutes — or click \"Verify Now\"",
                ],
            };
        });
    };
    completeOrganizationVerification = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            this.validateRequired(req.body, 'orgId');
            const body = req.body;
            const result = await this.rsiVerificationService.completeOrganizationVerification(user.id, body.orgId);
            if (!result.success) {
                throw new apiErrors_1.ValidationError(result.error ?? 'Organization verification failed');
            }
            logger_1.logger.info(`RSI organization verification completed for org ${body.orgId}, SID: ${result.rsiHandle}`);
            return {
                message: 'RSI organization verification successful!',
                verified: result.verified,
                rsiOrgSid: result.rsiHandle,
                orgName: result.displayName,
            };
        });
    };
    verifyOrganizationByRank = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            this.validateRequired(req.body, 'orgId');
            this.validateRequired(req.body, 'rsiOrgSid');
            const body = req.body;
            const result = await this.rsiVerificationService.verifyOrganizationByRank(user.id, body.orgId, body.rsiOrgSid);
            if (!result.success) {
                throw new apiErrors_1.ValidationError(result.error ?? 'Rank-based organization verification failed');
            }
            logger_1.logger.info(`RSI organization verified by rank for org ${body.orgId} by user ${user.id}`);
            return {
                message: 'RSI organization verified by rank!',
                verified: result.verified,
                rsiOrgSid: result.rsiHandle,
                orgName: result.displayName,
            };
        });
    };
    verifyOrganizationOwnership = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            this.validateRequired(req.body, 'orgSid');
            const body = req.body;
            const result = await this.rsiVerificationService.verifyOrganizationOwnership(user.id, body.orgSid);
            if (!result.success) {
                throw new apiErrors_1.ValidationError(result.error ?? 'Organization verification failed');
            }
            return {
                orgSid: result.orgSid,
                orgName: result.orgName,
                isOwner: result.isOwner,
                isAdmin: result.isAdmin,
                userRank: result.userRank,
            };
        });
    };
    lookupRsiUser = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            this.validateRequired(req.params, 'handle');
            const { handle } = req.params;
            const result = await this.rsiVerificationService.lookupRsiUser(handle);
            if (!result.verified) {
                throw new apiErrors_1.NotFoundError('RSI user');
            }
            return {
                handle: result.handle,
                displayName: result.displayName,
                bio: result.bio,
                organizations: result.organizations,
            };
        });
    };
    lookupRsiOrganization = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            this.validateRequired(req.params, 'sid');
            const { sid } = req.params;
            const result = await this.rsiVerificationService.lookupRsiOrganization(sid);
            if (!result.found) {
                throw new apiErrors_1.NotFoundError('RSI organization');
            }
            return result.data;
        });
    };
    getAnalytics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            if (user.role !== 'admin') {
                throw new apiErrors_1.ForbiddenError('Admin access required');
            }
            return rsi_1.rsiVerificationAnalytics.getSnapshot();
        });
    };
}
exports.RsiVerificationController = RsiVerificationController;
//# sourceMappingURL=rsiVerificationController.js.map