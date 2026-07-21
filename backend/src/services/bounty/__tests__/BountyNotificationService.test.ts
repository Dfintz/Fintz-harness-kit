import { Bounty } from '../../../models/Bounty';
import { BountyClaim } from '../../../models/BountyClaim';
import { HunterProfile, HunterRank } from '../../../models/HunterProfile';
import { logger } from '../../../utils/logger';
import {
  sendOrganizationNotification,
  sendUserNotification,
} from '../../../websocket/controllers/notificationWebSocketController';
import { BountyNotificationService, BountyNotificationType } from '../BountyNotificationService';

// Singleton-mocked websocket dispatch functions
jest.mock('../../../websocket/controllers/notificationWebSocketController', () => ({
  sendUserNotification: jest.fn(),
  sendOrganizationNotification: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const sendUserNotificationMock = sendUserNotification as jest.MockedFunction<
  typeof sendUserNotification
>;
const sendOrganizationNotificationMock = sendOrganizationNotification as jest.MockedFunction<
  typeof sendOrganizationNotification
>;
const loggerErrorMock = logger.error as jest.MockedFunction<typeof logger.error>;

describe('BountyNotificationService', () => {
  let service: BountyNotificationService;

  const testOrgId = 'org-123';
  const testCreatorId = 'creator-123';
  const testHunterId = 'hunter-456';

  const mockBounty: Bounty = {
    id: 'bounty-789',
    organizationId: testOrgId,
    createdBy: testCreatorId,
    title: 'Eliminate Pirate Captain',
    bountyType: 'kill',
    rewardAmount: 50000,
    rewardType: 'credits',
  } as unknown as Bounty;

  const mockClaim: BountyClaim = {
    id: 'claim-001',
    hunterId: testHunterId,
    hunterName: 'NightHawk',
  } as unknown as BountyClaim;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BountyNotificationService();
  });

  describe('notifyBountyCreated', () => {
    it('should send organization notification with bounty metadata', () => {
      service.notifyBountyCreated(mockBounty);

      expect(sendOrganizationNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendOrganizationNotificationMock).toHaveBeenCalledWith(
        testOrgId,
        expect.objectContaining({
          type: 'info',
          category: 'fleet',
          actionUrl: `/bounties/${mockBounty.id}`,
          data: expect.objectContaining({
            notificationType: BountyNotificationType.BOUNTY_CREATED,
            bountyId: mockBounty.id,
            bountyTitle: mockBounty.title,
            rewardAmount: mockBounty.rewardAmount,
          }),
        })
      );
      expect(sendUserNotificationMock).not.toHaveBeenCalled();
    });

    it('should swallow dispatch failures and log the error', () => {
      sendOrganizationNotificationMock.mockImplementationOnce(() => {
        throw new Error('socket dead');
      });

      expect(() => service.notifyBountyCreated(mockBounty)).not.toThrow();
      expect(loggerErrorMock).toHaveBeenCalledWith(
        'Failed to send bounty created notification',
        expect.objectContaining({ bountyId: mockBounty.id })
      );
    });

    it('should fall back to "negotiable" reward text when rewardAmount is null', () => {
      const noReward = { ...mockBounty, rewardAmount: null } as unknown as Bounty;

      service.notifyBountyCreated(noReward);

      const payload = sendOrganizationNotificationMock.mock.calls[0][1];
      expect(payload.message).toContain('negotiable');
    });
  });

  describe('notifyBountyClaimed', () => {
    it('should notify the creator with hunter details', () => {
      service.notifyBountyClaimed(mockBounty, mockClaim);

      expect(sendUserNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendUserNotificationMock).toHaveBeenCalledWith(
        testCreatorId,
        expect.objectContaining({
          data: expect.objectContaining({
            notificationType: BountyNotificationType.BOUNTY_CLAIMED,
            claimId: mockClaim.id,
            hunterId: testHunterId,
            hunterName: 'NightHawk',
          }),
        })
      );
    });

    it('should default to "a hunter" when hunterName is missing', () => {
      const anon = { ...mockClaim, hunterName: undefined } as unknown as BountyClaim;

      service.notifyBountyClaimed(mockBounty, anon);

      const payload = sendUserNotificationMock.mock.calls[0][1];
      expect(payload.message).toContain('a hunter');
    });
  });

  describe('notifyBountySubmitted', () => {
    it('should send a review-pending notification to the creator', () => {
      service.notifyBountySubmitted(mockBounty, mockClaim);

      expect(sendUserNotificationMock).toHaveBeenCalledWith(
        testCreatorId,
        expect.objectContaining({
          actionUrl: `/bounties/${mockBounty.id}/review`,
          data: expect.objectContaining({
            notificationType: BountyNotificationType.BOUNTY_SUBMITTED,
          }),
        })
      );
    });
  });

  describe('notifyBountyApproved', () => {
    it('should notify both the hunter and the organization', () => {
      service.notifyBountyApproved(mockBounty, mockClaim, 'AdminUser');

      expect(sendUserNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendUserNotificationMock).toHaveBeenCalledWith(
        testHunterId,
        expect.objectContaining({
          type: 'success',
          data: expect.objectContaining({
            notificationType: BountyNotificationType.BOUNTY_APPROVED,
            verifierName: 'AdminUser',
          }),
        })
      );

      expect(sendOrganizationNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendOrganizationNotificationMock).toHaveBeenCalledWith(
        testOrgId,
        expect.objectContaining({
          type: 'success',
          data: expect.objectContaining({
            notificationType: BountyNotificationType.BOUNTY_APPROVED,
          }),
        })
      );
    });

    it('should not throw when the websocket dispatch fails', () => {
      sendUserNotificationMock.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      expect(() => service.notifyBountyApproved(mockBounty, mockClaim, 'AdminUser')).not.toThrow();
      expect(loggerErrorMock).toHaveBeenCalledWith(
        'Failed to send bounty approved notification',
        expect.objectContaining({ bountyId: mockBounty.id })
      );
    });
  });

  describe('notifyBountyRejected', () => {
    it('should notify the hunter and include the rejection reason', () => {
      service.notifyBountyRejected(mockBounty, mockClaim, 'AdminUser', 'Insufficient evidence');

      expect(sendUserNotificationMock).toHaveBeenCalledTimes(1);
      const [userId, payload] = sendUserNotificationMock.mock.calls[0];
      expect(userId).toBe(testHunterId);
      expect(payload.type).toBe('warning');
      expect(payload.message).toContain('Insufficient evidence');
      expect(payload.data).toEqual(
        expect.objectContaining({
          notificationType: BountyNotificationType.BOUNTY_REJECTED,
          reason: 'Insufficient evidence',
          verifierName: 'AdminUser',
        })
      );
    });

    it('should omit reason text when no reason is provided', () => {
      service.notifyBountyRejected(mockBounty, mockClaim, 'AdminUser');

      const payload = sendUserNotificationMock.mock.calls[0][1];
      expect(payload.message).not.toContain('Reason:');
    });
  });

  describe('notifyBountyPaid', () => {
    it('should notify the hunter and include the payment reference', () => {
      service.notifyBountyPaid(mockBounty, mockClaim, 'TX-9001');

      expect(sendUserNotificationMock).toHaveBeenCalledWith(
        testHunterId,
        expect.objectContaining({
          type: 'success',
          data: expect.objectContaining({
            notificationType: BountyNotificationType.BOUNTY_PAID,
            paymentReference: 'TX-9001',
          }),
        })
      );
      expect(sendUserNotificationMock.mock.calls[0][1].message).toContain('TX-9001');
    });
  });

  describe('notifyBountyCancelled', () => {
    it('should notify both the claiming hunter and the organization when a claim exists', () => {
      service.notifyBountyCancelled(mockBounty, mockClaim, 'no longer needed');

      expect(sendUserNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendUserNotificationMock).toHaveBeenCalledWith(
        testHunterId,
        expect.objectContaining({
          data: expect.objectContaining({
            notificationType: BountyNotificationType.BOUNTY_CANCELLED,
            reason: 'no longer needed',
          }),
        })
      );

      expect(sendOrganizationNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendOrganizationNotificationMock).toHaveBeenCalledWith(
        testOrgId,
        expect.objectContaining({
          data: expect.objectContaining({
            notificationType: BountyNotificationType.BOUNTY_CANCELLED,
          }),
        })
      );
    });

    it('should only notify the organization when no claim exists', () => {
      service.notifyBountyCancelled(mockBounty);

      expect(sendUserNotificationMock).not.toHaveBeenCalled();
      expect(sendOrganizationNotificationMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('notifyBountyExpired', () => {
    it('should notify only the creator when there is no active claim', () => {
      service.notifyBountyExpired(mockBounty);

      expect(sendUserNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendUserNotificationMock).toHaveBeenCalledWith(
        testCreatorId,
        expect.objectContaining({
          data: expect.objectContaining({
            notificationType: BountyNotificationType.BOUNTY_EXPIRED,
          }),
        })
      );
    });

    it('should notify both the creator and the hunter when a claim exists', () => {
      service.notifyBountyExpired(mockBounty, mockClaim);

      expect(sendUserNotificationMock).toHaveBeenCalledTimes(2);
      const recipients = sendUserNotificationMock.mock.calls.map(call => call[0]);
      expect(recipients).toEqual(expect.arrayContaining([testCreatorId, testHunterId]));
    });
  });

  describe('notifyHunterRankPromotion', () => {
    const mockProfile: HunterProfile = {
      id: 'profile-001',
      userId: testHunterId,
      userName: 'NightHawk',
      organizationId: testOrgId,
    } as unknown as HunterProfile;

    it('notifies the hunter and the org on a promotion', () => {
      service.notifyHunterRankPromotion(mockProfile, HunterRank.HUNTER, HunterRank.VETERAN);

      expect(sendUserNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendUserNotificationMock).toHaveBeenCalledWith(
        testHunterId,
        expect.objectContaining({
          type: 'success',
          category: 'fleet',
          actionUrl: `/bounty/profile/${testHunterId}`,
          data: expect.objectContaining({
            notificationType: BountyNotificationType.HUNTER_RANK_CHANGED,
            hunterId: testHunterId,
            previousRank: HunterRank.HUNTER,
            newRank: HunterRank.VETERAN,
          }),
        })
      );
      expect(sendOrganizationNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendOrganizationNotificationMock).toHaveBeenCalledWith(
        testOrgId,
        expect.objectContaining({
          data: expect.objectContaining({
            notificationType: BountyNotificationType.HUNTER_RANK_CHANGED,
            newRank: HunterRank.VETERAN,
          }),
        })
      );
    });

    it('sends nothing when the transition is not a promotion', () => {
      service.notifyHunterRankPromotion(mockProfile, HunterRank.VETERAN, HunterRank.HUNTER);
      service.notifyHunterRankPromotion(mockProfile, HunterRank.HUNTER, HunterRank.HUNTER);

      expect(sendUserNotificationMock).not.toHaveBeenCalled();
      expect(sendOrganizationNotificationMock).not.toHaveBeenCalled();
    });

    it('swallows dispatch failures and logs the error', () => {
      sendUserNotificationMock.mockImplementationOnce(() => {
        throw new Error('socket dead');
      });

      expect(() =>
        service.notifyHunterRankPromotion(mockProfile, HunterRank.HUNTER, HunterRank.ELITE)
      ).not.toThrow();
      expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

