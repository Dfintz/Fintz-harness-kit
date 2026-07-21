import type { RsiStatusSnapshot } from '../../../services/external/RsiStatusService';
import {
  buildPanelSnapshotSignature,
  shouldDropPanelTrackingForError,
} from '../../commands/rsistatus';

function makeSnapshot(overrides: Partial<RsiStatusSnapshot> = {}): RsiStatusSnapshot {
  return {
    overallStatus: 'Degraded',
    fetchedAt: new Date('2026-06-06T00:00:00.000Z'),
    components: [
      { name: 'Platform', status: 'Operational' },
      { name: 'Persistent Universe', status: 'Maintenance' },
      { name: 'Arena Commander', status: 'Maintenance' },
    ],
    latestIncident: {
      title: 'Live Service Maintenance',
      link: 'https://status.robertsspaceindustries.com/issues/test',
      pubDate: 'Fri, 06 Jun 2026 00:00:00 +0000',
      description: 'Scheduled maintenance in progress.',
      resolved: false,
    },
    ...overrides,
  };
}

describe('buildPanelSnapshotSignature', () => {
  it('returns same signature when only fetchedAt changes', () => {
    const first = makeSnapshot({ fetchedAt: new Date('2026-06-06T00:00:00.000Z') });
    const second = makeSnapshot({ fetchedAt: new Date('2026-06-06T00:05:00.000Z') });

    expect(buildPanelSnapshotSignature(first)).toBe(buildPanelSnapshotSignature(second));
  });

  it('returns different signature when a component status changes', () => {
    const first = makeSnapshot();
    const second = makeSnapshot({
      components: [
        { name: 'Platform', status: 'Operational' },
        { name: 'Persistent Universe', status: 'Operational' },
        { name: 'Arena Commander', status: 'Maintenance' },
      ],
    });

    expect(buildPanelSnapshotSignature(first)).not.toBe(buildPanelSnapshotSignature(second));
  });

  it('returns different signature when incident state changes without title change', () => {
    const first = makeSnapshot();
    const incident = first.latestIncident;
    if (!incident) {
      throw new Error('Expected latestIncident to be present');
    }

    const second = makeSnapshot({
      latestIncident: {
        ...incident,
        resolved: true,
      },
    });

    expect(buildPanelSnapshotSignature(first)).not.toBe(buildPanelSnapshotSignature(second));
  });

  it('returns different signature when incident description changes', () => {
    const first = makeSnapshot();
    const incident = first.latestIncident;
    if (!incident) {
      throw new Error('Expected latestIncident to be present');
    }

    const second = makeSnapshot({
      latestIncident: {
        ...incident,
        description: 'Maintenance completed.',
      },
    });

    expect(buildPanelSnapshotSignature(first)).not.toBe(buildPanelSnapshotSignature(second));
  });
});

describe('shouldDropPanelTrackingForError', () => {
  it('returns true for unknown channel errors', () => {
    expect(shouldDropPanelTrackingForError({ code: 10003 })).toBe(true);
  });

  it('returns true for unknown message errors', () => {
    expect(shouldDropPanelTrackingForError({ code: 10008 })).toBe(true);
  });

  it('returns false for non-drop Discord API codes', () => {
    expect(shouldDropPanelTrackingForError({ code: 50013 })).toBe(false);
  });

  it('returns false for generic errors', () => {
    expect(shouldDropPanelTrackingForError(new Error('network hiccup'))).toBe(false);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
