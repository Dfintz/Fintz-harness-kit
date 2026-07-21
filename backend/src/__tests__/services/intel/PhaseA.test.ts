/**
 * Phase A — Shared Types & Entities Tests
 *
 * Tests for Wave 2.1 shared types (enums, DTOs) and entity helper methods.
 * These are unit tests — no database required.
 */
import {
  DEFAULT_FLAG_SEVERITY,
  FLAG_SEVERITY_ORDER,
  FlagSeverity,
  FlagStatus,
  MemberFlagType,
  WatchlistReason,
  WatchlistThreatLevel,
} from '@sc-fleet-manager/shared-types';

import { MemberAuditEvent } from '../../../models/MemberAuditEvent';
import { OrgWatchlistEntry } from '../../../models/OrgWatchlistEntry';

// ─── Shared Types Tests ──────────────────────────────────────────────

describe('MemberAudit shared types', () => {
  describe('MemberFlagType enum', () => {
    it('should define all expected flag types', () => {
      expect(MemberFlagType.RSI_ORG_LEFT).toBe('rsi_org_left');
      expect(MemberFlagType.JOINED_HOSTILE_ORG).toBe('joined_hostile_org');
      expect(MemberFlagType.JOINED_REDACTED_ORG).toBe('joined_redacted_org');
      expect(MemberFlagType.RSI_RANK_CHANGED).toBe('rsi_rank_changed');
      expect(MemberFlagType.DISCORD_LEFT).toBe('discord_left');
      expect(MemberFlagType.DISCORD_ROLE_CHANGED).toBe('discord_role_changed');
      expect(MemberFlagType.MODERATION_ACTION_RECEIVED).toBe('moderation_action_received');
      expect(MemberFlagType.MODERATION_ACTION_SHARED).toBe('moderation_action_shared');
      expect(MemberFlagType.PRIMARY_ORG_SWITCHED).toBe('primary_org_switched');
      expect(MemberFlagType.PLATFORM_LEFT).toBe('platform_left');
      expect(MemberFlagType.MANUAL).toBe('manual');
    });

    it('should have 27 flag types', () => {
      expect(Object.keys(MemberFlagType)).toHaveLength(27);
    });
  });

  describe('FlagSeverity enum', () => {
    it('should define severity levels', () => {
      expect(FlagSeverity.INFO).toBe('info');
      expect(FlagSeverity.MEDIUM).toBe('medium');
      expect(FlagSeverity.HIGH).toBe('high');
      expect(FlagSeverity.CRITICAL).toBe('critical');
    });
  });

  describe('FlagStatus enum', () => {
    it('should define resolution statuses', () => {
      expect(FlagStatus.OPEN).toBe('open');
      expect(FlagStatus.RESOLVED).toBe('resolved');
      expect(FlagStatus.DISMISSED).toBe('dismissed');
      expect(FlagStatus.ESCALATED).toBe('escalated');
    });
  });

  describe('FLAG_SEVERITY_ORDER', () => {
    it('should order severities correctly', () => {
      expect(FLAG_SEVERITY_ORDER[FlagSeverity.INFO]).toBeLessThan(
        FLAG_SEVERITY_ORDER[FlagSeverity.MEDIUM]
      );
      expect(FLAG_SEVERITY_ORDER[FlagSeverity.MEDIUM]).toBeLessThan(
        FLAG_SEVERITY_ORDER[FlagSeverity.HIGH]
      );
      expect(FLAG_SEVERITY_ORDER[FlagSeverity.HIGH]).toBeLessThan(
        FLAG_SEVERITY_ORDER[FlagSeverity.CRITICAL]
      );
    });
  });

  describe('DEFAULT_FLAG_SEVERITY', () => {
    it('should map every flag type to a severity', () => {
      for (const flagType of Object.values(MemberFlagType)) {
        expect(DEFAULT_FLAG_SEVERITY[flagType]).toBeDefined();
        expect(Object.values(FlagSeverity)).toContain(DEFAULT_FLAG_SEVERITY[flagType]);
      }
    });

    it('should assign CRITICAL to hostile org joins and platform leaving', () => {
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.JOINED_HOSTILE_ORG]).toBe(FlagSeverity.CRITICAL);
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.PLATFORM_LEFT]).toBe(FlagSeverity.CRITICAL);
    });

    it('should assign HIGH to discord left, moderation, redacted org, primary switch', () => {
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.DISCORD_LEFT]).toBe(FlagSeverity.HIGH);
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.MODERATION_ACTION_RECEIVED]).toBe(
        FlagSeverity.HIGH
      );
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.JOINED_REDACTED_ORG]).toBe(FlagSeverity.HIGH);
      expect(DEFAULT_FLAG_SEVERITY[MemberFlagType.PRIMARY_ORG_SWITCHED]).toBe(FlagSeverity.HIGH);
    });
  });
});

describe('OrgWatchlist shared types', () => {
  describe('WatchlistReason enum', () => {
    it('should define all expected reasons', () => {
      expect(WatchlistReason.HOSTILE).toBe('hostile');
      expect(WatchlistReason.GRIEFER).toBe('griefer');
      expect(WatchlistReason.SUSPICIOUS).toBe('suspicious');
      expect(WatchlistReason.UNDER_INVESTIGATION).toBe('under_investigation');
      expect(WatchlistReason.REDACTED).toBe('redacted');
      expect(WatchlistReason.NEGATIVE_HISTORY).toBe('negative_history');
      expect(WatchlistReason.IMPERSONATION).toBe('impersonation');
      expect(WatchlistReason.SPY).toBe('spy');
      expect(WatchlistReason.OTHER).toBe('other');
    });

    it('should have 9 reasons', () => {
      expect(Object.keys(WatchlistReason)).toHaveLength(9);
    });
  });

  describe('WatchlistThreatLevel enum', () => {
    it('should define all threat levels', () => {
      expect(WatchlistThreatLevel.LOW).toBe('low');
      expect(WatchlistThreatLevel.MODERATE).toBe('moderate');
      expect(WatchlistThreatLevel.HIGH).toBe('high');
      expect(WatchlistThreatLevel.CRITICAL).toBe('critical');
    });
  });
});

// ─── Entity Helper Tests ─────────────────────────────────────────────

describe('MemberAuditEvent entity', () => {
  function createEvent(overrides: Partial<MemberAuditEvent> = {}): MemberAuditEvent {
    const event = new MemberAuditEvent();
    event.id = 'test-id';
    event.userId = 'user-123';
    event.organizationId = 'org-456';
    event.flagType = MemberFlagType.DISCORD_LEFT;
    event.severity = FlagSeverity.HIGH;
    event.status = FlagStatus.OPEN;
    event.description = 'User left the Discord server';
    event.isAutoGenerated = true;
    event.createdAt = new Date();
    event.updatedAt = new Date();
    Object.assign(event, overrides);
    return event;
  }

  describe('isOpen()', () => {
    it('should return true for OPEN flags', () => {
      const event = createEvent();
      expect(event.isOpen()).toBe(true);
    });

    it('should return false for RESOLVED flags', () => {
      const event = createEvent({ status: FlagStatus.RESOLVED });
      expect(event.isOpen()).toBe(false);
    });

    it('should return false for DISMISSED flags', () => {
      const event = createEvent({ status: FlagStatus.DISMISSED });
      expect(event.isOpen()).toBe(false);
    });

    it('should return false for ESCALATED flags', () => {
      const event = createEvent({ status: FlagStatus.ESCALATED });
      expect(event.isOpen()).toBe(false);
    });
  });

  describe('getSeverityWeight()', () => {
    it('should return 1 for INFO', () => {
      const event = createEvent({ severity: FlagSeverity.INFO });
      expect(event.getSeverityWeight()).toBe(1);
    });

    it('should return 4 for CRITICAL', () => {
      const event = createEvent({ severity: FlagSeverity.CRITICAL });
      expect(event.getSeverityWeight()).toBe(4);
    });

    it('should order weights correctly', () => {
      const info = createEvent({ severity: FlagSeverity.INFO });
      const medium = createEvent({ severity: FlagSeverity.MEDIUM });
      const high = createEvent({ severity: FlagSeverity.HIGH });
      const critical = createEvent({ severity: FlagSeverity.CRITICAL });

      expect(info.getSeverityWeight()).toBeLessThan(medium.getSeverityWeight());
      expect(medium.getSeverityWeight()).toBeLessThan(high.getSeverityWeight());
      expect(high.getSeverityWeight()).toBeLessThan(critical.getSeverityWeight());
    });
  });

  describe('getDefaultSeverity()', () => {
    it('should return HIGH for DISCORD_LEFT', () => {
      expect(MemberAuditEvent.getDefaultSeverity(MemberFlagType.DISCORD_LEFT)).toBe(
        FlagSeverity.HIGH
      );
    });

    it('should return CRITICAL for PLATFORM_LEFT', () => {
      expect(MemberAuditEvent.getDefaultSeverity(MemberFlagType.PLATFORM_LEFT)).toBe(
        FlagSeverity.CRITICAL
      );
    });

    it('should return INFO for RSI_RANK_CHANGED', () => {
      expect(MemberAuditEvent.getDefaultSeverity(MemberFlagType.RSI_RANK_CHANGED)).toBe(
        FlagSeverity.INFO
      );
    });
  });

  describe('getFlagTypeLabel()', () => {
    it('should return human-readable labels', () => {
      expect(MemberAuditEvent.getFlagTypeLabel(MemberFlagType.DISCORD_LEFT)).toBe(
        'Left Discord Server'
      );
      expect(MemberAuditEvent.getFlagTypeLabel(MemberFlagType.JOINED_HOSTILE_ORG)).toBe(
        'Joined Hostile Organization'
      );
      expect(MemberAuditEvent.getFlagTypeLabel(MemberFlagType.MANUAL)).toBe('Manual Flag');
    });

    it('should return a label for every flag type', () => {
      for (const flagType of Object.values(MemberFlagType)) {
        const label = MemberAuditEvent.getFlagTypeLabel(flagType);
        expect(label).toBeTruthy();
        expect(label).not.toBe(flagType); // Label should differ from raw enum
      }
    });
  });
});

describe('OrgWatchlistEntry entity', () => {
  function createEntry(overrides: Partial<OrgWatchlistEntry> = {}): OrgWatchlistEntry {
    const entry = new OrgWatchlistEntry();
    entry.id = 'entry-id';
    entry.organizationId = 'org-456';
    entry.rsiHandle = 'HOSTILE_PLAYER';
    entry.citizenName = 'Hostile Player';
    entry.reason = WatchlistReason.HOSTILE;
    entry.threatLevel = WatchlistThreatLevel.CRITICAL;
    entry.addedBy = 'officer-789';
    entry.createdAt = new Date();
    entry.updatedAt = new Date();
    Object.assign(entry, overrides);
    return entry;
  }

  describe('getFlagSeverity()', () => {
    it('should map LOW threat to info severity', () => {
      const entry = createEntry({ threatLevel: WatchlistThreatLevel.LOW });
      expect(entry.getFlagSeverity()).toBe('info');
    });

    it('should map MODERATE threat to medium severity', () => {
      const entry = createEntry({ threatLevel: WatchlistThreatLevel.MODERATE });
      expect(entry.getFlagSeverity()).toBe('medium');
    });

    it('should map HIGH threat to high severity', () => {
      const entry = createEntry({ threatLevel: WatchlistThreatLevel.HIGH });
      expect(entry.getFlagSeverity()).toBe('high');
    });

    it('should map CRITICAL threat to critical severity', () => {
      const entry = createEntry({ threatLevel: WatchlistThreatLevel.CRITICAL });
      expect(entry.getFlagSeverity()).toBe('critical');
    });
  });

  describe('getSummary()', () => {
    it('should return a formatted summary string', () => {
      const entry = createEntry();
      expect(entry.getSummary()).toBe('Hostile Player [HOSTILE_PLAYER] — hostile (critical)');
    });
  });
});
