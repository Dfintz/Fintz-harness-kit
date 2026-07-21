import { type BlacklistSharingConfig } from '../../../models/BlacklistSharingConfig';
import { type MirrorAction, MirrorActionStatus } from '../../../models/MirrorAction';
import {
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  type ModerationIncident,
} from '../../../models/ModerationIncident';
import { type ModerationAnalytics } from '../../../services/discord/BlacklistAnalyticsService';
import {
  type CrossAllianceCheckResult,
  type SharedIncident,
} from '../../../services/discord/BlacklistSharingService';
import {
  type BulkMirrorSummary,
  type MirrorResult,
} from '../../../services/discord/MirrorActionService';
import { type UserIncidentSummary } from '../../../services/discord/ModerationIncidentService';
import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildAlliedAlertsEmbed,
  buildBulkMirrorSummaryEmbed,
  buildCrossAllianceCheckEmbed,
  buildIncidentListEmbed,
  buildIncidentReportedEmbed,
  buildIncidentRevokedEmbed,
  buildIncidentSharedEmbed,
  buildMirrorActionCancelledEmbed,
  buildMirrorActionConfirmedEmbed,
  buildMirrorActionResultEmbed,
  buildMirrorHistoryEmbed,
  buildModerationAnalyticsEmbed,
  buildSharingSettingsDisplayEmbed,
  buildSharingSettingsUpdatedEmbed,
  createSummaryEmbed,
  formatIncident,
  getMirrorStatusEmoji,
  getResultColor,
  getSeverityColor,
  getSeverityEmoji,
  getSeverityLabel,
  getStatusEmoji,
  getTypeEmoji,
} from '../moderationEmbeds';

describe('moderation embed helpers', () => {
  it('getSeverityColor returns the deliberate severity gradient (NOT brand colors)', () => {
    expect(getSeverityColor(IncidentSeverity.WARNING)).toBe(0x00ff00);
    expect(getSeverityColor(IncidentSeverity.TIMEOUT)).toBe(0xffff00);
    expect(getSeverityColor(IncidentSeverity.LONG_TIMEOUT)).toBe(0xffa500);
    expect(getSeverityColor(IncidentSeverity.KICK)).toBe(0xff0000);
    expect(getSeverityColor(IncidentSeverity.BAN)).toBe(0x800000);
  });

  it('getResultColor brands failure / confirmation / success', () => {
    expect(getResultColor(false)).toBe(EmbedColors.ERROR);
    expect(getResultColor(true, true)).toBe(EmbedColors.WARNING);
    expect(getResultColor(true)).toBe(EmbedColors.SUCCESS);
  });

  it('getSeverityLabel maps each severity', () => {
    expect(getSeverityLabel(IncidentSeverity.WARNING)).toBe('Warning');
    expect(getSeverityLabel(IncidentSeverity.LONG_TIMEOUT)).toBe('Long Timeout');
    expect(getSeverityLabel(IncidentSeverity.BAN)).toBe('Ban');
  });

  it('emoji helpers map their enums', () => {
    expect(getTypeEmoji(IncidentType.WARNING)).toBe('\u26a0\uFE0F');
    expect(getTypeEmoji(IncidentType.BAN)).toBe('\u{1F528}');
    expect(getSeverityEmoji(IncidentSeverity.WARNING)).toBe('\u{1F7E2}');
    expect(getSeverityEmoji(IncidentSeverity.BAN)).toBe('\u26d4');
    expect(getStatusEmoji(IncidentStatus.ACTIVE)).toBe('\u{1F7E2}');
    expect(getStatusEmoji(IncidentStatus.REVOKED)).toBe('\u2705');
    expect(getMirrorStatusEmoji(MirrorActionStatus.CONFIRMED)).toBe('\u2705');
    expect(getMirrorStatusEmoji(MirrorActionStatus.CANCELLED)).toBe('\u274c');
  });

  it('formatIncident renders status + type + UPPERCASE type with a truncated reason and shared flag', () => {
    const incident = {
      incidentType: IncidentType.BAN,
      status: IncidentStatus.ACTIVE,
      createdAt: new Date('2026-06-14T00:00:00.000Z'),
      reason: 'spam',
      isShared: true,
    } as ModerationIncident;
    const line = formatIncident(incident);
    expect(line).toContain('\u{1F528}'); // ban type emoji
    expect(line).toContain('BAN');
    expect(line).toContain('- spam');
    expect(line).toContain('\u{1F310}'); // shared globe
  });
});

describe('createSummaryEmbed', () => {
  const baseSummary: UserIncidentSummary = {
    targetDiscordId: '123',
    targetUsername: 'Offender',
    totalIncidents: 0,
    activeIncidents: 0,
    highestSeverity: IncidentSeverity.WARNING,
    incidentsByType: {} as Record<IncidentType, number>,
    incidentsBySeverity: {} as Record<IncidentSeverity, number>,
    sharedIncidents: 0,
    incidents: [],
  };

  it('uses the severity gradient colour and a no-incidents message when empty', () => {
    const embed = createSummaryEmbed(baseSummary);
    expect(embed.data.color).toBe(getSeverityColor(IncidentSeverity.WARNING));
    expect(embed.data.title).toBe('\u{1F4CB} Incident Report: Offender');
    expect(embed.data.description).toContain('No incidents found');
    expect(embed.data.fields ?? []).toHaveLength(0);
    expect(embed.data.footer?.text).toBe('Discord ID: 123');
  });

  it('renders the overview field with the highest-severity gradient when incidents exist', () => {
    const embed = createSummaryEmbed({
      ...baseSummary,
      totalIncidents: 3,
      activeIncidents: 2,
      highestSeverity: IncidentSeverity.BAN,
      incidentsByType: { [IncidentType.BAN]: 3 } as Record<IncidentType, number>,
      incidentsBySeverity: { [IncidentSeverity.BAN]: 3 } as Record<IncidentSeverity, number>,
    });
    expect(embed.data.color).toBe(0x800000); // BAN gradient, not a brand colour
    const overview = (embed.data.fields ?? []).find(f => f.name === '\u{1F4CA} Overview');
    expect(overview?.value).toContain('Total Incidents: **3**');
  });
});

describe('buildMirrorActionResultEmbed', () => {
  const baseIncident = {
    targetDiscordId: '999',
    incidentType: IncidentType.BAN,
    severity: IncidentSeverity.BAN,
    guildName: 'Allied Org',
    reason: 'raiding',
  } as ModerationIncident;

  const baseResult = {
    success: true,
    action: { id: 'abcdef1234567890' },
    message: 'Mirror created.',
    requiresConfirmation: false,
  } as MirrorResult;

  it('brands a created mirror with SUCCESS and the created title (no confirmation field)', () => {
    const embed = buildMirrorActionResultEmbed(baseResult, baseIncident, 'Mod');
    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toBe('\u{1FA9E} Mirror Action Created');
    expect(embed.data.footer?.text).toBe('Mirrored by Mod');
    const names = (embed.data.fields ?? []).map(f => f.name);
    expect(names).toContain('Target User');
    expect(names).not.toContain('\u26a0\uFE0F Confirmation Required');
  });

  it('brands a pending-confirmation mirror with WARNING and the confirmation field', () => {
    const embed = buildMirrorActionResultEmbed(
      { ...baseResult, requiresConfirmation: true, message: 'Pending.' },
      baseIncident,
      'Mod'
    );
    expect(embed.data.color).toBe(EmbedColors.WARNING);
    expect(embed.data.title).toBe('\u26a0\uFE0F Mirror Action Pending Confirmation');
    const confirmField = (embed.data.fields ?? []).find(
      f => f.name === '\u26a0\uFE0F Confirmation Required'
    );
    expect(confirmField?.value).toContain('/blacklist confirm-mirror');
  });
});

describe('mirror-action confirm/cancel embeds', () => {
  const baseAction = {
    id: 'fedcba0987654321',
    targetDiscordId: '555',
    actionType: 'ban',
    getSeverityEmoji: () => '\u{1F534}',
  } as unknown as MirrorAction;

  it('buildMirrorActionConfirmedEmbed brands SUCCESS with the confirmed title/footer', () => {
    const embed = buildMirrorActionConfirmedEmbed(baseAction, 'Mod');
    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toBe('\u2705 Mirror Action Confirmed');
    expect(embed.data.footer?.text).toBe('Confirmed by Mod');
    const actionType = (embed.data.fields ?? []).find(f => f.name === 'Action Type');
    expect(actionType?.value).toBe('\u{1F534} BAN');
  });

  it('buildMirrorActionCancelledEmbed brands CLOSED with the cancelled title/footer', () => {
    const embed = buildMirrorActionCancelledEmbed(baseAction, 'Mod');
    expect(embed.data.color).toBe(EmbedColors.CLOSED);
    expect(embed.data.title).toBe('\u274c Mirror Action Cancelled');
    expect(embed.data.footer?.text).toBe('Cancelled by Mod');
  });
});

describe('moderation success-confirmation embeds', () => {
  it('buildIncidentRevokedEmbed brands SUCCESS with the revoked title and optional reason', () => {
    const incident = {
      id: 'abc12345def',
      targetUsername: 'Target',
      targetDiscordId: '111',
      incidentType: IncidentType.BAN,
    } as ModerationIncident;
    const embed = buildIncidentRevokedEmbed(incident, 'appeal approved', 'Mod');
    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toBe('\u2705 Incident Revoked');
    expect(embed.data.footer?.text).toBe('Revoked by Mod');
    const reasonField = (embed.data.fields ?? []).find(f => f.name === 'Revoke Reason');
    expect(reasonField?.value).toBe('appeal approved');
  });

  it('buildIncidentRevokedEmbed omits the reason field and falls back to the discord id', () => {
    const incident = {
      id: 'abc12345def',
      targetDiscordId: '111',
      incidentType: IncidentType.WARNING,
    } as ModerationIncident;
    const embed = buildIncidentRevokedEmbed(incident, undefined, 'Mod');
    const names = (embed.data.fields ?? []).map(f => f.name);
    expect(names).not.toContain('Revoke Reason');
    const target = (embed.data.fields ?? []).find(f => f.name === 'Target');
    expect(target?.value).toBe('111');
  });

  it('buildSharingSettingsUpdatedEmbed brands SUCCESS and lists the changes', () => {
    const embed = buildSharingSettingsUpdatedEmbed(['\u2022 Share Bans: \u2705 Enabled'], 'Mod');
    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toBe('\u2705 Settings Updated');
    expect(embed.data.footer?.text).toBe('Updated by Mod');
    const changes = (embed.data.fields ?? []).find(f => f.name === '\u{1F4DD} Changes Applied');
    expect(changes?.value).toBe('\u2022 Share Bans: \u2705 Enabled');
  });

  it('buildSharingSettingsUpdatedEmbed shows "No changes" for an empty list', () => {
    const embed = buildSharingSettingsUpdatedEmbed([], 'Mod');
    const changes = (embed.data.fields ?? []).find(f => f.name === '\u{1F4DD} Changes Applied');
    expect(changes?.value).toBe('No changes');
  });
});

describe('buildIncidentSharedEmbed', () => {
  it('brands SC_BLUE with the shared title, footer, and incident fields', () => {
    const incident = {
      id: 'abc12345def',
      targetUsername: 'Target',
      targetDiscordId: '111',
      incidentType: IncidentType.BAN,
    } as ModerationIncident;
    const embed = buildIncidentSharedEmbed(incident, 'Mod');
    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toBe('\u{1F310} Incident Shared');
    expect(embed.data.footer?.text).toBe('Shared by Mod');
    const typeField = (embed.data.fields ?? []).find(f => f.name === 'Type');
    expect(typeField?.value).toBe('\u{1F528} ban');
  });

  it('falls back to the discord id when targetUsername is absent', () => {
    const incident = {
      id: 'abc12345def',
      targetDiscordId: '111',
      incidentType: IncidentType.WARNING,
    } as ModerationIncident;
    const embed = buildIncidentSharedEmbed(incident, 'Mod');
    const target = (embed.data.fields ?? []).find(f => f.name === 'Target');
    expect(target?.value).toBe('111');
  });
});

describe('moderation info-list embeds', () => {
  const incident = {
    id: 'inc12345678',
    targetUsername: 'Target',
    targetDiscordId: '111',
    incidentType: IncidentType.BAN,
    severity: IncidentSeverity.BAN,
    status: IncidentStatus.ACTIVE,
    isShared: true,
    reason: 'raiding',
    createdAt: new Date('2026-06-14T00:00:00.000Z'),
  } as ModerationIncident;

  it('buildIncidentListEmbed brands SC_BLUE with a pagination footer', () => {
    const embed = buildIncidentListEmbed(
      { incidents: [incident], total: 25, page: 1, totalPages: 3 },
      1
    );
    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toBe('\u{1F4CB} Moderation Incidents');
    expect(embed.data.description).toContain('Showing 1 of 25 incidents (Page 1/3)');
    expect(embed.data.fields).toHaveLength(1);
    expect(embed.data.footer?.text).toBe('Page 1 of 3 | Use /blacklist list page:2 for more');
  });

  it('buildIncidentListEmbed omits the footer on a single page', () => {
    const embed = buildIncidentListEmbed(
      { incidents: [incident], total: 1, page: 1, totalPages: 1 },
      1
    );
    expect(embed.data.footer).toBeUndefined();
  });

  it('buildAlliedAlertsEmbed brands ERROR with the alerts footer', () => {
    const embed = buildAlliedAlertsEmbed(
      { incidents: [{ incident } as SharedIncident], total: 12, page: 2, totalPages: 4 },
      2
    );
    expect(embed.data.color).toBe(EmbedColors.ERROR);
    expect(embed.data.title).toBe('\u{1F6A8} Allied Organization Alerts');
    expect(embed.data.fields).toHaveLength(1);
    expect(embed.data.footer?.text).toBe('Page 2 of 4 | Use /blacklist alerts page:3 for more');
  });

  it('buildMirrorHistoryEmbed brands SC_BLUE and uses the target mention when present', () => {
    const action = {
      id: 'mir12345678',
      targetUsername: 'Target',
      targetDiscordId: '111',
      actionType: 'ban',
      status: MirrorActionStatus.CONFIRMED,
      sourceGuildName: 'Allied',
      createdAt: new Date('2026-06-14T00:00:00.000Z'),
      getSeverityEmoji: () => '\u{1F534}',
    } as unknown as MirrorAction;
    const embed = buildMirrorHistoryEmbed(
      { actions: [action], total: 5, page: 1, totalPages: 1 },
      '999',
      1
    );
    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toBe('\u{1FA9E} Mirror Action History');
    expect(embed.data.description).toContain('<@999>');
    expect(embed.data.fields).toHaveLength(1);
    expect(embed.data.footer).toBeUndefined();
  });

  it('buildMirrorHistoryEmbed shows the count description when no target', () => {
    const embed = buildMirrorHistoryEmbed(
      { actions: [], total: 0, page: 1, totalPages: 1 },
      null,
      1
    );
    expect(embed.data.description).toContain('Showing 0 of 0 mirror actions');
  });
});

describe('buildBulkMirrorSummaryEmbed', () => {
  const action = {
    actionType: 'ban',
    sourceGuildName: 'Allied',
    getSeverityEmoji: () => '\u{1F534}',
  } as unknown as MirrorAction;

  const baseSummary = {
    bulkMirrorId: 'bulk1234567890',
    targetDiscordId: '777',
    totalIncidents: 5,
    mirroredCount: 4,
    pendingConfirmation: 1,
    failedCount: 0,
    actions: [action],
  } as BulkMirrorSummary;

  it('brands SUCCESS when nothing failed and renders the pending + recent-actions fields', () => {
    const embed = buildBulkMirrorSummaryEmbed(baseSummary, 'http://avatar', 'Mod');
    expect(embed.data.color).toBe(EmbedColors.SUCCESS);
    expect(embed.data.title).toBe('\u{1F4E6} Bulk Mirror Complete');
    expect(embed.data.description).toContain('<@777>');
    expect(embed.data.thumbnail?.url).toBe('http://avatar');
    expect(embed.data.footer?.text).toBe('Bulk mirror by Mod');
    const names = (embed.data.fields ?? []).map(f => f.name);
    expect(names).toContain('\u26a0\uFE0F Actions Pending');
    expect(names).toContain('\u{1F4DC} Recent Actions');
  });

  it('brands WARNING on failures and omits the pending + recent-actions fields', () => {
    const embed = buildBulkMirrorSummaryEmbed(
      { ...baseSummary, failedCount: 2, pendingConfirmation: 0, actions: [] },
      'http://avatar',
      'Mod'
    );
    expect(embed.data.color).toBe(EmbedColors.WARNING);
    const names = (embed.data.fields ?? []).map(f => f.name);
    expect(names).not.toContain('\u26a0\uFE0F Actions Pending');
    expect(names).not.toContain('\u{1F4DC} Recent Actions');
  });
});

describe('buildSharingSettingsDisplayEmbed', () => {
  it('brands SC_BLUE and renders the four settings groups', () => {
    const config = {
      shareWarnings: true,
      shareTimeouts: false,
      shareKicks: true,
      shareBans: true,
      alertChannelId: '123',
      receiveAlerts: true,
      minAlertSeverity: IncidentSeverity.TIMEOUT,
      autoShareWithAllies: false,
      autoShareMinSeverity: IncidentSeverity.KICK,
      autoEnforceEnabled: true,
      autoEnforceTimeouts: false,
      autoEnforceKicks: true,
    } as BlacklistSharingConfig;

    const embed = buildSharingSettingsDisplayEmbed(config);

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toBe('\u2699\uFE0F Blacklist Sharing Settings');
    expect(embed.data.footer?.text).toBe('Use /blacklist settings with options to update');
    const names = (embed.data.fields ?? []).map(f => f.name);
    expect(names).toEqual([
      '\u{1F4E4} Sharing Settings',
      '\u{1F4E5} Receiving Settings',
      '\u{1F916} Auto-Share',
      '\u26a1 Auto-Enforce',
    ]);
    const receiving = (embed.data.fields ?? []).find(
      f => f.name === '\u{1F4E5} Receiving Settings'
    );
    expect(receiving?.value).toContain('<#123>');
    expect(receiving?.value).toContain(getSeverityLabel(IncidentSeverity.TIMEOUT));
  });

  it('shows "Not set" when no alert channel is configured', () => {
    const config = {
      alertChannelId: null,
      minAlertSeverity: IncidentSeverity.WARNING,
      autoShareMinSeverity: IncidentSeverity.WARNING,
    } as unknown as BlacklistSharingConfig;

    const embed = buildSharingSettingsDisplayEmbed(config);

    const receiving = (embed.data.fields ?? []).find(
      f => f.name === '\u{1F4E5} Receiving Settings'
    );
    expect(receiving?.value).toContain('Not set');
  });
});

describe('buildModerationAnalyticsEmbed', () => {
  const baseAnalytics = {
    totalIncidents: 42,
    activeIncidents: 5,
    resolvedIncidents: 30,
    sharedIncidents: 7,
    autoDetectedIncidents: 3,
    byType: {} as Record<IncidentType, number>,
    bySeverity: {} as Record<IncidentSeverity, number>,
    byStatus: {} as Record<IncidentStatus, number>,
    dailyTrend: [],
    weeklyTrend: [],
    monthlyTrend: [],
    uniqueTargets: 12,
    uniqueModerators: 4,
    averageSeverity: 2.5,
    repeatOffenders: [],
    repeatOffenderCount: 0,
    mirrorStats: {
      totalMirrors: 0,
      confirmedMirrors: 0,
      pendingMirrors: 0,
      cancelledMirrors: 0,
      failedMirrors: 0,
    },
    incidentsLast24Hours: 1,
    incidentsLast7Days: 8,
    incidentsLast30Days: 20,
    generatedAt: new Date('2026-06-23T00:00:00Z'),
  } as ModerationAnalytics;

  it('brands SC_BLUE and renders the static dashboard fields', () => {
    const embed = buildModerationAnalyticsEmbed(baseAnalytics);

    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toBe('\u{1F4CA} Moderation Analytics Dashboard');
    const names = (embed.data.fields ?? []).map(f => f.name);
    expect(names).toContain('\u{1F4CB} Total Incidents');
    expect(names).toContain('\u{1F46E} Unique Moderators');
    expect(names).toContain('\u23f1\uFE0F Recent Activity');
    expect(embed.data.footer?.text).toContain('Generated at');
  });

  it('omits the conditional breakdown/offender/mirror fields when empty', () => {
    const embed = buildModerationAnalyticsEmbed(baseAnalytics);

    const names = (embed.data.fields ?? []).map(f => f.name);
    expect(names).not.toContain('\u{1F4D1} By Type');
    expect(names).not.toContain('\u{1FA9E} Mirror Actions');
    expect(names.some(n => n.startsWith('\u{1F504} Repeat Offenders'))).toBe(false);
  });

  it('includes breakdowns, repeat offenders, and mirror stats when present', () => {
    const embed = buildModerationAnalyticsEmbed({
      ...baseAnalytics,
      byType: { [IncidentType.WARNING]: 4 } as Record<IncidentType, number>,
      byStatus: { [IncidentStatus.ACTIVE]: 5 } as Record<IncidentStatus, number>,
      repeatOffenderCount: 2,
      repeatOffenders: [
        {
          targetDiscordId: '111',
          targetUsername: 'BadActor',
          totalIncidents: 6,
          activeIncidents: 2,
          highestSeverity: IncidentSeverity.KICK,
          firstIncident: new Date(),
          lastIncident: new Date(),
          incidentsByType: {} as Record<IncidentType, number>,
          riskScore: 80,
          isHighRisk: true,
        },
      ],
      mirrorStats: {
        totalMirrors: 3,
        confirmedMirrors: 2,
        pendingMirrors: 1,
        cancelledMirrors: 0,
        failedMirrors: 0,
      },
    } as ModerationAnalytics);

    const fields = embed.data.fields ?? [];
    const names = fields.map(f => f.name);
    expect(names).toContain('\u{1F4D1} By Type');
    expect(names).toContain('\u{1F4CA} By Status');
    expect(names).toContain('\u{1FA9E} Mirror Actions');
    const offenders = fields.find(f => f.name.startsWith('\u{1F504} Repeat Offenders'));
    expect(offenders?.value).toContain('BadActor');
  });
});

describe('buildIncidentReportedEmbed', () => {
  const baseIncident = {
    id: 'abcdef1234567890',
    incidentType: IncidentType.KICK,
    severity: IncidentSeverity.KICK,
    targetDiscordId: '555',
  } as ModerationIncident;

  it('keeps the getSeverityColor gradient (NOT a brand colour) and renders base fields', () => {
    const embed = buildIncidentReportedEmbed(baseIncident, 'spamming', undefined, false, 'ModName');

    expect(embed.data.color).toBe(getSeverityColor(IncidentSeverity.KICK));
    expect(embed.data.color).not.toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toContain('Incident Reported');
    expect(embed.data.description).toContain('<@555>');
    const fields = embed.data.fields ?? [];
    const names = fields.map(f => f.name);
    expect(fields.find(f => f.name === 'Reason')?.value).toBe('spamming');
    expect(embed.data.footer?.text).toBe('Reported by ModName');
    expect(names).not.toContain('Duration');
    expect(names).not.toContain('Shared');
  });

  it('adds Duration and Shared fields when provided', () => {
    const embed = buildIncidentReportedEmbed(baseIncident, 'reason', 60, true, 'ModName');

    const fields = embed.data.fields ?? [];
    const names = fields.map(f => f.name);
    expect(names).toContain('Duration');
    expect(fields.find(f => f.name === 'Duration')?.value).toBe('60 minutes');
    expect(names).toContain('Shared');
    expect(fields.find(f => f.name === 'Shared')?.value).toContain('\u{1F310}');
  });
});

describe('buildCrossAllianceCheckEmbed', () => {
  const cleanResult = {
    ownIncidents: [],
    alliedIncidents: [],
    totalIncidents: 0,
    highestSeverity: IncidentSeverity.WARNING,
    hasActiveIncident: false,
  } as CrossAllianceCheckResult;

  it('keeps the getSeverityColor gradient and shows the clean-record description', () => {
    const embed = buildCrossAllianceCheckEmbed(cleanResult, 'Pilot', '999', 'http://avatar');

    expect(embed.data.color).toBe(getSeverityColor(IncidentSeverity.WARNING));
    expect(embed.data.color).not.toBe(EmbedColors.SC_BLUE);
    expect(embed.data.title).toContain('Cross-Alliance Check: Pilot');
    expect(embed.data.thumbnail?.url).toBe('http://avatar');
    expect(embed.data.description).toContain('No incidents found');
    expect(embed.data.footer?.text).toBe('Discord ID: 999');
    expect((embed.data.fields ?? []).some(f => f.name.includes('Summary'))).toBe(false);
  });

  it('renders the summary and incident lists when incidents exist', () => {
    const ownIncident = {
      id: 'own123',
      status: IncidentStatus.ACTIVE,
      incidentType: IncidentType.BAN,
      severity: IncidentSeverity.BAN,
      guildName: 'My Org',
      createdAt: new Date('2026-06-01T00:00:00Z'),
    } as ModerationIncident;
    const alliedIncident = {
      id: 'ally456',
      status: IncidentStatus.ACTIVE,
      incidentType: IncidentType.KICK,
      severity: IncidentSeverity.KICK,
      guildName: 'Ally Org',
      createdAt: new Date('2026-06-02T00:00:00Z'),
    } as ModerationIncident;

    const embed = buildCrossAllianceCheckEmbed(
      {
        ownIncidents: [ownIncident],
        alliedIncidents: [
          { incident: alliedIncident, sourceOrganizationId: 'org2', isFromAlly: true },
        ],
        totalIncidents: 2,
        highestSeverity: IncidentSeverity.BAN,
        hasActiveIncident: true,
      } as CrossAllianceCheckResult,
      'Pilot',
      '999',
      'http://avatar'
    );

    const fields = embed.data.fields ?? [];
    const names = fields.map(f => f.name);
    expect(names.some(n => n.includes('Summary'))).toBe(true);
    expect(names.some(n => n.includes("Your Organization's Incidents"))).toBe(true);
    expect(names.some(n => n.includes('Incidents from Allied Organizations'))).toBe(true);
    expect(fields.find(f => f.name.includes('Allied Organizations'))?.value).toContain('Ally Org');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
