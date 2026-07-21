import { describe, expect, it } from '@jest/globals';

import type {
  ActivityReminder,
  DeliveryStatus,
  ReminderChannel,
  ReminderType,
} from '../models/activityreminder';
import type { PriceAlert, PriceAlertCondition } from '../models/pricealert';
import type {
  AccountAccessLog,
  TrustLevel,
  UserLoginSession,
  VerificationMethod,
} from '../models/securitysession';
import type { LoanStatus, ShipLoan } from '../models/shiploan';
import type {
  MaintenanceStatus,
  MaintenanceType,
  ShipMaintenance,
} from '../models/shipmaintenance';
import type { Webhook, WebhookEventType, WebhookStatus, WebhookType } from '../models/webhook';

function assertType<T>(_value: T): void {
  // compile-time helper
}

describe('PR-A shared model unions', () => {
  it('validates reminder unions', () => {
    const reminderType: ReminderType = '1_hour_before';
    const channel: ReminderChannel = 'discord';
    const status: DeliveryStatus = 'pending';
    expect(reminderType).toBe('1_hour_before');
    expect(channel).toBe('discord');
    expect(status).toBe('pending');
  });

  it('validates price alert condition union', () => {
    const condition: PriceAlertCondition = 'above';
    expect(condition).toBe('above');
  });

  it('validates ship loan and maintenance unions', () => {
    const loanStatus: LoanStatus = 'active';
    const maintenanceStatus: MaintenanceStatus = 'scheduled';
    const maintenanceType: MaintenanceType = 'routine';
    expect(loanStatus).toBe('active');
    expect(maintenanceStatus).toBe('scheduled');
    expect(maintenanceType).toBe('routine');
  });

  it('validates security session unions', () => {
    const trustLevel: TrustLevel = 'high';
    const verificationMethod: VerificationMethod = '2fa';
    expect(trustLevel).toBe('high');
    expect(verificationMethod).toBe('2fa');
  });

  it('validates webhook unions', () => {
    const type: WebhookType = 'discord';
    const status: WebhookStatus = 'active';
    const event: WebhookEventType = 'fleet.created';
    expect(type).toBe('discord');
    expect(status).toBe('active');
    expect(event).toBe('fleet.created');
  });
});

describe('PR-A shared model interfaces', () => {
  it('accepts ActivityReminder shape', () => {
    const model: ActivityReminder = {
      id: 'r1',
      activityId: 'a1',
      reminderType: '1_day_before',
      channel: 'both',
      scheduledTime: '2026-03-10T10:00:00Z',
      deliveryStatus: 'pending',
      messageTemplate: 'Reminder',
      retryCount: 0,
      isEnabled: true,
      createdAt: '2026-03-09T10:00:00Z',
      updatedAt: '2026-03-09T10:00:00Z',
    };
    assertType<ActivityReminder>(model);
    expect(model.activityId).toBe('a1');
  });

  it('accepts PriceAlert shape', () => {
    const model: PriceAlert = {
      id: 'pa1',
      userId: 'u1',
      commodity: 'Quantanium',
      condition: 'below',
      threshold: 25,
      enabled: true,
      createdAt: '2026-03-09T10:00:00Z',
    };
    assertType<PriceAlert>(model);
    expect(model.threshold).toBe(25);
  });

  it('accepts ShipLoan shape', () => {
    const model: ShipLoan = {
      id: 'l1',
      shipId: 's1',
      lenderId: 'u1',
      borrowerId: 'u2',
      requestDate: '2026-03-09T10:00:00Z',
      startDate: '2026-03-10T10:00:00Z',
      expectedReturnDate: '2026-03-15T10:00:00Z',
      status: 'pending',
      insuranceRequired: false,
      createdAt: '2026-03-09T10:00:00Z',
      updatedAt: '2026-03-09T10:00:00Z',
    };
    assertType<ShipLoan>(model);
    expect(model.status).toBe('pending');
  });

  it('accepts ShipMaintenance shape', () => {
    const model: ShipMaintenance = {
      id: 'm1',
      shipId: 's1',
      ownerId: 'u1',
      maintenanceType: 'inspection',
      scheduledDate: '2026-03-12T10:00:00Z',
      status: 'scheduled',
      createdAt: '2026-03-09T10:00:00Z',
      updatedAt: '2026-03-09T10:00:00Z',
    };
    assertType<ShipMaintenance>(model);
    expect(model.maintenanceType).toBe('inspection');
  });

  it('accepts security session shapes', () => {
    const session: UserLoginSession = {
      id: 1,
      userId: 42,
      sessionToken: 'token',
      discordTokenExpiry: '2026-03-10T10:00:00Z',
      isActive: true,
      createdAt: '2026-03-09T10:00:00Z',
      lastActivity: '2026-03-09T10:30:00Z',
      expiresAt: '2026-03-16T10:00:00Z',
    };
    const accessLog: AccountAccessLog = {
      id: 'al1',
      accountId: 'acc1',
      userId: 'u1',
      organizationId: 'o1',
      action: 'view',
      createdAt: '2026-03-09T10:00:00Z',
    };
    assertType<UserLoginSession>(session);
    assertType<AccountAccessLog>(accessLog);
    expect(session.isActive).toBe(true);
  });

  it('accepts Webhook shape', () => {
    const model: Webhook = {
      id: 'w1',
      organizationId: 'o1',
      name: 'Discord Hook',
      type: 'discord',
      status: 'active',
      enabled: true,
      events: ['activity.created'],
      maxRetries: 3,
      retryDelayMs: 1000,
      timeoutMs: 30000,
      totalDeliveries: 0,
      successfulDeliveries: 0,
      failedDeliveries: 0,
      deliveryHistory: [],
      circuitBreakerThreshold: 5,
      consecutiveFailures: 0,
      circuitBreakerOpen: false,
      adminNotifiedOfFailure: false,
      createdBy: 'u1',
      createdAt: '2026-03-09T10:00:00Z',
      updatedAt: '2026-03-09T10:00:00Z',
    };
    assertType<Webhook>(model);
    expect(model.name).toBe('Discord Hook');
  });
});
