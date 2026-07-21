/**
 * Event button builder + parser tests.
 * Covers the consolidated "Ship & Crew" action panel and the shared row assembler.
 */

import { ButtonStyle } from 'discord.js';

import {
  buildCancelButton,
  buildEventActionPanelComponents,
  buildEventActionsRow,
  buildEventButtons,
  buildEventComponentRows,
  parseEventButtonId,
} from '../../bot/embeds/eventEmbed';

describe('parseEventButtonId', () => {
  it('parses the new passenger actions', () => {
    expect(parseEventButtonId('event_joinpassenger_abc123')).toEqual({
      action: 'joinpassenger',
      activityId: 'abc123',
    });
    expect(parseEventButtonId('event_leavepassenger_abc123')).toEqual({
      action: 'leavepassenger',
      activityId: 'abc123',
    });
  });

  it('parses the manage-slots and bring-fleet actions', () => {
    expect(parseEventButtonId('event_manageslots_abc123')).toEqual({
      action: 'manageslots',
      activityId: 'abc123',
    });
    expect(parseEventButtonId('event_bringfleet_abc123')).toEqual({
      action: 'bringfleet',
      activityId: 'abc123',
    });
  });

  it('parses the new "Ship & Crew" actions-panel trigger', () => {
    expect(parseEventButtonId('event_actions_abc123')).toEqual({
      action: 'actions',
      activityId: 'abc123',
    });
  });

  it('parses the clone action', () => {
    expect(parseEventButtonId('event_clone_abc123')).toEqual({
      action: 'clone',
      activityId: 'abc123',
    });
  });

  it('parses the remind-me action', () => {
    expect(parseEventButtonId('event_remindme_abc123')).toEqual({
      action: 'remindme',
      activityId: 'abc123',
    });
  });

  it('still parses existing actions', () => {
    expect(parseEventButtonId('event_join_xyz')).toEqual({ action: 'join', activityId: 'xyz' });
    expect(parseEventButtonId('event_joincrew_xyz')).toEqual({
      action: 'joincrew',
      activityId: 'xyz',
    });
  });

  it('returns null for unknown actions', () => {
    expect(parseEventButtonId('event_bogus_xyz')).toBeNull();
    expect(parseEventButtonId('not_an_event_button')).toBeNull();
  });

  it('preserves activity IDs containing underscores', () => {
    expect(parseEventButtonId('event_joinpassenger_a_b_c')).toEqual({
      action: 'joinpassenger',
      activityId: 'a_b_c',
    });
  });
});

describe('buildEventActionsRow', () => {
  it('renders the "Ship & Crew" trigger plus a personal "Remind Me" button', () => {
    const row = buildEventActionsRow('act-1');
    expect(row.components).toHaveLength(2);

    const trigger = row.components[0].toJSON();
    expect(trigger.custom_id).toBe('event_actions_act-1');
    expect(trigger.label).toBe('Ship & Crew');
    expect(trigger.style).toBe(ButtonStyle.Primary);

    const remind = row.components[1].toJSON();
    expect(remind.custom_id).toBe('event_remindme_act-1');
    expect(remind.label).toBe('Remind Me');
    expect(remind.style).toBe(ButtonStyle.Secondary);
  });
});

describe('buildEventActionPanelComponents', () => {
  it('groups contribute actions on row 1 and manage/leave/request on row 2', () => {
    const rows = buildEventActionPanelComponents('act-1');
    expect(rows).toHaveLength(2);

    const row1 = rows[0].components.map(c => c.toJSON().custom_id);
    expect(row1).toEqual([
      'event_bringship_act-1',
      'event_bringfleet_act-1',
      'event_joincrew_act-1',
      'event_joinpassenger_act-1',
    ]);

    const row2 = rows[1].components.map(c => c.toJSON().custom_id);
    expect(row2).toEqual([
      'event_manageslots_act-1',
      'event_removeship_act-1',
      'event_leavecrew_act-1',
      'event_leavepassenger_act-1',
      'event_requestship_act-1',
    ]);
  });

  it('exposes Bring Fleet inside the panel (no longer organizer-only)', () => {
    const ids = buildEventActionPanelComponents('act-1').flatMap(r =>
      r.components.map(c => c.toJSON().custom_id)
    );
    expect(ids).toContain('event_bringfleet_act-1');
  });

  it('exposes Manage Slots inside the panel so ship owners can reach it', () => {
    const ids = buildEventActionPanelComponents('act-1').flatMap(r =>
      r.components.map(c => c.toJSON().custom_id)
    );
    expect(ids).toContain('event_manageslots_act-1');
  });
});

describe('buildEventComponentRows', () => {
  it('includes the RSVP row and the Ship & Crew trigger by default (no manage row)', () => {
    const rows = buildEventComponentRows('act-1');
    expect(rows).toHaveLength(2);

    const rsvpIds = rows[0].components.map(c => c.toJSON().custom_id);
    expect(rsvpIds).toEqual([
      'event_join_act-1',
      'event_tentative_act-1',
      'event_decline_act-1',
      'event_leave_act-1',
    ]);

    const actionIds = rows[1].components.map(c => c.toJSON().custom_id);
    expect(actionIds).toEqual(['event_actions_act-1', 'event_remindme_act-1']);
  });

  it('appends the manage (edit/mirror/resync/clone/cancel) row when includeManage is set — no bring fleet or slots', () => {
    const rows = buildEventComponentRows('act-1', { includeManage: true });
    expect(rows).toHaveLength(3);
    const manageIds = rows[2].components.map(c => c.toJSON().custom_id);
    expect(manageIds).toEqual([
      'event_edit_act-1',
      'event_mirrorcreate_act-1',
      'event_mirrorresync_act-1',
      'event_clone_act-1',
      'event_cancel_act-1',
    ]);
    expect(manageIds).not.toContain('event_bringfleet_act-1');
    expect(manageIds).not.toContain('event_manageslots_act-1');
  });

  it('never exceeds Discord’s 5-row limit, and no row exceeds 5 buttons', () => {
    const rows = buildEventComponentRows('act-1', { includeManage: true });
    expect(rows.length).toBeLessThanOrEqual(5);
    for (const row of rows) {
      expect(row.components.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('buildEventButtons', () => {
  it('renders Decline with a neutral style so the red ❌ icon stays legible', () => {
    const decline = buildEventButtons('act-1')
      .components.map(c => c.toJSON())
      .find(c => c.custom_id === 'event_decline_act-1');
    // Grey (Secondary) instead of red (Danger) — a red icon on a red button blends.
    expect(decline?.style).toBe(ButtonStyle.Secondary);
    expect(decline?.emoji?.name).toBe('❌');
  });
});

describe('buildCancelButton (manage row)', () => {
  it('contains edit, mirror, resync, clone, and cancel — but not bring fleet or manage slots', () => {
    const ids = buildCancelButton('act-1').components.map(c => c.toJSON().custom_id);
    expect(ids).toEqual([
      'event_edit_act-1',
      'event_mirrorcreate_act-1',
      'event_mirrorresync_act-1',
      'event_clone_act-1',
      'event_cancel_act-1',
    ]);
    expect(ids).not.toContain('event_bringfleet_act-1');
    expect(ids).not.toContain('event_manageslots_act-1');
  });
});

describe('buildEventActionPanelComponents emoji', () => {
  it('uses a seat emoji for Join as Passenger', () => {
    const join = buildEventActionPanelComponents('act-1')
      .flatMap(r => r.components.map(c => c.toJSON()))
      .find(c => c.custom_id === 'event_joinpassenger_act-1');
    expect(join?.emoji?.name).toBe('💺');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
