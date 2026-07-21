// Mock TypeORM before imports
import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';
const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

import { BriefingService } from '../../services/content';
import { StarCommsContextSyncService } from '../../services/communication/starcomms';
import { BriefingClassification, BriefingStatus } from '../../models/Briefing';

describe('BriefingService', () => {
  let briefingService: BriefingService;
  let mockBriefings: any[];
  let syncBriefingContextSpy: jest.SpiedFunction<
    StarCommsContextSyncService['syncBriefingContext']
  >;
  const TEST_ORG_ID = 'org-123';

  beforeEach(() => {
    // Reset mock data
    mockBriefings = [];

    // Setup Briefing repository mock with smart data handling
    const mockRepo = createMockRepositoryWithData(mockBriefings);
    mockDataSource.getRepository.mockReturnValue(mockRepo);

    syncBriefingContextSpy = jest
      .spyOn(StarCommsContextSyncService.prototype, 'syncBriefingContext')
      .mockResolvedValue(undefined);

    briefingService = new BriefingService();
    jest.clearAllMocks();
  });

  describe('createBriefing', () => {
    it('should create a new briefing with organizationId', async () => {
      const briefingData = {
        title: 'Test Briefing',
        creatorId: 'user-1',
        elements: [],
      };

      const briefing = await briefingService.createBriefing(TEST_ORG_ID, briefingData);

      expect(briefing).toBeDefined();
      expect(briefing.title).toBe('Test Briefing');
    });

    it('should trigger StarComms briefing sync after creation', async () => {
      const briefingData = {
        title: 'Sync Briefing',
        creatorId: 'user-2',
        status: BriefingStatus.DRAFT,
        classification: BriefingClassification.CONFIDENTIAL,
        operationIds: ['op-1'],
        elements: [],
      };

      const briefing = await briefingService.createBriefing(TEST_ORG_ID, briefingData);

      expect(syncBriefingContextSpy).toHaveBeenCalledTimes(1);
      expect(syncBriefingContextSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: TEST_ORG_ID,
          briefingId: briefing.id,
          title: 'Sync Briefing',
          status: BriefingStatus.DRAFT,
        })
      );
    });

    it('should not fail createBriefing when StarComms sync rejects', async () => {
      syncBriefingContextSpy.mockRejectedValueOnce(new Error('StarComms unavailable'));

      await expect(
        briefingService.createBriefing(TEST_ORG_ID, {
          title: 'Resilient Briefing',
          creatorId: 'user-3',
          elements: [],
        })
      ).resolves.toBeDefined();
    });
  });

  describe('getBriefingById', () => {
    it('should return a briefing by ID scoped to organization', async () => {
      // Pre-populate test data
      mockBriefings.push({
        id: 'briefing-1',
        title: 'Test Briefing',
        status: BriefingStatus.DRAFT,
        organizationId: TEST_ORG_ID,
      });

      const briefing = await briefingService.getBriefingById('briefing-1', TEST_ORG_ID);

      expect(briefing).toBeDefined();
      expect(briefing?.id).toBe('briefing-1');
    });

    it('should return null for non-existent briefing', async () => {
      const briefing = await briefingService.getBriefingById('non-existent', TEST_ORG_ID);

      expect(briefing).toBeNull();
    });

    it('should return null for briefing in different organization', async () => {
      // Pre-populate test data with a different org
      mockBriefings.push({
        id: 'briefing-1',
        title: 'Test Briefing',
        status: BriefingStatus.DRAFT,
        organizationId: 'other-org-456',
      });

      const briefing = await briefingService.getBriefingById('briefing-1', TEST_ORG_ID);

      expect(briefing).toBeNull();
    });
  });

  describe('addElement', () => {
    it('should add an element to a briefing', async () => {
      // Pre-populate test data
      mockBriefings.push({
        id: 'briefing-1',
        title: 'Test Briefing',
        status: BriefingStatus.DRAFT,
        elements: [],
        organizationId: TEST_ORG_ID,
      });

      const briefing = await briefingService.addElement('briefing-1', TEST_ORG_ID, {
        type: 'text',
        position: { x: 100, y: 100 },
        data: { content: 'Test element' },
      });

      expect(briefing).toBeDefined();
      expect(briefing?.elements).toBeDefined();
    });
  });

  describe('updateElement', () => {
    it('should update an element in a briefing', async () => {
      // Pre-populate test data with briefing containing element
      mockBriefings.push({
        id: 'briefing-1',
        title: 'Test Briefing',
        status: BriefingStatus.DRAFT,
        elements: [
          {
            id: 'element-1',
            type: 'text',
            position: { x: 100, y: 100 },
            data: { content: 'Original content' },
          },
        ],
        organizationId: TEST_ORG_ID,
      });

      const updates = {
        position: { x: 200, y: 200 },
      };

      const briefing = await briefingService.updateElement(
        'briefing-1',
        TEST_ORG_ID,
        'element-1',
        updates
      );

      expect(briefing).toBeDefined();
    });
  });

  describe('addParticipant', () => {
    it('should add a participant to a briefing', async () => {
      // Pre-populate test data
      mockBriefings.push({
        id: 'briefing-1',
        title: 'Test Briefing',
        status: BriefingStatus.DRAFT,
        participants: [],
        organizationId: TEST_ORG_ID,
      });

      const briefing = await briefingService.addParticipant('briefing-1', TEST_ORG_ID, 'user-2');

      expect(briefing).toBeDefined();
      expect(briefing?.participants).toContain('user-2');
    });

    it('should not add duplicate participants', async () => {
      // Pre-populate test data
      mockBriefings.push({
        id: 'briefing-1',
        title: 'Test Briefing',
        status: BriefingStatus.DRAFT,
        participants: [],
        organizationId: TEST_ORG_ID,
      });

      await briefingService.addParticipant('briefing-1', TEST_ORG_ID, 'user-2');
      const briefing2 = await briefingService.addParticipant('briefing-1', TEST_ORG_ID, 'user-2');

      expect(briefing2?.participants?.filter(p => p === 'user-2').length).toBe(1);
    });
  });

  describe('updateStatus', () => {
    it('should update briefing status', async () => {
      // Pre-populate test data
      mockBriefings.push({
        id: 'briefing-1',
        title: 'Test Briefing',
        status: BriefingStatus.DRAFT,
        organizationId: TEST_ORG_ID,
      });

      const briefing = await briefingService.updateStatus(
        'briefing-1',
        TEST_ORG_ID,
        BriefingStatus.ACTIVE
      );

      expect(briefing).toBeDefined();
      expect(briefing?.status).toBe(BriefingStatus.ACTIVE);
    });

    it('should trigger StarComms briefing sync after status update', async () => {
      mockBriefings.push({
        id: 'briefing-2',
        title: 'Status Sync Briefing',
        status: BriefingStatus.DRAFT,
        classification: BriefingClassification.CONFIDENTIAL,
        organizationId: TEST_ORG_ID,
      });

      await briefingService.updateStatus('briefing-2', TEST_ORG_ID, BriefingStatus.ACTIVE);

      expect(syncBriefingContextSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: TEST_ORG_ID,
          briefingId: 'briefing-2',
          status: BriefingStatus.ACTIVE,
        })
      );
    });

    it('should not fail updateStatus when StarComms sync rejects', async () => {
      mockBriefings.push({
        id: 'briefing-3',
        title: 'Resilient Status Sync',
        status: BriefingStatus.DRAFT,
        classification: BriefingClassification.CONFIDENTIAL,
        organizationId: TEST_ORG_ID,
      });

      syncBriefingContextSpy.mockRejectedValueOnce(new Error('StarComms unavailable'));

      await expect(
        briefingService.updateStatus('briefing-3', TEST_ORG_ID, BriefingStatus.ACTIVE)
      ).resolves.toBeDefined();
    });
  });

  describe('createVersion', () => {
    it('should create a new version of a briefing', async () => {
      // Pre-populate test data
      mockBriefings.push({
        id: 'briefing-1',
        title: 'Test Briefing',
        status: BriefingStatus.DRAFT,
        version: 1,
        organizationId: TEST_ORG_ID,
      });

      const briefing = await briefingService.createVersion('briefing-1', TEST_ORG_ID);

      expect(briefing).toBeDefined();
      expect(briefing?.version).toBe(2);
    });
  });

  describe('getBriefingsByMission', () => {
    it('should return briefings for a mission scoped to organization', async () => {
      const briefings = await briefingService.getBriefingsByMission('mission-1', TEST_ORG_ID);

      expect(briefings).toBeDefined();
      expect(Array.isArray(briefings)).toBe(true);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
