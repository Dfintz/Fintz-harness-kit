import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { OrgFocusPreference } from '../../models/OrgFocusPreference';
import { UserFocusPreference } from '../../models/UserFocusPreference';
import { ValidationError } from '../../utils/apiErrors';

/**
 * Type for focus classification (Primary or Secondary)
 */
export type FocusType = 'Primary' | 'Secondary';

/**
 * Available focus values for Star Citizen gameplay activities
 */
export type FocusValue =
  | 'Bounty Hunting'
  | 'Engineering'
  | 'Exploration'
  | 'Medical'
  | 'Piracy'
  | 'Infiltration'
  | 'Resources'
  | 'Scouting'
  | 'Security'
  | 'Smuggling'
  | 'Trading'
  | 'Transport';

/**
 * User focus configuration with primary and secondary focuses
 */
export interface UserFocus {
  userId: string;
  primaryFocuses: FocusValue[];
  secondaryFocuses: FocusValue[];
}

/**
 * Organization focus configuration
 */
export interface OrgFocus {
  orgId: string;
  focuses: FocusValue[];
}

/**
 * Limits for the number of focuses users and organizations can set
 */
const FOCUS_LIMITS = {
  user: { primary: 3, secondary: 3 },
  org: 2,
};

/**
 * Complete list of available focus values
 */
const focusList: FocusValue[] = [
  'Bounty Hunting',
  'Engineering',
  'Exploration',
  'Medical',
  'Piracy',
  'Infiltration',
  'Resources',
  'Scouting',
  'Security',
  'Smuggling',
  'Trading',
  'Transport',
];

/**
 * Service for managing user and organization gameplay focuses
 * Persists focus preferences to PostgreSQL via TypeORM
 */
export class FocusService {
  private get userRepo(): Repository<UserFocusPreference> {
    return AppDataSource.getRepository(UserFocusPreference);
  }

  private get orgRepo(): Repository<OrgFocusPreference> {
    return AppDataSource.getRepository(OrgFocusPreference);
  }

  /**
   * Get the complete list of available focus values
   */
  getFocusList(): FocusValue[] {
    return focusList;
  }

  /**
   * Set user's primary and secondary focuses
   */
  async setUserFocus(
    userId: string,
    primary: FocusValue[],
    secondary: FocusValue[]
  ): Promise<void> {
    if (
      primary.length > FOCUS_LIMITS.user.primary ||
      secondary.length > FOCUS_LIMITS.user.secondary
    ) {
      throw new ValidationError(
        `Users can set up to ${FOCUS_LIMITS.user.primary} primary and ${FOCUS_LIMITS.user.secondary} secondary focuses.`
      );
    }

    let record = await this.userRepo.findOneBy({ userId });
    if (record) {
      record.primaryFocuses = primary;
      record.secondaryFocuses = secondary;
    } else {
      record = this.userRepo.create({
        userId,
        primaryFocuses: primary,
        secondaryFocuses: secondary,
      });
    }
    await this.userRepo.save(record);
  }

  /**
   * Set organization's focus values
   */
  async setOrgFocus(orgId: string, focuses: FocusValue[]): Promise<void> {
    if (focuses.length > FOCUS_LIMITS.org) {
      throw new ValidationError(`Organizations can set up to ${FOCUS_LIMITS.org} focuses.`);
    }

    let record = await this.orgRepo.findOneBy({ orgId });
    if (record) {
      record.focuses = focuses;
    } else {
      record = this.orgRepo.create({ orgId, focuses });
    }
    await this.orgRepo.save(record);
  }

  /**
   * Get user's focus configuration
   */
  async getUserFocus(userId: string): Promise<UserFocus | undefined> {
    const record = await this.userRepo.findOneBy({ userId });
    if (!record) {
      return undefined;
    }
    return {
      userId: record.userId,
      primaryFocuses: record.primaryFocuses as FocusValue[],
      secondaryFocuses: record.secondaryFocuses as FocusValue[],
    };
  }

  /**
   * Get organization's focus configuration
   */
  async getOrgFocus(orgId: string): Promise<OrgFocus | undefined> {
    const record = await this.orgRepo.findOneBy({ orgId });
    if (!record) {
      return undefined;
    }
    return {
      orgId: record.orgId,
      focuses: record.focuses as FocusValue[],
    };
  }
}

