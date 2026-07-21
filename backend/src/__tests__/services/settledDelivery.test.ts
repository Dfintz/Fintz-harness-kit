import type { NotificationResult } from '../../services/communication';

const mockWarn = jest.fn();

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: mockWarn,
    error: jest.fn(),
    debug: jest.fn(),
  },
  default: {
    info: jest.fn(),
    warn: mockWarn,
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { collectDeliveredNotifications } from '../../services/communication';

/**
 * PERF-02: collectDeliveredNotifications must count only notifications that
 * actually delivered (NotificationResult.success === true), not every settled
 * promise. NotificationService.create swallows errors and resolves with
 * { success: false }, so a fulfilled promise is NOT a delivered notification.
 */
describe('collectDeliveredNotifications (PERF-02 settled-delivery accounting)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const delivered = (notificationId: string): NotificationResult => ({
    success: true,
    channel: 'in-app',
    recipientCount: 1,
    notificationId,
  });

  const failedValue = (error: string): NotificationResult => ({
    success: false,
    channel: 'in-app',
    recipientCount: 0,
    error,
  });

  it('returns only fulfilled results whose value.success is true', () => {
    const results: PromiseSettledResult<NotificationResult>[] = [
      { status: 'fulfilled', value: delivered('n-1') },
      { status: 'fulfilled', value: delivered('n-2') },
    ];

    const out = collectDeliveredNotifications(results, ['u-1', 'u-2'], 'fleet creation');

    expect(out).toHaveLength(2);
    expect(out.map(r => r.notificationId)).toEqual(['n-1', 'n-2']);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('excludes fulfilled-but-unsuccessful results and logs them as failures', () => {
    const results: PromiseSettledResult<NotificationResult>[] = [
      { status: 'fulfilled', value: delivered('n-1') },
      { status: 'fulfilled', value: failedValue('user not found') },
    ];

    const out = collectDeliveredNotifications(results, ['u-1', 'u-2'], 'fleet creation');

    // The second attempt resolved fulfilled but success === false — it must NOT
    // be counted as delivered (the bug this fixes), and it must be logged.
    expect(out).toHaveLength(1);
    expect(out[0].notificationId).toBe('n-1');
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      'Failed to send fleet creation notification',
      expect.objectContaining({ userId: 'u-2', error: 'user not found' })
    );
  });

  it('falls back to a default error message when a failed result has no error', () => {
    const results: PromiseSettledResult<NotificationResult>[] = [
      {
        status: 'fulfilled',
        value: { success: false, channel: 'in-app', recipientCount: 0 },
      },
    ];

    const out = collectDeliveredNotifications(results, ['u-1'], 'fleet deployment');

    expect(out).toHaveLength(0);
    expect(mockWarn).toHaveBeenCalledWith(
      'Failed to send fleet deployment notification',
      expect.objectContaining({
        userId: 'u-1',
        error: 'Notification service reported failure',
      })
    );
  });

  it('treats rejected promises as failures and logs the rejection reason', () => {
    const results: PromiseSettledResult<NotificationResult>[] = [
      { status: 'fulfilled', value: delivered('n-1') },
      { status: 'rejected', reason: new Error('db down') },
    ];

    const out = collectDeliveredNotifications(results, ['u-1', 'u-2'], 'fleet dissolution');

    expect(out).toHaveLength(1);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(
      'Failed to send fleet dissolution notification',
      expect.objectContaining({ userId: 'u-2', error: 'db down' })
    );
  });

  it('stringifies a non-Error rejection reason', () => {
    const results: PromiseSettledResult<NotificationResult>[] = [
      { status: 'rejected', reason: 'boom' },
    ];

    const out = collectDeliveredNotifications(results, ['u-1'], 'fleet creation');

    expect(out).toHaveLength(0);
    expect(mockWarn).toHaveBeenCalledWith(
      'Failed to send fleet creation notification',
      expect.objectContaining({ userId: 'u-1', error: 'boom' })
    );
  });

  it('returns an empty array for no results', () => {
    const out = collectDeliveredNotifications([], [], 'fleet creation');

    expect(out).toEqual([]);
    expect(mockWarn).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
