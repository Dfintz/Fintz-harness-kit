jest.mock('../../../services/activity', () => ({
  ActivityService: jest.fn(),
  EventMirrorService: jest.fn(),
}));

jest.mock('../../../services/user/UserService', () => ({
  UserService: jest.fn(),
}));

jest.mock('../../embeds/eventsEmbeds', () => ({
  buildEventMirrorSubPanelEmbed: jest.fn(),
}));

jest.mock('../../embeds/mirroredEventMessage', () => ({
  buildMirroredEventComponents: jest.fn(),
  buildMirroredEventEmbed: jest.fn(),
}));

jest.mock('../../interactions/eventButtons', () => ({
  handleBringFleetSelect: jest.fn(),
  handleBringShipModal: jest.fn(),
  handleCrewSelectMenu: jest.fn(),
  handleEditEventModal: jest.fn(),
  handleEventButton: jest.fn(),
  handleFleetInviteResponse: jest.fn(),
  handleHangarPageSelect: jest.fn(),
  handleHangarShipSelect: jest.fn(),
  handleManageSlotsModal: jest.fn(),
  handleManageSlotsShipSelect: jest.fn(),
  handleNestShipSelect: jest.fn(),
  handlePassengerSelectMenu: jest.fn(),
  handleRemoveShipSelectMenu: jest.fn(),
  handleReqShipModal: jest.fn(),
  handleReqShipRoleSelect: jest.fn(),
  handleReqShipTypeSelect: jest.fn(),
}));

jest.mock('../../interactions/eventCreationWizard', () => ({
  handleWizardButton: jest.fn(),
  handleWizardModal: jest.fn(),
  handleWizardSelectMenu: jest.fn(),
  isWizardButtonId: jest.fn(() => false),
  isWizardModalId: jest.fn(() => false),
  isWizardSelectId: jest.fn(() => false),
}));

jest.mock('../../interactions/eventEditWizard', () => ({
  handleEditWizardButton: jest.fn(),
  handleEditWizardModal: jest.fn(),
  isEditWizardButtonId: jest.fn(() => false),
  isEditWizardModalId: jest.fn(() => false),
}));

jest.mock('../../mirrorSyncPublisher', () => ({
  publishMirrorRefresh: jest.fn(),
}));

jest.mock('../../utils/commandPanelBuilder', () => ({
  buildCommandPanel: jest.fn(),
  parsePanelCustomId: jest.fn(() => null),
  replyWithCommandPanel: jest.fn(),
}));

jest.mock('../../utils/guildContext', () => ({
  resolveOrgIdForGuild: jest.fn(),
}));

jest.mock('../eventHandlers', () => ({
  handleEventCreate: jest.fn(),
  handleEventList: jest.fn(),
}));

import { parseFleetInviteButtonId } from '../events';

describe('events fleet invite parser helper (C9)', () => {
  it('parses known fleet invite actions', () => {
    expect(parseFleetInviteButtonId('event_fleetjoinship_activity-1_fleet-1')).toEqual({
      action: 'joinship',
      activityId: 'activity-1',
      fleetId: 'fleet-1',
    });
    expect(parseFleetInviteButtonId('event_fleetjoinonly_activity-1_fleet-1')).toEqual({
      action: 'joinonly',
      activityId: 'activity-1',
      fleetId: 'fleet-1',
    });
    expect(parseFleetInviteButtonId('event_fleetdecline_activity-1_fleet-1')).toEqual({
      action: 'decline',
      activityId: 'activity-1',
      fleetId: 'fleet-1',
    });
  });

  it('keeps permissive parsing for extra params', () => {
    expect(parseFleetInviteButtonId('event_fleetjoinship_activity-1_fleet-1_extra')).toEqual({
      action: 'joinship',
      activityId: 'activity-1',
      fleetId: 'fleet-1',
    });
  });

  it.each([
    'event_fleetjoinship_activity-1',
    'event_fleetunknown_activity-1_fleet-1',
    'event_fleetdecline__fleet-1',
    'mirror_post',
  ])('returns null for unmatched id: %s', customId => {
    expect(parseFleetInviteButtonId(customId)).toBeNull();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
