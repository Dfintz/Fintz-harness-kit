/**
 * RsiUserLink Model Tests
 *
 * Tests for the NEEDS_REVIEW enum value and helper methods.
 * Wave 1.6: RSI Sync Review Queue
 */

import { RsiUserLink, SyncStatus } from '../../models/RsiUserLink';

describe('RsiUserLink', () => {
  let link: RsiUserLink;

  beforeEach(() => {
    link = new RsiUserLink();
    link.syncStatus = SyncStatus.PENDING;
    link.metadata = {};
  });

  describe('SyncStatus enum', () => {
    it('should have NEEDS_REVIEW value', () => {
      expect(SyncStatus.NEEDS_REVIEW).toBe('needs_review');
    });

    it('should have all expected values', () => {
      expect(Object.values(SyncStatus)).toEqual(
        expect.arrayContaining(['pending', 'synced', 'failed', 'removed', 'needs_review'])
      );
    });
  });

  describe('needsReview()', () => {
    it('should return true when syncStatus is NEEDS_REVIEW', () => {
      link.syncStatus = SyncStatus.NEEDS_REVIEW;
      expect(link.needsReview()).toBe(true);
    });

    it('should return false for other statuses', () => {
      link.syncStatus = SyncStatus.PENDING;
      expect(link.needsReview()).toBe(false);

      link.syncStatus = SyncStatus.SYNCED;
      expect(link.needsReview()).toBe(false);

      link.syncStatus = SyncStatus.FAILED;
      expect(link.needsReview()).toBe(false);

      link.syncStatus = SyncStatus.REMOVED;
      expect(link.needsReview()).toBe(false);
    });
  });

  describe('markNeedsReview()', () => {
    it('should set syncStatus to NEEDS_REVIEW', () => {
      link.syncStatus = SyncStatus.SYNCED;
      link.markNeedsReview('rank_mismatch');

      expect(link.syncStatus).toBe(SyncStatus.NEEDS_REVIEW);
    });

    it('should set review reason in metadata', () => {
      link.markNeedsReview('rank_mismatch');

      expect(link.metadata?.reviewReason).toBe('rank_mismatch');
    });

    it('should set reviewFlaggedAt in metadata', () => {
      link.markNeedsReview('handle_not_found');

      expect(link.metadata?.reviewFlaggedAt).toBeDefined();
      expect(typeof link.metadata?.reviewFlaggedAt).toBe('string');
    });

    it('should default reason to Unknown when not provided', () => {
      link.markNeedsReview();

      expect(link.metadata?.reviewReason).toBe('Unknown');
    });

    it('should preserve existing metadata', () => {
      link.metadata = { existingKey: 'value' };
      link.markNeedsReview('test_reason');

      expect(link.metadata?.existingKey).toBe('value');
      expect(link.metadata?.reviewReason).toBe('test_reason');
    });
  });

  describe('existing helpers still work', () => {
    it('markSynced should set SYNCED status', () => {
      link.markSynced('Captain', false);
      expect(link.syncStatus).toBe(SyncStatus.SYNCED);
      expect(link.lastKnownRank).toBe('Captain');
    });

    it('markFailed should set FAILED status with reason', () => {
      link.markFailed('API timeout');
      expect(link.syncStatus).toBe(SyncStatus.FAILED);
      expect(link.metadata?.lastFailureReason).toBe('API timeout');
    });

    it('markRemoved should set REMOVED status', () => {
      link.markRemoved();
      expect(link.syncStatus).toBe(SyncStatus.REMOVED);
      expect(link.metadata?.removedAt).toBeDefined();
    });

    it('status checks should be mutually exclusive', () => {
      link.syncStatus = SyncStatus.NEEDS_REVIEW;
      expect(link.needsReview()).toBe(true);
      expect(link.isPending()).toBe(false);
      expect(link.isSynced()).toBe(false);
      expect(link.hasFailed()).toBe(false);
      expect(link.isRemoved()).toBe(false);
    });
  });
});
