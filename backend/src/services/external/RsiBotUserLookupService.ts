import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { User } from '../../models/User';

/**
 * Bot-facing lookup helper for resolving platform user ids from Discord ids.
 */
export class RsiBotUserLookupService {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  public isAvailable(): boolean {
    return AppDataSource.isInitialized;
  }

  public async getPlatformUserIdByDiscordId(discordUserId: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const linkedUser = await this.userRepository
      .createQueryBuilder('user')
      .select('user.id', 'id')
      .where('user.discordId = :discordId', { discordId: discordUserId })
      .getRawOne<{ id: string }>();

    return linkedUser?.id ?? null;
  }
}

export const rsiBotUserLookupService = new RsiBotUserLookupService();

