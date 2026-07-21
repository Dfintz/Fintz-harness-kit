/**
 * Play styles
 */
export type PlayStyle =
  | 'PVP'
  | 'PVE'
  | 'TRADING'
  | 'MINING'
  | 'EXPLORATION'
  | 'BOUNTY_HUNTING'
  | 'PIRACY'
  | 'RACING'
  | 'ROLEPLAY';

/**
 * User entity
 */
export interface User {
  id: string;
  username: string;
  displayName?: string;
  email: string;
  avatar?: string;
  discordId?: string;
  rsiHandle?: string;
  rsiVerified: boolean;
  timezone?: string;
  language?: string;
  bio?: string;
  location?: string;
  playStyle?: PlayStyle[];
  twoFactorEnabled: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastLoginAt?: Date | string;
}

/**
 * Extended user entity with counts (v2)
 */
export interface UserV2 extends User {
  shipCount: number;
  organizationCount: number;
  activeOrgId?: string;
}

/**
 * Public user profile (limited fields)
 */
export interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  rsiHandle?: string;
  rsiVerified: boolean;
  bio?: string;
  playStyle?: PlayStyle[];
  shipCount: number;
  organizationCount: number;
}

/**
 * Request to update user profile
 */
export interface UpdateUserRequest {
  displayName?: string;
  bio?: string;
  timezone?: string;
  language?: string;
  location?: string;
  playStyle?: PlayStyle[];
}

/**
 * Community member browse result — privacy-safe public subset.
 * Aligns 1:1 with PublicUserInfo in PublicUserCard.tsx.
 */
export interface CommunityMemberResult {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  rsiHandle?: string;
  rsiVerified?: boolean;
  shipCount?: number;
  organizationName?: string;
  createdAt: string;
}
