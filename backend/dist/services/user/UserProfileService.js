"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserProfileService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const data_source_1 = require("../../data-source");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
class UserProfileService {
    static UUID_IDENTIFIER_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    async findUserById(userId, selectFields) {
        const query = this.userRepository.createQueryBuilder('user').where('user.id = :userId', {
            userId,
        });
        if (selectFields && selectFields.length > 0) {
            query.select(selectFields.map(field => `user.${String(field)}`));
        }
        return query.getOne();
    }
    async getUserProfile(userId) {
        return this.findUserById(userId, [
            'id',
            'username',
            'email',
            'role',
            'activeOrgId',
            'createdAt',
            'updatedAt',
        ]);
    }
    async updateProfile(userId, profileData) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        const allowedFields = [
            'username',
            'email',
            'firstName',
            'lastName',
            'displayName',
            'bio',
            'location',
            'website',
            'avatar',
            'timezone',
            'language',
        ];
        const updates = {};
        for (const field of allowedFields) {
            if (profileData[field] !== undefined) {
                updates[field] = profileData[field];
            }
        }
        Object.assign(user, updates);
        return this.userRepository.save(user);
    }
    async updateAvatar(userId, avatarUrl) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        user.avatar = avatarUrl;
        return this.userRepository.save(user);
    }
    async updateDisplayName(userId, displayName) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        user.displayName = displayName;
        return this.userRepository.save(user);
    }
    async updateEmail(userId, newEmail) {
        const existingUser = await this.getUserByEmail(newEmail);
        if (existingUser && existingUser.id !== userId) {
            throw new apiErrors_1.ConflictError('Email address is already in use');
        }
        const user = await this.findUserById(userId);
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        user.email = newEmail;
        user.emailVerified = false;
        user.emailVerificationToken =
            this.generateVerificationToken();
        return this.userRepository.save(user);
    }
    async getUserByEmail(email) {
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.email = :email', { email })
            .getOne();
        return user ?? null;
    }
    async isEmailAvailable(email, excludeUserId) {
        const queryBuilder = this.userRepository
            .createQueryBuilder('user')
            .where('user.email = :email', { email });
        if (excludeUserId) {
            queryBuilder.andWhere('user.id != :excludeUserId', { excludeUserId });
        }
        const user = await queryBuilder.getOne();
        return !user;
    }
    async verifyEmail(userId, verificationToken) {
        const user = await this.findUserById(userId);
        if (!user) {
            return false;
        }
        if (user.emailVerificationToken !== verificationToken) {
            return false;
        }
        user.emailVerified = true;
        user.emailVerificationToken = null;
        user.emailVerifiedAt = new Date();
        await this.userRepository.save(user);
        return true;
    }
    async requestEmailVerification(userId) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        const verificationToken = this.generateVerificationToken();
        user.emailVerificationToken = verificationToken;
        user.emailVerificationRequestedAt = new Date();
        await this.userRepository.save(user);
        return verificationToken;
    }
    async updateUsername(userId, newUsername) {
        const isAvailable = await this.isUsernameAvailable(newUsername, userId);
        if (!isAvailable) {
            throw new apiErrors_1.ConflictError('Username is already taken');
        }
        const user = await this.findUserById(userId);
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        const oldUsername = user.username;
        user.username = newUsername;
        user.previousUsernames = user.previousUsernames ?? [];
        user.previousUsernames.push({
            username: oldUsername,
            changedAt: new Date(),
        });
        return this.userRepository.save(user);
    }
    async isUsernameAvailable(username, excludeUserId) {
        const queryBuilder = this.userRepository
            .createQueryBuilder('user')
            .where('user.username = :username', { username });
        if (excludeUserId) {
            queryBuilder.andWhere('user.id != :excludeUserId', { excludeUserId });
        }
        const user = await queryBuilder.getOne();
        return !user;
    }
    async getUsernameHistory(userId) {
        const user = await this.findUserById(userId, ['previousUsernames']);
        return (user?.previousUsernames ?? []);
    }
    async getProfileCompletion(userId) {
        const user = await this.findUserById(userId);
        if (!user) {
            return 0;
        }
        const fields = [
            'username',
            'email',
            'firstName',
            'lastName',
            'bio',
            'location',
            'avatar',
            'emailVerified',
        ];
        let completedFields = 0;
        for (const field of fields) {
            if (user[field]) {
                completedFields++;
            }
        }
        return Math.round((completedFields / fields.length) * 100);
    }
    async getProfileActivity(userId) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        const profileCompletion = await this.getProfileCompletion(userId);
        return {
            profileViews: user.profileViews ?? 0,
            lastProfileUpdate: user.updatedAt,
            joinedDate: user.createdAt,
            emailVerified: (user.emailVerified ??
                false),
            profileCompletion,
        };
    }
    async updateProfileVisibility(userId, visibilitySettings) {
        const user = await this.findUserById(userId);
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        user.profileSettings = {
            ...user.profileSettings,
            ...visibilitySettings,
        };
        return this.userRepository.save(user);
    }
    async findUserByIdentifier(identifier) {
        const normalizedIdentifier = identifier.trim();
        const query = this.userRepository.createQueryBuilder('user');
        if (UserProfileService.UUID_IDENTIFIER_REGEX.test(normalizedIdentifier)) {
            query.where('user.id = :identifier', { identifier: normalizedIdentifier });
        }
        else {
            query.where('user.username = :identifier', { identifier: normalizedIdentifier });
        }
        return query.getOne();
    }
    generateVerificationToken() {
        return node_crypto_1.default.randomBytes(32).toString('hex');
    }
    async incrementProfileViews(userId, viewerUserId) {
        if (userId === viewerUserId) {
            return;
        }
        await this.userRepository
            .createQueryBuilder()
            .update(User_1.User)
            .set({
            profileViews: () => 'COALESCE("profileViews", 0) + 1',
            lastProfileViewAt: () => 'CURRENT_TIMESTAMP',
        })
            .where('id = :userId', { userId })
            .execute();
    }
    async getPublicProfile(identifier, requestingUserId) {
        const targetUser = await this.findUserByIdentifier(identifier);
        if (!targetUser) {
            return null;
        }
        const isOwnProfile = requestingUserId === targetUser.id;
        const privacy = targetUser.preferences?.privacy ?? {};
        const visibility = privacy.profileVisibility ?? 'public';
        if (!isOwnProfile && visibility === 'private') {
            return {
                id: targetUser.id,
                username: targetUser.username,
                displayName: targetUser.displayName,
                avatar: targetUser.avatar,
                isPrivateProfile: true,
                showShips: false,
                showActivity: false,
            };
        }
        const publicProfile = {
            id: targetUser.id,
            username: targetUser.username,
            displayName: targetUser.displayName,
            avatar: targetUser.avatar,
            joinedAt: targetUser.createdAt,
            createdAt: targetUser.createdAt,
            lastActiveAt: targetUser.lastLoginAt,
            isPrivateProfile: false,
            showShips: isOwnProfile || privacy.showPublicShips !== false,
            showActivity: isOwnProfile || privacy.showActivity !== false,
            showRsiInfo: isOwnProfile || privacy.showRsiInfo !== false,
            showVerifiedBadge: isOwnProfile || privacy.showVerifiedBadge !== false,
            showOrganizations: isOwnProfile || privacy.showOrganizations !== false,
            showScStats: isOwnProfile || privacy.showScStats === true,
        };
        if (isOwnProfile || privacy.showBio !== false) {
            publicProfile.bio = targetUser.bio;
        }
        if (publicProfile.showRsiInfo) {
            publicProfile.rsiHandle = targetUser.rsiHandle;
        }
        if (publicProfile.showVerifiedBadge) {
            publicProfile.rsiVerified = targetUser.rsiVerified;
        }
        if (isOwnProfile) {
            publicProfile.email = targetUser.email;
            publicProfile.role = targetUser.role;
            publicProfile.rsiHandle = targetUser.rsiHandle;
            publicProfile.rsiVerified = targetUser.rsiVerified;
        }
        if (publicProfile.showOrganizations) {
            const memQb = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership)
                .createQueryBuilder('mem')
                .innerJoinAndSelect('mem.organization', 'org')
                .innerJoinAndSelect('mem.role', 'role')
                .where('mem."userId" = :targetUserId', { targetUserId: targetUser.id })
                .andWhere('mem."isActive" = true')
                .andWhere('org."isArchived" = false');
            if (!isOwnProfile) {
                memQb.andWhere(`(
          org.settings IS NULL
          OR org.settings->>'visibility' IS NULL
          OR org.settings->>'visibility' = 'public'
        )`);
            }
            const memberships = await memQb.orderBy('role.priority', 'DESC').getMany();
            publicProfile.organizations = memberships.map(mem => ({
                orgId: mem.organizationId,
                orgName: mem.organization.name,
                orgLogo: mem.organization.logoUrl ?? undefined,
                roleName: mem.role?.name ?? 'Member',
            }));
        }
        else {
            publicProfile.organizations = [];
        }
        return publicProfile;
    }
}
exports.UserProfileService = UserProfileService;
//# sourceMappingURL=UserProfileService.js.map