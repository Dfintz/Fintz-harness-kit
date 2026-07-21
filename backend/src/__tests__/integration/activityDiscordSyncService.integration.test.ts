import {
  Column,
  CreateDateColumn,
  DataSource,
  Entity,
  PrimaryColumn,
  Repository,
  UpdateDateColumn,
} from 'typeorm';

@Entity('activities')
class ActivitySyncStub {
  @PrimaryColumn('varchar')
  id!: string;

  @Column({ type: 'varchar', nullable: true })
  organizationId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  discordEventId?: string | null;

  @Column('simple-json', { nullable: true })
  voiceChannel?: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  voiceChannelId?: string | null;

  @Column({ type: 'varchar', nullable: true })
  voiceChannelName?: string | null;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt!: Date;
}

const testDataSource = new DataSource({
  type: 'sqlite',
  database: ':memory:',
  synchronize: true,
  logging: false,
  entities: [ActivitySyncStub],
});

const mockAppDataSource = {
  get isInitialized(): boolean {
    return testDataSource.isInitialized;
  },
  getRepository: jest.fn(() => testDataSource.getRepository(ActivitySyncStub)),
};

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ActivityDiscordSyncService } from '../../services/activity/ActivityDiscordSyncService';

describe('ActivityDiscordSyncService integration', () => {
  let service: ActivityDiscordSyncService;
  let activityRepository: Repository<ActivitySyncStub>;

  beforeAll(async () => {
    await testDataSource.initialize();
    activityRepository = testDataSource.getRepository(ActivitySyncStub);
  });

  afterAll(async () => {
    if (testDataSource.isInitialized) {
      await testDataSource.destroy();
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await activityRepository.clear();
    service = new ActivityDiscordSyncService();
  });

  it('persists discordEventId clearing as null in the database', async () => {
    await activityRepository.save({
      id: 'activity-1',
      organizationId: 'org-1',
      discordEventId: 'discord-event-1',
      voiceChannelId: 'voice-1',
      voiceChannelName: 'Ops Voice',
      voiceChannel: {
        channelId: 'voice-1',
        autoDelete: true,
      },
    });

    const result = await service.clearDiscordEventPointer('activity-1', 'org-1');

    const updated = await activityRepository.findOneBy({ id: 'activity-1' });
    expect(result).toBe(true);
    expect(updated).not.toBeNull();
    expect(updated?.discordEventId).toBeNull();
  });

  it('persists voice channel pointer clearing as null values in the database', async () => {
    await activityRepository.save({
      id: 'activity-2',
      organizationId: 'org-1',
      discordEventId: 'discord-event-2',
      voiceChannelId: 'voice-2',
      voiceChannelName: 'PvP Voice',
      voiceChannel: {
        channelId: 'voice-2',
        autoDelete: false,
      },
    });

    const result = await service.clearVoiceChannelPointers('activity-2', 'org-1');

    const updated = await activityRepository.findOneBy({ id: 'activity-2' });
    expect(result).toBe(true);
    expect(updated).not.toBeNull();
    expect(updated?.voiceChannelId).toBeNull();
    expect(updated?.voiceChannelName).toBeNull();
    expect(updated?.voiceChannel).toBeNull();
  });
});
